import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Botao, Campo, Aviso } from '../componentes/Ui';
import { CartaoFluxo, TelaFluxoVoluntariado as TelaFluxo } from '../componentes/TelaFluxoVoluntariado';
import { ImagemDiario } from '../componentes/ImagemDiario';
import { detalheDiario, listarDiario, salvarDiario, statusDiario } from '../lib/diario';
import { imagemJpeg } from '../lib/regrasDiario';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { mensagemErro } from '../lib/voluntariado';
import { tipo } from '../lib/tema';
import type { Publicacao } from '../lib/diario.types';

function DataPublicacao({ p }: { p: Publicacao }) {
 return <Text style={tipo.apoio}>Gestão da instituição · {new Date(p.data_publicacao).toLocaleDateString('pt-BR')}{p.status === 'OCULTA' ? ' · Oculta' : ''}</Text>;
}
export function TelaDiario({ gestao, voltar, abrir, criar }: {
 gestao: boolean; voltar: () => void; abrir: (id: number) => void; criar: () => void;
}) {
 const { dados, erro, carregando, carregar } = useDadosVoluntariado(listarDiario);
 return <TelaFluxo titulo="Diário de Transparência" voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
  {gestao ? <Botao titulo="Criar publicação" onPress={criar} /> : null}
  {dados?.length === 0 ? <Text style={tipo.apoio}>Nenhuma publicação disponível no momento.</Text> : null}
  {dados?.map(p => <CartaoFluxo key={p.id}>
   {p.imagem_caminho ? <ImagemDiario caminho={p.imagem_caminho} /> : null}
   <Text style={tipo.secao}>{p.titulo}</Text><DataPublicacao p={p} />
   <Text style={tipo.corpo} numberOfLines={3}>{p.texto ?? p.descricao_curta ?? 'Relato não informado.'}</Text>
   <Botao titulo="Ler publicação" variante="contorno" onPress={() => abrir(p.id)} />
  </CartaoFluxo>)}
 </TelaFluxo>;
}
export function TelaDetalheDiario({ id, gestao, voltar, editar }: {
 id: number; gestao: boolean; voltar: () => void; editar: () => void;
}) {
 const { dados, erro, carregando, carregar } = useDadosVoluntariado(useCallback(() => detalheDiario(id), [id]));
 const [erroAcao, setErroAcao] = useState<string | null>(null);
 const [ocupado, setOcupado] = useState(false);
 const trava = useRef(false);
 async function mudar() {
  if(!dados || trava.current) return;
  trava.current=true; setOcupado(true); setErroAcao(null);
  try { await statusDiario(id, dados.status === 'PUBLICADA' ? 'OCULTA' : 'PUBLICADA', dados.revisao); await carregar(); }
  catch(f) { setErroAcao(mensagemErro(f)); }
  finally { trava.current=false; setOcupado(false); }
 }
 return <TelaFluxo titulo="Publicação" voltar={voltar} erro={erroAcao ?? erro} carregando={carregando}
  atualizar={() => { setErroAcao(null); void carregar(); }}>
  {dados ? <>
   <Text style={tipo.titulo}>{dados.titulo}</Text><DataPublicacao p={dados} />
   {dados.imagem_caminho ? <ImagemDiario caminho={dados.imagem_caminho} /> : null}
   <Text style={tipo.corpo}>{dados.texto ?? dados.descricao_curta ?? 'Relato não informado.'}</Text>
   {gestao ? <>
    <Botao titulo="Editar publicação" onPress={editar} desabilitado={ocupado} />
    <Botao titulo={dados.status === 'PUBLICADA' ? 'Ocultar publicação' : 'Publicar novamente'} variante="contorno" carregando={ocupado}
     onPress={() => Alert.alert('Alterar visibilidade?', dados.status === 'PUBLICADA' ? 'A publicação deixará de aparecer para a comunidade.' : 'A publicação ficará visível para usuários autenticados.',
      [{ text: 'Voltar', style: 'cancel' }, { text: 'Confirmar', onPress: () => { void mudar(); } }])} />
   </> : null}
  </> : null}
 </TelaFluxo>;
}
export function TelaFormDiario({ id, voltar }: { id: number | null; voltar: () => void }) {
 const { dados, erro, carregando, carregar } = useDadosVoluntariado(useCallback(async () => id === null ? null : detalheDiario(id), [id]));
 return <TelaFluxo titulo={id === null ? 'Criar publicação' : 'Editar publicação'} voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
  {!erro && !carregando ? <Formulario key={dados?.atualizado_em ?? 'nova'} p={dados} voltar={voltar} recarregar={carregar} /> : null}
 </TelaFluxo>;
}
function Formulario({ p, voltar, recarregar }: { p: Publicacao | null; voltar: () => void; recarregar: () => Promise<void> }) {
 const [titulo,setTitulo]=useState(p?.titulo ?? '');
 const [texto,setTexto]=useState(p?.texto ?? p?.descricao_curta ?? '');
 const [status,setStatus]=useState<'PUBLICADA'|'OCULTA'>(p?.status ?? 'PUBLICADA');
 const [caminho,setCaminho]=useState(p?.imagem_caminho ?? null);
 const [foto,setFoto]=useState<{ uri: string; base64: string } | null>(null);
 const [erro,setErro]=useState<string | null>(null);
 const [ocupado,setOcupado]=useState(false);
 const trava=useRef(false), montado=useRef(true);
 useEffect(() => { montado.current=true; return () => { montado.current=false; }; },[]);
 async function escolher() {
  if(trava.current) return;
  trava.current=true; setOcupado(true); setErro(null);
  try {
   const resultado=await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], quality:0.8, base64:true, exif:false, allowsMultipleSelection:false });
   if(resultado.canceled || !montado.current) return;
   const asset=resultado.assets[0];
   if(!asset.base64) throw new Error('Não foi possível ler a imagem. Escolha outra foto.');
   imagemJpeg(asset.base64);
   setFoto({uri:asset.uri,base64:asset.base64});
  } catch(f) { if(montado.current) setErro(mensagemErro(f)); }
  finally { trava.current=false; if(montado.current) setOcupado(false); }
 }
 async function salvar() {
  if(trava.current) return;
  trava.current=true;setOcupado(true);setErro(null);
  try {
   await salvarDiario({revisao:p?.revisao ?? null,id:p?.id ?? null,titulo,texto,status,imagem:caminho,base64:foto?.base64 ?? null});
   if(montado.current) voltar();
  } catch(f) { if(montado.current) setErro(mensagemErro(f)); }
  finally { trava.current=false; if(montado.current) setOcupado(false); }
 }
 return <>
  {erro ? <><Aviso mensagem={erro} /><Botao titulo="Recarregar dados (descartar edição)" onPress={()=>{void recarregar();}} /></> : null}
  <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} maxLength={120} editable={!ocupado} />
  <Campo rotulo="Relato da instituição" value={texto} onChangeText={setTexto} multiline maxLength={20000} editable={!ocupado}
   style={{ minHeight:160,textAlignVertical:'top' }} />
  <Text style={tipo.apoio}>Imagem opcional, até 5 MiB. Publique registros institucionais das atividades.</Text>
  {foto ? <Image source={{uri:foto.uri}} style={{height:220,width:'100%',borderRadius:10}} accessibilityLabel="Prévia da imagem selecionada" /> :
   caminho ? <ImagemDiario caminho={caminho} /> : <Text style={tipo.apoio}>Publicação sem imagem.</Text>}
  <Botao titulo={foto || caminho ? 'Substituir imagem' : 'Adicionar imagem'} variante="contorno" desabilitado={ocupado} onPress={() => {void escolher();}} />
  {foto || caminho ? <Botao titulo="Remover imagem da publicação" variante="contorno" desabilitado={ocupado} onPress={() => {setFoto(null);setCaminho(null);}} /> : null}
  <Text style={tipo.corpo}>Visibilidade: {status === 'PUBLICADA' ? 'Publicada para usuários autenticados' : 'Oculta, somente gestão'}</Text>
  <Botao titulo={status === 'PUBLICADA' ? 'Manter oculta' : 'Publicar para usuários autenticados'} variante="contorno" desabilitado={ocupado}
   onPress={() => setStatus(status === 'PUBLICADA' ? 'OCULTA' : 'PUBLICADA')} />
  <Botao titulo={status === 'PUBLICADA' ? 'Salvar e publicar' : 'Salvar oculta'} carregando={ocupado} onPress={() => {void salvar();}} />
 </>;
}
