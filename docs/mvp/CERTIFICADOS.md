# Prioridade 5 — Certificados de participação

> **Situação em 05/10/2026.** Recurso **fora do MVP por enquanto** ([ESCOPO_MVP.md](ESCOPO_MVP.md)).
> - **Requisitos e backlog ([CLAUDE.md](../../CLAUDE.md)):** complemento do RF0008 (histórico de participação); sem item próprio no backlog. PDF segue fora de escopo.
> - **App:** oculto por `src/lib/escopoMvp.ts` (`recursosPosMvp.certificados = false`). O indicador
>   de horas do Início leva ao histórico de participação. Código e testes preservados.
> - **Banco:** `certificados` e as RPCs `certificados_*` estão no remoto desde 30/09, pela
>   [reconciliação 02](../../supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql); continuam lá, sem uso pelo app.
>   A migration `20260924200000` fica como histórico; não aplicar no remoto.
> - A carga horária continua sendo **prevista**, registrada no check-in; não é tempo medido.
> - **Para reativar:** mudar a flag para `true`, revisar textos de interface e homologar.
>
> As seções abaixo preservam o registro de 24/09; contagens de testes são daquela data.

> Correção integrada: título/data/carga da atividade são protegidos após a primeira
> candidatura. Certificados existentes não foram reescritos; divergências anteriores
> exigem decisão administrativa. Ver [CORRECOES_MVP.md](CORRECOES_MVP.md).

## Auditoria e decisão

Não havia tabela, tela, serviço ou biblioteca de PDF para certificados. O histórico
da Prioridade 1 já expõe inscrições, presença, `checkin_em` e
`carga_horaria_registrada`. Esta última é uma cópia da **carga horária prevista**
da atividade, registrada pelo servidor no check-in; não é tempo medido.

Foram reutilizados esse fluxo, `usuarios`, `atividades`,
`configuracao_instituicao`, cliente Supabase, sessão, componentes e navegação.
As decisões seguem a documentação [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
consultada antes da implementação. Não foi adicionada biblioteca.

A tabela nova `certificados` preserva a emissão, seu identificador e o conteúdo
oficial naquele momento. Derivar todo o conteúdo a cada abertura mudaria um
certificado já emitido quando o nome do usuário ou da instituição fosse editado.
A persistência é limitada a esses dados de emissão; não duplica atividades ou
participações inteiras.

## Elegibilidade e origem dos dados

A emissão é validada exclusivamente pela RPC no banco:

- inscrição pertence à conta solicitante;
- status APROVADA e `presenca_confirmada = true`;
- `checkin_em` existe e não está no futuro;
- `carga_horaria_registrada` é positiva e finita;
- atividade em ABERTA, ENCERRADA ou REALIZADA, com data prevista já iniciada;
- nome do voluntário e título da atividade não estão vazios;
- configuração institucional contém um registro único com nome completo válido.

Presença legada sem data de check-in ou sem carga horária registrada não é
convertida automaticamente. Aprovação isolada, candidatura pendente, recusada
ou cancelada e atividade cancelada não habilitam nova emissão. A tela informa
falhas de emissão; cadastro institucional ausente bloqueia sem inventar nome.

| Conteúdo | Origem na emissão |
| --- | --- |
| Voluntário | usuarios.nome, vinculado à inscrição |
| Instituição | configuracao_instituicao.nome_completo |
| Atividade e data prevista | atividades.titulo e data_hora_prevista |
| Carga horária prevista | inscricoes_atividades.carga_horaria_registrada |
| Emissão | relógio do servidor |
| Identificador | UUID gerado no banco, apresentado como HC-UUID |
| Projeto | identificação Horta Conecta no texto de apresentação |

**O certificado não atesta horas efetivamente realizadas.** O texto contém essa
limitação explicitamente e chama a data de “data prevista da atividade”. Há
check-in, mas não checkout nem apuração de permanência. Não é exigido esperar
o término previsto para emitir: comprova participação registrada, não conclusão
integral da atividade.

## Banco, concorrência e RLS

Migration nova: `20260924200000_certificados.sql`. Não altera migrations anteriores
nem dados existentes. Depende das tabelas iniciais, configuração institucional,
colunas de check-in e função `voluntariado_privado.gestao` da Prioridade 1.

`certificados`: UUID (PK), participacao_id (FK RESTRICT e UNIQUE), usuario_id
(FK RESTRICT), emitido_em, nome_voluntario, instituicao, atividade,
data_atividade, carga_horaria_prevista. Índice usuário/data. Constraints validam
textos, horas e unicidade. Não há bucket, arquivos no banco ou novos triggers.

- `certificados_emitir(participacao)`: recebe somente o ID da participação.
  Bloqueia atividade e inscrição, valida os registros e grava o snapshot.
  Emissão repetida retorna o mesmo UUID e a mesma data, sem sobrescrever dados.
- `certificados_listar()`: retorna emitidos acessíveis e participações próprias
  disponíveis para emissão. Não emite implicitamente ao abrir a lista.
- `certificados_detalhe(uuid)`: consulta com autorização novamente no servidor.

RPCs SECURITY DEFINER com search_path vazio, execução somente por authenticated.
RLS de SELECT permite somente titular ou gestão. Políticas restritivas reforçam
esse limite mesmo com uma política permissiva adicional. INSERT/UPDATE/DELETE
diretos são revogados e bloqueados por políticas restritivas. Anônimos não têm
acesso. Gestão consulta certificados emitidos; não emite em nome de terceiros
nem altera o snapshot. O modelo mantém a instituição única já existente.

Certificados já emitidos permanecem registros históricos e não são revogados
automaticamente por alterações posteriores. Não há função administrativa de
correção/revogação no MVP. FKs RESTRICT impedem apagar silenciosamente a
participação ou o usuário de um certificado. Uma futura exclusão de conta deve
considerar essa retenção; nenhuma rotina de exclusão foi alterada nesta etapa.

## Interface e obtenção

Início → Meus certificados → Emitir e visualizar / Visualizar certificado.
Gestão: Início → Certificados emitidos → Visualizar certificado.
As rotas transportam somente IDs; detalhes são consultados novamente. Há loading,
lista vazia, erros com nova tentativa e bloqueio de emissão durante envio.

A visualização é nativa, com texto selecionável. O botão “Compartilhar texto do
certificado” abre o compartilhamento nativo React Native. Uma falha mostra erro;
o aplicativo não afirma que houve entrega ao destinatário. O compartilhamento
é iniciado pelo usuário e inclui apenas os dados exibidos, sem CPF ou contato.

**Não há PDF, impressão, download de arquivo, assinatura digital, portal público
ou validação pública.** A visualização e o compartilhamento em texto são a
solução mínima desta etapa. O UUID identifica o registro dentro do sistema; não
é assinatura nem prova criptográfica da autenticidade de uma cópia textual.
QR de check-in não é utilizado como validação de certificado. Essa possibilidade
exigiria outro contrato de acesso e permanece fora do MVP.

## Testes locais e homologação

Resultado em 24/09/2026: TypeScript passou; suíte completa com **56 testes/subtestes
aprovados**, incluindo 7 de certificados; bundle JavaScript Android exportado
com sucesso (1.272 módulos). Não houve execução em dispositivo ou Supabase remoto.

Automação cobre aprovação sem presença, check-in executado pela RPC existente,
emissão idempotente, identificadores distintos, dados oficiais, preservação do
snapshot, configuração ausente, isolamento, leitura pela gestão, bloqueio de
escrita direta e RLS mesmo após concessões adicionais no teste. Também cobre
cancelada/pendente/recusada, falta de participação, data de check-in ou horas,
atividade cancelada e conteúdo mínimo do texto com a ressalva de horas previstas.

Os testes PostgreSQL usam PGlite com fixtures locais do schema inicial e todas
as migrations em ordem. Não são validação do Supabase remoto e as fixtures não
devem ser aplicadas nele. Testes sequenciais de emissão repetida não comprovam
concorrência real entre conexões; homologar esse cenário remotamente.

Comandos de verificação:

```
node node_modules/typescript/bin/tsc --noEmit
node --test tests/*.test.cjs
node node_modules/expo/bin/cli export --platform android --no-bytecode --output-dir .expo/validacao-certificados --max-workers 2
git diff --check
```

O bundle utiliza URL e chave Supabase fictícias, não executa chamadas remotas e
não é APK. Navegação e tratamento de compartilhamento foram analisados
estaticamente; interação nativa exige Android.

### Roteiro de homologação remota e Android

1. Conferir schema, migrations prévias e nome oficial da configuração. Aplicar
   somente a migration nova em homologação. Não reconstruir o banco remoto.
2. Com dois voluntários e gestão, aprovar inscrição sem check-in: não deve
   aparecer disponível e emissão direta via RPC deve falhar.
3. Fazer check-in autorizado pelo fluxo existente. Abrir Meus certificados,
   emitir, conferir dados oficiais, data, horas previstas e identificador.
4. Repetir emissão, inclusive simultaneamente em duas sessões da mesma conta:
   deve retornar um único certificado. Outro usuário não pode consultar/emitir.
5. Conferir gestão em modo de consulta e tentar alterar dados/status/presença via
   API como voluntário. Tentativas devem ser recusadas ou não afetar registros.
6. Testar certificado indisponível, conexão interrompida, nova tentativa, retorno
   das telas e troca de usuário; não pode permanecer conteúdo da conta anterior.
7. Em Android, abrir compartilhamento, cancelar, escolher um aplicativo e conferir
   o texto recebido. Validar acentos, texto longo, rolagem e seleções. Nenhuma
   entrega ou geração de PDF foi testada ou prometida.

Sem alterações em PIX, pagamentos ou limpeza do legado financeiro.
