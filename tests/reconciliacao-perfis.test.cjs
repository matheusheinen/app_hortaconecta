const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const fixture=fs.readFileSync('tests/fixtures/reconciliacao-perfis-remoto.sql','utf8');
const migration=fs.readFileSync('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql','utf8');
const v='11111111-1111-4111-8111-111111111111';
const g='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';

test('Reconciliação de perfis: catálogo remoto recortado, dados exclusivamente sintéticos',async t=>{
 const db=new PGlite();
 const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].value;
 async function role(id,r='authenticated'){
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);
  if(r!=='owner')await db.exec('SET ROLE '+r);
 }
 const saveV=(data,skills=[1])=>scalar('SELECT public.voluntariado_salvar_perfil($1,$2) AS value',[JSON.stringify(data),skills]);
 const saveG=data=>scalar('SELECT public.gestao_salvar_perfil($1) AS value',[JSON.stringify(data)]);
 const dump=async()=>scalar("SELECT jsonb_build_object('u',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.usuarios t),'v',(SELECT jsonb_agg(to_jsonb(t) ORDER BY usuario_id) FROM public.voluntarios t),'o',(SELECT jsonb_agg(to_jsonb(t) ORDER BY usuario_id) FROM public.ongs t),'h',(SELECT jsonb_agg(to_jsonb(t) ORDER BY usuario_id,habilidade_id) FROM public.usuario_habilidades t)) AS value");
 try{
  await db.exec(fixture);
  await db.query('INSERT INTO auth.users VALUES($1),($2),($3)',[v,g,other]);
  await db.query("INSERT INTO public.usuarios(id,nome,tipo_perfil) VALUES($1,'Voluntário','VOLUNTARIO'),($2,'Gestão','ONG'),($3,'Outro','VOLUNTARIO')",[v,g,other]);
  await db.query(`INSERT INTO public.voluntarios(usuario_id,cpf,data_nascimento,profissao,disponibilidade_horarios,logradouro,numero,cidade) VALUES($1,'12345678901','1990-01-01','Educador','[{"dia":"seg","periodo":"manha"}]','Rua A','10','Cidade'),($2,'12345678902','1990-01-01','Educador','[{"dia":"seg","periodo":"manha"}]',null,null,null)`,[v,other]);
  await db.exec("INSERT INTO public.habilidades(nome_habilidade) VALUES('Educação'),('Horta')");
  await db.query('INSERT INTO public.usuario_habilidades VALUES($1,1),($2,1)',[v,other]);
  const before=await dump();
  const acl=await scalar("SELECT proacl::text AS value FROM pg_proc WHERE oid='public.perfil_completo(uuid)'::regprocedure");
  const oid=await scalar("SELECT 'public.perfil_completo(uuid)'::regprocedure::oid AS value");
  await t.test('SQL aplica atomicamente sem backfill, sem alterar linhas, ACL ou OID antigos',async()=>{
   await db.exec(migration);
   assert.deepEqual(await dump(),before);
   assert.equal(await scalar("SELECT proacl::text AS value FROM pg_proc WHERE oid='public.perfil_completo(uuid)'::regprocedure"),acl);
   assert.equal(await scalar("SELECT 'public.perfil_completo(uuid)'::regprocedure::oid AS value"),oid);
  });
  await t.test('ACL novas: anon/service_role sem execução, helpers inacessíveis ao cliente',async()=>{
   for(const fn of ['voluntariado_elegibilidade()','voluntariado_salvar_perfil(jsonb,bigint[])','gestao_salvar_perfil(jsonb)']){
    for(const r of ['anon','service_role'])assert.equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE') AS value",[r,'public.'+fn]),false);
    assert.equal(await scalar("SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS value",['public.'+fn]),true);
   }
   assert.equal(await scalar("SELECT has_schema_privilege('authenticated','voluntariado_privado','USAGE') AS value"),false);
   const funcs=(await db.query("SELECT oid,prosecdef,proconfig FROM pg_proc WHERE pronamespace='voluntariado_privado'::regnamespace")).rows;
   for(const f of funcs){
    assert.ok(f.proconfig.includes('search_path=""'));
    assert.equal(await scalar("SELECT has_function_privilege('authenticated',$1::oid,'EXECUTE') AS value",[f.oid]),false);
   }
  });
  await t.test('endereço mínimo e elegibilidade alinhada; gestão mantém ramo antigo',async()=>{
   await role(v);
   assert.equal(await scalar('SELECT public.perfil_completo() AS value'),true);
   assert.equal(await scalar('SELECT public.voluntariado_elegibilidade() AS value'),true);
   await role(other);
   assert.equal(await scalar('SELECT public.perfil_completo() AS value'),false);
   await role(g);
   assert.equal(await scalar('SELECT public.perfil_completo() AS value'),true);
   assert.equal(await scalar('SELECT public.voluntariado_elegibilidade() AS value'),false);
  });
  await t.test('atualização parcial preserva omitidos; habilidades deduplicadas e remoção explícita',async()=>{
   await role(v);
   assert.equal(await saveV({bairro:' Centro '},[1,2,2]),true);
   await role(null,'owner');
   const row=(await db.query('SELECT * FROM public.voluntarios WHERE usuario_id=$1',[v])).rows[0];
   assert.equal(row.logradouro,'Rua A');assert.equal(row.bairro,'Centro');
   assert.equal(await scalar('SELECT count(*)::int AS value FROM public.usuario_habilidades WHERE usuario_id=$1',[v]),2);
   await role(v);
   assert.equal(await saveV({numero:null}),false);
   assert.equal(await saveV({numero:'10'},[]),false);
   assert.equal(await saveV({},[1]),true);
  });
  await t.test('payload legado/administrativo, tipos incorretos e disponibilidade inválida rejeitados',async()=>{
   await role(v);
   for(const data of [{endereco:'Rua'}, {tipo_perfil:'ONG'},{id:other},{usuario_id:other},{cidade:3},{nome:null},null,[],
    {disponibilidade_horarios:null},{disponibilidade_horarios:[1]},{disponibilidade_horarios:[{dia:'seg',periodo:'manha'},{dia:'seg',periodo:'manha'}]},
    {disponibilidade_horarios:[{dia:'seg',periodo:'manha',extra:true}]}]){
    await assert.rejects(saveV(data),/Contrato|Campo|Formato|Nome|objeto|Disponibilidade/);
   }
   await assert.rejects(saveV({},null),/Habilidades/);
   await assert.rejects(saveV({},[999]),/Habilidades/);
   await assert.rejects(saveV({},[null]),/Habilidades/);
  });
  await t.test('falha no segundo UPDATE reverte usuário e vínculos; CPF duplicado também',async()=>{
   await role(null,'owner');const initial=await dump();
   await role(v);
   await assert.rejects(saveV({nome:'Não persistir',cep:'abc'},[2]),/check constraint/);
   await assert.rejects(saveV({nome:'Não persistir',cpf:'12345678902'}),/unique constraint/);
   await role(null,'owner');assert.deepEqual(await dump(),initial);
  });
  await t.test('ONG ausente: falha reverte criação e usuário; sucesso cria somente uma linha',async()=>{
   await role(g);
   await assert.rejects(saveG({nome:'Não persistir',cnpj:'inválido'}),/check constraint/);
   await role(null,'owner');
   assert.equal(await scalar('SELECT count(*)::int AS value FROM public.ongs WHERE usuario_id=$1',[g]),0);
   assert.equal(await scalar('SELECT nome AS value FROM public.usuarios WHERE id=$1',[g]),'Gestão');
   await role(g);
   assert.equal(await saveG({nome:'Instituição',razao_social:'Instituição Legal'}),true);
   assert.equal(await saveG({telefone:'11999999999'}),true);
   await role(null,'owner');
   assert.equal(await scalar('SELECT count(*)::int AS value FROM public.ongs WHERE usuario_id=$1',[g]),1);
   assert.equal(await scalar('SELECT razao_social AS value FROM public.ongs WHERE usuario_id=$1',[g]),'Instituição Legal');
  });
  await t.test('PIX legado omitido preservado; erro em complemento existente reverte usuário',async()=>{
   await role(null,'owner');
   await db.query("UPDATE public.ongs SET chave_pix='legado',nome_beneficiario_pix='Beneficiário' WHERE usuario_id=$1",[g]);
   await role(g);await saveG({nome:'Gestão atualizada'});
   await assert.rejects(saveG({nome:'Não persistir',whatsapp:'inválido'}),/check constraint/);
   await role(null,'owner');
   assert.equal(await scalar('SELECT chave_pix AS value FROM public.ongs WHERE usuario_id=$1',[g]),'legado');
   assert.equal(await scalar('SELECT nome_beneficiario_pix AS value FROM public.ongs WHERE usuario_id=$1',[g]),'Beneficiário');
   assert.equal(await scalar('SELECT nome AS value FROM public.usuarios WHERE id=$1',[g]),'Gestão atualizada');
  });
  await t.test('sessão ausente, conta inexistente, papel errado e acesso direto a helpers negados',async()=>{
   await role(null);
   await assert.rejects(saveG({}),/Sessão/);await assert.rejects(saveV({}),/Sessão/);
   assert.equal(await scalar('SELECT public.voluntariado_elegibilidade() AS value'),false);
   await role('44444444-4444-4444-8444-444444444444');
   await assert.rejects(saveV({}),/Sessão/);
   await role(v);await assert.rejects(saveG({}),/Sessão/);
   await assert.rejects(db.query('SELECT voluntariado_privado.elegivel($1)',[other]),/permission denied/);
   await role(g);await assert.rejects(saveV({}),/Sessão/);
   await role(null,'anon');await assert.rejects(saveG({}),/permission denied/);
  });
  await t.test('perfis antigos com disponibilidade/profissão inválidas ficam inelegíveis sem correção automática',async()=>{
   await role(null,'owner');
   await db.query("UPDATE public.voluntarios SET profissao=' ',disponibilidade_horarios='{}' WHERE usuario_id=$1",[v]);
   await role(v);assert.equal(await scalar('SELECT public.perfil_completo() AS value'),false);
   assert.equal(await saveV({profissao:'Educador',disponibilidade_horarios:[{dia:'ter',periodo:'tarde'}]}),true);
  });
  await t.test('segunda aplicação aborta explicitamente sem substituir objetos',async()=>{
   await role(null,'owner');
   await assert.rejects(db.exec(migration),/objetos de perfil já existem/);
   await db.exec('ROLLBACK');
  });
 }finally{await db.close();}
});

test('Preflight rejeita base antiga, falta de constraints, drift da função e tipos incompatíveis',async()=>{
 for(const change of [
  'ALTER TABLE public.usuarios ADD COLUMN endereco text',
  'ALTER TABLE public.ongs DROP CONSTRAINT ongs_pkey',
  'ALTER TABLE public.voluntarios ALTER COLUMN numero TYPE integer USING null',
  'CREATE OR REPLACE FUNCTION public.perfil_completo(uid uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql AS $$SELECT true$$'
 ]){
  const db=new PGlite();
  try{
   await db.exec(fixture);await db.exec(change);
   await assert.rejects(db.exec(migration),/Pré-condição/);
   await db.exec('ROLLBACK');
   assert.equal((await db.query("SELECT to_regnamespace('voluntariado_privado') AS n")).rows[0].n,null);
  }finally{await db.close();}
 }
});
