# Reconciliação 01 — bloqueios antes da implementação

Data: 29/09/2026.

**Migration `reconciliacao_01_base_perfis_endereco` não criada.** A implementação foi interrompida conforme a instrução de não escolher decisões de negócio pendentes. Nenhuma alteração remota foi executada.

## 1. Decisões que ainda impedem fechar o contrato

As seções 4.5, 4.6 e 10 de `RECONCILIACAO_1C_PRIMEIRA_MIGRATION.md` registram explicitamente estas decisões como pendentes. A solicitação atual autoriza preservar os endereços existentes, mas também exige interromper a implementação se depender de uma decisão de negócio não definida.

### Conta de gestão sem complemento em ongs

**CONFIRMADO:** existe uma conta com perfil ONG sem linha correspondente em `ongs`. A migration local `20260924210000_coerencia_mvp.sql` usa UPSERT no salvamento da gestão; o teste local correspondente confirma esse comportamento.

**DECISÃO NECESSÁRIA:**

- Manter a criação do próprio complemento durante o salvamento de uma conta já provisionada como ONG; ou
- Bloquear o salvamento inteiro com erro controlado até regularização administrativa.

A segunda opção é a recomendação conservadora do relatório 1C, expressamente sujeita a aprovação. Adotá-la agora mudaria o comportamento local existente e afetaria uma conta real. A primeira opção tampouco deve ser presumida como resolução da decisão pendente. Nenhuma opção permite promover voluntário a gestão, inserir linha vazia na implantação ou salvar parcialmente `usuarios`.

### Elegibilidade e perfil_completo

**CONFIRMADO:** o remoto usa `perfil_completo(uuid DEFAULT auth.uid())`, com ramo ONG e exigência de logradouro, número e cidade para voluntários. Sua validação de disponibilidade é menos estrita que a proposta local: verifica array não vazio, sem validar cada dia/período e duplicidade. Profissão é verificada como não nula, sem exigir texto não vazio.

**DECISÃO NECESSÁRIA:** aprovar ou não a unificação do predicado antigo com o novo helper de elegibilidade, incluindo:

- Manter rua/logradouro, número e cidade como requisitos de elegibilidade;
- Aplicar a validação local de disponibilidade e profissão não vazia também aos consumidores antigos;
- Preservar o ramo ONG e a assinatura/default da função antiga.

Isso pode tornar perfis antes aceitos inelegíveis sem alterar os dados, inclusive em policies que usam a função antiga. Preservar colunas de endereço não equivale a aprovar sua obrigatoriedade para elegibilidade. O relatório 1C exige redefinir explicitamente o escopo caso essa unificação não seja aprovada; não foi criado um contrato parcial ou divergente para contornar a decisão.

## 2. Conferência remota desta etapa

Uma consulta SELECT de catálogo e agregados, capturada em **29/09/2026 às 18:59:17 UTC**, confirmou:

- Ausência de `usuarios.endereco`;
- Presença dos sete campos estruturados de endereço em `voluntarios`;
- Ausência do schema `voluntariado_privado` e das assinaturas consultadas de `voluntariado_salvar_perfil(jsonb,bigint[])` e `gestao_salvar_perfil(jsonb)`;
- Uma conta ONG sem complemento;
- Histórico remoto com 11 versões registradas;
- Definição de `perfil_completo` descrita acima.

Não foi repetido o inventário completo do banco. A consulta não executou RPC de negócio, não testou permissões com JWT de cliente e não alterou dados, objetos, grants ou Storage. As evidências anteriores sobre endereço institucional e legado continuam como referências; nenhuma alteração foi proposta ou executada sobre eles.

## 3. Validação local executada

Comando:

```text
node --test tests/auth-perfil.test.cjs tests/banco-voluntariado.test.cjs tests/coerencia-mvp.test.cjs
```

Resultado: **21 testes aprovados, zero falhas e zero ignorados**.

Cobertura existente: autenticação/sessão e loading, bloqueio do formulário após falha de carregamento, RPCs de voluntariado, autorização local, atomicidade de perfil, candidaturas, check-in, coerência histórica, conflito do Diário e UPSERT/rollback do perfil da gestão.

Esses testes validam o código e as migrations existentes em fixtures locais/PGlite. **Não validam uma nova migration, não reproduzem integralmente o remoto e não comprovam segurança com JWT real ou concorrência entre conexões independentes.**

Não há nova sintaxe SQL a validar, pois nenhum arquivo SQL foi criado. A validação de sintaxe e o ensaio da reconciliação permanecem pendentes após a definição das regras e implementação.

## 4. Preservação e próximo passo

Nenhuma tela, código do aplicativo ou migration histórica foi editada. Endereços estruturados, configuração institucional, campos PIX, tabelas e triggers financeiros permanecem intactos. Não houve staging, commit, push ou implantação.

Após as duas decisões acima, será possível preparar o SQL com pré-condições explícitas para o catálogo remoto e testes específicos. Antes do ensaio, ainda será necessário reproduzir fielmente o schema remoto; antes da implantação, definir a sequência ativa do histórico divergente, backup/retorno e corte coordenado do aplicativo. Esses requisitos de implantação não constituem autorização para aplicar as sete migrations locais pendentes.

**Situação: bloqueada antes da criação; não pronta para ensaio da nova migration contra uma cópia do remoto.**
