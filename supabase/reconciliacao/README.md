# Reconciliação do remoto com o MVP

O remoto já possui as tabelas-base, com endereço estruturado em `voluntarios`,
contador de vagas e regras próprias. As migrations históricas permanecem como
registro do desenvolvimento e **não devem ser reaplicadas nesse banco**.

Aplicados em 30/09/2026 ao projeto `hnawclapixopwjyrpxpq`, como `postgres`, nesta ordem:

1. `../migrations/reconciliacao_01_base_perfis_endereco.sql`: RPCs de perfil com
   endereço estruturado, sem alterar registros existentes.
2. `20260930141047_reconciliacao_02_fluxos_mvp.sql`: voluntariado, contribuição
   de materiais, Diário, propostas de oficinas e certificados.

Versões no histórico remoto: `20260930142505` e `20260930142520`, respectivamente.

**Pendente de aplicação** (decisão de 05/10/2026), depois dos dois acima:

3. `20261005150000_contribuicoes_metas_pix.sql`: PIX em `configuracao_instituicao`,
   voluntário só contribui em meta aberta e **exclusão** de `solicitacoes_materiais`,
   `contribuicoes_materiais` e funções `materiais_*`, com os dados. Ver
   [CONTRIBUICOES.md](../../docs/mvp/CONTRIBUICOES.md). Verificação local:
   `node --test tests/contribuicoes-metas.test.cjs`.
4. `20261005170000_diario_excluir.sql`: RPC `diario_excluir_revisao`, para a gestão
   excluir publicações do Diário (com checagem de revisão). DELETE direto segue
   bloqueado. Depende só da reconciliação 02. Verificação local:
   `node --test tests/diario-excluir.test.cjs`. Até ser aplicada, o botão
   "Excluir publicação" do app falha com erro de função inexistente.
5. `20261006120000_modo_gestor.sql`: RPC `gestor_alternar_modo` para a gestão
   alternar entre ONG e voluntário com as permissões reais de cada papel (troca
   `usuarios.tipo_perfil`; só quem já foi ONG consegue). Depende da reconciliação 02.
   Verificação local: `node --test tests/modo-gestor.test.cjs`. Até ser aplicada, o
   interruptor "Modo gestor" não aparece no perfil.
6. `20261006180000_convidado.sql`: convidado = sessão anônima do Supabase Auth, só leitura.
   Gatilho por instrução em toda tabela com escrita barra INSERT/UPDATE/DELETE quando o
   JWT tem `is_anonymous` (vale também dentro das RPCs SECURITY DEFINER), o Diário (tabela e
   imagens) fica fechado a convidado e `handle_new_user` aceita usuário sem e-mail e nome.
   Depende do modo gestor (tabela `voluntariado_privado.gestores`). **Pré-requisito fora do
   SQL:** ligar "Allow anonymous sign-ins" em Authentication > Sign In / Providers. Verificação
   local: `node --test tests/convidado.test.cjs`. Até ser aplicada, "Entrar como convidado"
   cria a sessão, mas o convidado não ficaria impedido de escrever pelo banco. Contas
   anônimas se acumulam em `auth.users`: ainda falta uma limpeza periódica (não há pg_cron).
7. `20261026120000_dispositivos_push.sql`: tabela privada `dispositivos_push` e RPCs
   `push_registrar_token` / `push_remover_token` (B29). Depende da reconciliação 02.
   Convidado não registra token. Verificação local:
   `node --test tests/dispositivos-push.test.cjs`. Até ser aplicada, o app só registra um
   aviso no console ao tentar salvar o token; nada quebra.
8. `20261026130000_notificacoes.sql`: tabela `notificacoes` com RLS, Realtime, RPCs de leitura
   e gatilhos (candidatura nova/cancelada, presença, contribuição nova para a gestão; candidatura
   decidida, atividade cancelada e contribuição conferida para o voluntário). Depende da
   reconciliação 02; inclui quem está em modo gestor se `gestores` existir. Verificação local:
   `node --test tests/notificacoes.test.cjs`. Até ser aplicada, o sino do app fica em zero.
Não reaplicar: as pré-condições rejeitam objetos já instalados. Ver
[resultado, verificação e limites](../../docs/reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md).

**Foto do perfil aplicada em 21/10/2026 (versão remota `20261021155604`):**
`20261021120000_foto_perfil.sql` adiciona o bucket privado `perfil-fotos` e as
RPCs de caminho/salvamento com controle de concorrência. Depende apenas das
reconciliações 01 e 02; pode ser aplicada independentemente das atualizações
3 a 6 acima. Não altera dados de perfil existentes nem converte fotos legadas.
Ver [contrato, aplicação e limites](../../docs/mvp/FOTO_PERFIL.md).
Verificação local: `node --test tests/foto-perfil-banco.test.cjs`.

O segundo arquivo foi criado por `supabase migration new` e movido para esta
pasta para separar a reconciliação do histórico incompatível. Cada arquivo tem
pré-condições e uma transação própria. Não execute `db push` usando o conjunto
histórico como se fosse o baseline desse remoto.

A capacidade usa apenas candidaturas aprovadas. Pendentes integram a fila de
triagem, que pode exceder o número de vagas; aprovações são serializadas pelo
bloqueio da atividade. A coluna e o trigger de contador existentes são
preservados. A função de contador muda e recalcula somente contadores divergentes
dentro da mesma transação. O legado financeiro, imagens antigas do Diário,
inscrições, presenças e vínculos de habilidades continuam armazenados.

Novas presenças usam check-in com código e carga horária prevista registrada.
Presenças antigas não recebem check-in/horas retroativos. Propostas aprovadas
continuam independentes do calendário.

5. `20261023170000_comprovantes_storage.sql` (**aplicada em 23/10/2026**, B22): bucket privado `comprovantes`, RPC
   `comprovante_caminho`, policies de Storage e restrição em `contribuicoes.url_comprovante`.
   Verificação local: `node --test tests/comprovantes-storage.test.cjs`. Não depende do PIX.
6. `20261023190000_comprovantes_formatos.sql` (**aplicada em 23/10/2026**, B22): o bucket passa a aceitar JPEG, PNG e
   WebP, `comprovante_caminho(p_ext)` recebe a extensão, a gestão anexa comprovante ao
   registrar doação e o doador lê o arquivo ligado à contribuição dele. Depende do item 5.
   Verificação local: `node --test tests/comprovantes-formatos.test.cjs`.
7. `20261023200000_arrecadacao_trigger.sql` (**pendente de aplicação**, B24): versiona o trigger que
   recalcula `quantidade_arrecadada` (soma das APROVADA) em INSERT, UPDATE e DELETE. O remoto já
   tem essa lógica; a migration é idempotente e só corrige totais divergentes. Verificação local:
   `node --test tests/contribuicoes-metas.test.cjs`.
8. `20261023210000_contribuicoes_conferencia.sql` (**pendente de aplicação**, B23): gatilho que só deixa
   conferir contribuição PENDENTE (aprovada ou recusada não volta atrás), impede trocar meta, doador, valor,
   comprovante e data de envio na conferência e exige motivo ao recusar. Depende do item 7. O app funciona
   sem ela, mas a trava passa a valer só depois. Verificação local:
   `node --test tests/contribuicoes-conferencia.test.cjs`.

As novas tabelas recebem RLS e grants explícitos; funções privadas não ficam
acessíveis ao cliente. Contas autenticadas leem o próprio perfil, e a gestão
mantém acesso necessário à triagem. Privilégios de TRUNCATE, REFERENCES e TRIGGER
são retirados dos papéis do aplicativo.

Verificação local: `node --test tests/reconciliacao-mvp.test.cjs`.
O teste usa o catálogo PUBLIC auditado e dados sintéticos. Auth e Storage são
mocks: a aprovação local não confirma o serviço Storage, JWT/Data API nem Android.
O ensaio em `docs/reconciliacao/VALIDACAO_COMPATIBILIDADE_REMOTA.sql` exercita
as funções e a RLS reais com dados fictícios e reverte os registros no final;
sequências de identidade podem avançar.
