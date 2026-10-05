import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, espaco } from '../lib/tema';
import { DIAS_SEMANA, PERIODOS_DIA, type DiaSemana, type PeriodoDia, type SlotDisponibilidade } from '../lib/tipos';
import { apenasDigitos, validarCpf, validarTelefone } from '../lib/validadores';
import { mascararCpf, mascararTelefone } from '../lib/mascaras';
import { Campo } from '../componentes/Ui';
import { CampoData } from '../componentes/CampoData';
import { CartaoSecao, HubPerfil, SecaoPerfil, StatusPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { buscarCep, type PerfilVoluntarioCarregado } from '../lib/perfilVoluntario';
import {
  SECOES_PERFIL,
  hojeIso,
  interpretarData,
  mascararCep,
  paraCampoData,
  secaoCompleta,
  secoesPendentes,
  type DadosPerfilVoluntario,
  type SecaoPerfil as ChaveSecao,
} from '../lib/regrasPerfil';

export type ContextoPerfilVoluntario = {
  perfil: PerfilVoluntarioCarregado | null;
  erro: string | null;
  carregando: boolean;
  carregar: () => void;
  /** Salva uma seção e atualiza o estado compartilhado com a resposta do banco. */
  salvar: (parcial: Partial<DadosPerfilVoluntario>, habilidades?: number[]) => Promise<void>;
};

const Contexto = createContext<ContextoPerfilVoluntario | null>(null);

export function ProvedorPerfilVoluntario({ valor, children }: { valor: ContextoPerfilVoluntario; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function usePerfil() {
  const valor = useContext(Contexto);
  if (!valor?.perfil) throw new Error('Perfil do voluntário fora do provedor.');
  return { perfil: valor.perfil, salvar: valor.salvar };
}

export function TelaHubPerfilVoluntario({ nome, sair, abrir }: {
  nome: string;
  sair: () => void;
  abrir: (secao: ChaveSecao) => void;
}) {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Perfil do voluntário fora do provedor.');
  const { perfil, erro, carregando, carregar } = contexto;
  const pendentes = perfil ? secoesPendentes(perfil.dados, perfil.habilidades.length) : [];
  const total = SECOES_PERFIL.length;

  return (
    <HubPerfil nome={nome} papel="voluntário" sair={sair} erro={erro} carregando={carregando && !perfil} carregar={carregar}>
      {perfil ? (
        <>
          <StatusPerfil
            ok={perfil.elegivel}
            titulo={perfil.elegivel ? 'Cadastro completo' : 'Complete seu cadastro'}
            texto={perfil.elegivel
              ? 'Você já pode se candidatar às tarefas da instituição.'
              : pendentes.length
                ? `Falta${pendentes.length > 1 ? 'm' : ''} ${pendentes.length} de ${total} seções para se candidatar às tarefas.`
                : 'Confira os dados das seções; o servidor ainda não liberou as candidaturas.'}
            feitas={total - pendentes.length}
            total={total}
          />
          {SECOES_PERFIL.map((secao) => (
            <CartaoSecao key={secao.chave} titulo={secao.titulo} resumo={secao.resumo}
              completa={secaoCompleta(secao.chave, perfil.dados, perfil.habilidades.length)}
              onPress={() => abrir(secao.chave)} />
          ))}
        </>
      ) : null}
    </HubPerfil>
  );
}

export function TelaSecaoDadosPessoais({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfil();
  const d = perfil.dados;
  const [nome, setNome] = useState(d.nome);
  const [telefone, setTelefone] = useState(mascararTelefone(d.telefone ?? ''));
  const [instagram, setInstagram] = useState(d.perfil_instagram ?? '');
  const [descricao, setDescricao] = useState(d.descricao ?? '');
  return (
    <SecaoPerfil titulo="Dados pessoais" voltar={voltar} salvar={async () => {
      if (nome.trim().length < 2 || nome.trim().length > 120) return 'O nome precisa ter entre 2 e 120 caracteres.';
      if (telefone.trim() && !validarTelefone(telefone)) return 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).';
      const insta = instagram.trim().replace(/^@/, '');
      if (insta && !/^[A-Za-z0-9._]{1,30}$/.test(insta)) return 'Instagram inválido. Use só letras, números, ponto e underline.';
      if (descricao.trim().length > 500) return 'A apresentação pode ter no máximo 500 caracteres.';
      await salvar({
        nome: nome.trim(),
        telefone: telefone.trim() ? apenasDigitos(telefone) : null,
        perfil_instagram: insta || null,
        descricao: descricao.trim() || null,
      });
      return null;
    }}>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} />
      <Campo rotulo="Telefone" value={telefone} onChangeText={(t) => setTelefone(mascararTelefone(t))}
        placeholder="(51) 99999-9999" keyboardType="phone-pad" />
      <Campo rotulo="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="@seuperfil" />
      <Campo rotulo="Sobre você" value={descricao} onChangeText={setDescricao} multiline numberOfLines={3}
        style={estilosPerfil.multilinha} dica={`${descricao.trim().length}/500`} />
    </SecaoPerfil>
  );
}

export function TelaSecaoCadastro({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfil();
  const d = perfil.dados;
  const [cpf, setCpf] = useState(mascararCpf(d.cpf ?? ''));
  const [nascimento, setNascimento] = useState(paraCampoData(d.data_nascimento));
  const [profissao, setProfissao] = useState(d.profissao ?? '');
  return (
    <SecaoPerfil titulo="Cadastro de voluntário" voltar={voltar} salvar={async () => {
      if (cpf.trim() && !validarCpf(cpf)) return 'CPF inválido.';
      const iso = nascimento.trim() ? interpretarData(nascimento) : null;
      if (nascimento.trim() && !iso) return 'Use o formato DD/MM/AAAA na data de nascimento.';
      if (iso && iso <= '1900-01-01') return 'A data de nascimento precisa ser posterior a 01/01/1900.';
      if (iso && iso >= hojeIso()) return 'A data de nascimento precisa ser no passado.';
      await salvar({
        cpf: cpf.trim() ? apenasDigitos(cpf) : null,
        data_nascimento: iso,
        profissao: profissao.trim() || null,
      });
      return null;
    }}>
      <Text style={estilosPerfil.explicacao}>
        Estes dados ficam visíveis apenas para você e para a gestão da instituição.
      </Text>
      <Campo rotulo="CPF" value={cpf} onChangeText={(t) => setCpf(mascararCpf(t))}
        placeholder="000.000.000-00" keyboardType="number-pad" />
      <CampoData rotulo="Data de nascimento" valorTexto={nascimento} aoMudarTexto={setNascimento} maximo={new Date()} />
      <Campo rotulo="Profissão" value={profissao} onChangeText={setProfissao} />
    </SecaoPerfil>
  );
}

export function TelaSecaoEndereco({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfil();
  const d = perfil.dados;
  const [cep, setCep] = useState(mascararCep(d.cep ?? ''));
  const [logradouro, setLogradouro] = useState(d.logradouro ?? '');
  const [numero, setNumero] = useState(d.numero ?? '');
  const [complemento, setComplemento] = useState(d.complemento ?? '');
  const [bairro, setBairro] = useState(d.bairro ?? '');
  const [cidade, setCidade] = useState(d.cidade ?? '');
  const [uf, setUf] = useState(d.uf ?? '');
  const [buscando, setBuscando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  /** Busca assim que os 8 dígitos chegam; sem resposta, segue o preenchimento manual. */
  async function aoMudarCep(texto: string) {
    const mascarado = mascararCep(texto);
    setCep(mascarado);
    setRecado(null);
    if (apenasDigitos(mascarado).length !== 8) return;
    setBuscando(true);
    const encontrado = await buscarCep(mascarado);
    setBuscando(false);
    if (!encontrado) {
      setRecado('Não encontramos esse CEP. Você pode preencher o endereço à mão.');
      return;
    }
    if (encontrado.logradouro) setLogradouro(encontrado.logradouro);
    if (encontrado.bairro) setBairro(encontrado.bairro);
    setCidade(encontrado.cidade);
    setUf(encontrado.uf);
  }

  return (
    <SecaoPerfil titulo="Endereço" voltar={voltar} salvar={async () => {
      if (cep.trim() && apenasDigitos(cep).length !== 8) return 'CEP inválido. Informe os 8 dígitos.';
      const ufNormalizada = uf.trim().toUpperCase();
      if (ufNormalizada && !/^[A-Z]{2}$/.test(ufNormalizada)) return 'UF inválida. Informe a sigla com duas letras, como RS.';
      await salvar({
        cep: cep.trim() ? apenasDigitos(cep) : null,
        logradouro: logradouro.trim() || null,
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        uf: ufNormalizada || null,
      });
      return null;
    }}>
      <Text style={estilosPerfil.explicacao}>
        Logradouro, número e cidade são necessários para se candidatar. Você pode salvar e completar depois.
      </Text>
      <Campo rotulo="CEP" value={cep} onChangeText={aoMudarCep} placeholder="00000-000"
        keyboardType="number-pad" maxLength={9}
        dica={buscando ? 'Buscando endereço…' : recado ?? 'Digite o CEP para preencher o restante automaticamente.'} />
      <Campo rotulo="Logradouro" value={logradouro} onChangeText={setLogradouro} placeholder="Rua, avenida ou estrada" />
      <View style={estilosPerfil.linha}>
        <View style={{ flex: 1 }}>
          <Campo rotulo="Número" value={numero} onChangeText={setNumero} placeholder="Nº ou s/n" />
        </View>
        <View style={{ flex: 2 }}>
          <Campo rotulo="Complemento" value={complemento} onChangeText={setComplemento} />
        </View>
      </View>
      <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} />
      <View style={estilosPerfil.linha}>
        <View style={{ flex: 3 }}>
          <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo="UF" value={uf} onChangeText={(t) => setUf(t.toUpperCase())} placeholder="RS"
            autoCapitalize="characters" autoCorrect={false} maxLength={2} />
        </View>
      </View>
    </SecaoPerfil>
  );
}

export function TelaSecaoDisponibilidade({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfil();
  const [slots, setSlots] = useState<SlotDisponibilidade[]>(perfil.dados.disponibilidade_horarios as SlotDisponibilidade[]);
  const alternar = (dia: DiaSemana, periodo: PeriodoDia) =>
    setSlots((atual) =>
      atual.some((s) => s.dia === dia && s.periodo === periodo)
        ? atual.filter((s) => !(s.dia === dia && s.periodo === periodo))
        : [...atual, { dia, periodo }],
    );
  return (
    <SecaoPerfil titulo="Disponibilidade" voltar={voltar} salvar={async () => {
      await salvar({ disponibilidade_horarios: slots });
      return null;
    }}>
      <Text style={estilosPerfil.explicacao}>Toque nos períodos em que você costuma estar livre.</Text>
      {DIAS_SEMANA.map((dia) => (
        <View key={dia.codigo} style={estilos.linhaDia}>
          <Text style={estilos.rotuloDia}>{dia.rotulo}</Text>
          <View style={estilos.chips}>
            {PERIODOS_DIA.map((periodo) => {
              const ativo = slots.some((s) => s.dia === dia.codigo && s.periodo === periodo.codigo);
              return (
                <Pressable key={periodo.codigo} onPress={() => alternar(dia.codigo, periodo.codigo)}
                  accessibilityRole="checkbox" accessibilityState={{ checked: ativo }}
                  accessibilityLabel={`${dia.rotulo}, ${periodo.rotulo}`}
                  style={[estilos.opcao, ativo && estilos.opcaoAtiva]}>
                  <Text style={[estilos.opcaoTexto, ativo && estilos.opcaoTextoAtivo]}>{periodo.rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </SecaoPerfil>
  );
}

export function TelaSecaoHabilidades({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfil();
  const [selecionadas, setSelecionadas] = useState<number[]>(perfil.habilidades);
  const categorias = [...new Set(perfil.catalogo.map((h) => h.categoria ?? 'Outras'))];
  const alternar = (id: number) =>
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((h) => h !== id) : [...atual, id]));
  return (
    <SecaoPerfil titulo="Habilidades" voltar={voltar} salvar={async () => {
      await salvar({}, selecionadas);
      return null;
    }}>
      {perfil.catalogo.length === 0 ? (
        <Text style={estilosPerfil.explicacao}>Nenhuma habilidade cadastrada pela gestão ainda.</Text>
      ) : (
        categorias.map((categoria) => (
          <View key={categoria} style={{ marginBottom: espaco.md }}>
            <Text style={estilos.categoria}>{categoria}</Text>
            <View style={estilos.chips}>
              {perfil.catalogo.filter((h) => (h.categoria ?? 'Outras') === categoria).map((h) => {
                const ativo = selecionadas.includes(h.id);
                return (
                  <Pressable key={h.id} onPress={() => alternar(h.id)} accessibilityRole="checkbox"
                    accessibilityState={{ checked: ativo }} accessibilityLabel={h.nome_habilidade}
                    style={[estilos.opcao, ativo && estilos.opcaoAtiva]}>
                    <Text style={[estilos.opcaoTexto, ativo && estilos.opcaoTextoAtivo]}>{h.nome_habilidade}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </SecaoPerfil>
  );
}

const estilos = StyleSheet.create({
  linhaDia: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, marginBottom: espaco.sm },
  rotuloDia: { width: 36, fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  categoria: { fontSize: 13, fontWeight: '700', color: cores.tintaSuave, marginBottom: espaco.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, flex: 1 },
  opcao: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: 20,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.xs + 2,
    backgroundColor: cores.fundo,
  },
  opcaoAtiva: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  opcaoTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  opcaoTextoAtivo: { color: cores.folha },
});
