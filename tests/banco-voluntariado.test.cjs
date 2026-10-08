const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('migration e RPCs de voluntariado em PostgreSQL isolado (fixture, não schema remoto)', async t => {
  const db = new PGlite();
  const v1 = '11111111-1111-4111-8111-111111111111';
  const v2 = '22222222-2222-4222-8222-222222222222';
  const ong = '33333333-3333-4333-8333-333333333333';
  async function papel(id, role = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
    if (role !== 'owner') await db.exec(`SET ROLE ${role}`);
  }
  async function valor(sql, args = []) {
    return (await db.query(sql, args)).rows[0]?.valor;
  }
  try {
    await db.exec(fs.readFileSync('tests/fixtures/base-voluntariado.sql', 'utf8'));
    for (const file of [
      '20260914120000_completa_modelo_dados.sql',
      '20260914121500_revoga_execucao_trigger_arrecadacao.sql',
      '20260914140000_seed_habilidades.sql',
    ]) {
      await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await db.exec(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;',
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/20260923120000_fluxo_voluntariado.sql', 'utf8'),
    );
    await db.exec(
      fs.readFileSync(
        'supabase/migrations/20260924120000_valida_seguranca_voluntariado.sql',
        'utf8',
      ),
    );
    await db.query(
      "INSERT INTO public.usuarios(id,nome,tipo_perfil) VALUES($1,'Voluntário A','VOLUNTARIO'),($2,'Voluntário B','VOLUNTARIO'),($3,'Gestão','ONG')",
      [v1, v2, ong],
    );
    await db.query(
      'INSERT INTO public.voluntarios(usuario_id,cpf,data_nascimento,profissao,disponibilidade_horarios) VALUES ($1,\'52998224725\',\'1990-01-01\',\'Educador\',\'[{"dia":"seg","periodo":"manha"}]\'),($2,\'11144477735\',\'1990-01-01\',\'Educador\',\'[{"dia":"seg","periodo":"manha"}]\')',
      [v1, v2],
    );
    await db.query(
      'INSERT INTO public.usuario_habilidades(usuario_id,habilidade_id) VALUES($1,1),($2,1)',
      [v1, v2],
    );
    const criar = async (titulo, data = "now() + interval '10 minutes'", vagas = 1) => {
      await papel(null, 'owner');
      return valor(
        `INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria) VALUES($1,'Atividade fictícia','TAREFA_ONG',$2,${data},$3,2) RETURNING id AS valor`,
        [titulo, ong, vagas],
      );
    };
    const a = await criar('Atividade de teste');
    let i1, i2;

    await t.test(
      'catálogo confirma RPCs protegidas, tabela privada e constraints herdadas',
      async () => {
        const funcoes = (
          await db.query(
            "SELECT p.oid, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'voluntariado_%'",
          )
        ).rows;
        assert.equal(funcoes.length, 11);
        for (const f of funcoes) {
          assert.equal(f.prosecdef, true);
          assert.ok(f.proconfig.includes('search_path=""'));
          assert.equal(
            await valor("SELECT has_function_privilege($1,$2::oid,'EXECUTE') AS valor", [
              'anon',
              f.oid,
            ]),
            false,
          );
          assert.equal(
            await valor("SELECT has_function_privilege($1,$2::oid,'EXECUTE') AS valor", [
              'authenticated',
              f.oid,
            ]),
            true,
          );
        }
        assert.equal(
          await valor(
            "SELECT relrowsecurity AS valor FROM pg_class WHERE oid='voluntariado_privado.tokens_checkin'::regclass",
          ),
          true,
        );
        assert.equal(
          await valor(
            "SELECT count(*)::int AS valor FROM pg_constraint WHERE conrelid='voluntariado_privado.tokens_checkin'::regclass AND contype='f'",
          ),
          2,
        );
        assert.equal(
          await valor(
            "SELECT count(*)::int AS valor FROM pg_constraint WHERE conrelid='public.inscricoes_atividades'::regclass AND contype='f'",
          ),
          3,
        );
        assert.equal(
          await valor(
            "SELECT count(*)::int AS valor FROM pg_constraint WHERE conrelid='public.inscricoes_atividades'::regclass AND contype='u'",
          ),
          1,
        );
      },
    );

    await t.test(
      'anônimo não executa RPCs; voluntário não lê token privado nem lista candidatos',
      async () => {
        await papel(null, 'anon');
        await assert.rejects(
          valor('SELECT public.voluntariado_elegibilidade() AS valor'),
          /permission denied/,
        );
        await papel(v1);
        await assert.rejects(
          db.query('SELECT * FROM voluntariado_privado.tokens_checkin'),
          /permission denied/,
        );
        await assert.rejects(
          valor('SELECT public.voluntariado_candidatos($1) AS valor', [a]),
          /Somente a gestão/,
        );
        await assert.rejects(
          db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [v1]),
          /tipo de perfil/,
        );
      },
    );
    await t.test(
      'perfil é salvo atomicamente, disponibilidade validada e elegibilidade recalculada',
      async () => {
        await papel(v1);
        const dados = {
          nome: 'Nome salvo',
          cpf: '52998224725',
          data_nascimento: '1990-01-01',
          profissao: 'Educador',
          disponibilidade_horarios: [{ dia: 'ter', periodo: 'tarde' }],
        };
        assert.equal(
          await valor('SELECT public.voluntariado_salvar_perfil($1,$2) AS valor', [dados, [1, 2]]),
          true,
        );
        await assert.rejects(
          valor('SELECT public.voluntariado_salvar_perfil($1,$2) AS valor', [
            { ...dados, nome: 'Não deve salvar', cpf: '11144477735' },
            [3],
          ]),
          /duplicate key/,
        );
        assert.equal(
          await valor('SELECT nome AS valor FROM public.usuarios WHERE id=$1', [v1]),
          'Nome salvo',
        );
        assert.equal(
          await valor(
            'SELECT count(*)::int AS valor FROM public.usuario_habilidades WHERE usuario_id=$1',
            [v1],
          ),
          2,
        );
        await assert.rejects(
          valor('SELECT public.voluntariado_salvar_perfil($1,$2) AS valor', [
            { ...dados, disponibilidade_horarios: [{ dia: 'seg', periodo: 'invalido' }] },
            [1],
          ]),
          /Disponibilidade inválida/,
        );
        assert.equal(
          await valor('SELECT public.voluntariado_salvar_perfil($1,$2) AS valor', [dados, []]),
          false,
        );
        await assert.rejects(
          valor('SELECT public.voluntariado_candidatar($1) AS valor', [a]),
          /Complete seu perfil/,
        );
        assert.equal(
          await valor('SELECT public.voluntariado_salvar_perfil($1,$2) AS valor', [dados, [1, 2]]),
          true,
        );
      },
    );
    await t.test(
      'criação obrigatoriamente pendente; duplicidade e autoaprovação bloqueadas',
      async () => {
        await papel(v1);
        i1 = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [a]);
        const detalhe = await valor('SELECT public.voluntariado_detalhe($1) AS valor', [a]);
        assert.equal(detalhe.inscricao.status_inscricao, 'PENDENTE');
        assert.equal(detalhe.inscricao.presenca_confirmada, false);
        await assert.rejects(
          valor('SELECT public.voluntariado_candidatar($1) AS valor', [a]),
          /já tem uma candidatura/,
        );
        await assert.rejects(
          valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [i1]),
          /Somente a gestão/,
        );
        await assert.rejects(
          db.query('UPDATE public.inscricoes_atividades SET presenca_confirmada=true WHERE id=$1', [
            i1,
          ]),
          /permission denied/,
        );
        await assert.rejects(
          db.query(
            "INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao,presenca_confirmada) VALUES($1,$2,'APROVADA',true)",
            [a, v1],
          ),
          /permission denied/,
        );
        await papel(v2);
        i2 = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [a]);
        await assert.rejects(
          valor('SELECT public.voluntariado_cancelar($1) AS valor', [i1]),
          /não encontrada/,
        );
      },
    );
    await t.test(
      'leitura restrita mesmo para autor voluntário e sob policy permissiva legada',
      async () => {
        const privada = await criar('Privacidade');
        await papel(null, 'owner');
        await db.query('UPDATE public.atividades SET autor_id=$1 WHERE id=$2', [v1, privada]);
        await db.query(
          'INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id) VALUES($1,$2)',
          [privada, v2],
        );
        await db.exec(
          'CREATE POLICY teste_leitura_legada ON public.inscricoes_atividades FOR SELECT TO PUBLIC USING (true); GRANT SELECT ON public.inscricoes_atividades TO anon;',
        );
        await papel(v1);
        assert.equal(
          await valor(
            'SELECT count(*)::int AS valor FROM public.inscricoes_atividades WHERE atividade_id=$1',
            [privada],
          ),
          0,
        );
        assert.ok(
          (await db.query('SELECT usuario_id FROM public.inscricoes_atividades')).rows.every(
            x => x.usuario_id === v1,
          ),
        );
        await papel(v2);
        assert.equal(
          await valor(
            'SELECT count(*)::int AS valor FROM public.inscricoes_atividades WHERE atividade_id=$1',
            [privada],
          ),
          1,
        );
        await papel(ong);
        assert.equal(
          await valor(
            'SELECT count(*)::int AS valor FROM public.inscricoes_atividades WHERE atividade_id=$1',
            [privada],
          ),
          1,
        );
        await papel(null, 'anon');
        assert.equal(
          await valor('SELECT count(*)::int AS valor FROM public.inscricoes_atividades'),
          0,
        );
        await papel(null, 'owner');
        await db.exec(
          'DROP POLICY teste_leitura_legada ON public.inscricoes_atividades; REVOKE SELECT ON public.inscricoes_atividades FROM anon;',
        );
        for (const role of ['anon', 'authenticated']) {
          assert.equal(
            await valor(
              "SELECT has_table_privilege($1,'public.inscricoes_atividades','TRUNCATE') AS valor",
              [role],
            ),
            false,
          );
        }
      },
    );
    await t.test(
      'políticas restritivas bloqueiam writes mesmo com grant adicional legado',
      async () => {
        await papel(null, 'owner');
        await db.exec('GRANT INSERT, UPDATE ON public.inscricoes_atividades TO authenticated');
        await papel(v1);
        await assert.rejects(
          db.query(
            "INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'APROVADA')",
            [a, v1],
          ),
          /row-level security/,
        );
        const res = await db.query(
          'UPDATE public.inscricoes_atividades SET atividade_id=999,presenca_confirmada=true WHERE id=$1 RETURNING id',
          [i1],
        );
        assert.equal(res.rows.length, 0);
        await papel(null, 'owner');
        await db.exec('REVOKE INSERT, UPDATE ON public.inscricoes_atividades FROM authenticated');
      },
    );
    await t.test(
      'recusa tem motivo e não pode ser redecidida; gestão não decide inscrição própria legada',
      async () => {
        const recusada = await criar('Recusa');
        await papel(v1);
        const id = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [recusada]);
        await papel(ong);
        await valor(
          "SELECT public.voluntariado_decidir($1,'RECUSADA','Disponibilidade incompatível') AS valor",
          [id],
        );
        await assert.rejects(
          valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [id]),
          /já foi decidida/,
        );
        await papel(v1);
        const detalhe = await valor('SELECT public.voluntariado_detalhe($1) AS valor', [recusada]);
        assert.equal(detalhe.inscricao.status_inscricao, 'RECUSADA');
        assert.equal(detalhe.inscricao.motivo_decisao, 'Disponibilidade incompatível');
        await assert.rejects(
          valor('SELECT public.voluntariado_cancelar($1) AS valor', [id]),
          /não pode mais ser cancelada/,
        );
        await papel(null, 'owner');
        const propria = await valor(
          'INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id) VALUES($1,$2) RETURNING id AS valor',
          [recusada, ong],
        );
        await papel(ong);
        await assert.rejects(
          valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [propria]),
          /própria candidatura/,
        );
      },
    );
    await t.test(
      'triagem respeita capacidade e redução de vagas; cancelamento libera vaga',
      async () => {
        await papel(ong);
        await valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [i1]);
        await assert.rejects(
          valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [i2]),
          /vagas já estão preenchidas/,
        );
        await assert.rejects(
          valor("SELECT public.voluntariado_decidir($1,'RECUSADA') AS valor", [i1]),
          /já foi decidida/,
        );
        await assert.rejects(
          db.query('DELETE FROM public.atividades WHERE id=$1', [a]),
          /não pode ser excluída/,
        );
        await papel(v1);
        await valor('SELECT public.voluntariado_cancelar($1) AS valor', [i1]);
        await assert.rejects(
          valor('SELECT public.voluntariado_cancelar($1) AS valor', [i1]),
          /não pode mais ser cancelada/,
        );
        await papel(ong);
        await valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [i2]);
        const b = await criar('Duas vagas', undefined, 2);
        await papel(v1);
        const b1 = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [b]);
        await papel(v2);
        const b2 = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [b]);
        await papel(ong);
        await valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [b1]);
        await valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [b2]);
        await assert.rejects(
          db.query('UPDATE public.atividades SET vagas_totais=1 WHERE id=$1', [b]),
          /menor que/,
        );
      },
    );
    await t.test(
      'check-in exige gestão emissora, aprovação, token atual e ausência de presença anterior',
      async () => {
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [a]),
          /Somente a gestão/,
        );
        await papel(ong);
        const velho = await valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [a]);
        const novo = await valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [a]);
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [a, novo.token]),
          /Somente participantes aprovados/,
        );
        await papel(v2);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [a, String(a)]),
          /inválido ou expirado/,
        );
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [a, velho.token]),
          /inválido ou expirado/,
        );
        await valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [a, novo.token]);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [a, novo.token]),
          /já foi confirmada/,
        );
        const itens = await valor('SELECT public.voluntariado_minhas_inscricoes() AS valor');
        const participacao = itens.find(x => x.atividade.id === a);
        assert.equal(participacao.inscricao.presenca_confirmada, true);
        assert.ok(participacao.inscricao.checkin_em);
        assert.equal(participacao.inscricao.carga_horaria_registrada, 2);
        assert.ok(itens.every(x => x.inscricao.usuario_id === v2));
        await assert.rejects(
          valor('SELECT public.voluntariado_cancelar($1) AS valor', [i2]),
          /não pode mais ser cancelada/,
        );
      },
    );
    await t.test(
      'atividade fechada/passada não recebe candidatura; tokens expiram e respeitam a janela',
      async () => {
        const futura = await criar('Fora da janela', "now() + interval '2 days'");
        await papel(ong);
        await assert.rejects(
          valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [futura]),
          /30 minutos/,
        );
        await valor("SELECT public.voluntariado_status_atividade($1,'ENCERRADA') AS valor", [
          futura,
        ]);
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_candidatar($1) AS valor', [futura]),
          /terminou/,
        );
        const passada = await criar('Passada', "now() - interval '3 hours'");
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_candidatar($1) AS valor', [passada]),
          /terminou/,
        );
        const exp = await criar('Expiração');
        await papel(v1);
        const ie = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [exp]);
        await papel(ong);
        await valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [ie]);
        const token = await valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [exp]);
        await papel(null, 'owner');
        await db.query(
          "UPDATE voluntariado_privado.tokens_checkin SET expira_em=now()-interval '1 second' WHERE atividade_id=$1",
          [exp],
        );
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [exp, token.token]),
          /inválido ou expirado/,
        );
      },
    );
    await t.test(
      'QR recusa pendente, recusado, token nulo, outra atividade e janela encerrada',
      async () => {
        const b = await criar('Limites QR');
        await papel(v1);
        const ib = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [b]);
        await papel(ong);
        const token = await valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [b]);
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [b, token.token]),
          /Somente participantes aprovados/,
        );
        await papel(ong);
        await valor("SELECT public.voluntariado_decidir($1,'RECUSADA') AS valor", [ib]);
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [b, token.token]),
          /Somente participantes aprovados/,
        );
        const c = await criar('Aprovado QR');
        await papel(v1);
        const ic = await valor('SELECT public.voluntariado_candidatar($1) AS valor', [c]);
        await papel(ong);
        await valor("SELECT public.voluntariado_decidir($1,'APROVADA') AS valor", [ic]);
        const atual = await valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [c]);
        await papel(v1);
        for (const invalido of [null, token.token]) {
          await assert.rejects(
            valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [c, invalido]),
            /inválido ou expirado/,
          );
        }
        await papel(null, 'owner');
        await db.query(
          "UPDATE public.atividades SET data_hora_prevista=now()-interval '3 hours' WHERE id=$1",
          [c],
        );
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [c, atual.token]),
          /não está aberto/,
        );
        await papel(ong);
        await assert.rejects(
          valor('SELECT public.voluntariado_gerar_checkin($1) AS valor', [c]),
          /30 minutos/,
        );
        await valor("SELECT public.voluntariado_status_atividade($1,'REALIZADA') AS valor", [c]);
        await papel(v1);
        await assert.rejects(
          valor('SELECT public.voluntariado_checkin($1,$2) AS valor', [c, atual.token]),
          /não está aberto/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
