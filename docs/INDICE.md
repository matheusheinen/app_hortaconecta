# Documentação — HortaConecta

Os relatórios são registros datados: suas conclusões descrevem a etapa em que foram escritos. A organização abaixo preserva esse histórico.

## Executar o app

- [Windows, Expo Go, LAN e túnel Cloudflare](EXECUTAR_APP.md)

## Escopo do MVP

- [O que está dentro e fora do MVP (decisão de 05/10/2026)](mvp/ESCOPO_MVP.md)

## MVP implementado

- [Voluntariado](mvp/VOLUNTARIADO.md)
- [Contribuições: metas em dinheiro e de materiais](mvp/CONTRIBUICOES.md)
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

**05/10/2026.** O MVP compreende voluntariado, contribuições por metas (dinheiro e materiais) e Diário; oficinas e certificados estão ocultos no app ([escopo](mvp/ESCOPO_MVP.md)). As reconciliações 01 e 02 estão aplicadas no Supabase desde 30/09; a reconciliação `20261005150000` (PIX na configuração e exclusão das tabelas de materiais) **está pendente**. A suíte local tem 117 testes aprovados. Cada relatório das pastas `auditoria`, `mvp` e `reconciliacao` abre com um bloco "Situação em 05/10/2026" que indica o que mudou desde a data em que foi escrito. Pendências: [ESCOPO_MVP.md](mvp/ESCOPO_MVP.md#pendências-do-mvp-05102026).

Em 30/09/2026 as duas reconciliações foram aplicadas e os fluxos foram verificados por SQL no remoto com dados fictícios revertidos. Ver [resultado e limites da verificação](reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md).

Os relatórios anteriores descrevem o estado de cada etapa e permanecem como histórico. A homologação em aparelho Android, Auth/Storage pelos serviços reais e concorrência entre conexões independentes continuam pendentes. Os comandos LAN, localhost e Cloudflare estão descritos no [guia de execução](EXECUTAR_APP.md). `npm test` executa a suíte sequencialmente para limitar o consumo de memória dos bancos PGLite.

## Caminhos históricos preservados

Duas mensagens em migrations históricas ainda citam caminhos antigos, mantidos para não alterar essas migrations:

- `20260923120000_fluxo_voluntariado.sql`: `docs/VOLUNTARIADO.md` → [destino atual](mvp/VOLUNTARIADO.md).
- `20260924160000_diario_transparencia.sql`: `docs/DIARIO.md` → [destino atual](mvp/DIARIO.md).

Nenhum documento foi arquivado ou descartado. O registro de bloqueios continua junto à reconciliação para preservar a sequência das decisões.
