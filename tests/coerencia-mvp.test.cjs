const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('Correções integradas: conflitos, histórico, certificados e perfil atômico', async t => {
  const db = new PGlite(),
    g = '33333333-3333-4333-8333-333333333333',
    v = '11111111-1111-4111-8111-111111111111';
  const val = async (s, p = []) => (await db.query(s, p)).rows[0]?.v;
  async function papel(id, role = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (role !== 'owner') await db.exec('SET ROLE ' + role);
  }
  const perfil = d => val('SELECT public.gestao_salvar_perfil($1) AS v', [JSON.stringify(d)]);
  try {
    await db.exec(fs.readFileSync('tests/fixtures/base-voluntariado.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    for (const f of fs
      .readdirSync('supabase/migrations')
      .filter(f => /^\d{14}_.*\.sql$/.test(f))
      .sort())
      await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
    await db.exec('GRANT SELECT ON public.usuarios,public.ongs TO authenticated');
    await db.query(
      "INSERT INTO public.usuarios(id,nome,tipo_perfil) VALUES($1,'Gestão','ONG'),($2,'Ana','VOLUNTARIO')",
      [g, v],
    );
    await t.test(
      'Diário: edição antiga não desfaz ocultação, recarga permite edição/republicação',
      async () => {
        await papel(g);
        const id = await val(
          "SELECT public.diario_salvar_revisao(NULL,'Título','Relato','PUBLICADA',NULL,NULL) AS v",
        );
        await db.query("SELECT public.diario_status_revisao($1,'OCULTA',1)", [id]);
        await assert.rejects(
          db.query(
            "SELECT public.diario_salvar_revisao($1,'Antigo','Relato antigo','PUBLICADA',NULL,1)",
            [id],
          ),
          /alterada por outra operação/,
        );
        let d = await val('SELECT public.diario_detalhe($1) AS v', [id]);
        assert.equal(d.status, 'OCULTA');
        assert.equal(d.titulo, 'Título');
        assert.equal(d.revisao, 2);
        await assert.rejects(
          db.query("SELECT public.diario_status_revisao($1,'PUBLICADA',1)", [id]),
          /alterada/,
        );
        await db.query(
          "SELECT public.diario_salvar_revisao($1,'Atualizado','Relato novo','OCULTA',NULL,2)",
          [id],
        );
        await db.query("SELECT public.diario_status_revisao($1,'PUBLICADA',3)", [id]);
        d = await val('SELECT public.diario_detalhe($1) AS v', [id]);
        assert.equal(d.status, 'PUBLICADA');
        assert.equal(d.revisao, 4);
        await assert.rejects(
          db.query("SELECT public.diario_salvar($1,'Antigo','Relato','PUBLICADA',NULL)", [id]),
          /permission denied/,
        );
        await assert.rejects(
          db.query("SELECT public.diario_status($1,'PUBLICADA')", [id]),
          /permission denied/,
        );
      },
    );
    await t.test(
      'histórico: antes edita; após qualquer candidatura bloqueia inclusive API direta',
      async () => {
        for (const status of ['PENDENTE', 'APROVADA', 'CANCELADA', 'RECUSADA']) {
          await papel(null, 'owner');
          const a = await val(
            "INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria) VALUES('Original','Relato','TAREFA_ONG',$1,now()-interval '10 minutes',5,2) RETURNING id AS v",
            [g],
          );
          await db.query("UPDATE public.atividades SET titulo='Título oficial' WHERE id=$1", [a]);
          const i = await val(
            'INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,$3) RETURNING id AS v',
            [a, v, status],
          );
          // Grants extras somente nesta fixture: comprova que o trigger não depende da RLS remota desconhecida.
          await db.exec('GRANT SELECT,UPDATE ON public.atividades TO authenticated');
          for (const uid of [g, v]) {
            await papel(uid);
            for (const campo of [
              "titulo='Alterado'",
              "data_hora_prevista=now()+interval '1 day'",
              'carga_horaria=5',
              "tipo='OFICINA_AUTORAL'",
              `autor_id='${v}'`,
            ]) {
              await assert.rejects(
                db.query('UPDATE public.atividades SET ' + campo + ' WHERE id=$1', [a]),
                /históricos/,
              );
            }
          }
          await papel(g);
          await db.query(
            "UPDATE public.atividades SET descricao='Orientação corrigida',vagas_totais=6 WHERE id=$1",
            [a],
          );
          if (status === 'APROVADA') {
            const qr = await val('SELECT public.voluntariado_gerar_checkin($1) AS v', [a]);
            await papel(v);
            await db.query('SELECT public.voluntariado_checkin($1,$2)', [a, qr.token]);
            await assert.rejects(
              db.query("UPDATE public.atividades SET titulo='Após presença' WHERE id=$1", [a]),
              /históricos/,
            );
            const c = await val('SELECT public.certificados_emitir($1) AS v', [i]);
            assert.equal(await val('SELECT public.certificados_emitir($1) AS v', [i]), c);
            const certificado = await val('SELECT public.certificados_detalhe($1) AS v', [c]);
            assert.equal(certificado.atividade, 'Título oficial');
            assert.equal(certificado.carga_horaria_prevista, 2);
            await assert.rejects(
              db.query("UPDATE public.certificados SET atividade='Forjada' WHERE id=$1", [c]),
              /permission denied/,
            );
          }
        }
      },
    );
    await t.test(
      'perfil gestão: ONG ausente é criada; atualização completa e falha reverte ambas as tabelas',
      async () => {
        await papel(g);
        assert.equal(
          await perfil({ nome: 'Conta nova', razao_social: 'Instituição', cnpj: null }),
          true,
        );
        assert.equal(
          await perfil({
            nome: 'Conta atualizada',
            razao_social: 'Instituição atualizada',
            chave_pix: 'legado preservado',
          }),
          true,
        );
        await assert.rejects(
          perfil({ nome: 'Não deve persistir', cnpj: 'inválido' }),
          /constraint/,
        );
        assert.equal(
          await val('SELECT nome AS v FROM public.usuarios WHERE id=$1', [g]),
          'Conta atualizada',
        );
        assert.equal(
          await val('SELECT razao_social AS v FROM public.ongs WHERE usuario_id=$1', [g]),
          'Instituição atualizada',
        );
        assert.equal(
          await val('SELECT chave_pix AS v FROM public.ongs WHERE usuario_id=$1', [g]),
          'legado preservado',
        );
        await papel(v);
        await assert.rejects(perfil({ nome: 'Indevido' }), /Sessão de gestão inválida/);
        await papel(null);
        await assert.rejects(perfil({ nome: 'Sem sessão' }), /Sessão de gestão inválida/);
        await papel(null, 'anon');
        await assert.rejects(perfil({ nome: 'Anônimo' }), /permission denied/);
      },
    );
  } finally {
    await db.close();
  }
});
