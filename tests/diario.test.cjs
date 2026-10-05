const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const { PGlite }=require('@electric-sql/pglite');
test('Diário: migrations, RPCs e policies de Storage em fixture (sem serviço remoto)',async t=>{
 const db=new PGlite();
 const ong='33333333-3333-4333-8333-333333333333', vol='11111111-1111-4111-8111-111111111111';
 const val=async(sql,args=[])=>{
 if(sql.includes('public.diario_salvar(')||sql.includes('public.diario_status(')){
  const rev=(await db.query('SELECT revisao FROM public.diario_transparencia WHERE id=$1',[args[0]??999999])).rows[0]?.revisao??null;
  args=[...args,rev];
  sql=sql.replace('public.diario_salvar(','public.diario_salvar_revisao(').replace('public.diario_status(','public.diario_status_revisao(').replace(') AS v',()=>',$'+args.length+') AS v');
 }
 return (await db.query(sql,args)).rows[0]?.v;
 };
 async function papel(uid,role='authenticated'){
  await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid??'']);
  if(role!=='owner') await db.exec('SET ROLE '+role);
 }
 const salvar=(id=null,status='PUBLICADA',img=null)=>val("SELECT public.diario_salvar($1,'Relato institucional','Texto completo da atividade',$2,$3) AS v",[id,status,img]);
 let id,caminho;
 try{
  await db.exec(fs.readFileSync('tests/fixtures/base-voluntariado.sql','utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql','utf8'));
  for(const f of fs.readdirSync('supabase/migrations').filter(f=>/^\d{14}_.*\.sql$/.test(f)).sort()) await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'));
  await db.exec('GRANT SELECT ON public.usuarios TO authenticated');
  await db.query("INSERT INTO public.usuarios(id,nome,tipo_perfil) VALUES($1,'Gestão','ONG'),($2,'Voluntário','VOLUNTARIO')",[ong,vol]);
  await t.test('gestão cria sem imagem e edita preservando autor; voluntário apenas lê',async()=>{
   await papel(ong);id=await salvar();
   let p=await val('SELECT public.diario_detalhe($1) AS v',[id]);
   assert.equal(p.imagem_caminho,null);assert.equal(p.autor_id,ong);
   await val("SELECT public.diario_salvar($1,'Novo título','Relato editado','PUBLICADA',NULL) AS v",[id]);
   await papel(vol);p=await val('SELECT public.diario_detalhe($1) AS v',[id]);
   assert.equal(p.titulo,'Novo título');assert.equal(p.texto,'Relato editado');
   await assert.rejects(salvar(),/Somente a gestão/);
   await assert.rejects(salvar(id),/Somente a gestão/);
   await assert.rejects(val("SELECT public.diario_status($1,'OCULTA') AS v",[id]),/Somente a gestão/);
   await assert.rejects(db.query('DELETE FROM public.diario_transparencia WHERE id=$1',[id]),/permission denied/);
  });
  await t.test('ocultar retira do feed, detalhe e SELECT direto; gestão pode republicar',async()=>{
   await papel(ong);await val("SELECT public.diario_status($1,'OCULTA') AS v",[id]);
   await papel(vol);
   assert.equal(await val('SELECT public.diario_detalhe($1) AS v',[id]),null);
   assert.equal((await val('SELECT public.diario_listar() AS v')).some(p=>p.id===id),false);
   assert.equal((await db.query('SELECT * FROM public.diario_transparencia WHERE id=$1',[id])).rows.length,0);
   await papel(ong);assert.equal((await val('SELECT public.diario_detalhe($1) AS v',[id])).status,'OCULTA');
   await val("SELECT public.diario_status($1,'PUBLICADA') AS v",[id]);
   await assert.rejects(val("SELECT public.diario_status($1,'APROVADA') AS v",[id]),/Status inválido/);
   await assert.rejects(val("SELECT public.diario_status(999999,'OCULTA') AS v"),/não encontrada/);
  });
  await t.test('bucket privado, imagem existente e caminho do gestor são obrigatórios',async()=>{
   await papel(null,'owner');
   const b=(await db.query("SELECT * FROM storage.buckets WHERE id='diario-imagens'")).rows[0];
   assert.equal(b.public,false);assert.equal(Number(b.file_size_limit),5242880);
   assert.deepEqual(b.allowed_mime_types,['image/jpeg','image/png','image/webp']);
   await papel(ong);caminho=await val("SELECT public.diario_caminho('jpg') AS v");
   assert.ok(caminho.startsWith(ong+'/'));
   await assert.rejects(salvar(id,'PUBLICADA',caminho),/Imagem não encontrada/);
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)",[caminho]);
   await salvar(id,'PUBLICADA',caminho);
   assert.equal((await val('SELECT public.diario_detalhe($1) AS v',[id])).imagem_caminho,caminho);
   await assert.rejects(salvar(null,'PUBLICADA',vol+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'),/sua conta/);
   await assert.rejects(salvar(null,'PUBLICADA',caminho),/unique/);
  });
  await t.test('imagem publicada pode ser lida; oculta e upload solto não são públicos',async()=>{
   await papel(vol);
   assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='diario-imagens' AND name=$1",[caminho])).rows.length,1);
   await assert.rejects(val("SELECT public.diario_caminho('jpg') AS v"),/Somente a gestão/);
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)",[vol+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg']),/row-level security/);
   assert.equal((await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING name",[caminho])).rows.length,0);
   await papel(ong);
   await val("SELECT public.diario_status($1,'OCULTA') AS v",[id]);
   const solta=await val("SELECT public.diario_caminho('jpg') AS v");
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)",[solta]);
   await papel(vol);
   assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='diario-imagens'")).rows.length,0);
   await papel(ong);
   assert.equal((await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING name",[caminho])).rows.length,0);
   assert.equal((await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING name",[solta])).rows.length,1);
  });
  await t.test('substituição, remoção e falha preservam a referência correta; republicação restaura acesso',async()=>{
   await papel(ong);
   const antigo=caminho;
   const nova=await val("SELECT public.diario_caminho('jpg') AS v");
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)",[nova]);
   await salvar(id,'PUBLICADA',nova);
   await assert.rejects(salvar(id,'PUBLICADA',ong+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'),/Imagem não encontrada/);
   assert.equal((await val('SELECT public.diario_detalhe($1) AS v',[id])).imagem_caminho,nova);
   await papel(vol);
   assert.equal((await db.query('SELECT name FROM storage.objects WHERE name=$1',[antigo])).rows.length,0);
   assert.equal((await db.query('SELECT name FROM storage.objects WHERE name=$1',[nova])).rows.length,1);
   await papel(ong);
   await val("SELECT public.diario_status($1,'OCULTA') AS v",[id]);
   await papel(vol);
   assert.equal((await db.query('SELECT name FROM storage.objects WHERE name=$1',[nova])).rows.length,0);
   await papel(ong);
   await val("SELECT public.diario_status($1,'PUBLICADA') AS v",[id]);
   await papel(vol);
   assert.ok((await val('SELECT public.diario_listar() AS v')).some(p=>p.id===id));
   assert.equal((await db.query('SELECT name FROM storage.objects WHERE name=$1',[nova])).rows.length,1);
   await papel(ong);
   await salvar(id,'PUBLICADA',null);
   assert.equal((await val('SELECT public.diario_detalhe($1) AS v',[id])).imagem_caminho,null);
   // Não há limpeza automática: os dois objetos permanecem, privados para gestão.
   assert.equal((await db.query('SELECT name FROM storage.objects WHERE name IN ($1,$2)',[antigo,nova])).rows.length,2);
   await salvar(id,'OCULTA',antigo);
  });
  await t.test('FK exige autor válido; formatos e permissões RPC permanecem restritos',async()=>{
   await papel(ong);
   for(const ext of ['jpg','png','webp']) assert.ok((await val('SELECT public.diario_caminho($1) AS v',[ext])).endsWith('.'+ext));
   for(const ext of ['svg','html','pdf',null]) await assert.rejects(val('SELECT public.diario_caminho($1) AS v',[ext]),/Formato/);
   await papel(null,'owner');
   await assert.rejects(db.query("INSERT INTO public.diario_transparencia(titulo,autor_id) VALUES('Autor ausente','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"),/foreign key/);
   await assert.rejects(db.query('DELETE FROM public.usuarios WHERE id=$1',[ong]),/foreign key/);
   const funcoes=(await db.query("SELECT oid,proconfig FROM pg_proc WHERE proname LIKE 'diario_%'")).rows;
   assert.equal(funcoes.length,11);
   for(const f of funcoes){
    assert.ok(f.proconfig.includes('search_path=""'));
    assert.equal(await val("SELECT has_function_privilege('anon',$1::oid,'EXECUTE') AS v",[f.oid]),false);
   }
   assert.equal(await val("SELECT has_table_privilege('authenticated','public.diario_transparencia','TRUNCATE') AS v"),false);
  });
  await t.test('policies restritivas protegem contra grants/policies amplas existentes',async()=>{
   await papel(null,'owner');
   await db.exec("CREATE POLICY teste_storage_ampla ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true); GRANT INSERT,UPDATE,DELETE ON public.diario_transparencia TO authenticated; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated");
   await papel(vol);
   assert.equal((await db.query("SELECT * FROM storage.objects WHERE name=$1",[caminho])).rows.length,0);
   assert.equal((await db.query('UPDATE public.diario_transparencia SET titulo=$1 WHERE id=$2 RETURNING id',['Invasão',id])).rows.length,0);
   await assert.rejects(db.query("INSERT INTO public.diario_transparencia(titulo,autor_id) VALUES('Invasão',$1)",[vol]),/row-level security/);
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)",[vol+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg']),/row-level security/);
   await papel(ong);
   assert.equal((await db.query("UPDATE storage.objects SET name='outra.jpg' WHERE name=$1 RETURNING id",[caminho])).rows.length,0);
   await papel(null,'anon');
   assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='diario-imagens'")).rows.length,0);
   await assert.rejects(val('SELECT public.diario_listar() AS v'),/permission denied/);
  });
 }finally{await db.close();}
});
