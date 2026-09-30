const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migrationPath='supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql';
const migration=fs.readFileSync(migrationPath,'utf8');
const v='11111111-1111-4111-8111-111111111111';
const g='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const third='44444444-4444-4444-8444-444444444444';

test('Reconciliação MVP sobre catálogo PUBLIC integral remoto, com dados sintéticos',async t=>{
 const db=new PGlite();
 const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0]?.value;
 async function role(id,r='authenticated'){
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);
  if(r!=='owner')await db.exec('SET ROLE '+r);
 }
 const activity=(title,when="now()+interval '1 day'",capacity=1)=>
  scalar("INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria,status) VALUES($1,'Orientações','TAREFA_ONG',$2,"+when+",$3,2,'ABERTA') RETURNING id AS value",[title,g,capacity]);
 try{
  await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql','utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql','utf8'));
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'ana@example.invalid','{\"nome\":\"Ana Voluntária\",\"tipo_perfil\":\"ONG\"}'),($2,'gestao@example.invalid','{\"nome\":\"Gestão\"}'),($3,'bia@example.invalid','{\"nome\":\"Bia Voluntária\"}'),($4,'carlos@example.invalid','{\"nome\":\"Carlos Voluntário\"}')",[v,g,other,third]);
  await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1",[g]);
  for(const [idx,id] of [v,other,third].entries()){
   await db.query("UPDATE public.voluntarios SET cpf=$2,data_nascimento='1990-01-01',profissao='Educador',disponibilidade_horarios='[{\"dia\":\"seg\",\"periodo\":\"manha\"}]',logradouro='Rua das Hortas',numero='10',cidade='Guaporé',cep='99200000',uf='RS' WHERE usuario_id=$1",[id,'1234567890'+idx]);
  }
  await db.exec("INSERT INTO public.habilidades(nome_habilidade,categoria) VALUES('Horta','Campo')");
  for(const id of [v,other,third])await db.query('INSERT INTO public.usuario_habilidades VALUES($1,1)',[id]);
  await db.query("INSERT INTO public.ongs(usuario_id,razao_social,chave_pix) VALUES($1,'Instituição antiga','legado-financeiro')",[g]);
  await db.exec("INSERT INTO public.configuracao_instituicao(nome_curto,nome_completo,cidade,uf,endereco) VALUES('Horta','Instituição da Horta','Guaporé','RS','Endereço público antigo')");
  const legacyActivity=await activity('Atividade antiga',"now()+interval '1 day'",2);
  await db.query('INSERT INTO public.atividade_habilidades VALUES($1,1)',[legacyActivity]);
  const legacyPending=await scalar("INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'PENDENTE') RETURNING id AS value",[legacyActivity,v]);
  const legacyApproved=await scalar("INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao,presenca_confirmada) VALUES($1,$2,'APROVADA',true) RETURNING id AS value",[legacyActivity,other]);
  const legacyDiary=await scalar("INSERT INTO public.diario_transparencia(titulo,descricao_curta,url_imagem,atividade_id,autor_id) VALUES('Diário antigo','Texto antigo','https://example.invalid/legado.jpg',$1,$2) RETURNING id AS value",[legacyActivity,g]);
  const legacyMeta=await scalar("INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Meta antiga','Financeiro legado','FINANCEIRA',100) RETURNING id AS value");
  await db.query("INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,status_validacao,validado_por,validado_em) VALUES($1,$2,25,'APROVADA',$3,now())",[legacyMeta,v,g]);
  const legacySnapshot=await scalar("SELECT jsonb_build_object('meta',(SELECT to_jsonb(m) FROM public.metas_demandas m WHERE id=$1),'financeiro',(SELECT jsonb_agg(to_jsonb(c)) FROM public.contribuicoes c),'habilidades',(SELECT jsonb_agg(to_jsonb(h)) FROM public.atividade_habilidades h),'config',(SELECT to_jsonb(c) FROM public.configuracao_instituicao c),'usuarios',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.usuarios u),'voluntarios',(SELECT jsonb_agg(to_jsonb(v) ORDER BY usuario_id) FROM public.voluntarios v),'ongs',(SELECT jsonb_agg(to_jsonb(o)) FROM public.ongs o)) AS value",[legacyMeta]);
  const profileDefinitions=async()=>scalar("SELECT jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),'acl',proacl::text) ORDER BY proname) AS value FROM pg_proc WHERE oid IN ('public.voluntariado_salvar_perfil(jsonb,bigint[])'::regprocedure,'public.voluntariado_elegibilidade()'::regprocedure,'public.gestao_salvar_perfil(jsonb)'::regprocedure,'voluntariado_privado.elegivel(uuid)'::regprocedure)");
  await t.test('SQL integral aplica sem reinterpretar endereço, RPCs de perfil ou registros legados',async()=>{
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[legacyActivity]),2);
   await db.exec(fs.readFileSync('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql','utf8'));
   const profiles=await profileDefinitions();
   await db.exec(migration);
   assert.deepEqual(await profileDefinitions(),profiles);
   assert.deepEqual(await scalar("SELECT jsonb_build_object('meta',(SELECT to_jsonb(m) FROM public.metas_demandas m WHERE id=$1),'financeiro',(SELECT jsonb_agg(to_jsonb(c)) FROM public.contribuicoes c),'habilidades',(SELECT jsonb_agg(to_jsonb(h)) FROM public.atividade_habilidades h),'config',(SELECT to_jsonb(c) FROM public.configuracao_instituicao c),'usuarios',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM public.usuarios u),'voluntarios',(SELECT jsonb_agg(to_jsonb(v) ORDER BY usuario_id) FROM public.voluntarios v),'ongs',(SELECT jsonb_agg(to_jsonb(o)) FROM public.ongs o)) AS value",[legacyMeta]),legacySnapshot);
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[legacyActivity]),1);
   assert.deepEqual(await scalar("SELECT jsonb_build_object('descricao',descricao_curta,'url',url_imagem,'texto',texto,'status',status) AS value FROM public.diario_transparencia WHERE id=$1",[legacyDiary]),{descricao:'Texto antigo',url:'https://example.invalid/legado.jpg',texto:null,status:'PUBLICADA'});
   for(const id of [legacyPending,legacyApproved]){
    const row=await scalar('SELECT to_jsonb(i) AS value FROM public.inscricoes_atividades i WHERE id=$1',[id]);
    assert.equal(row.checkin_em,null);assert.equal(row.carga_horaria_registrada,null);assert.equal(row.decidido_em,null);
   }
   assert.equal(await scalar("SELECT count(*)::int AS value FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='endereco'"),0);
  });
  await t.test('Grants remotos amplos fechados e privacidade própria/gestão preservada',async()=>{
   await role(null,'owner');
   for(const r of ['anon','authenticated']){
    const admin=await scalar("SELECT count(*)::int AS value FROM pg_tables WHERE schemaname='public' AND (has_table_privilege($1,format('%I.%I',schemaname,tablename),'TRUNCATE') OR has_table_privilege($1,format('%I.%I',schemaname,tablename),'REFERENCES') OR has_table_privilege($1,format('%I.%I',schemaname,tablename),'TRIGGER'))",[r]);
    assert.equal(admin,0);
   }
   const functions=(await db.query("SELECT oid::regprocedure::text AS name FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname~'^(voluntariado_|materiais_|diario_|oficinas_|certificados_)'")).rows;
   for(const {name} of functions){
    for(const r of ['anon','service_role'])assert.equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE') AS value",[r,name]),false,name+' '+r);
   }
   await role(v);
   assert.deepEqual((await db.query('SELECT id FROM public.usuarios ORDER BY id')).rows,[{id:v}]);
   assert.equal(await scalar('SELECT count(*)::int AS value FROM public.ongs'),0);
   assert.equal(await scalar('SELECT public.voluntariado_elegibilidade() AS value'),true);
   assert.equal(await scalar('SELECT tipo_perfil AS value FROM public.usuarios WHERE id=$1',[v]),'VOLUNTARIO');
   await assert.rejects(db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1",[v]),/tipo_perfil|tipo de perfil/);
   for(const table of ['usuarios','atividades','inscricoes_atividades','propostas_oficinas'])await assert.rejects(db.exec('TRUNCATE public.'+table),/permission denied/);
   await role(g);
   assert.equal(await scalar('SELECT count(*)::int AS value FROM public.usuarios'),4);
   assert.equal(await scalar('SELECT count(*)::int AS value FROM public.ongs'),1);
   await role(null,'anon');
   await assert.rejects(db.query('SELECT public.voluntariado_elegibilidade()'),/permission denied/);
  });
  await t.test('Fila excede vagas; aprovação limita capacidade; cancelar libera e histórico continua',async()=>{
   await role(null,'owner');const a=await activity('Triagem com uma vaga');
   const ids=[];
   for(const id of [v,other,third]){await role(id);ids.push(await scalar('SELECT public.voluntariado_candidatar($1) AS value',[a]));}
   await role(null,'owner');
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[a]),0);
   assert.equal(await scalar("SELECT count(*)::int AS value FROM public.inscricoes_atividades WHERE atividade_id=$1 AND status_inscricao='PENDENTE'",[a]),3);
   await role(g);
   await db.query("SELECT public.voluntariado_decidir($1,'APROVADA',NULL)",[ids[0]]);
   await assert.rejects(db.query("SELECT public.voluntariado_decidir($1,'APROVADA',NULL)",[ids[1]]),/vagas já estão preenchidas/);
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[a]),1);
   await assert.rejects(db.query("UPDATE public.atividades SET status='REALIZADA' WHERE id=$1",[a]),/operação de gestão/);
   await assert.rejects(db.query('UPDATE public.atividades SET vagas_ocupadas=0 WHERE id=$1',[a]),/mantido automaticamente/);
   await assert.rejects(db.query("UPDATE public.atividades SET titulo='Histórico alterado' WHERE id=$1",[a]),/históricos/);
   await assert.rejects(db.query('DELETE FROM public.atividades WHERE id=$1',[a]),/preservar o histórico/);
   await role(v);await db.query('SELECT public.voluntariado_cancelar($1)',[ids[0]]);
   await role(g);await db.query("SELECT public.voluntariado_decidir($1,'APROVADA',NULL)",[ids[1]]);
   await db.query("SELECT public.voluntariado_status_atividade($1,'ENCERRADA')",[a]);
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[a]),1);
   await assert.rejects(db.query("SELECT public.voluntariado_status_atividade($1,'REALIZADA')",[a]),/Aguarde o fim/);
   await role(null,'owner');
   await assert.rejects(db.query('UPDATE public.inscricoes_atividades SET usuario_id=$2 WHERE id=$1',[ids[2],g]),/Identidade e vínculos/);
   const removable=await activity('Manutenção de contador');
   const participation=await scalar("INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'APROVADA') RETURNING id AS value",[removable,v]);
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[removable]),1);
   await db.query('DELETE FROM public.inscricoes_atividades WHERE id=$1',[participation]);
   assert.equal(await scalar('SELECT vagas_ocupadas AS value FROM public.atividades WHERE id=$1',[removable]),0);
  });
  await t.test('Check-in e certificado operam nas funções novas; presença antiga não inventa horas',async()=>{
   await role(null,'owner');
   const a=await activity('Presença e certificado',"now()-interval '5 minutes'",2);
   const i=await scalar("INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'APROVADA') RETURNING id AS value",[a,v]);
   await role(g);const qr=await scalar('SELECT public.voluntariado_gerar_checkin($1) AS value',[a]);
   await role(v);
   await assert.rejects(db.query('SELECT public.voluntariado_checkin($1,$2)',[a,'inválido']),/inválido ou expirado/);
   await db.query('SELECT public.voluntariado_checkin($1,$2)',[a,qr.token]);
   await assert.rejects(db.query('SELECT public.voluntariado_checkin($1,$2)',[a,qr.token]),/já foi confirmada/);
   const c=await scalar('SELECT public.certificados_emitir($1) AS value',[i]);
   assert.equal(await scalar('SELECT public.certificados_emitir($1) AS value',[i]),c);
   const detail=await scalar('SELECT public.certificados_detalhe($1) AS value',[c]);
   assert.equal(detail.nome_voluntario,'Ana Voluntária');assert.equal(detail.instituicao,'Instituição da Horta');
   assert.equal(detail.carga_horaria_prevista,2);assert.equal(detail.atividade,'Presença e certificado');
   await role(other);await assert.rejects(db.query('SELECT public.certificados_detalhe($1)',[c]),/indisponível/);
   await assert.rejects(db.query('SELECT public.certificados_emitir($1)',[legacyApproved]),/necessária aprovação, check-in/);
  });
  await t.test('Materiais: contribuição/entrega e conclusão atômica com intents excedentes',async()=>{
   await role(g);const s=await scalar("SELECT public.materiais_salvar(NULL,'Sementes','Para plantar',5) AS value");
   await role(v);const c1=await scalar('SELECT public.materiais_contribuir($1,5) AS value',[s]);
   await role(other);const c2=await scalar('SELECT public.materiais_contribuir($1,3) AS value',[s]);
   await assert.rejects(db.query("SELECT public.materiais_decidir($1,'CONFIRMADA')",[c2]),/Somente a gestão/);
   await role(g);await db.query("SELECT public.materiais_decidir($1,'CONFIRMADA')",[c1]);
   const d=await scalar('SELECT public.materiais_detalhe($1) AS value',[s]);
   assert.equal(d.solicitacao.status,'CONCLUIDA');assert.equal(d.solicitacao.quantidade_recebida,5);
   assert.equal(d.contribuicoes.find(c=>c.id===c2).status,'CANCELADA');
   await role(v);assert.equal((await scalar('SELECT public.materiais_minhas() AS value')).length,1);
   await assert.rejects(db.query('UPDATE public.solicitacoes_materiais SET quantidade_recebida=0 WHERE id=$1',[s]),/permission denied/);
  });
  await t.test('Diário: RLS ocultação, revisão otimista e imagem privada',async()=>{
   await role(g);const path=await scalar("SELECT public.diario_caminho('jpg') AS value");
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)",[path]);
   const d=await scalar("SELECT public.diario_salvar_revisao(NULL,'Plantio coletivo','Relato do dia','PUBLICADA',$1,NULL) AS value",[path]);
   await role(v);assert.equal((await scalar('SELECT public.diario_detalhe($1) AS value',[d])).titulo,'Plantio coletivo');
   assert.equal(await scalar("SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='diario-imagens'"),1);
   await role(g);await db.query("SELECT public.diario_status_revisao($1,'OCULTA',1)",[d]);
   await assert.rejects(db.query("SELECT public.diario_salvar_revisao($1,'Antigo','Relato','PUBLICADA',NULL,1)",[d]),/alterada por outra operação/);
   await role(v);assert.equal(await scalar('SELECT public.diario_detalhe($1) AS value',[d]),null);
   assert.equal(await scalar("SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='diario-imagens'"),0);
   await role(g);await db.query("SELECT public.diario_status_revisao($1,'PUBLICADA',2)",[d]);
  });
  await t.test('Oficina: proposta privada, revisão obrigatória e decisão independente de calendário',async()=>{
   await role(null,'owner');const before=await scalar('SELECT count(*)::int AS value FROM public.atividades');
   await role(v);const p=await scalar("SELECT public.oficinas_salvar(NULL,NULL,'Compostagem','Prática no canteiro','Solo','Aprender compostagem',60,NULL,NULL) AS value");
   await role(other);assert.equal((await scalar('SELECT public.oficinas_listar() AS value')).length,0);
   await assert.rejects(db.query('SELECT public.oficinas_detalhe($1)',[p]),/indisponível/);
   await role(g);await assert.rejects(db.query("SELECT public.oficinas_decidir($1,0,'APROVADA',NULL)",[p]),/atualizada/);
   await db.query("SELECT public.oficinas_decidir($1,1,'APROVADA',NULL)",[p]);
   assert.equal((await scalar('SELECT public.oficinas_detalhe($1) AS value',[p])).status,'APROVADA');
   await role(null,'owner');assert.equal(await scalar('SELECT count(*)::int AS value FROM public.atividades'),before);
   // Aplicação duplicada deve falhar antes de qualquer alteração.
   await assert.rejects(db.exec(migration),/Contador ou validação|já existem/);
   await db.exec('ROLLBACK');
  });
 }finally{await db.close();}
});
