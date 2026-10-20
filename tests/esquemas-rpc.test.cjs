const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { base, esquemasDe } = require('./apoio/esquemas.cjs');

// Contrato entre o SQL aplicado no remoto e os esquemas Zod do app: cada RPC jsonb
// roda sobre o catálogo remoto sintético e a resposta passa pelo esquema real.

const voluntario = '11111111-1111-4111-8111-111111111111';
const gestao = '22222222-2222-4222-8222-222222222222';
const semCadastro = '33333333-3333-4333-8333-333333333333';

const voluntariado = esquemasDe('voluntariado');
const diario = esquemasDe('diario');
const oficinas = esquemasDe('oficinas');
const certificados = esquemasDe('certificados');
const validar = (esquema, dados) => base.validarResposta(esquema, dados, 'Resposta inválida.');

test('Esquemas Zod aceitam as respostas reais das RPCs', async t => {
  const db = new PGlite();
  const valor = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function como(id, papel = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (papel !== 'owner') await db.exec('SET ROLE ' + papel);
  }
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\'),($3,\'bia@example.invalid\',\'{"nome":"Bia"}\')',
      [voluntario, gestao, semCadastro],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [gestao]);
    await db.query(
      "UPDATE public.voluntarios SET cpf='12345678900',data_nascimento='1990-01-01',profissao='Educadora',disponibilidade_horarios='[{\"dia\":\"seg\",\"periodo\":\"manha\"}]',logradouro='Rua das Hortas',numero='10',cidade='Guaporé',cep='99200000',uf='RS' WHERE usuario_id=$1",
      [voluntario],
    );
    // Candidato sem linha em voluntarios: o LEFT JOIN traz profissão e disponibilidade nulas.
    await db.query('DELETE FROM public.voluntarios WHERE usuario_id=$1', [semCadastro]);
    await db.exec(
      "INSERT INTO public.habilidades(nome_habilidade,categoria) VALUES('Horta','Campo')",
    );
    await db.query('INSERT INTO public.usuario_habilidades VALUES($1,1)', [voluntario]);
    await db.exec(
      "INSERT INTO public.configuracao_instituicao(nome_curto,nome_completo,cidade,uf,endereco) VALUES('Horta','Instituição da Horta','Guaporé','RS','Endereço')",
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql', 'utf8'),
    );
    await db.exec(
      fs.readFileSync(
        'supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql',
        'utf8',
      ),
    );

    // Atividade em andamento: aceita check-in e gera certificado.
    const atividade = await valor(
      "INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria,status) VALUES('Plantio','Orientações','TAREFA_ONG',$1,now()-interval '5 minutes',3,2,'ABERTA') RETURNING id AS value",
      [gestao],
    );
    const inscricao = await valor(
      "INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'APROVADA') RETURNING id AS value",
      [atividade, voluntario],
    );
    await db.query(
      "INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'PENDENTE')",
      [atividade, semCadastro],
    );
    // Publicação legada, sem texto nem imagem.
    await db.query(
      "INSERT INTO public.diario_transparencia(titulo,descricao_curta,autor_id) VALUES('Diário antigo','Resumo',$1)",
      [gestao],
    );

    await t.test('voluntariado', async () => {
      await como(gestao);
      const detalheGestao = validar(
        voluntariado.esquemaDetalheAtividade,
        await valor('SELECT public.voluntariado_detalhe($1) AS value', [atividade]),
      );
      assert.equal(detalheGestao.inscricao, null);
      const candidatos = validar(
        voluntariado.esquemaCandidatos,
        await valor('SELECT public.voluntariado_candidatos($1) AS value', [atividade]),
      );
      const bia = candidatos.find(c => c.usuario_id === semCadastro);
      assert.equal(bia.profissao, null);
      assert.equal(bia.disponibilidade_horarios, null);
      assert.deepEqual(candidatos.find(c => c.usuario_id === voluntario).habilidades, ['Horta']);
      const qr = validar(
        voluntariado.esquemaTokenCheckin,
        await valor('SELECT public.voluntariado_gerar_checkin($1) AS value', [atividade]),
      );

      await como(voluntario);
      const detalhe = validar(
        voluntariado.esquemaDetalheAtividade,
        await valor('SELECT public.voluntariado_detalhe($1) AS value', [atividade]),
      );
      assert.equal(detalhe.inscricao.id, inscricao);
      // Colunas fora do tipo do app (ex.: vagas_ocupadas) são descartadas.
      assert.equal('vagas_ocupadas' in detalhe.atividade, false);
      const minhas = validar(
        voluntariado.esquemaMinhasInscricoes,
        await valor('SELECT public.voluntariado_minhas_inscricoes() AS value'),
      );
      assert.equal(minhas.length, 1);
      await db.query('SELECT public.voluntariado_checkin($1,$2)', [atividade, qr.token]);
    });

    await t.test('certificados', async () => {
      await como(voluntario);
      const antes = validar(
        certificados.esquemaListaCertificados,
        await valor('SELECT public.certificados_listar() AS value'),
      );
      assert.equal(antes.disponiveis.length, 1);
      const id = await valor('SELECT public.certificados_emitir($1) AS value', [inscricao]);
      const lista = validar(
        certificados.esquemaListaCertificados,
        await valor('SELECT public.certificados_listar() AS value'),
      );
      assert.equal(lista.emitidos.length, 1);
      validar(
        certificados.esquemaCertificado,
        await valor('SELECT public.certificados_detalhe($1) AS value', [id]),
      );
    });

    await t.test('diário', async () => {
      await como(gestao);
      const caminho = await valor("SELECT public.diario_caminho('jpg') AS value");
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)", [
        caminho,
      ]);
      const id = await valor(
        "SELECT public.diario_salvar_revisao(NULL,'Plantio coletivo','Relato do dia','PUBLICADA',$1,NULL) AS value",
        [caminho],
      );
      await como(voluntario);
      const lista = validar(
        diario.esquemaListaPublicacoes,
        await valor('SELECT public.diario_listar() AS value'),
      );
      assert.ok(lista.some(p => p.texto === null));
      validar(
        diario.esquemaPublicacao,
        await valor('SELECT public.diario_detalhe($1) AS value', [id]),
      );
    });

    await t.test('oficinas', async () => {
      await como(voluntario);
      const id = await valor(
        "SELECT public.oficinas_salvar(NULL,NULL,'Compostagem','Prática no canteiro','Solo','Aprender compostagem',60,NULL,NULL) AS value",
      );
      const lista = validar(
        oficinas.esquemaListaOficinas,
        await valor('SELECT public.oficinas_listar() AS value'),
      );
      assert.equal(lista[0].nome_autor, undefined);
      const detalhe = validar(
        oficinas.esquemaPropostaOficina,
        await valor('SELECT public.oficinas_detalhe($1) AS value', [id]),
      );
      assert.equal(detalhe.nome_autor, 'Ana');
    });
  } finally {
    await db.close();
  }
});

test('Esquemas Zod recusam respostas fora do contrato com mensagem para o usuário', () => {
  const publicacao = {
    revisao: 1,
    id: 1,
    titulo: 'T',
    texto: null,
    descricao_curta: null,
    status: 'PUBLICADA',
    imagem_caminho: null,
    data_publicacao: '2026-10-13T12:00:00Z',
    autor_id: 'a',
    atualizado_em: '2026-10-13T12:00:00Z',
  };
  const avisos = [];
  const original = console.warn;
  console.warn = mensagem => avisos.push(mensagem);
  try {
    assert.equal(validar(diario.esquemaPublicacao, publicacao).id, 1);
    assert.throws(() => validar(diario.esquemaPublicacao, { ...publicacao, status: 'RASCUNHO' }), {
      message: 'Resposta inválida.',
    });
    assert.throws(() => validar(diario.esquemaPublicacao, { ...publicacao, titulo: undefined }));
    assert.throws(() => validar(diario.esquemaListaPublicacoes, null));
    // O detalhe técnico fica no console, apontando o campo.
    assert.match(avisos[0], /status/);
  } finally {
    console.warn = original;
  }
});
