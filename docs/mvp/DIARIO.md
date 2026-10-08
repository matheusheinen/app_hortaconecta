# Prioridade 3 — Diário de Transparência

> **Situação em 05/10/2026.** Fluxo **dentro do MVP** ([ESCOPO_MVP.md](ESCOPO_MVP.md)).
> - **Requisitos e backlog ([DOCUMENTACAO.md](../../DOCUMENTACAO.md)):** RF0013, RNF0003 (imagens de menores), RNF0005 (consumo de dados); B25, B26, B27.
> - **Banco:** colunas, RPCs com revisão (`diario_salvar_revisao`/`diario_status_revisao`) e o
>   bucket privado `diario-imagens` estão no remoto desde 30/09, pela
>   [reconciliação 02](../../supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql).
>   A migration `20260924160000` fica como histórico; não aplicar no remoto.
> - **Tipos:** o contrato local `DatabaseMateriais` citado abaixo foi substituído por
>   `DatabaseAplicativo` (`src/servicos/database.api.types.ts`), derivado dos tipos regenerados.
> - **Lacuna conhecida (RNF0005, B27):** o app ainda não comprime nem redimensiona a imagem com
>   `expo-image-manipulator`, como pede o DOCUMENTACAO.md; usa só `quality: 0.8` do seletor.
> - **Legado financeiro:** metas e contribuições em dinheiro voltaram a fazer parte do MVP
>   ([CONTRIBUICOES.md](CONTRIBUICOES.md)); as menções a "legado financeiro" abaixo são de 24/09.
> - **Exclusão (05/10):** a gestão pode excluir publicações (botão no detalhe), pela RPC
>   `diario_excluir_revisao` da [reconciliação 20261005170000](../../supabase/reconciliacao/20261005170000_diario_excluir.sql),
>   **pendente de aplicação no remoto**. Substitui a decisão "desativação é ocultação, não DELETE"
>   descrita abaixo; ocultar continua disponível. O app apaga a imagem pela API Storage depois
>   da exclusão; se falhar, o arquivo fica sem vínculo e invisível à comunidade.
> - **Pendente:** Storage real (upload, URLs assinadas, limites HTTP) e homologação em Android.
>
> As seções abaixo preservam o registro de 24/09; contagens de testes são daquela data.

> Correção integrada: a edição e a visibilidade agora exigem `revisao` nas RPCs
> `diario_salvar_revisao`/`diario_status_revisao`. As versões antigas não são
> executáveis pelo cliente. Ver [CORRECOES_MVP.md](CORRECOES_MVP.md).

Implementação de 24/09/2026. Escopo: publicações institucionais, uma imagem
opcional, feed, detalhes e administração pela gestão. Não implementa oficinas,
certificados, notificações, WhatsApp, pagamentos ou limpeza financeira.

## Decisões aprovadas para o MVP

- Acesso somente por usuários autenticados.
- No máximo uma imagem por publicação, opcional, até **5 MiB** (5.242.880 bytes).
- Bucket privado **diario-imagens** e URLs assinadas por **60 segundos**.
- O feed da comunidade exibe somente PUBLICADA. OCULTA permanece na listagem
  administrativa da gestão para edição/republicação, sem acesso do voluntário.
- Não haverá importação automática de imagens legadas nesta etapa.
- Não há limpeza automática de objetos sem vínculo.

## Auditoria e reutilização

Já existiam a aba diario (TelaEmBreve), a tabela diario_transparencia,
tipos gerados, FK opcional para atividades e FK obrigatória para usuarios,
índice por data e RLS histórica. Não havia feed/formulário/RPCs do Diário nem
bucket/policies de Storage no repositório. O Storage remoto não estava disponível
para inventário: a ausência de configuração local não comprova ausência remota.

Reutilizados: tabela e colunas existentes, tema, Ui (Campo/Botao/Aviso),
TelaFluxoVoluntariado/CartaoFluxo, useDadosVoluntariado, sessão e identificação
de gestão da Prioridade 1. Os nomes dos componentes compartilhados foram
preservados para evitar refatoração geral.

A nova implementação não usa url_imagem legada para carregar URLs arbitrárias.
Essa coluna e seus valores permanecem intactos. Texto legado aparece usando
descricao_curta quando texto ainda é nulo. Nenhum dado legado foi convertido.
A FK atividade_id é preservada, mas vinculação de atividade não foi adicionada
ao formulário nesta etapa.

## Estrutura e navegação

- Início → Ver Diário; aba Diário → lista → Ler publicação → detalhes.
- Gestão: Criar publicação / Editar publicação; título, relato completo, imagem
  opcional com prévia e visibilidade PUBLICADA ou OCULTA.
- Voluntários: leem apenas PUBLICADA. Aqui "pública" significa comunidade
  autenticada do app; não há feed anônimo nem interface web.
- Instituição única, conforme arquitetura atual; autor_id vem de auth.uid().
  A apresentação identifica "Gestão da instituição", sem expor dados pessoais.
- Publicações ocultas ficam disponíveis à gestão e podem ser republicadas.
  Desativação é ocultação, não DELETE. Autor e data_publicacao originais são
  preservados ao editar/ocultar/republicar; atualizado_em registra a alteração.
- Título: 3–120 caracteres; texto: 1–20.000. descricao_curta mantém os primeiros
  280 caracteres do relato para compatibilidade. Feed limita visualmente o
  resumo; detalhes mostram o texto completo.
- Loading, erro com nova tentativa e lista vazia usam componentes existentes.
  Erro de imagem não impede leitura do texto. Erros de upload/salvamento aparecem
  no formulário e liberam os botões. Resposta tardia após sair do formulário
  não executa outro voltar().

Arquivos principais: PilhaDiario.tsx, TelasDiario.tsx, ImagemDiario.tsx,
diario.ts, diario.types.ts e regrasDiario.ts. O contrato local de RPCs estende
DatabaseMateriais; database.types.ts não foi apresentado como regenerado.
*(30/09: tipos regenerados; o cliente usa `DatabaseAplicativo`.)*

## Banco e migration

20260924160000_diario_transparencia.sql deve ser aplicada após as anteriores.
Usa diario_transparencia, usuarios, atividades (FK já existente),
storage.buckets e storage.objects. Não cria outra tabela pública de publicações.

Colunas acrescentadas: texto (opcional para preservar legado), status com default
PUBLICADA, imagem_caminho opcional e atualizado_em. Constraints limitam título
(herdada), texto, estados e formato de caminho. Novo índice status/data/id e
índice único parcial de imagem_caminho; um arquivo não é compartilhado entre
publicações. FKs autor_id → usuarios RESTRICT e atividade_id → atividades
SET NULL continuam iguais. Nenhum trigger novo.

RPCs:
- diario_salvar: gestão cria/edita, valida texto e arquivo no bucket, fixa autor
  na criação e preserva autor/data nas edições; referência nova deve estar na
  pasta da própria gestão. Carrega arquivo com lock antes de associar.
- diario_status: gestão oculta/republica; id inexistente gera erro.
- diario_listar / diario_detalhe: SECURITY INVOKER, respeitam RLS.
- diario_caminho: gestão obtém caminho uid/UUID.jpg|png|webp.
- Helpers diario_gestao, diario_imagem_visivel, diario_imagem_livre: respostas
  booleanas para RLS, sem devolver registros pessoais.

Mutação/helpers usam SECURITY DEFINER com search_path vazio. EXECUTE apenas
authenticated. Usa voluntariado_privado.gestao() da Prioridade 1.
Não altera policies/tabelas financeiras.

## Storage e imagens

Bucket **diario-imagens**, privado, limite 5 MiB (5.242.880 bytes), MIME
image/jpeg, image/png, image/webp. Migration cria o bucket se ausente.
Se existir com configuração diferente, a migration aborta na transação:
não muda silenciosamente um bucket remoto. Também aborta se schema Storage
estiver ausente ou se RLS em storage.objects estiver desabilitado.

Seleção pela galeria do sistema usando expo-image-picker, compatível com Expo 57.
Não cria fluxo de câmera novo; preserva a câmera de QR da Prioridade 1.
O picker retorna base64 JPEG; o app valida limite/assinatura inicial e envia
ArrayBuffer com Content-Type image/jpeg. Não grava base64 no banco nem em logs.
Sem seleção de vídeos, reconhecimento facial ou marcação de pessoas.

Upload usa caminho aleatório, upsert=false e arquivo imutável. Substituir envia
outro arquivo e associa sua referência somente depois de upload bem-sucedido.
Remover imagem no formulário desvincula a imagem ao salvar, sem apagar o objeto.
Ocultar publicação também não apaga sua imagem.

Banco e Storage não têm transação distribuída. Se o upload falhar, não se chama
a RPC de salvar. Se upload concluir e a resposta do banco falhar, pode restar
arquivo sem vínculo (ou publicação já salva com resposta perdida). Não há
exclusão compensatória automática nem repetição automática de publicação.
Recarregar o Diário antes de repetir após falha ambígua.

A limpeza futura deve usar a API Storage, como gestão, para objetos sem vínculo;
não usar DELETE SQL em storage.objects (metadados não são o arquivo físico).
Não foi criado job de limpeza nem tela extra. Não remover arquivos referenciados.
Corridas com manutenção administrativa devem ser verificadas em homologação.

Leitura usa URL assinada com validade de 60 segundos, cacheControl do upload de
60 segundos e nova assinatura ao retornar às telas ou tentar novamente.
Ocultação bloqueia novas leituras/assinaturas, mas não revoga instantaneamente
URLs já emitidas nem imagens já baixadas. Esse limite deve ser conhecido pela
instituição. Não é prometida revogação de cópias existentes.

## RLS e permissões

- Diario: policies restritivas complementam as antigas; SELECT de voluntário
  somente PUBLICADA, gestão lê todas; anon sem leitura. INSERT/UPDATE/DELETE
  diretos bloqueados por RLS e grants revogados. TRUNCATE também revogado.
- Storage SELECT: gestão pode consultar imagens do bucket; comunidade apenas
  arquivos associados a PUBLICADA. Arquivos soltos e ocultos não são públicos.
- Storage INSERT: somente gestão, pasta igual a auth.uid(), formato restrito.
- Storage UPDATE: bloqueado neste bucket; substituição exige novo arquivo.
- Storage DELETE: somente gestão e arquivo sem vínculo com qualquer publicação,
  inclusive OCULTA. O app não dispara exclusão física automática.
- Policies restritivas limitam permissões amplas já existentes para este bucket,
  preservando acesso de outros buckets. Não usa service role no app.

Precondições remotas: conferir ownership das funções, roles/grants do Storage,
schema inicial de usuarios/atividades, provisionamento seguro de ONG, proteção
de tipo_perfil e policies desconhecidas. A RLS de usuarios deve permitir ler o
próprio registro para as policies de publicações. Não reconstruir o banco remoto.

## Validação local da Prioridade 3

### Testes automatizados

Executados:
- TypeScript: node node_modules/typescript/bin/tsc --noEmit, sem erros.
- node --test tests/*.test.cjs: 40 testes/subtestes aprovados.
- Todas as migrations na fixture PGlite, incluindo schema Storage fictício:
  criação sem imagem, edição, ocultação/republicação, consultas públicas,
  acesso indevido, associação a arquivo existente, bucket privado,
  upload restrito, proteção contra policies amplas, delete de arquivo solto.
- Substituição e remoção: caminho antigo deixa de ser público; publicação
  passa a apontar para o novo arquivo ou null. Tentativa de salvar imagem
  inexistente preserva a referência anterior. Objetos soltos são preservados.
- Republicação restaura leitura de texto/imagem; FK recusa autor inexistente
  e exclusão de autor ainda referenciado. Permissões das oito funções conferidas.
- Limite exato de 5 MiB aceito e 5 MiB + 1 byte recusado pela função real do app,
  usando bytes sintéticos com assinatura JPEG. Não é decodificação de foto real.
- MIME JPEG/PNG/WebP e limite de 5 MiB conferidos na configuração do bucket.
  Extensões permitidas/negadas testadas na RPC; isso não testa a rejeição HTTP
  de MIME/tamanho pelo serviço Storage.
- Funções reais de validação e coordenação de upload testadas com callbacks:
  falha no upload não publica; banco recebe caminho após upload; sem imagem
  dispensa upload; falha no banco é propagada.
- Adaptador real diario.ts executado com cliente Supabase simulado: envia
  ArrayBuffer JPEG, bucket correto, upsert=false, cache de 60 segundos e solicita
  assinatura por 60 segundos. Falha de upload impede a chamada de salvar.
- Bundle JavaScript Android concluído com valores Supabase fictícios.
- git diff --check e integridade SHA-256 das sete migrations existentes.

### Revisão estática e correções de interface

Revisados estaticamente: rotas por perfil, IDs, imports, recarga por foco,
limites de formulário, proteção contra clique repetido e mensagens de falha.
Corrigido estado de falha da imagem que podia persistir após troca do caminho
ou renovação de URL. Durante nova carga, não se mostra a imagem anterior.
Textos de limite agora dizem 5 MiB, correspondendo ao limite binário real.
Essas correções passaram pelo TypeScript/bundle; interação visual ainda não foi
executada em aparelho. Não houve mudança de regra de negócio nem migration nova.

### Supabase e Storage remotos: pendentes

**Não executados:** integração com serviço Supabase/Storage remoto, emissão real
de URL assinada, enforcement HTTP de tamanho/MIME, upload de foto real,
APK/build nativo, câmera/galeria em aparelho ou teste ponta a ponta.
A fixture testa SQL/RLS; não reproduz a API Storage, CDN, bytes armazenados ou JWT.
Confirmar no remoto aplicação após Prioridades 1 e 2, constraints, grants,
políticas existentes, provisionamento de gestão e credenciais reais de teste.
Testar pela API Storage exatamente 5 MiB e acima, JPEG/PNG/WebP permitidos e
SVG/HTML/PDF recusados, incluindo tentativa de contornar o cliente. Validar
expiração real e emissão de nova assinatura após ocultação. Nada foi aplicado
ou enviado ao ambiente remoto nesta validação.

### Android: pendente

Instalação nativa, seletor de fotos, prévia, carregamento/erro de imagem, teclado,
troca de conta, salvar/substituir/remover, ocultar/republicar, retorno das telas,
falhas de conexão e expiração de URL. O bundle local não é teste ponta a ponta.

## Como homologar

1. Conferir pré-requisitos, inventariar bucket/policies remotas e aplicar migration.
   Usar contas fictícias de gestão e voluntário. Não executar fixtures no remoto.
2. Gestão cria publicação sem imagem. Conferir título/texto/data no feed e detalhe
   do voluntário; editar e voltar para verificar atualização.
3. Selecionar foto pela galeria. Conferir prévia, publicar e abrir em outra conta.
   Tentar arquivo maior que 5 MiB, cancelar seletor e negar permissões quando
   solicitadas pelo sistema. Não deve publicar silenciosamente após falha.
4. Ocultar: desaparecer do feed/detalhe do voluntário; continuar na gestão.
   Após expirar URL previamente emitida, solicitar nova assinatura como voluntário:
   deve falhar. Republicar e testar novamente.
5. Substituir/remover imagem: conferir nova associação e texto preservado.
   Imagem inexistente deve mostrar falha recuperável sem esconder o relato.
6. Como voluntário, tentar RPC de salvar/status/caminho, escrita direta na tabela,
   upload/update/delete Storage e leitura de imagem oculta/solta: negar.
7. Como gestão, tentar associar arquivo inexistente ou pasta de outro gestor:
   negar referência nova. Tentar sobrescrever imagem existente: negar.
8. Testar falha de conexão durante upload e depois dele. Conferir estado real no
   servidor antes de repetir. Identificar arquivos sem vínculo para limpeza futura.
9. Android: galeria, teclado/rolagem, publicação/edição, troca de conta, retorno
   às telas, expiração da assinatura, sair durante salvamento e instalação nativa.

## Legado e decisões pendentes

Preservados contratos gerados, tabelas/trigger financeiros e campos PIX.
*(05/10: esse modelo financeiro voltou a ser usado; ver [CONTRIBUICOES.md](CONTRIBUICOES.md).)*
Apenas a indicação de que o Diário "chega em breve" foi retirada dos pontos que
agora dão acesso ao Diário. Outros textos financeiros antigos continuam fora
do escopo. url_imagem legada permanece no banco mas não é carregada no novo UI:
validar importação segura futura de imagens antigas, se existirem.

As decisões de acesso autenticado, uma imagem/5 MiB, bucket privado, URLs de
60 segundos e ausência de importação legada estão aprovadas. Procedimentos
institucionais de publicação de fotos e eventual limpeza manual de objetos
continuam operacionais, fora desta implementação. Nenhuma funcionalidade de
identificação de crianças/adolescentes ou limpeza automática foi criada.

Referências técnicas consultadas:
- [Expo 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Supabase Storage: controle de acesso](https://supabase.com/docs/guides/storage/security/access-control)

Parar na Prioridade 3; não iniciar Oficinas ou Certificados automaticamente.
*(Oficinas e certificados foram implementados em 24/09 e estão fora do MVP desde 05/10.)*
