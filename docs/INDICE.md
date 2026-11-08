# Documentação — HortaConecta

Visão do projeto, requisitos (RF0001–RF0015, RNF0001–RNF0011), backlog (B01–B34),
cronograma e convenções ficam no [DOCUMENTACAO.md](../DOCUMENTACAO.md), que é a referência
principal. Esta pasta reúne o guia de execução, o escopo do MVP e os relatórios
de cada etapa. Os relatórios são **registros datados**: cada um abre com um bloco
"Situação em 05/10/2026" que diz o que mudou depois de escrito. Quando um
relatório divergir do DOCUMENTACAO.md, vale o DOCUMENTACAO.md.

## Estado atual (07/11/2026)

- **MVP:** voluntariado, contribuições por metas (dinheiro e materiais) e Diário.
  Oficinas e certificados estão implementados, mas ocultos no app ([escopo](mvp/ESCOPO_MVP.md)).
- **Código:** branch `main`, com os PRs #16 a #21 aguardando revisão; 269 testes na `main`
  e 314 com os PRs. Situação de cada item no [backlog](../DOCUMENTACAO.md#backlog-e-situação-atual).
- **Supabase:** ordem e situação de cada reconciliação no
  [README da reconciliação](../supabase/reconciliacao/README.md). Pendentes: as duas do B23 e a do B26
  (esta junto com o merge do PR #20).

## Executar o app

- [Instalação, `.env`, Expo Go, LAN, túnel Cloudflare e problemas comuns](EXECUTAR_APP.md)

## Escopo e fluxos do MVP

| Documento | Requisitos | Backlog |
| --- | --- | --- |
| [Escopo do MVP (decisão de 05/10/2026)](mvp/ESCOPO_MVP.md) | Todos | Todos |
| [Voluntariado](mvp/VOLUNTARIADO.md) | RF0001–RF0005, RF0007–RF0009 | B01–B14, B16–B18, B31, B32, B34 |
| [Contribuições: metas em dinheiro e de materiais](mvp/CONTRIBUICOES.md) | RF0010–RF0012, RF0015, RNF0004 | B19–B24, B28, B30, B33 |
| [Diário de Transparência](mvp/DIARIO.md) | RF0013, RNF0003, RNF0005 | B25–B27 |
| [Correções do MVP](mvp/CORRECOES_MVP.md) | RNF0007, RNF0010, RNF0011 | — |
| [Foto do perfil (21/10/2026)](mvp/FOTO_PERFIL.md) | RF0002 | B31 |

## Implementado, fora do MVP por enquanto

Ocultos no app por `src/compartilhado/escopoMvp.ts`; código, testes e banco preservados.

| Documento | Requisitos | Backlog |
| --- | --- | --- |
| [Propostas de oficinas](mvp/OFICINAS.md) | RF0006, parte do RF0007 | B15 (previsto na Sprint 3; a equipe precisa conciliar) |
| [Certificados](mvp/CERTIFICADOS.md) | Complemento do RF0008 | — |

## Auditorias e segurança

- [Auditoria final do MVP (24/09)](auditoria/AUDITORIA_FINAL_MVP.md)
- [Segurança da base original e checklist](auditoria/SEGURANCA_BASE.md)
- [Consultas de auditoria somente leitura](auditoria/AUDITORIA_SUPABASE_LEITURA.sql)

## Reconciliação do Supabase

- [Compatibilidade aplicada e validada em 30/09/2026](reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md) — estado do remoto
- [Arquivos de reconciliação e ordem de aplicação](../supabase/reconciliacao/README.md)
- [Plano técnico (29/09)](reconciliacao/PLANO_RECONCILIACAO_SUPABASE.md)
- [1A — estrutura](reconciliacao/RECONCILIACAO_1A_ESTRUTURA.md)
- [1B — diagnóstico](reconciliacao/RECONCILIACAO_1B_DIAGNOSTICO.md)
- [1C — definição da primeira migration](reconciliacao/RECONCILIACAO_1C_PRIMEIRA_MIGRATION.md)
- [Registro histórico dos bloqueios](reconciliacao/RECONCILIACAO_01_BLOQUEIOS.md)
- [Implementação local após aprovação das decisões](reconciliacao/RECONCILIACAO_01_IMPLEMENTACAO.md)
- [Roteiro do ensaio remoto de 30/09](reconciliacao/VALIDACAO_COMPATIBILIDADE_REMOTA.sql) — não reexecutar depois da reconciliação pendente

## Caminhos históricos preservados

Duas mensagens em migrations históricas ainda citam caminhos antigos, mantidos para não alterar essas migrations:

- `20260923120000_fluxo_voluntariado.sql`: `docs/VOLUNTARIADO.md` → [destino atual](mvp/VOLUNTARIADO.md).
- `20260924160000_diario_transparencia.sql`: `docs/DIARIO.md` → [destino atual](mvp/DIARIO.md).

`docs/mvp/MATERIAIS.md` foi renomeado para [CONTRIBUICOES.md](mvp/CONTRIBUICOES.md) em 05/10/2026;
o conteúdo original está preservado no fim do arquivo. Nenhum documento foi descartado.
