# Horta Conecta

Aplicativo mobile de voluntariado, apadrinhamento e transparência para a Horta Comunitária Guaporé (Centro Ocupacional Bruno José Campos, Guaporé/RS).

Projeto de extensão — UNIVATES, Engenharia de Software, Laboratório de Programação para Dispositivos Móveis, 2026/2. Professor orientador: Juliano Dertzbacher.

**Equipe:** Lucas Mezzomo (analista/desenvolvedor), Matheus Augusto Heinen (desenvolvedor/testador), Roberto Estevão Henz Junior (desenvolvedor/documentador).

O app resolve três problemas da instituição: captação de voluntários (banco de talentos), captação de recursos (mural de apadrinhamento com PIX) e transparência (diário com fotos e relatos).

## Estado atual (05/10/2026)

- **Branch de trabalho:** `integracao/mvp`, criada a partir de `origin/main` (PRs #1 e #2), com as funcionalidades do redesenho local (27–29/09) portadas por cima. Ainda não enviada ao GitHub. O `main` local com os commits do redesenho continua preservado.
- **Escopo do MVP:** voluntariado, contribuições por metas (dinheiro e materiais) e Diário. Propostas de oficinas e certificados estão implementados, mas **fora do MVP por enquanto**: ocultos no app por `src/compartilhado/escopoMvp.ts`, com código, testes e banco preservados. Referência: [docs/mvp/ESCOPO_MVP.md](docs/mvp/ESCOPO_MVP.md).
- **Estilo visual:** o atual de `origin/main`. O redesenho é fonte de funcionalidades, não de estilo; posicionamento pode mudar e elementos faltantes podem ser adicionados.
- **Supabase (`hnawclapixopwjyrpxpq`):** reconciliações 01 e 02 aplicadas em 30/09. A reconciliação `supabase/reconciliacao/20261005150000_contribuicoes_metas_pix.sql` está **pendente**: move o PIX para `configuracao_instituicao`, exige meta aberta para o voluntário contribuir e exclui as tabelas de materiais criadas pela reconciliação 02. Depois de aplicá-la, regenerar `src/servicos/database.types.ts` e remover o bloco provisório `ColunasPix` de `src/servicos/database.api.types.ts`.
- **Verificação local:** `npx tsc --noEmit` sem erros e `npm test` com 117 testes aprovados.
- **Documentação:** índice em [docs/INDICE.md](docs/INDICE.md). Os relatórios de `docs/` são registros datados; cada um abre com um bloco "Situação em 05/10/2026". Quando um relatório divergir deste arquivo, este arquivo prevalece.

### Foto do perfil — implantação em 21/10/2026

A foto pessoal foi implementada para voluntários e gestores no cabeçalho do perfil,
com seleção, recorte quadrado, normalização JPEG até 512 px, substituição e remoção.
É opcional e não interfere na elegibilidade. O armazenamento é privado.
A reconciliação `supabase/reconciliacao/20261021120000_foto_perfil.sql` foi aplicada
no HortaConecta como versão remota `20261021155604`. Bucket, funções, permissões e
geração de caminho sob o papel autenticado foram verificados; os tipos foram
regenerados. A homologação do seletor e do envio de uma foto em aparelho permanece
necessária.
Contrato, permissões e roteiro: [docs/mvp/FOTO_PERFIL.md](docs/mvp/FOTO_PERFIL.md).

## Stack

- **App:** React Native + Expo SDK 57, TypeScript, React Navigation 7. Antes de escrever código, consultar a documentação versionada: https://docs.expo.dev/versions/v57.0.0/ (ver `AGENTS.md`).
- **Backend:** Supabase (BaaS) — Auth, PostgreSQL, Storage, Row Level Security
- **Imagens:** `expo-image-manipulator` instalado para recortar e reduzir fotos de perfil antes do upload. O Diário ainda usa só `quality: 0.8` do `expo-image-picker`, sem redimensionar (B27 pendente).
- **Notificações:** Expo Notifications (prioridade baixa) — tokens em `voluntariado_privado.dispositivos_push` (vários aparelhos por usuário), gravados pelas RPCs `push_registrar_token` e `push_remover_token`; o envio remoto não existe. As notificações do dia a dia vivem em `public.notificacoes` (gatilhos no banco, sino no app via Realtime)
- **Integrações:** WhatsApp via deep link (`wa.me`), PIX estático (chave copia e cola, `expo-clipboard`), ViaCEP para endereço
- **Check-in:** `expo-camera` (leitura de QR) e `react-native-qrcode-svg` (geração)
- **Build/testes:** Expo Go, EAS Build; testes com `node --test` e PGlite (PostgreSQL em memória)
- **Design:** Figma (protótipo navegável validado com a ONG)

Homologação do MVP restrita a **Android**, mas a base de código deve permanecer compatível com iOS — evitar APIs exclusivas de uma plataforma sem fallback.

## Modelo de dados

PostgreSQL no Supabase, mais `auth.users` (gerenciada pelo Supabase Auth). Tabelas transacionais têm `criado_em` e `atualizado_em` (`timestamp with time zone`). O retrato gerado do banco está em `src/servicos/database.types.ts`; o cliente usa `DatabaseAplicativo` (`src/servicos/database.api.types.ts`).

### Perfis (herança 1:1)

`usuarios.id` **é** o `auth.users.id` — não criar identificador próprio. Um usuário é voluntário ou ONG conforme `tipo_perfil`, e os dados específicos ficam na tabela filha correspondente.

| Tabela | Atributos |
| --- | --- |
| `auth.users` | `id` (UUID, PK), `email` — gerenciada pelo Supabase Auth |
| `usuarios` | `id` (UUID, PK/FK → `auth.users`), `nome`, `telefone`, `descricao`, `perfil_instagram`, `tipo_perfil`, `foto_perfil`, `exclusao_solicitada_em`, `criado_em`, `atualizado_em` |
| `voluntarios` | `usuario_id` (PK/FK), `cpf` (único), `data_nascimento`, `profissao`, `disponibilidade_horarios` (JSONB), `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `atualizado_em` |
| `ongs` | `usuario_id` (PK/FK), `cnpj` (único), `razao_social`, `data_criacao`, `responsavel_legal`, `chave_pix` *(legado)*, `nome_beneficiario_pix` *(legado)*, `whatsapp` *(legado)*, `atualizado_em` |

`usuarios.endereco` **não existe**: o endereço pessoal fica em `voluntarios` (CEP só com 8 dígitos, UF com 2 letras) e o institucional em `configuracao_instituicao`. A RLS restringe `usuarios` e `ongs`: cada conta lê o próprio cadastro e a gestão lê todos. Por isso contatos públicos da instituição (WhatsApp, PIX) ficam em `configuracao_instituicao`, não em `ongs`.

### Habilidades e atividades

| Tabela | Atributos |
| --- | --- |
| `habilidades` | `id` (PK), `nome_habilidade` (único), `categoria` |
| `usuario_habilidades` | `usuario_id` (FK), `habilidade_id` (FK) — PK composta |
| `atividades` | `id` (PK), `titulo`, `descricao`, `tipo` (`TAREFA_ONG` / `OFICINA_AUTORAL`), `autor_id` (FK), `data_hora_prevista`, `vagas_totais`, `vagas_ocupadas` (só APROVADA), `carga_horaria`, `status`, `arquivada_em` (data em que a gestão arquivou a atividade; vazia se não foi arquivada), `criado_em`, `atualizado_em` |
| `atividade_habilidades` | `atividade_id` (FK), `habilidade_id` (FK) — PK composta; áreas da tarefa, usadas nas sugestões |
| `inscricoes_atividades` | `id` (PK), `atividade_id` (FK), `usuario_id` (FK), `data_inscricao`, `status_inscricao`, `presenca_confirmada`, `decidido_em`, `decidido_por`, `motivo_decisao`, `checkin_em`, `carga_horaria_registrada` |

Escrita em `inscricoes_atividades` só por RPC (`voluntariado_*`). Tokens de check-in ficam no schema privado `voluntariado_privado`, sem acesso do cliente.

### Arrecadação e transparência

| Tabela | Atributos |
| --- | --- |
| `metas_demandas` | `id` (PK), `titulo`, `descricao`, `tipo` (`FINANCEIRA` / `MATERIAL`), `unidade_medida`, `quantidade_meta`, `quantidade_arrecadada`, `url_imagem_capa`, `data_limite`, `status`, `criado_em`, `atualizado_em` |
| `contribuicoes` | `id` (PK), `meta_id` (FK), `usuario_id` (FK), `quantidade_oferecida`, `url_comprovante` (opcional), `data_envio`, `status_validacao`, `validado_por` (FK → `usuarios`), `validado_em`, `observacao_validacao` |
| `diario_transparencia` | `id` (PK), `titulo`, `descricao_curta`, `texto`, `status` (`PUBLICADA` / `OCULTA`), `imagem_caminho`, `url_imagem` *(legado)*, `revisao`, `atividade_id` (FK, opcional), `data_publicacao`, `autor_id` (FK), `atualizado_em` |

Imagens do Diário ficam no bucket privado `diario-imagens` (até 5 MiB, JPEG/PNG/WebP), lidas por URL assinada de 60 segundos. Escrita no Diário só por RPC com controle de revisão (`diario_salvar_revisao`, `diario_status_revisao`).

`solicitacoes_materiais` e `contribuicoes_materiais` (reconciliação 02) **serão excluídas** pela reconciliação pendente: duplicavam metas e contribuições. Não usar.

### Fora do MVP (presentes no banco)

| Tabela | Uso |
| --- | --- |
| `propostas_oficinas` | Propostas privadas de oficinas (RPCs `oficinas_*`) |
| `certificados` | Certificados de participação com horas **previstas** (RPCs `certificados_*`) |

### Configuração

| Tabela | Atributos |
| --- | --- |
| `configuracao_instituicao` | `id` (registro único), `nome_curto`, `nome_completo`, `cidade`, `uf`, `endereco`, `chamada`, `sobre`, `cor_primaria`, `cor_acento`, `url_logo`, `site`, `telefone`, `whatsapp`, `email_contato`, `chave_pix` *(pendente)*, `nome_beneficiario_pix` *(pendente)*, `atualizado_em` |

Registro único, referente à Horta Comunitária Guaporé. Nome da instituição, cores, logo, textos e canais de contato vêm daqui — **não fixar esses valores no código**. Leitura pública; só a gestão altera. A estrutura já prevê o uso por outras ONGs no futuro, mas isso não é escopo do MVP.

## Regras de negócio

**Perfil progressivo.** Cadastro inicial pede só nome, e-mail e senha, e libera a navegação básica. Candidatar-se a tarefas exige cadastro completo do voluntário. A liberação é decidida **pelo banco em tempo de execução** (`voluntariado_elegibilidade`): CPF, data de nascimento, profissão, disponibilidade de horários, ao menos uma habilidade e endereço mínimo (logradouro, número e cidade). Não existe campo `nivel_cadastro` — ele foi removido do modelo justamente para evitar estado duplicado e inconsistente. O perfil é um hub de seções; cada seção salva só suas chaves por `voluntariado_salvar_perfil`, reenviando sempre as habilidades atuais (a RPC substitui esse conjunto).

**Atividades.** `TAREFA_ONG` é publicada pela gestão; `OFICINA_AUTORAL` é tipo legado, e as propostas de oficina usam `propostas_oficinas` (fora do MVP). Voluntários se candidatam via RPC; a gestão faz a triagem. Só candidaturas APROVADA ocupam vaga; PENDENTE pode exceder a capacidade. Após a primeira candidatura, título, data, carga horária, tipo e autor da atividade ficam imutáveis. Presença é confirmada por check-in com QR exibido pela gestão (token de até 5 minutos; janela de 30 minutos antes do início até o fim previsto). A carga horária registrada é a **prevista**, não medida.

**Doações (apadrinhamento).** Metas em dinheiro (PIX) ou de materiais. O pagamento acontece **fora do app**: o doador copia a chave PIX estática (vinda de `configuracao_instituicao.chave_pix`), transfere e informa o valor; a contribuição entra PENDENTE. O comprovante em imagem é opcional por enquanto (upload previsto no B22). A baixa é manual — a gestão confere e o sistema registra `validado_por`, `validado_em` e `observacao_validacao`. A gestão também registra doações recebidas em mãos, já como APROVADA, desde que o doador seja voluntário cadastrado. `quantidade_arrecadada` é calculada pelo trigger `atualizar_arrecadacao_meta`, somando só APROVADA; o app nunca grava esse total. O voluntário só contribui em meta ABERTA. Metas não são excluídas pelo app (encerrar, cancelar ou reabrir), para preservar o histórico. Não há integração bancária nem conciliação automática.

**WhatsApp.** Deep link usando `configuracao_instituicao.whatsapp`, no detalhe da atividade e da meta. Sem número cadastrado, o botão não aparece.

**Dados da ONG.** O perfil da gestão (B30) tem seções de conta, dados institucionais (por `gestao_salvar_perfil`), WhatsApp e PIX (gravados em `configuracao_instituicao`). A seção de PIX fica indisponível até a reconciliação pendente ser aplicada.

**"Combinam com você".** O Início do voluntário mostra "Sugeridas para você": tarefas abertas, futuras e com vaga que cabem na disponibilidade dele e, quando a gestão marcou áreas (`atividade_habilidades`), cuja categoria coincide com a de alguma habilidade do voluntário. É só um filtro de recomendação — ninguém é inscrito automaticamente; não evoluir para pareamento automático (ver Fora de escopo).

**Imagens.** Sempre comprimir no dispositivo com `expo-image-manipulator` antes do upload (pendente, B27). No banco guarda-se apenas o caminho no Supabase Storage.

**LGPD.** A instituição atende crianças e adolescentes. Restringir a exibição de imagens de menores no diário. A solicitação de exclusão de dados pelo voluntário grava `exclusao_solicitada_em` para tratamento pela gestão (RNF0004; não há item de backlog próprio para a tela de solicitação).

**RLS.** Todo acesso passa por Row Level Security. Ao criar tabela ou coluna nova, criar também a política correspondente — nunca contornar RLS com service role no cliente.

**Banco remoto.** Mudanças no Supabase vão em arquivos de `supabase/reconciliacao/`, com pré-condições e transação própria, aplicados sobre o remoto já reconciliado. As migrations de `supabase/migrations/` são histórico local e **não** devem ser aplicadas no remoto; não usar `db push` sobre esse conjunto. Testar cada reconciliação em PGlite sobre `tests/fixtures/reconciliacao-mvp-remoto.sql` antes de aplicar.

## Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF0001 | Cadastro e Autenticação |
| RF0002 | Gestão do Perfil do Usuário |
| RF0003 | Controle de Acesso por Perfil |
| RF0004 | Publicação de Tarefas |
| RF0005 | Consulta e Candidatura a Tarefas |
| RF0006 | Proposta de Oficina Autoral |
| RF0007 | Triagem de Candidaturas e Oficinas |
| RF0008 | Histórico de Participação e Impacto |
| RF0009 | Contato via WhatsApp e Compartilhamento |
| RF0010 | Gestão e Mural de Metas |
| RF0011 | Doação e Acompanhamento de Contribuições |
| RF0012 | Validação de Contribuições |
| RF0013 | Diário de Transparência |
| RF0014 | Notificações Push |
| RF0015 | Gestão dos Dados da Instituição |

### Não funcionais

| ID | Requisito |
| --- | --- |
| RNF0001 | Tecnologia de Desenvolvimento |
| RNF0002 | Plataforma e Compatibilidade |
| RNF0003 | Proteção de Imagens de Menores |
| RNF0004 | Proteção de Dados Pessoais e Financeiros |
| RNF0005 | Desempenho e Consumo de Dados |
| RNF0006 | Arquitetura e Segurança do Backend |
| RNF0007 | Auditoria de Registros |
| RNF0008 | Parametrização e Extensibilidade |
| RNF0009 | Usabilidade |
| RNF0010 | Tratamento de Falhas de Conexão |
| RNF0011 | Segurança da Autenticação |

## Backlog e situação atual

34 itens, 168 horas estimadas. Situação ao final da Sprint 2 (05/10/2026): 16 concluídos (67h), 5 em desenvolvimento (32h), 13 em planejamento (69h).

| ID | Funcionalidade | Requisito | Prioridade | Estimativa | Situação |
| --- | --- | --- | --- | --- | --- |
| B01 | Tela de cadastro simplificado | RF0001 | Alta | 3h | Concluído |
| B02 | Criação automática do registro em usuarios (trigger) | RF0001 | Alta | 2h | Concluído |
| B03 | Login, logout e sessão persistida | RF0001 | Alta | 3h | Concluído |
| B04 | Recuperação de senha por e-mail | RF0001 | Média | 2h | Concluído |
| B05 | Rotas protegidas e navegação por perfil de acesso | RF0003 | Alta | 3h | Concluído |
| B06 | Carga inicial da tabela de habilidades | RF0002 | Alta | 2h | Concluído |
| B07 | Dados complementares com validação de CPF | RF0002 | Alta | 3h | Concluído |
| B08 | Seleção de habilidades e disponibilidade de horários | RF0002 | Alta | 7h | Concluído |
| B09 | Verificação do perfil completo | RF0003 | Alta | 3h | Concluído |
| B10 | Formulário e gestão de tarefas pela ONG | RF0004 | Alta | 10h | Concluído |
| B11 | Políticas de RLS e validações das tarefas | RF0004 | Alta | 4h | Concluído |
| B12 | Lista e detalhe de tarefas abertas | RF0005 | Alta | 6h | Concluído |
| B13 | Candidatura com controle de vagas | RF0005 | Alta | 6h | Concluído |
| B14 | Tela "Minhas candidaturas" com cancelamento | RF0005 | Média | 4h | Concluído |
| B15 | Proposta de oficina autoral | RF0006 | Média | 3h | Em planejamento |
| B16 | Triagem de candidatos e oficinas | RF0007 | Média | 9h | Em desenvolvimento |
| B17 | Confirmação de presença | RF0007 | Média | 2h | Em planejamento |
| B18 | Integração com WhatsApp e compartilhamento | RF0009 | Média | 6h | Em planejamento |
| B19 | Gestão de metas pela ONG | RF0010 | Alta | 5h | Concluído |
| B20 | Mural de metas com progresso | RF0010 | Alta | 4h | Concluído |
| B21 | Chave PIX copia e cola e registro da contribuição | RF0011 | Alta | 6h | Em desenvolvimento |
| B22 | Upload de comprovante e armazenamento privado | RF0011 | Alta | 6h | Em desenvolvimento |
| B23 | Fila e validação manual de comprovantes | RF0012 | Média | 8h | Em desenvolvimento |
| B24 | Atualização automática do total arrecadado | RF0012 | Alta | 3h | Em desenvolvimento |
| B25 | Publicação no diário de transparência | RF0013 | Média | 6h | Em planejamento |
| B26 | Feed do diário com restrição de imagens de menores | RF0013 | Média | 6h | Em planejamento |
| B27 | Compressão local de imagens | RNF0005 | Média | 6h | Em planejamento |
| B28 | Configuração e parametrização da instituição | RF0015 | Média | 8h | Em planejamento |
| B29 | Notificações push (Expo) | RF0014 | Baixa | 10h | Em planejamento |
| B30 | Tela de perfil da ONG (dados cadastrais, PIX e WhatsApp) | RF0015 | Alta | 4h | Em planejamento |
| B31 | Edição de perfil e foto do usuário | RF0002 | Média | 5h | Em planejamento |
| B32 | Histórico de participação e mensagem de impacto | RF0008 | Média | 6h | Em planejamento |
| B33 | Tela "Minhas contribuições" com situação de validação | RF0011 | Média | 4h | Em planejamento |

### Implementado na branch `integracao/mvp` (aguardando revisão da equipe)

A coluna "Situação" acima é o registro oficial da Sprint 2. A branch de integração já contém código para itens ainda marcados como em desenvolvimento ou planejamento; a equipe decide se atualiza a situação após revisar e homologar.

| ID | O que existe na branch | Falta |
| --- | --- | --- |
| B15 | Propostas de oficina com decisão da gestão | Oculto no app: fora do MVP por decisão de 05/10 |
| B16 | Triagem de candidatos com aprovação/recusa e motivo (RPC `voluntariado_decidir`) | Triagem de oficinas (fora do MVP); homologação |
| B17 | Check-in por QR com token temporário | Homologação em aparelho |
| B18 | WhatsApp no detalhe da atividade e da meta | Compartilhamento; número cadastrado pela gestão |
| B21 | Cópia da chave PIX e registro da contribuição (PENDENTE) | Homologação (migration `20261005150000_contribuicoes_metas_pix.sql` aplicada em 23/10/2026) |
| B22 | Anexo opcional do comprovante, bucket privado `comprovantes` e visualização pela gestão | Homologar com Storage real (migration `20261023170000_comprovantes_storage.sql` aplicada em 23/10/2026) |
| B23 | Fila geral de conferência (todas as metas), confirmar/recusar com observação (motivo obrigatório ao recusar) e registro de doação recebida | Aplicar `20261023210000_contribuicoes_conferencia.sql` e homologar |
| B24 | Total recalculado pelo trigger do banco | Homologação |
| B25 | Publicação, edição e ocultação com revisão e imagem privada | Homologação com Storage real |
| B26 | Feed só com publicações PUBLICADA | Regra específica para imagens de menores |
| B30 | Perfil da gestão em seções (conta, institucional, WhatsApp, PIX) | Seção de PIX depende da reconciliação pendente |
| B31 | Perfil em seções, busca de CEP e foto pessoal com troca/remoção; banco atualizado em 21/10 | Homologar seleção e envio de foto em aparelho |
| B32 | Histórico de participação com carga prevista | Mensagem de impacto |
| B33 | "Minhas contribuições" com etiqueta de situação da conferência e filtro por situação | Homologação em dispositivo |

## Cronograma

| Sprint | Período | Escopo |
| --- | --- | --- |
| Sprint 1 | 27/07 a 14/09/2026 | Requisitos, protótipo, modelagem do banco, refinamento do backlog; início do cadastro/login (B01–B05) e do CRUD de atividades (B10, B12) |
| Sprint 2 | 15/09 a 05/10/2026 | Concluídos: B01–B14 (autenticação, perfil e habilidades, tarefas e candidatura) e B19–B20 (mural de metas). Iniciados e não concluídos: B16 (triagem) e B21–B24 (contribuições, comprovantes e validação) |
| Sprint 3 | 06/10 a 16/11/2026 | Primeiro concluir B16, B17 e B21–B24; depois B28 e B30 (perfil da ONG e parametrização), B25–B27 (diário e compressão), B31–B34 (perfil do usuário, apresentação e históricos), B18 e B29 (WhatsApp e notificações) e B15 (oficina autoral) |
| Sprint final | 17/11 a 14/12/2026 | Testes com ONG e voluntários, correções, publicação na Google Play, treinamento e handover |

## Estrutura do código

O código fica em `src/`, organizado por funcionalidade. `index.ts` registra `src/app/App.tsx`.

```text
src/
  app/                 App, abas principais e abas do convidado
  funcionalidades/
    autenticacao/      TelaLogin, useAcesso, useSessao, ContextoSessao (useSessaoAtual), recuperação de senha
    modoGestor/        alternância ONG ↔ voluntário
    voluntariado/      atividades, candidaturas, check-in, áreas e sugestões
    metas/             metas em dinheiro e de materiais, contribuições
    diario/            Diário de Transparência
    perfil/            perfis do voluntário e da gestão
    inicio/            resumo da tela inicial (api.ts consulta, regras.ts monta)
    convidado/         telas do acesso como convidado
    oficinas/          fora do MVP (ver escopoMvp.ts)
    certificados/      fora do MVP (ver escopoMvp.ts)
  compartilhado/
    componentes/       Ui (Botao, Campo, Aviso, AbasFiltro), TelaFluxo, Icone, CampoData, LimiteErro, memoTela
    hooks/             useConsulta, useAcao, useConfiguracaoInstituicao
    utils/             erros, datas, máscaras, validadores, confirmar, whatsapp
    api.ts             consultas usadas por várias funcionalidades (configuração da instituição)
    esquemas.ts        base do Zod: configuração, esquemaDe e validarResposta
    tema.ts, tipos.ts, escopoMvp.ts
  servicos/            cliente Supabase e tipos do banco
```

Dentro de cada funcionalidade:

| Arquivo | Conteúdo |
| --- | --- |
| `api.ts` | Acesso ao Supabase (tabelas, RPCs, Storage). Lança o erro em vez de devolvê-lo. As telas não importam `supabase` diretamente. |
| `regras.ts` | Regras puras, sem imports de React ou Supabase, testáveis no Node. |
| `tipos.ts` | Tipos do domínio, derivados de `database.types.ts` (`Tables<…>`, `Enums<…>`) sempre que possível. |
| `esquemas.ts` | Esquemas Zod das respostas jsonb das RPCs (ver [Validação das respostas do servidor](#validação-das-respostas-do-servidor-zod)). Só existe nas funcionalidades que usam RPCs desse tipo. |
| `Pilha<Fluxo>.tsx` | Navegador em pilha e tipos das rotas. |
| `telas/` | Uma tela por arquivo (`Tela<Nome>.tsx`). |
| `componentes/` | Componentes usados só por essa funcionalidade. |

O que é usado por mais de uma funcionalidade vai para `compartilhado/`.

## Convenções

- Identificadores de banco, tabelas e colunas em **português, snake_case** — manter o padrão já existente.
- Código TypeScript (componentes, funções, variáveis) em inglês ou português, mas **consistente com os arquivos vizinhos**; textos de interface sempre em português.
- Tipar as respostas do Supabase; evitar `any` e `as unknown as`. Enums e linhas de tabela vêm de `database.types.ts`, não são redeclarados à mão. Respostas jsonb de RPC passam por um esquema Zod (seção abaixo).
- Validações de formulário e de regra de negócio ficam em `regras.ts` e **lançam `Error`** com a mensagem para o usuário; quem chama (`useAcao`, `SecaoPerfil`, `useAcesso`) mostra a mensagem.
- Dados da sessão (`usuarioId`, `nome`, `ehGestao`, `convidado`, `sair`) vêm de `useSessaoAtual()`, não de props.
- Rotas protegidas por autenticação ficam sob o controle do React Navigation.
- Imports: relativos dentro da mesma funcionalidade (`../api`); entre funcionalidades e para `compartilhado`/`servicos`, pelo alias `@/` (`@/compartilhado/tema`), configurado em `tsconfig.json`.
- Formatação pelo Prettier (`.prettierrc.json`) e lint pelo ESLint com `eslint-config-expo` (`eslint.config.js`). `npm run format` formata; `npm run lint` verifica.
- Fim de linha LF em todo o repositório (`.gitattributes`); as pré-condições das reconciliações comparam hashes de funções.
- Antes de commitar, rodar `npm run typecheck`, `npm run lint` e `npm test`.
- Os testes (`tests/*.test.cjs`) carregam os módulos de `src/` pelo caminho e injetam as dependências pelo especificador do import (`'@/servicos/supabase'`, `'./regras'`). Ao mover um arquivo ou mudar um import, ajustar os testes correspondentes.

## Validação das respostas do servidor (Zod)

As consultas a tabelas já chegam tipadas pelo `database.types.ts`. As **RPCs que devolvem `jsonb`** não: para o TypeScript o retorno é `Json`, e antes o app fazia `as unknown as Tipo`, o que deixava passar em silêncio qualquer diferença entre o SQL e a tela. Essas respostas agora passam por um esquema [Zod](https://zod.dev) (versão 4, fixada em `~4.6`).

**Quando usar:** em toda RPC cujo retorno seja `jsonb` (hoje: voluntariado, Diário, oficinas e certificados). Consultas `.from('tabela')` e RPCs que devolvem tipos simples (`boolean`, `bigint`) não precisam.

**Como fazer:**

1. O tipo continua em `tipos.ts` (ou vem de `database.types.ts`).
2. O esquema fica em `<funcionalidade>/esquemas.ts` e é amarrado ao tipo com `esquemaDe<Tipo>()`:

   ```ts
   export const esquemaPublicacao = esquemaDe<Publicacao>()(
     z.object({ id: z.number(), texto: z.string().nullable() /* … */ }),
   );
   ```

   `esquemaDe` **não compila** se o esquema diferir do tipo em qualquer campo (nome, opcional, `null`). Enums usam `Constants.public.Enums`, gerado junto com `database.types.ts`.
3. No `api.ts`, a resposta passa por `validarResposta(esquema, data, 'Mensagem para o usuário.')`. Fora do formato, ela lança essa mensagem; em desenvolvimento, o campo problemático aparece no console.

**Cuidados:**

- **Campos descartados.** O `z.object` remove os campos que o esquema não declara (por exemplo, `vagas_ocupadas` no detalhe da atividade). Como `esquemaDe` exige que esquema e tipo tenham os mesmos campos, só some o que o tipo também não tem. Para a tela usar um campo novo, acrescente-o **no tipo e no esquema**.
- **`null` vindo do SQL.** `LEFT JOIN`, `to_jsonb` de colunas opcionais e `SELECT … INTO` podem gerar `null`. Declare `.nullable()` conforme o SQL, não conforme o caso comum. Exemplo: `profissao` e `disponibilidade_horarios` dos candidatos.
- **Mudou uma RPC?** Atualize o tipo, o esquema e o teste `tests/esquemas-rpc.test.cjs`, que roda as RPCs reais (PGlite, sobre o catálogo remoto sintético) e valida cada resposta com os esquemas. Ele é o que garante que SQL e app falam a mesma língua.
- **Hermes.** `compartilhado/esquemas.ts` liga `z.config({ jitless: true })`. Sem isso, o Zod 4 tenta gerar código com `new Function`, recurso que o Hermes (motor do React Native) pode não ter; o Zod detecta e recua sozinho, mas com a opção ligada o comportamento é o mesmo no celular, no web e nos testes. Não remover.
- **Testes.** Os testes que carregam um `api.ts` com esquemas usam `tests/apoio/esquemas.cjs`, que compila os esquemas com o Zod real.

## Padrões adotados

| Padrão | Onde | Por quê |
| --- | --- | --- |
| Facade | `api.ts` de cada funcionalidade | As telas não conhecem o Supabase; trocar uma consulta não mexe na tela. |
| Adapter | `esquemas.ts` + `validarResposta` | Converte e valida o `jsonb` das RPCs para os tipos do app. |
| Provider (Context) | `ContextoSessao`, `ContextoPerfil*`, `ProvedorModoGestor` | Dados compartilhados sem repassar props por várias camadas. |
| Máquina de estados | `autenticacao/regras.ts` (`proximaFase`) + `useReducer` em `useAcesso` | A tela de acesso só pode estar em uma fase válida. |
| Hooks de comportamento | `useConsulta`, `useAcao`, `useAcesso` | Reaproveitam carga, envio e estado sem repetir código nas telas. |
| Memo de tela | `memoTela` | Repõe a otimização que o render callback das pilhas desliga. |
| Error boundary | `LimiteErro` | Um erro de renderização mostra uma tela de recuperação em vez de fechar o app. |
| Feature flags | `escopoMvp.ts` | Recursos prontos, mas fora do MVP, ficam ocultos sem apagar código. |

Decidido **não** adotar por enquanto: Strategy por papel (as diferenças entre gestão e voluntário são poucas e pontuais), Repository em classes, Redux e TanStack Query (exagero para o tamanho atual e para o prazo do MVP).

## Fora de escopo do MVP

Não implementar sem combinar com a equipe:

- *Matching* automático entre habilidades de voluntários e tarefas (escalar ou inscrever alguém sem ação dele). As sugestões do Início são permitidas porque só recomendam.
- Propostas de oficinas e certificados de participação: implementados, mas ocultos no app até nova decisão (ver [ESCOPO_MVP.md](docs/mvp/ESCOPO_MVP.md))
- Emissão de certificados de horas em PDF (o histórico de horas do RF0008 é apenas consulta em tela)
- Integração bancária ou PIX dinâmico com conciliação automática
- Cadastro de múltiplas instituições (a estrutura prevê, o MVP não entrega)
- Build e homologação para iOS

## Dados sensíveis

Chaves do Supabase ficam em variáveis de ambiente (`.env`, a partir de `.env.example`), nunca versionadas. Não commitar dados reais de voluntários, CPF, CNPJ, chave PIX de produção ou fotos de crianças e adolescentes — usar dados fictícios em testes e seeds.

## Observações

Caso tenha alguma dúvida ou tiver alguma alteração crítica no projeto, faça perguntas para confirmação.
