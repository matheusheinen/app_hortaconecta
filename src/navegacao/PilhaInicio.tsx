import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaInicioOng } from '../telas/TelaInicioOng';
import { TelaInicioVoluntario } from '../telas/TelaInicioVoluntario';
import { TelaOficinas,TelaDetalheOficina,TelaFormOficina } from '../telas/TelasOficinas';
import { TelaCertificados,TelaCertificado } from '../telas/TelasCertificados';
import { recursosPosMvp } from '../lib/escopoMvp';
export type ParametrosInicio={resumo:undefined;certificados:undefined;certificado:{id:string};oficinas:undefined;oficina:{id:number};propor:{id:number|null}};
const Pilha=createNativeStackNavigator<ParametrosInicio>();
export function PilhaInicio({gestao,usuarioId,nome,sair,atividades,materiais,diario,perfil,
 abrirAtividade,abrirMaterial,abrirPublicacao,minhasAtividades,minhasContribuicoes}:{
 gestao:boolean;usuarioId:string;nome:string;sair:()=>void;atividades:()=>void;materiais:()=>void;diario:()=>void;perfil:()=>void;
 abrirAtividade:(id:number)=>void;abrirMaterial:(id:number)=>void;abrirPublicacao:(id:number)=>void;
 minhasAtividades:()=>void;minhasContribuicoes:()=>void;
}){
 return <Pilha.Navigator screenOptions={{headerShown:false}}>
  <Pilha.Screen name="resumo">{({navigation})=>{
   const Inicio=gestao?TelaInicioOng:TelaInicioVoluntario;
   return <Inicio nome={nome} sair={sair} aoIrParaAtividades={atividades} aoIrParaMetas={materiais} aoIrParaDiario={diario}
    aoIrParaCertificados={recursosPosMvp.certificados?()=>navigation.navigate('certificados'):undefined}
    aoIrParaOficinas={recursosPosMvp.oficinas?()=>navigation.navigate('oficinas'):undefined}
    aoPerfil={perfil} abrirAtividade={abrirAtividade} abrirMaterial={abrirMaterial} abrirPublicacao={abrirPublicacao}
    minhasAtividades={minhasAtividades} minhasContribuicoes={minhasContribuicoes}/>;
  }}</Pilha.Screen>
  {recursosPosMvp.oficinas?<>
   <Pilha.Screen name="oficinas">{({navigation})=><TelaOficinas gestao={gestao} voltar={()=>navigation.goBack()}
    criar={()=>navigation.navigate('propor',{id:null})} abrir={id=>navigation.navigate('oficina',{id})}/>}</Pilha.Screen>
   <Pilha.Screen name="oficina">{({navigation,route})=><TelaDetalheOficina key={route.params.id} id={route.params.id} gestao={gestao}
    usuarioId={usuarioId} voltar={()=>navigation.goBack()} editar={()=>navigation.navigate('propor',route.params)}/>}</Pilha.Screen>
   {!gestao?<Pilha.Screen name="propor">{({navigation,route})=><TelaFormOficina id={route.params.id} voltar={()=>navigation.goBack()}
    pronto={id=>navigation.popTo('oficina',{id})} perfil={perfil}/>}</Pilha.Screen>:null}
  </>:null}
  {recursosPosMvp.certificados?<>
   <Pilha.Screen name="certificados">{({navigation})=><TelaCertificados gestao={gestao} voltar={()=>navigation.goBack()} abrir={id=>navigation.navigate('certificado',{id})}/>}</Pilha.Screen>
   <Pilha.Screen name="certificado">{({navigation,route})=><TelaCertificado key={route.params.id} id={route.params.id} voltar={()=>navigation.goBack()}/>}</Pilha.Screen>
  </>:null}
 </Pilha.Navigator>;
}
