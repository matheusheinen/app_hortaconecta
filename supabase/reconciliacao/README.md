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
Não reaplicar: as pré-condições rejeitam objetos já instalados. Ver
[resultado, verificação e limites](../../docs/reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md).

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
