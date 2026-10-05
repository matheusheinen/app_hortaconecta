# Horta Conecta

> **Escopo do MVP — 05/10/2026:** a referência do que entra no MVP é
> [docs/mvp/ESCOPO_MVP.md](docs/mvp/ESCOPO_MVP.md). Oficinas e certificados
> ficam **fora do MVP por enquanto**: ocultos no app por `src/lib/escopoMvp.ts`,
> com código, testes e banco preservados. Doações = materiais + lançamento de
> entrega pela gestão. O estilo base das telas é o atual de `origin/main`; o
> redesenho local (27–29/09) é fonte de funcionalidades a portar, não de estilo.
> Quando este aviso divergir de seções abaixo, ele prevalece.

> Compatibilidade — 30/09/2026: app adaptado ao endereço estruturado, tipos
> regenerados e duas reconciliações aplicadas no Supabase. Cinco fluxos verificados
> por SQL remoto com dados fictícios revertidos; 91 testes locais e export Android
> aprovados. Ver [resultado e limites](docs/reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md).
> Os registros anteriores abaixo preservam o estado histórico de cada etapa.

> Correções integradas — 24/09/2026: revisão obrigatória do Diário, proteção do
> histórico de atividades, perfil da gestão atômico e tratamento de autenticação.
> Ver [CORRECOES_MVP.md](docs/mvp/CORRECOES_MVP.md). A segurança do schema inicial
> continua dependendo de [validação remota](docs/auditoria/SEGURANCA_BASE.md).

> Prioridade 5 — 24/09/2026: [certificados de participação](docs/mvp/CERTIFICADOS.md)
> emitidos pelo banco após aprovação e check-in confirmado. A carga horária é
> **prevista**, não medida. Visualização nativa e compartilhamento em texto, sem PDF.

> Prioridade 4 — 24/09/2026: propostas privadas de oficinas implementadas em
> [docs/mvp/OFICINAS.md](docs/mvp/OFICINAS.md). Aprovação não cria uma atividade,
> inscrição, presença ou certificado. O tipo legado OFICINA_AUTORAL permanece
> preservado; o fluxo atual usa propostas_oficinas, sem calendário.

> Atualização — 24/09/2026: a Prioridade 2 está descrita em
> [docs/mvp/MATERIAIS.md](docs/mvp/MATERIAIS.md), com modelo, regras, migration e limites
> de validação. Contribuição significa entrega de materiais ou itens físicos,
> não contribuição financeira. Referências abaixo a PIX, pagamentos e comprovantes
> financeiros são legado obsoleto, preservado para revisão posterior.

> Atualização de implementação — 23/09/2026: o fluxo da Prioridade 1
> (voluntariado) e sua migration incremental estão descritos em
> [docs/mvp/VOLUNTARIADO.md](docs/mvp/VOLUNTARIADO.md), incluindo dependências remotas,
> regras de check-in e roteiro de testes. A migration ainda precisa ser aplicada
> e homologada no Supabase. As demais seções abaixo preservam o planejamento
> anterior e não significam implementação das outras prioridades nesta etapa.

Aplicativo mobile de voluntariado, apadrinhamento e transparência para a Horta Comunitária Guaporé (Centro Ocupacional Bruno José Campos, Guaporé/RS).

Projeto de extensão — UNIVATES, Engenharia de Software, Laboratório de Programação para Dispositivos Móveis, 2026/2. Professor orientador: Juliano Dertzbacher.

**Equipe:** Lucas Mezzomo (analista/desenvolvedor), Matheus Augusto Heinen (desenvolvedor/testador), Roberto Estevão Henz Junior (desenvolvedor/documentador).

O app resolve três problemas da instituição: captação de voluntários (banco de talentos), captação de recursos (mural de apadrinhamento com PIX) e transparência (diário com fotos e relatos).

## Stack

- **App:** React Native + Expo, TypeScript, React Navigation
- **Backend:** Supabase (BaaS) — Auth, PostgreSQL, Storage, Row Level Security
- **Imagens:** `expo-image-manipulator` (compressão local antes do upload)
- **Notificações:** Expo Notifications (prioridade baixa, ainda não implementado)
- **Integrações:** WhatsApp via deep link, PIX estático (chave copia e cola)
- **Build/testes:** Expo Go, EAS Build
- **Design:** Figma (protótipo navegável validado com a ONG)

Homologação do MVP restrita a **Android**, mas a base de código deve permanecer compatível com iOS — evitar APIs exclusivas de uma plataforma sem fallback.


## Modelo de dados

PostgreSQL no Supabase. Onze tabelas em `public`, mais `auth.users` (gerenciada pelo Supabase Auth). Tabelas transacionais têm `criado_em` e `atualizado_em` (`timestamp with time zone`).

### Perfis (herança 1:1)

`usuarios.id` **é** o `auth.users.id` — não criar identificador próprio. Um usuário é voluntário ou ONG conforme `tipo_perfil`, e os dados específicos ficam na tabela filha correspondente.

| Tabela | Atributos |
| --- | --- |
| `auth.users` | `id` (UUID, PK), `email` — gerenciada pelo Supabase Auth |
| `usuarios` | `id` (UUID, PK/FK → `auth.users`), `nome`, `telefone`, `endereco`, `descricao`, `perfil_instagram`, `tipo_perfil`, `foto_perfil`, `exclusao_solicitada_em`, `criado_em`, `atualizado_em` |
| `voluntarios` | `usuario_id` (PK/FK), `cpf` (único), `data_nascimento`, `profissao`, `disponibilidade_horarios` (JSONB), `atualizado_em` |
| `ongs` | `usuario_id` (PK/FK), `cnpj` (único), `razao_social`, `data_criacao`, `responsavel_legal`, `chave_pix`, `nome_beneficiario_pix`, `whatsapp`, `atualizado_em` |

### Habilidades e atividades

| Tabela | Atributos |
| --- | --- |
| `habilidades` | `id` (PK), `nome_habilidade` (único), `categoria` |
| `usuario_habilidades` | `usuario_id` (FK), `habilidade_id` (FK) — PK composta |
| `atividades` | `id` (PK), `titulo`, `descricao`, `tipo` (`TAREFA_ONG` / `OFICINA_AUTORAL`), `autor_id` (FK), `data_hora_prevista`, `vagas_totais`, `carga_horaria`, `status`, `criado_em`, `atualizado_em` |
| `inscricoes_atividades` | `id` (PK), `atividade_id` (FK), `usuario_id` (FK), `data_inscricao`, `status_inscricao`, `presenca_confirmada` |

### Arrecadação e transparência

| Tabela | Atributos |
| --- | --- |
| `metas_demandas` | `id` (PK), `titulo`, `descricao`, `tipo` (`FINANCEIRA` / `MATERIAL`), `unidade_medida`, `quantidade_meta`, `quantidade_arrecadada`, `url_imagem_capa`, `data_limite`, `status`, `criado_em`, `atualizado_em` |
| `contribuicoes` | `id` (PK), `meta_id` (FK), `usuario_id` (FK), `quantidade_oferecida`, `url_comprovante`, `data_envio`, `status_validacao`, `validado_por` (FK → `usuarios`), `validado_em`, `observacao_validacao` |
| `diario_transparencia` | `id` (PK), `titulo`, `descricao_curta`, `url_imagem`, `atividade_id` (FK, opcional), `data_publicacao`, `autor_id` (FK) |

### Configuração

| Tabela | Atributos |
| --- | --- |
| `configuracao_instituicao` | `id` (registro único), `nome_curto`, `nome_completo`, `cidade`, `uf`, `chamada`, `sobre`, `cor_primaria`, `cor_acento`, `url_logo`, `site`, `telefone`, `whatsapp`, `email_contato`, `atualizado_em` |

Registro único, referente à Horta Comunitária Guaporé. Nome da instituição, cores, logo, textos e canais de contato vêm daqui — **não fixar esses valores no código**. A estrutura já prevê o uso por outras ONGs no futuro, mas isso não é escopo do MVP.

## Regras de negócio

**Perfil progressivo.** Cadastro inicial pede só nome, e-mail e senha, e libera a navegação básica. Candidatar-se a tarefas e propor oficinas exige cadastro completo do voluntário. A liberação é decidida **verificando em tempo de execução** se os dados complementares estão preenchidos (CPF, data de nascimento, profissão, disponibilidade de horários e habilidades). Não existe campo `nivel_cadastro` — ele foi removido do modelo justamente para evitar estado duplicado e inconsistente.

**Atividades.** `TAREFA_ONG` é publicada pela gestão; `OFICINA_AUTORAL` é proposta por voluntário e fica sujeita a aprovação. Voluntários se candidatam via `inscricoes_atividades`, e a gestão faz a triagem.

**Doações.** O pagamento acontece **fora do app**: o doador copia a chave PIX estática (vinda de `ongs.chave_pix`), transfere e anexa o comprovante. A baixa é manual — a gestão valida e o sistema registra `validado_por`, `validado_em` e `observacao_validacao`. `quantidade_arrecadada` só é atualizada após a validação. Não há integração bancária nem conciliação automática.

**WhatsApp.** Deep link usando `ongs.whatsapp`, para contato direto após a candidatura.

**Imagens.** Sempre comprimir no dispositivo com `expo-image-manipulator` antes do upload. No banco guarda-se apenas a URL do Supabase Storage.

**LGPD.** A instituição atende crianças e adolescentes. Restringir a exibição de imagens de menores no diário. A solicitação de exclusão de dados pelo voluntário grava `exclusao_solicitada_em` para tratamento pela gestão.

**RLS.** Todo acesso passa por Row Level Security. Ao criar tabela ou coluna nova, criar também a política correspondente — nunca contornar RLS com service role no cliente.

## Requisitos

| ID | Requisito |
| --- | --- |
| RF0001 | Autenticação e perfil progressivo |
| RF0002 | Gestão de tarefas e demandas |
| RF0003 | Integração e engajamento (WhatsApp) |
| RF0004 | Apadrinhamento e validação financeira |
| RF0005 | Diário de transparência |
| RNF0001 | Plataforma operacional (React Native + Expo, MVP em Android) |
| RNF0002 | Privacidade e conformidade com a LGPD |
| RNF0003 | Otimização de armazenamento (compressão local) |
| RNF0004 | Arquitetura e backend (BaaS, PostgreSQL, RLS) |
| RNF0005 | Parametrização da instituição |

## Backlog e situação atual

| ID | Funcionalidade | Prioridade | Situação |
| --- | --- | --- | --- |
| B01 | Cadastro e autenticação com perfil progressivo | Alta | Em desenvolvimento |
| B02 | Perfil de habilidades e disponibilidade de horários | Alta | Em desenvolvimento |
| B03 | Publicação de tarefas pela ONG | Alta | Em desenvolvimento |
| B04 | Candidatura a tarefas | Alta | Em desenvolvimento |
| B05 | Feed do diário de transparência | Média | Em desenvolvimento |
| B06 | Compressão local de imagens | Média | Em desenvolvimento |
| B07 | Triagem de candidatos e proposta de oficinas autorais | Média | Em planejamento |
| B08 | Mural de metas com chave PIX | Alta | Em planejamento |
| B09 | Envio e validação de comprovantes | Alta | Em planejamento |
| B10 | Integração com WhatsApp via deep link | Média | Em planejamento |
| B11 | Parametrização da instituição | Média | Em planejamento |
| B12 | Notificações push (Expo) | Baixa | Em planejamento |

## Cronograma

| Sprint | Período | Escopo |
| --- | --- | --- |
| Sprint 1 | 27/07 a 14/09/2026 | Requisitos, protótipo, modelagem do banco, refinamento do backlog; início do cadastro/login e do CRUD de atividades |
| Sprint 2 | 15/09 a 05/10/2026 | B01, B02, B03, B04, B05, B06 |
| Sprint 3 | 06/10 a 16/11/2026 | B07, B08, B09, B10, B11, B12 |
| Sprint final | 17/11 a 14/12/2026 | Testes com ONG e voluntários, correções, publicação na Google Play, treinamento e handover |

## Convenções

- Identificadores de banco, tabelas e colunas em **português, snake_case** — manter o padrão já existente.
- Código TypeScript (componentes, funções, variáveis) em inglês ou português, mas **consistente com os arquivos vizinhos**; textos de interface sempre em português.
- Tipar as respostas do Supabase; evitar `any`.
- Rotas protegidas por autenticação ficam sob o controle do React Navigation.
- Antes de commitar, rodar `npx tsc --noEmit`.

## Fora de escopo do MVP

Não implementar sem combinar com a equipe:

- *Matching* automático entre habilidades de voluntários e tarefas
- Emissão de certificados de horas em PDF
- Propostas de oficinas e certificados de participação: já implementados, mas ocultos no app até nova decisão (ver [ESCOPO_MVP.md](docs/mvp/ESCOPO_MVP.md))
- Integração bancária ou PIX dinâmico com conciliação automática
- Cadastro de múltiplas instituições (a estrutura prevê, o MVP não entrega)
- Build e homologação para iOS

## Dados sensíveis

Chaves do Supabase ficam em variáveis de ambiente, nunca versionadas. Não commitar dados reais de voluntários, CPF, CNPJ, chave PIX de produção ou fotos de crianças e adolescentes — usar dados fictícios em testes e seeds.

## Observações

Caso tenha alguma dúvida ou tiver alguma alteração crítica no projeto, faça perguntas para confirmação...
