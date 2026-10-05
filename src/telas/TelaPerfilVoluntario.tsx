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
import {
  DIAS_SEMANA,
  PERIODOS_DIA,
  type DiaSemana,
  type Habilidade,
  type PeriodoDia,
  type SlotDisponibilidade,
  type Usuario,
} from '../lib/tipos';
import { apenasDigitos, validarCpf, validarTelefone } from '../lib/validadores';
import { mascararCpf, mascararTelefone } from '../lib/mascaras';
import { Aviso, Botao, Campo } from '../componentes/Ui';
import { CampoData } from '../componentes/CampoData';
import { disponibilidadeValida } from '../lib/regrasVoluntariado';
import { mensagemErro } from '../lib/voluntariado';

type Props = {
  perfil: Usuario;
  sair: () => void;
  recarregarPerfil: (propagarErro?: boolean) => Promise<void>;
};

export function TelaPerfilVoluntario({ perfil, sair, recarregarPerfil }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [cargaValida, setCargaValida] = useState(false);
  const [elegivel, setElegivel] = useState<boolean | null>(null);
  const sequenciaCarga = useRef(0);

  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(mascararTelefone(perfil.telefone ?? ''));
  const [instagram, setInstagram] = useState(perfil.perfil_instagram ?? '');
  const [descricao, setDescricao] = useState(perfil.descricao ?? '');

  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [profissao, setProfissao] = useState('');
  const [disponibilidade, setDisponibilidade] = useState<SlotDisponibilidade[]>([]);
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  const [catalogo, setCatalogo] = useState<Habilidade[]>([]);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);

  const carregar = useCallback(async () => {
    const atual = ++sequenciaCarga.current;
    setCarregando(true);
    setErro(null);
    setCargaValida(false);
    setSucesso(false);
    setElegivel(null);

    try {
      const [respVoluntario, respCatalogo, respSelecionadas, respUsuario] = await Promise.all([
        supabase
          .from('voluntarios')
          .select('cpf, data_nascimento, profissao, disponibilidade_horarios, cep, logradouro, numero, complemento, bairro, cidade, uf')
          .eq('usuario_id', perfil.id)
          .single(),
        supabase.from('habilidades').select('*').order('categoria').order('nome_habilidade'),
        supabase.from('usuario_habilidades').select('habilidade_id').eq('usuario_id', perfil.id),
        supabase.from('usuarios').select('nome, telefone, perfil_instagram, descricao').eq('id', perfil.id).single(),
      ]);
      if (atual !== sequenciaCarga.current) return;

      if (respVoluntario.error) throw respVoluntario.error;
      if (respCatalogo.error) throw respCatalogo.error;
      if (respSelecionadas.error) throw respSelecionadas.error;
      if (respUsuario.error) throw respUsuario.error;
      setNome(respUsuario.data.nome);
      setTelefone(mascararTelefone(respUsuario.data.telefone ?? ''));
      setInstagram(respUsuario.data.perfil_instagram ?? '');
      setDescricao(respUsuario.data.descricao ?? '');
      if (respVoluntario.data) {
        if (!disponibilidadeValida(respVoluntario.data.disponibilidade_horarios)) {
          throw new Error(
            'A disponibilidade salva está em formato inválido. Solicite suporte à gestão.',
          );
        }
        setCpf(mascararCpf(respVoluntario.data.cpf ?? ''));
        setDataNascimento(paraCampoData(respVoluntario.data.data_nascimento));
        setProfissao(respVoluntario.data.profissao ?? '');
        setDisponibilidade(respVoluntario.data.disponibilidade_horarios);
        setCep(mascararCep(respVoluntario.data.cep ?? ''));
        setLogradouro(respVoluntario.data.logradouro ?? '');
        setNumero(respVoluntario.data.numero ?? '');
        setComplemento(respVoluntario.data.complemento ?? '');
        setBairro(respVoluntario.data.bairro ?? '');
        setCidade(respVoluntario.data.cidade ?? '');
        setUf(respVoluntario.data.uf ?? '');
      }

      setCatalogo(respCatalogo.data ?? []);
      setSelecionadas((respSelecionadas.data ?? []).map((linha) => linha.habilidade_id));
      const resposta = await supabase.rpc('voluntariado_elegibilidade');
      if (atual !== sequenciaCarga.current) return;
      if (resposta.error) throw resposta.error;
      setElegivel(resposta.data);
      setCargaValida(true);
    } catch (falha) {
      if (atual === sequenciaCarga.current) setErro(mensagemErro(falha));
    } finally {
      if (atual === sequenciaCarga.current) setCarregando(false);
    }
  }, [perfil.id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
      return () => {
        sequenciaCarga.current++;
      };
    }, [carregar]),
  );

  function alternarSlot(dia: DiaSemana, periodo: PeriodoDia) {
    setDisponibilidade((atual) => {
      const existe = atual.some((s) => s.dia === dia && s.periodo === periodo);
      if (existe) return atual.filter((s) => !(s.dia === dia && s.periodo === periodo));
      return [...atual, { dia, periodo }];
    });
  }

  function alternarHabilidade(id: number) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((h) => h !== id) : [...atual, id],
    );
  }

  async function salvar() {
    if (ocupado || carregando || !cargaValida) return;
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
    if (cep.trim() && apenasDigitos(cep).length !== 8) {
      return setErro('CEP inválido. Informe os 8 dígitos.');
    }
    const ufNormalizada = uf.trim().toUpperCase();
    if (ufNormalizada && !/^[A-Z]{2}$/.test(ufNormalizada)) {
      return setErro('UF inválida. Informe a sigla com duas letras, como RS.');
    }
    if (cpf.trim() && !validarCpf(cpf)) {
      return setErro('CPF inválido.');
    }
    const dataNascimentoIso = dataNascimento.trim() ? interpretarData(dataNascimento) : null;
    if (dataNascimento.trim() && !dataNascimentoIso) {
      return setErro('Use o formato DD/MM/AAAA na data de nascimento.');
    }
    if (dataNascimentoIso && dataNascimentoIso <= '1900-01-01') {
      return setErro('A data de nascimento precisa ser posterior a 01/01/1900.');
    }
    if (dataNascimentoIso && dataNascimentoIso >= hoje()) {
      return setErro('A data de nascimento precisa ser no passado.');
    }
    if (!disponibilidadeValida(disponibilidade)) return setErro('Disponibilidade inválida.');

    setOcupado(true);
    try {
      const { data, error } = await supabase.rpc('voluntariado_salvar_perfil', {
        p_dados: {
          nome: nome.trim(),
          telefone: telefone.trim() ? apenasDigitos(telefone) : null,
          perfil_instagram: instagram.trim() ? instagram.trim().replace(/^@/, '') : null,
          descricao: descricao.trim() || null,
          cpf: cpf.trim() ? apenasDigitos(cpf) : null,
          data_nascimento: dataNascimentoIso,
          profissao: profissao.trim() || null,
          disponibilidade_horarios: disponibilidade,
          cep: cep.trim() ? apenasDigitos(cep) : null,
          logradouro: logradouro.trim() || null,
          numero: numero.trim() || null,
          complemento: complemento.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          uf: ufNormalizada || null,
        },
        p_habilidades: selecionadas,
      });
      if (error) throw error;
      if (data === null) throw new Error('O servidor não confirmou o salvamento.');
      setElegivel(data);
      setSucesso(true);
      try {
        await recarregarPerfil(true);
      } catch (falha) {
        setErro(`Perfil salvo, mas não foi possível atualizar os dados de exibição: ${mensagemErro(falha)}`);
      }
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.superficie }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>Perfil</Text>
          <Text style={tipo.apoio}>{perfil.nome} · voluntário</Text>
        </View>
        <Pressable onPress={sair} hitSlop={12}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        {carregando ? (
          <Text style={tipo.apoio}>Carregando...</Text>
        ) : (
          <>
            {erro ? <Aviso mensagem={erro} /> : null}
            {!cargaValida ? <Botao titulo="Tentar carregar novamente" onPress={carregar} /> : null}
            {elegivel !== null ? (
              <Text style={tipo.apoio}>
                {elegivel
                  ? 'Cadastro completo para candidaturas.'
                  : 'Complete os dados, habilidades e disponibilidade para se candidatar.'}
              </Text>
            ) : null}
            {sucesso ? (
              <View style={estilos.sucesso}>
                <Text style={[tipo.apoio, { color: cores.folha }]}>Perfil salvo com sucesso.</Text>
              </View>
            ) : null}

            <Text style={estilos.secao}>Dados pessoais</Text>
            <Campo rotulo="Nome" value={nome} onChangeText={setNome} />
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
              rotulo="Sobre você"
              value={descricao}
              onChangeText={setDescricao}
              multiline
              numberOfLines={3}
              style={estilos.multilinha}
            />

            <Text style={estilos.secao}>Endereço pessoal</Text>
            <Text style={[tipo.apoio, { marginBottom: espaco.md }]}>
              Logradouro, número e cidade são necessários para se candidatar. Você pode salvar
              o perfil e completar os dados depois.
            </Text>
            <Campo
              rotulo="CEP"
              value={cep}
              onChangeText={(texto) => setCep(mascararCep(texto))}
              placeholder="00000-000"
              keyboardType="number-pad"
              maxLength={9}
            />
            <Campo
              rotulo="Logradouro"
              value={logradouro}
              onChangeText={setLogradouro}
              placeholder="Rua, avenida ou estrada"
            />
            <Campo
              rotulo="Número"
              value={numero}
              onChangeText={setNumero}
              placeholder="Número ou s/n"
            />
            <Campo rotulo="Complemento" value={complemento} onChangeText={setComplemento} />
            <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} />
            <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} />
            <Campo
              rotulo="UF"
              value={uf}
              onChangeText={(texto) => setUf(texto.toUpperCase())}
              placeholder="RS"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={2}
            />

            <Text style={estilos.secao}>Cadastro de voluntário</Text>
            <Text style={[tipo.apoio, { marginBottom: espaco.md }]}>
              CPF, data de nascimento, profissão, endereço, habilidades e disponibilidade liberam
              candidatura a tarefas.
            </Text>
            <Campo
              rotulo="CPF"
              value={cpf}
              onChangeText={(texto) => setCpf(mascararCpf(texto))}
              placeholder="000.000.000-00"
              keyboardType="number-pad"
            />
            <CampoData
              rotulo="Data de nascimento"
              valorTexto={dataNascimento}
              aoMudarTexto={setDataNascimento}
              maximo={new Date()}
            />
            <Campo rotulo="Profissão" value={profissao} onChangeText={setProfissao} />

            <Text style={estilos.secao}>Disponibilidade de horários</Text>
            {DIAS_SEMANA.map((dia) => (
              <View key={dia.codigo} style={estilos.linhaDisponibilidade}>
                <Text style={estilos.rotuloDia}>{dia.rotulo}</Text>
                <View style={estilos.chipsPeriodo}>
                  {PERIODOS_DIA.map((periodo) => {
                    const ativo = disponibilidade.some(
                      (s) => s.dia === dia.codigo && s.periodo === periodo.codigo,
                    );
                    return (
                      <Pressable
                        key={periodo.codigo}
                        onPress={() => alternarSlot(dia.codigo, periodo.codigo)}
                        style={[estilos.chip, ativo && estilos.chipAtivo]}
                      >
                        <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>
                          {periodo.rotulo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text style={estilos.secao}>Habilidades</Text>
            {catalogo.length === 0 ? (
              <Text style={tipo.apoio}>Nenhuma habilidade cadastrada pela gestão ainda.</Text>
            ) : (
              <View style={estilos.chipsHabilidades}>
                {catalogo.map((habilidade) => {
                  const ativo = selecionadas.includes(habilidade.id);
                  return (
                    <Pressable
                      key={habilidade.id}
                      onPress={() => alternarHabilidade(habilidade.id)}
                      style={[estilos.chip, ativo && estilos.chipAtivo]}
                    >
                      <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>
                        {habilidade.nome_habilidade}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ height: espaco.md }} />
            <Botao
              titulo="Salvar"
              onPress={salvar}
              carregando={ocupado}
              desabilitado={!cargaValida}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mascararCep(texto: string): string {
  const digitos = apenasDigitos(texto).slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
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
  linhaDisponibilidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    marginBottom: espaco.sm,
  },
  rotuloDia: { width: 36, fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  chipsPeriodo: { flexDirection: 'row', gap: espaco.sm, flex: 1 },
  chipsHabilidades: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: 20,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.xs,
  },
  chipAtivo: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  chipTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  chipTextoAtivo: { color: cores.folha },
});
