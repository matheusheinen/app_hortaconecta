# Documentação — HortaConecta

Os relatórios são registros datados: suas conclusões descrevem a etapa em que foram escritos. A organização abaixo preserva esse histórico.

## Executar o app

- [Windows, Expo Go, LAN e túnel Cloudflare](EXECUTAR_APP.md)

## Escopo do MVP

- [O que está dentro e fora do MVP (decisão de 05/10/2026)](mvp/ESCOPO_MVP.md)

## MVP implementado

- [Voluntariado](mvp/VOLUNTARIADO.md)
- [Contribuição de materiais](mvp/MATERIAIS.md)
- [Diário de Transparência](mvp/DIARIO.md)
- [Correções do MVP](mvp/CORRECOES_MVP.md)

## Implementado, fora do MVP por enquanto

Ocultos no app por `src/lib/escopoMvp.ts`; código, testes e banco preservados.

- [Propostas de oficinas](mvp/OFICINAS.md)
- [Certificados](mvp/CERTIFICADOS.md)

## Auditorias e segurança

- [Auditoria final do MVP](auditoria/AUDITORIA_FINAL_MVP.md)
- [Segurança da base original](auditoria/SEGURANCA_BASE.md)
- [Consultas de auditoria somente leitura](auditoria/AUDITORIA_SUPABASE_LEITURA.sql)

## Reconciliação do Supabase

- [Compatibilidade aplicada e validada em 30/09/2026](reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md)
- [Plano técnico](reconciliacao/PLANO_RECONCILIACAO_SUPABASE.md)
- [1A — estrutura](reconciliacao/RECONCILIACAO_1A_ESTRUTURA.md)
- [1B — diagnóstico](reconciliacao/RECONCILIACAO_1B_DIAGNOSTICO.md)
- [1C — definição da primeira migration](reconciliacao/RECONCILIACAO_1C_PRIMEIRA_MIGRATION.md)
- [Registro histórico dos bloqueios](reconciliacao/RECONCILIACAO_01_BLOQUEIOS.md)
- [Implementação local após aprovação das decisões](reconciliacao/RECONCILIACAO_01_IMPLEMENTACAO.md)

## Estado atual

As duas reconciliações foram aplicadas ao Supabase em 30/09/2026. O app usa endereço estruturado e tipos regenerados; os cinco fluxos foram verificados por SQL no remoto com dados fictícios revertidos. Login, início e navegação foram atualizados, com indicadores ligados aos dados reais. A suíte local tem 99 testes aprovados e a exportação Android passou. Ver [resultado e limites da verificação](reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md).

Os relatórios anteriores descrevem o estado de cada etapa e permanecem como histórico. A homologação em aparelho Android, Auth/Storage pelos serviços reais e concorrência entre conexões independentes continuam pendentes. Os comandos LAN, localhost e Cloudflare estão descritos no [guia de execução](EXECUTAR_APP.md). `npm test` executa a suíte sequencialmente para limitar o consumo de memória dos bancos PGLite.

## Caminhos históricos preservados

Duas mensagens em migrations históricas ainda citam caminhos antigos, mantidos para não alterar essas migrations:

- `20260923120000_fluxo_voluntariado.sql`: `docs/VOLUNTARIADO.md` → [destino atual](mvp/VOLUNTARIADO.md).
- `20260924160000_diario_transparencia.sql`: `docs/DIARIO.md` → [destino atual](mvp/DIARIO.md).

Nenhum documento foi arquivado ou descartado. O registro de bloqueios continua junto à reconciliação para preservar a sequência das decisões.
