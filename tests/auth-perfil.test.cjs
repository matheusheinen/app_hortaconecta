const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
function carregar(arquivo,dependencias={}){
 const m=new Module(arquivo);m.require=n=>{if(n in dependencias)return dependencias[n];throw new Error('Import inesperado: '+n);};
 m._compile(ts.transpileModule(fs.readFileSync(arquivo,'utf8'),{fileName:arquivo,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,arquivo);return m.exports;
}
const {executarAuth,erroAuth}=carregar('src/lib/operacaoAuth.ts');
test('Autenticação: login/logout sucesso e falhas sempre encerram loading',async()=>{
 for(const acao of [async()=>({error:null}),async()=>({error:new Error('Falha')}),async()=>{throw new Error('Falha');}]){
  const estados=[];try{await executarAuth(acao,v=>estados.push(v));}catch(e){assert.match(e.message,/Falha/);}
  assert.deepEqual(estados,[true,false]);
 }
 assert.equal(erroAuth({message:'Invalid login credentials'}),'E-mail ou senha incorretos.');
});
test('Autenticação: conexão sem resposta encerra loading por timeout',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const estados=[];
 const p=executarAuth(()=>new Promise(()=>{}),v=>estados.push(v));const rejeicao=assert.rejects(p,/demorou demais/);
 t.mock.timers.tick(30001);await rejeicao;assert.deepEqual(estados,[true,false]);
});
test('Perfil gestão: carga falhou impede RPC; falhas e falta de confirmação são propagadas',async()=>{
 let chamadas=0,resposta={data:true,error:null};
 const {salvarPerfilGestao}=carregar('src/lib/perfilGestao.ts',{'./supabase':{supabase:{rpc:async()=>{chamadas++;return resposta;}}}});
 await assert.rejects(salvarPerfilGestao(false,{}),/Recarregue/);assert.equal(chamadas,0);
 await salvarPerfilGestao(true,{});assert.equal(chamadas,1);
 resposta={data:null,error:new Error('Falha banco')};await assert.rejects(salvarPerfilGestao(true,{}),/Falha banco/);
 resposta={data:false,error:null};await assert.rejects(salvarPerfilGestao(true,{}),/não confirmou/);
});

test('Sessão: erro inicial, troca de conta, resposta antiga e falha/sucesso de logout (hooks simulados)',async()=>{
 const slots=[];let cursor=0,efeitos=[],evento,saidaFalha=true;const alertas=[],pendentes=[];
 const mudou=(a,b)=>!a||a.length!==b.length||a.some((x,i)=>x!==b[i]);
 const react={
  useState:inicial=>{const i=cursor++;if(!slots[i])slots[i]={v:inicial};return [slots[i].v,v=>{slots[i].v=typeof v==='function'?v(slots[i].v):v;}];},
  useRef:inicial=>{const i=cursor++;return slots[i]??(slots[i]={current:inicial});},
  useCallback:(f,d)=>{const i=cursor++;if(!slots[i]||mudou(slots[i].d,d))slots[i]={f,d};return slots[i].f;},
  useEffect:(f,d)=>{const i=cursor++;if(!slots[i]||mudou(slots[i].d,d)){slots[i]?.limpar?.();slots[i]={d};efeitos.push(()=>{slots[i].limpar=f();});}},
 };
 const supabase={auth:{
  onAuthStateChange:f=>{evento=f;return {data:{subscription:{unsubscribe(){}}}};},
  getSession:async()=>{throw new Error('Sessão indisponível');},
  signOut:async()=>{if(saidaFalha)return {error:new Error('Sem rede')};evento('SIGNED_OUT',null);return {error:null};},
 },from:()=>({select:()=>({eq:(_campo,id)=>({single:()=>new Promise(resolve=>pendentes.push({id,resolve}))})})})};
 const {useSessao}=carregar('src/lib/useSessao.ts',{'react':react,'react-native':{Alert:{alert:(...a)=>alertas.push(a)}},'./supabase':{supabase},'./operacaoAuth':{executarAuth,erroAuth},'./modoGestor':{alternarModoGestor:async()=>{},gestorPodeAlternarModo:async()=>false}});
 const render=()=>{cursor=0;const r=useSessao();const fila=efeitos;efeitos=[];fila.forEach(f=>f());return r;};
 const tick=()=>new Promise(r=>setImmediate(r));
 render();await tick();let r=render();assert.equal(r.carregando,false);assert.match(r.erroPerfil,/indisponível/);
 evento('SIGNED_IN',{user:{id:'a'}});render();await tick();
 evento('SIGNED_IN',{user:{id:'b'}});render();await tick();
 pendentes.find(p=>p.id==='a').resolve({data:{id:'a',nome:'Antigo'},error:null});await tick();assert.equal(render().perfil,null);
 pendentes.find(p=>p.id==='b').resolve({data:{id:'b',nome:'Atual',tipo_perfil:'ONG'},error:null});await tick();
 r=render();assert.equal(r.perfil.id,'b');assert.equal(r.carregando,false);
 await r.sair();assert.equal(render().sessao.user.id,'b');assert.equal(alertas.length,1);
 saidaFalha=false;await r.sair();r=render();assert.equal(r.sessao,null);assert.equal(r.perfil,null);assert.equal(r.carregando,false);
});

