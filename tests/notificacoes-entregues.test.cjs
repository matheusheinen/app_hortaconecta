const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const v2 = '55555555-5555-4555-8555-555555555555';
const arq = f => fs.readFileSync(f, 'utf8');
const migration = arq('supabase/reconciliacao/20261101120000_notificacoes_entregues.sql');
const tokenA = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const tokenB = 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]';
const tokenG = 'ExpoPushToken[gggggggggggggggggggggg]';

test('Entregas de notificações por canal (B29), dados sintéticos', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated', anonimo = false) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      id ? JSON.stringify({ sub: id, is_anonymous: anonimo }) : '',
    ]);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const entregas = async () => {
    await role(null, 'owner');
    return (
      await db.query(
        'SELECT id, notificacao_id, usuario_id, canal, destino, status, tentativas, id_externo, erro FROM voluntariado_privado.notificacoes_entregues ORDER BY id',
      )
    ).rows;
  };
  const notificar = async (quem, tipo = 'CANDIDATURA_APROVADA') => {
    await role(null, 'owner');
    return scalar(
      "INSERT INTO public.notificacoes(usuario_id,tipo,titulo,corpo) VALUES($1,$2,'Título','Corpo') RETURNING id AS value",
      [quem, tipo],
    );
  };
  // Simula a passagem do tempo para a fila (retentativa e recibos).
  const envelhecer = async intervalo => {
    await role(null, 'owner');
    await db.query(
      `UPDATE voluntariado_privado.notificacoes_entregues SET proximo_em=proximo_em-$1::interval, enviado_em=enviado_em-$1::interval, reservado_em=reservado_em-$1::interval`,
      [intervalo],
    );
  };
  const reservar = async () => {
    await role(null, 'service_role');
    return (await db.query("SELECT * FROM public.notificacoes_entregues_reservar('{push}',100)"))
      .rows;
  };
  const concluir = async resultados => {
    await role(null, 'service_role');
    return scalar('SELECT public.notificacoes_entregues_concluir($1::jsonb) AS value', [
      JSON.stringify(resultados),
    ]);
  };

  try {
    await db.exec(arq('tests/fixtures/reconciliacao-mvp-remoto.sql'));
    await db.exec(arq('tests/fixtures/storage-diario.sql'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\'),($3,\'bia@example.invalid\',\'{"nome":"Bia"}\')',
      [v, g, v2],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    await db.exec(arq('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql'));
    await db.exec(arq('supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql'));
    await db.exec(arq('supabase/reconciliacao/20261026120000_dispositivos_push.sql'));
    await db.exec(arq('supabase/reconciliacao/20261026130000_notificacoes.sql'));
    await db.exec(
      arq('supabase/reconciliacao/20261026140000_notificacoes_cancelamento_pendentes.sql'),
    );
    await db.exec(migration);
    await assert.rejects(db.exec(migration), /não reaplicar/);
    await db.exec('ROLLBACK');

    await role(v);
    await db.query("SELECT public.push_registrar_token($1,'android')", [tokenA]);
    await db.query("SELECT public.push_registrar_token($1,'ios')", [tokenB]);
    await role(g);
    await db.query("SELECT public.push_registrar_token($1,'android')", [tokenG]);

    await t.test('tipo fora do catálogo é rejeitado', async () => {
      await assert.rejects(notificar(v, 'INVENTADO'), /notificacoes_tipo_fk/);
    });

    await t.test('uma entrega de push por aparelho; canais desligados não entram', async () => {
      const id = await notificar(v);
      const e = (await entregas()).filter(x => x.notificacao_id === id);
      assert.deepEqual(e.map(x => [x.canal, x.destino]).sort(), [
        ['push', tokenB],
        ['push', tokenA],
      ]);
      assert.ok(e.every(x => x.status === 'PENDENTE'));
    });

    await t.test('quem não tem aparelho só recebe no app', async () => {
      const id = await notificar(v2);
      assert.equal((await entregas()).filter(x => x.notificacao_id === id).length, 0);
    });

    await t.test('fila: reservar, enviar, falhar com retentativa e desistir', async () => {
      await role(null, 'owner');
      await db.query('DELETE FROM voluntariado_privado.notificacoes_entregues');
      await notificar(v);
      const lote = await reservar();
      assert.equal(lote.length, 2);
      assert.equal(lote[0].titulo, 'Título');
      assert.equal(lote[0].tipo, 'CANDIDATURA_APROVADA');
      assert.equal((await reservar()).length, 0, 'reservadas não saem de novo');

      const [a, b] = lote;
      assert.equal(
        await concluir([
          { id: a.id, ok: true, id_externo: 'ticket-a' },
          { id: b.id, ok: false, erro: 'HTTP 503' },
        ]),
        2,
      );
      let e = await entregas();
      assert.equal(e.find(x => x.id === a.id).status, 'ENVIADA');
      assert.equal(e.find(x => x.id === b.id).status, 'PENDENTE');
      assert.equal((await reservar()).length, 0, 'espera antes de tentar de novo');

      await envelhecer('2 minutes');
      const [denovo] = await reservar();
      assert.equal(denovo.id, b.id);
      assert.equal(denovo.tentativas, 2);
      await concluir([{ id: b.id, ok: false, erro: 'InvalidCredentials', definitivo: true }]);
      e = await entregas();
      assert.equal(e.find(x => x.id === b.id).status, 'FALHOU');
      assert.equal(await concluir([{ id: b.id, ok: true }]), 0, 'só conclui o que está reservado');
    });

    await t.test('reserva esquecida (function caiu) volta para a fila', async () => {
      await role(null, 'owner');
      await db.query('DELETE FROM voluntariado_privado.notificacoes_entregues');
      await notificar(g, 'CANDIDATURA_NOVA');
      assert.equal((await reservar()).length, 1);
      assert.equal((await reservar()).length, 0);
      await envelhecer('6 minutes');
      assert.equal((await reservar()).length, 1);
    });

    await t.test('DeviceNotRegistered no envio apaga o token', async () => {
      await role(null, 'owner');
      await db.query('DELETE FROM voluntariado_privado.notificacoes_entregues');
      await notificar(g, 'CANDIDATURA_NOVA');
      const [x] = await reservar();
      await concluir([
        {
          id: x.id,
          ok: false,
          erro: 'DeviceNotRegistered',
          definitivo: true,
          remover_destino: true,
        },
      ]);
      await role(null, 'owner');
      assert.equal(
        Number(
          await scalar(
            'SELECT count(*) AS value FROM voluntariado_privado.dispositivos_push WHERE token=$1',
            [tokenG],
          ),
        ),
        0,
      );
    });

    await t.test(
      'recibos: só depois da espera; ok vira ENTREGUE e erro remove o token',
      async () => {
        await role(null, 'owner');
        await db.query('DELETE FROM voluntariado_privado.notificacoes_entregues');
        await notificar(v);
        const [a, b] = await reservar();
        await concluir([
          { id: a.id, ok: true, id_externo: 'ticket-a' },
          { id: b.id, ok: true, id_externo: 'ticket-b' },
        ]);
        await role(null, 'service_role');
        assert.equal(
          (await db.query('SELECT * FROM public.notificacoes_recibos_pendentes()')).rows.length,
          0,
        );
        await envelhecer('16 minutes');
        await role(null, 'service_role');
        const pendentes = (await db.query('SELECT * FROM public.notificacoes_recibos_pendentes()'))
          .rows;
        assert.deepEqual(pendentes.map(p => p.id_externo).sort(), ['ticket-a', 'ticket-b']);
        await db.query('SELECT public.notificacoes_recibos_registrar($1::jsonb)', [
          JSON.stringify([
            { id: a.id, ok: true },
            { id: b.id, ok: false, erro: 'DeviceNotRegistered', remover_destino: true },
          ]),
        ]);
        const e = await entregas();
        assert.equal(e.find(x => x.id === a.id).status, 'ENTREGUE');
        assert.equal(e.find(x => x.id === b.id).status, 'FALHOU');
        await role(null, 'owner');
        const tokens = (
          await db.query('SELECT token FROM voluntariado_privado.dispositivos_push ORDER BY token')
        ).rows.map(r => r.token);
        assert.ok(tokens.includes(tokenA) && !tokens.includes(tokenB));
      },
    );

    await t.test('preferências: padrão ligado, desligar corta o push da categoria', async () => {
      await role(v);
      const antes = (await db.query('SELECT * FROM public.notificacoes_preferencias()')).rows;
      assert.deepEqual(antes, [
        { categoria: 'CONTRIBUICOES', canal: 'push', ativo: true },
        { categoria: 'VOLUNTARIADO', canal: 'push', ativo: true },
      ]);
      await db.query("SELECT public.notificacoes_salvar_preferencia('VOLUNTARIADO','push',false)");
      const depois = (await db.query('SELECT * FROM public.notificacoes_preferencias()')).rows;
      assert.equal(depois.find(p => p.categoria === 'VOLUNTARIADO').ativo, false);

      const id = await notificar(v, 'CANDIDATURA_APROVADA');
      assert.equal((await entregas()).filter(x => x.notificacao_id === id).length, 0);
      const outra = await notificar(v, 'CONTRIBUICAO_APROVADA');
      assert.equal((await entregas()).filter(x => x.notificacao_id === outra).length, 1);
    });

    await t.test('tipo crítico ignora o push desligado', async () => {
      const id = await notificar(v, 'ATIVIDADE_CANCELADA');
      const e = (await entregas()).filter(x => x.notificacao_id === id);
      assert.deepEqual(
        e.map(x => x.canal),
        ['push'],
        'e-mail e WhatsApp seguem fora enquanto o canal estiver desligado',
      );
    });

    await t.test(
      'ligar o canal de e-mail passa a gerar entrega para o e-mail da conta',
      async () => {
        await role(null, 'owner');
        await db.query(
          "UPDATE voluntariado_privado.notificacoes_canais SET ativo=true WHERE canal='email'",
        );
        const id = await notificar(v, 'ATIVIDADE_CANCELADA');
        const e = (await entregas()).filter(x => x.notificacao_id === id);
        assert.deepEqual(e.map(x => [x.canal, x.destino]).sort(), [
          ['email', 'ana@example.invalid'],
          ['push', tokenA],
        ]);
        await role(null, 'owner');
        await db.query(
          "UPDATE voluntariado_privado.notificacoes_canais SET ativo=false WHERE canal='email'",
        );
      },
    );

    await t.test('preferência inválida e convidado são rejeitados', async () => {
      await role(v);
      await assert.rejects(
        db.query("SELECT public.notificacoes_salvar_preferencia('VOLUNTARIADO','email',true)"),
        /inválida/,
        'canal desligado',
      );
      await assert.rejects(
        db.query("SELECT public.notificacoes_salvar_preferencia('OUTRA','push',true)"),
        /inválida/,
      );
      await role(v, 'authenticated', true);
      await assert.rejects(
        db.query("SELECT public.notificacoes_salvar_preferencia('VOLUNTARIADO','push',true)"),
        /Convidado/,
      );
    });

    await t.test('o app não lê a fila nem chama as RPCs do servidor', async () => {
      await role(v);
      await assert.rejects(
        db.query('SELECT * FROM voluntariado_privado.notificacoes_entregues'),
        /permission denied/,
      );
      await assert.rejects(
        db.query("SELECT * FROM public.notificacoes_entregues_reservar('{push}',10)"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("SELECT public.notificacoes_entregues_concluir('[]'::jsonb)"),
        /permission denied/,
      );
      await role(null, 'anon');
      await assert.rejects(
        db.query('SELECT * FROM public.notificacoes_preferencias()'),
        /permission denied/,
      );
    });

    await t.test('sem pg_net/Vault (ambiente local) o INSERT não falha', async () => {
      await role(null, 'owner');
      await db.query('SELECT voluntariado_privado.notificacoes_rotina()');
      assert.ok(await notificar(v2));
    });
  } finally {
    await db.close();
  }
});
