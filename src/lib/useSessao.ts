import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';
import type {Usuario} from './tipos';
import {executarAuth,erroAuth} from './operacaoAuth';

export function useSessao(){
 const [sessao,setSessao]=useState<Session|null>(null),[perfil,setPerfil]=useState<Usuario|null>(null);
 const [carregando,setCarregando]=useState(true),[erroPerfil,setErroPerfil]=useState<string|null>(null);
 const usuarioAtual=useRef<string|null>(null),saindo=useRef(false),revisaoSessao=useRef(0);
 useEffect(()=>{
  let ativo=true,recebeuEvento=false;
  const aplicar=(s:Session|null)=>{
   if(!ativo)return;
   const id=s?.user.id??null;
   if(usuarioAtual.current!==id){revisaoSessao.current++;setPerfil(null);setErroPerfil(null);setCarregando(!!s);}
   usuarioAtual.current=id;setSessao(s);
   if(!s){setPerfil(null);setCarregando(false);}
  };
  const {data:escuta}=supabase.auth.onAuthStateChange((_evento,s)=>{recebeuEvento=true;aplicar(s);});
  void executarAuth(()=>supabase.auth.getSession(),()=>{}).then(({data})=>{if(!recebeuEvento)aplicar(data.session);})
   .catch(f=>{if(ativo&&!recebeuEvento){setErroPerfil(erroAuth(f));setCarregando(false);}});
  return()=>{ativo=false;revisaoSessao.current++;escuta.subscription.unsubscribe();};
 },[]);
 const carregarPerfil=useCallback(async(userId:string)=>{
  const versao=revisaoSessao.current;
  try{
   const {data}=await executarAuth(()=>supabase.from('usuarios').select('*').eq('id',userId).single(),()=>{});
   if(usuarioAtual.current!==userId||versao!==revisaoSessao.current)return;
   if(!data)throw new Error('Perfil não encontrado.');setPerfil(data);setErroPerfil(null);
  }catch(f){if(usuarioAtual.current===userId&&versao===revisaoSessao.current)setErroPerfil(erroAuth(f));throw f;}
 },[]);
 useEffect(()=>{
  if(!sessao?.user)return;
  let ativo=true;setCarregando(true);
  void carregarPerfil(sessao.user.id).catch(()=>{}).finally(()=>{if(ativo)setCarregando(false);});
  return()=>{ativo=false;};
 },[sessao?.user?.id,carregarPerfil]);
 async function sair(){
  if(saindo.current)return;
  const versao=revisaoSessao.current;
  try{await executarAuth(()=>supabase.auth.signOut(),v=>{saindo.current=v;});}
  catch(f){if(versao===revisaoSessao.current)Alert.alert('Não foi possível sair',erroAuth(f));}
 }
 return {sessao,perfil,carregando,erroPerfil,ehGestao:perfil?.tipo_perfil==='ONG',sair,
  recarregarPerfil:(propagarErro=false)=>sessao?.user?carregarPerfil(sessao.user.id).catch(f=>{if(propagarErro)throw f;}):Promise.resolve()};
}
