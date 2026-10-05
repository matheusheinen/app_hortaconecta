import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import type { Usuario } from '../lib/tipos';
import { apenasDigitos, validarCnpj, validarTelefone } from '../lib/validadores';
import { mascararCnpj, mascararTelefone } from '../lib/mascaras';
import { Aviso, Botao, Campo } from '../componentes/Ui';
import { mensagemErro } from '../lib/voluntariado';
import { salvarPerfilGestao } from '../lib/perfilGestao';
import { CampoData } from '../componentes/CampoData';

type Props = {
  perfil: Usuario;
  sair: () => void;
  recarregarPerfil: (propagarErro?: boolean) => Promise<void>;
};

export function TelaPerfilOng({ perfil, sair, recarregarPerfil }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [cargaValida, setCargaValida] = useState(false);
  const sequencia=useRef(0);

  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(mascararTelefone(perfil.telefone ?? ''));
  const [instagram, setInstagram] = useState(perfil.perfil_instagram ?? '');
  const [descricao, setDescricao] = useState(perfil.descricao ?? '');

  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [dataCriacao, setDataCriacao] = useState('');
  const [responsavelLegal, setResponsavelLegal] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [nomeBeneficiarioPix, setNomeBeneficiarioPix] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const carregar = useCallback(async () => {
    const atual=++sequencia.current;
    setCarregando(true);setErro(null);setCargaValida(false);setSucesso(false);
    try {
      const [u,o]=await Promise.all([
        supabase.from('usuarios').select('*').eq('id',perfil.id).single(),
        supabase.from('ongs').select('*').eq('usuario_id',perfil.id).maybeSingle(),
      ]);
      if(atual!==sequencia.current)return;
      if(u.error)throw u.error;if(o.error)throw o.error;
      setNome(u.data.nome);setTelefone(mascararTelefone(u.data.telefone??''));
      setInstagram(u.data.perfil_instagram??'');setDescricao(u.data.descricao??'');
      const data=o.data;
      setCnpj(mascararCnpj(data?.cnpj??''));setRazaoSocial(data?.razao_social??'');
      setDataCriacao(paraCampoData(data?.data_criacao??null));setResponsavelLegal(data?.responsavel_legal??'');
      setChavePix(data?.chave_pix??'');setNomeBeneficiarioPix(data?.nome_beneficiario_pix??'');
      setWhatsapp(mascararTelefone(data?.whatsapp??''));setCargaValida(true);
    }catch(f){if(atual===sequencia.current)setErro(mensagemErro(f));}
    finally{if(atual===sequencia.current)setCarregando(false);}
  },[perfil.id]);
  useFocusEffect(useCallback(()=>{void carregar();return()=>{sequencia.current++;};},[carregar]));

  async function salvar() {
    if(ocupado||!cargaValida||carregando)return;
    setErro(null);
    setSucesso(false);

    if (nome.trim().length < 2 || nome.trim().length > 120) {
      return setErro('O nome precisa ter entre 2 e 120 caracteres.');
    }
    if (telefone.trim() && !validarTelefone(telefone)) {
      return setErro('Telefone inválido. Informe DDD + número (10 ou 11 dígitos).');
    }
    if (instagram.trim() && !/^[A-Za-z0-9._]{1,30}$/.test(instagram.trim().replace(/^@/, ''))) {
      return setErro('Instagram inválido. Use só letras, números, ponto e underline.');
    }
    if (descricao.trim().length > 500) {
      return setErro('A descrição pode ter no máximo 500 caracteres.');
    }
    if (cnpj.trim() && !validarCnpj(cnpj)) {
      return setErro('CNPJ inválido.');
    }
    const dataCriacaoIso = dataCriacao.trim() ? interpretarData(dataCriacao) : null;
    if (dataCriacao.trim() && !dataCriacaoIso) {
      return setErro('Use o formato DD/MM/AAAA na data de fundação.');
    }
    if (dataCriacaoIso && dataCriacaoIso > hoje()) {
      return setErro('A data de fundação não pode ser no futuro.');
    }
    if (whatsapp.trim() && !validarTelefone(whatsapp)) {
      return setErro('WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).');
    }

    setOcupado(true);

    try {
      await salvarPerfilGestao(cargaValida,{
        nome:nome.trim(),telefone:telefone.trim()?apenasDigitos(telefone):null,
        perfil_instagram:instagram.trim().replace(/^@/,'')||null,descricao:descricao.trim()||null,
        cnpj:cnpj.trim()?apenasDigitos(cnpj):null,razao_social:razaoSocial.trim()||null,data_criacao:dataCriacaoIso,
        responsavel_legal:responsavelLegal.trim()||null,chave_pix:chavePix.trim()||null,
        nome_beneficiario_pix:nomeBeneficiarioPix.trim()||null,whatsapp:whatsapp.trim()?apenasDigitos(whatsapp):null,
      });
      setSucesso(true);
      try{await recarregarPerfil(true);}catch(f){setErro('Perfil salvo, mas a exibição não foi atualizada: '+mensagemErro(f));}
    }catch(f){setErro(mensagemErro(f));}finally{setOcupado(false);}
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.superficie }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>Perfil</Text>
          <Text style={tipo.apoio}>{perfil.nome} · gestão da ONG</Text>
        </View>
        <Pressable onPress={sair} hitSlop={12}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {carregando ? (
          <Text style={tipo.apoio}>Carregando...</Text>
        ) : !cargaValida ? (
          <>
            <Aviso mensagem={erro ?? 'Não foi possível carregar o perfil.'} />
            <Botao titulo="Tentar novamente" onPress={() => { void carregar(); }} />
          </>
        ) : (
          <>
            {erro ? <Aviso mensagem={erro} /> : null}
            {sucesso ? (
              <View style={estilos.sucesso}>
                <Text style={[tipo.apoio, { color: cores.folha }]}>
                  Perfil salvo com sucesso.
                </Text>
              </View>
            ) : null}

            <Text style={estilos.secao}>Dados de contato</Text>
            <Campo rotulo="Nome de exibição" value={nome} onChangeText={setNome} />
            <Campo
              rotulo="Telefone"
              value={telefone}
              onChangeText={(texto) => setTelefone(mascararTelefone(texto))}
              placeholder="(51) 99999-9999"
              keyboardType="phone-pad"
            />
            <Campo
              rotulo="Instagram"
              value={instagram}
              onChangeText={setInstagram}
              autoCapitalize="none"
            />
            <Campo
              rotulo="Sobre a horta"
              value={descricao}
              onChangeText={setDescricao}
              multiline
              numberOfLines={3}
              style={estilos.multilinha}
            />

            <Text style={estilos.secao}>Dados institucionais</Text>
            <Text style={tipo.apoio}>O nome de exibição identifica esta conta. A razão social pertence ao perfil da gestão. O nome oficial e o endereço da horta vêm da configuração institucional, administrada separadamente.</Text>
            <Campo
              rotulo="CNPJ"
              value={cnpj}
              onChangeText={(texto) => setCnpj(mascararCnpj(texto))}
              placeholder="00.000.000/0000-00"
              keyboardType="number-pad"
            />
            <Campo rotulo="Razão social" value={razaoSocial} onChangeText={setRazaoSocial} />
            <CampoData
              rotulo="Data de fundação"
              valorTexto={dataCriacao}
              aoMudarTexto={setDataCriacao}
              maximo={new Date()}
            />
            <Campo
              rotulo="Responsável legal"
              value={responsavelLegal}
              onChangeText={setResponsavelLegal}
            />

            <Text style={estilos.secao}>Recebimento de doações</Text>
            <Campo
              rotulo="Chave PIX"
              value={chavePix}
              onChangeText={setChavePix}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              autoCapitalize="none"
            />
            <Campo
              rotulo="Nome do beneficiário"
              value={nomeBeneficiarioPix}
              onChangeText={setNomeBeneficiarioPix}
            />
            <Campo
              rotulo="WhatsApp"
              value={whatsapp}
              onChangeText={(texto) => setWhatsapp(mascararTelefone(texto))}
              placeholder="(51) 99999-9999"
              dica="Usado no contato com voluntários"
              keyboardType="phone-pad"
            />

            <View style={{ height: espaco.md }} />
            <Botao titulo="Salvar" onPress={salvar} carregando={ocupado} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function paraCampoData(iso: string | null): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function interpretarData(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getDate() !== Number(dia) || d.getMonth() !== Number(mes) - 1) return null;
  return `${ano}-${mes}-${dia}`;
}

const estilos = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.xl,
    paddingBottom: espaco.md,
    backgroundColor: cores.fundo,
  },
  conteudo: { padding: espaco.lg, paddingBottom: espaco.xl },
  secao: {
    fontSize: 16,
    fontWeight: '700',
    color: cores.tinta,
    marginTop: espaco.md,
    marginBottom: espaco.md,
  },
  multilinha: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  sucesso: {
    backgroundColor: cores.folhaClara,
    borderRadius: 8,
    padding: espaco.md,
    marginBottom: espaco.md,
  },
});
