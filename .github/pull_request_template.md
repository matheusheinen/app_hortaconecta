## O que muda

<!-- Uma ou duas frases. Se fecha um item do backlog, cite o ID (ex.: B21). -->

## Como testar

<!-- Passos para o revisor ver a mudança funcionando: tela, perfil (ONG ou voluntário), dados necessários. -->

## Checklist

- [ ] A branch está atualizada com o `main` (`git pull --rebase origin main`)
- [ ] `npm run typecheck`, `npm run lint` e `npm test` passam
- [ ] Mexe no banco? A migration nova está em `supabase/migrations` e `database.types.ts` foi regenerado
- [ ] Mexe em arquivo compartilhado (tema, `Ui.tsx`, navegação, tipos do banco)? Avisei a equipe no grupo
- [ ] Sem dados reais (CPF, chave PIX de produção, fotos de crianças) e sem chaves do `.env`
