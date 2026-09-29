# Documentação — HortaConecta

Os relatórios são registros datados: suas conclusões descrevem a etapa em que foram escritos. A organização abaixo preserva esse histórico.

## MVP implementado

- [Voluntariado](mvp/VOLUNTARIADO.md)
- [Contribuição de materiais](mvp/MATERIAIS.md)
- [Diário de Transparência](mvp/DIARIO.md)
- [Propostas de oficinas](mvp/OFICINAS.md)
- [Certificados](mvp/CERTIFICADOS.md)
- [Correções do MVP](mvp/CORRECOES_MVP.md)

## Auditorias e segurança

- [Auditoria final do MVP](auditoria/AUDITORIA_FINAL_MVP.md)
- [Segurança da base original](auditoria/SEGURANCA_BASE.md)
- [Consultas de auditoria somente leitura](auditoria/AUDITORIA_SUPABASE_LEITURA.sql)

## Reconciliação do Supabase

- [Plano técnico](reconciliacao/PLANO_RECONCILIACAO_SUPABASE.md)
- [1A — estrutura](reconciliacao/RECONCILIACAO_1A_ESTRUTURA.md)
- [1B — diagnóstico](reconciliacao/RECONCILIACAO_1B_DIAGNOSTICO.md)
- [1C — definição da primeira migration](reconciliacao/RECONCILIACAO_1C_PRIMEIRA_MIGRATION.md)
- [Registro histórico dos bloqueios](reconciliacao/RECONCILIACAO_01_BLOQUEIOS.md)
- [Implementação local após aprovação das decisões](reconciliacao/RECONCILIACAO_01_IMPLEMENTACAO.md)

## Status atual da PR

O trabalho local reúne as cinco prioridades, correções, testes, auditorias e a [primeira migration de reconciliação](../supabase/migrations/reconciliacao_01_base_perfis_endereco.sql). Ela não foi aplicada ao Supabase de homologação. O ensaio em cópia fiel permanece bloqueado por falta de ambiente isolado adequado; os testes em fixture não o substituem.

A [documentação da implementação](reconciliacao/RECONCILIACAO_01_IMPLEMENTACAO.md) descreve o contrato e as pendências de compatibilidade do aplicativo. Esta organização não representa aprovação para produção, implantação ou abertura da PR; não inclui staging, commit ou push.

## Caminhos históricos preservados

Duas mensagens em migrations históricas ainda citam caminhos antigos, mantidos para não alterar essas migrations:

- `20260923120000_fluxo_voluntariado.sql`: `docs/VOLUNTARIADO.md` → [destino atual](mvp/VOLUNTARIADO.md).
- `20260924160000_diario_transparencia.sql`: `docs/DIARIO.md` → [destino atual](mvp/DIARIO.md).

Nenhum documento foi arquivado ou descartado. O registro de bloqueios continua junto à reconciliação para preservar a sequência das decisões.
