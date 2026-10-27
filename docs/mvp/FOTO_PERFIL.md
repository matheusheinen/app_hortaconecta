# Foto do perfil

Implementação de 21/10/2026, complemento do B31/RF0002. Disponível para contas
de voluntário e gestão, sem participar da elegibilidade para candidaturas.
O convidado permanece sem edição de perfil.

## Contrato de dados

- `usuarios.foto_perfil` continua sendo `text` opcional. Para fotos novas, guarda
  o caminho `UUID_DO_USUARIO/UUID_DO_ARQUIVO.jpg`, nunca a URL assinada.
- Bucket privado `perfil-fotos`: JPEG, máximo de 2 MiB. O aplicativo normaliza
  a imagem antes do upload. O limite de tamanho e MIME do bucket é aplicado
  pela API Storage; os ensaios SQL usam apenas o catálogo do serviço.
- `perfil_foto_caminho()` produz um caminho novo para a conta autenticada.
- `perfil_foto_salvar(p_caminho text, p_anterior text, p_usuario_id uuid)` devolve
  `true` após confirmar o vínculo ou a remoção. `p_caminho` e `p_anterior` aceitam
  `null`. `p_usuario_id` precisa ser o usuário do JWT, impedindo que uma operação
  iniciada antes da troca de conta altere a conta seguinte.
- A RPC bloqueia a linha do usuário, compara a foto atual com `p_anterior` e
  exige objeto existente para foto nova. Uma alteração concorrente rejeita a
  operação e pede recarga, em vez de substituir uma foto mais recente.

Fotos legadas não são convertidas nem apagadas pela reconciliação. Seu valor
anterior pode ser enviado na comparação para substituição ou remoção. Somente
os novos vínculos precisam obedecer ao formato de caminho privado.

## Privacidade e limpeza

Somente o próprio titular não anônimo pode ler, enviar ou excluir suas fotos.
A gestão não recebe acesso às fotos de outras pessoas neste recurso. A leitura
usa URL assinada temporária; não tornar o bucket público.

Objetos são imutáveis: trocar a foto cria um arquivo novo, sem `upsert`. A RPC
atualiza somente `foto_perfil`; nome, endereço, habilidades e elegibilidade
continuam com seus fluxos próprios. Alterar `foto_perfil` diretamente pela API
é bloqueado por um gatilho, inclusive se o usuário possuir UPDATE no perfil.

A exclusão de arquivo só é permitida após desvinculá-lo do perfil. A verificação
é serializada com a RPC para proteger a foto atual também quando o aplicativo
não recebe a resposta do salvamento e tenta limpar o upload. Ao substituir ou
remover uma foto, o aplicativo pode excluir o caminho anterior já desvinculado.
Falhas de limpeza não desfazem uma alteração de perfil confirmada; os objetos
sem vínculo permanecem privados e podem ser removidos por manutenção.

## Aplicação no Supabase

Aplicada em 21/10/2026 no projeto HortaConecta (`hnawclapixopwjyrpxpq`), pelo
proprietário `postgres`, como versão remota `20261021155604` (`foto_perfil`).
As duas RPCs, o bucket privado, as oito policies e o trigger foram conferidos.
Uma consulta sob o papel `authenticated` confirmou a geração do caminho da própria
conta; a API deixou de retornar função ausente e rejeita chamadas não autenticadas.
Os tipos TypeScript foram regenerados e as declarações provisórias da foto removidas.

Para outra instalação, aplicar `supabase/reconciliacao/20261021120000_foto_perfil.sql` como administrador,
depois das reconciliações 01 e 02, no projeto previamente conferido. O arquivo
tem transação, validações de pré-condição e rejeita reaplicação. Nenhuma alteração
remota é executada pelo app ou pelos testes.

Esta reconciliação é independente das posteriores de metas/PIX, exclusão do
Diário, modo gestor e convidado. A detecção de usuário anônimo lê o claim do JWT
diretamente, sem depender de `e_convidado()`. Não é necessário reaplicar o
histórico nem executar `db push`. Um bucket `perfil-fotos` já existente com
configuração diferente interrompe a instalação para revisão.

Após aplicar em outro ambiente, regenerar `src/servicos/database.types.ts`.
O adaptador mantém a nulabilidade explícita de `p_caminho` e `p_anterior`.
Reiniciar o aplicativo e conferir a seleção, substituição, remoção e persistência
em uma sessão real.

O Advisor registra aviso de revisão para as três funções
`SECURITY DEFINER` acessíveis ao papel autenticado. Esse acesso é intencional:
as funções validam a identidade, bloqueiam convidado e só operam sobre a própria
conta, com `search_path` fixo e sem execução por `anon`/`PUBLIC`.
A função de salvamento precisa atualizar o campo protegido, e a de limpeza
serializa a remoção com esse vínculo. Referência do
[aviso do Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Verificação

`node --test tests/foto-perfil-banco.test.cjs` testa a reconciliação com dados
sintéticos sobre o catálogo reconciliado, tanto após metas/PIX quanto, em outro
cenário, após convidado. Cobre bucket, permissões, policies permissivas legadas,
isolamento entre titulares, bloqueio de convidado pelo JWT, proteção da foto
vinculada, concorrência por valor anterior, troca de sessão e preservação das
demais RPCs de perfil e das regras de Storage do Diário.

Os testes não substituem a validação de upload, URL assinada, MIME/tamanho no
Storage real ou do seletor de fotos em Android/iOS. A instalação do banco foi
confirmada; a homologação de seleção e envio em aparelho continua necessária.
