# Notificações (B29, RF0014)

> Situação em 02/11/2026: notificações dentro do app **no ar** (26/10). Push remoto **no servidor
> no ar**: `dispositivos_push` e `notificacoes_entregues` aplicadas, segredos no Vault, Edge Functions
> publicadas e chave FCM V1 no EAS (projeto `@hortaconecta/horta-conecta`). Teste com token falso
> confirmou banco → pg_net → function (200) → Expo → `FALHOU/DeviceNotRegistered` → token apagado.
> **Falta** o teste num Android real (development build já gerado). E-mail e WhatsApp: só estrutura.

## Como funciona

```
gatilhos de negócio ──INSERT──► public.notificacoes ──► sino + Realtime (app aberto)
                                     │ gatilho
                                     ▼
                     voluntariado_privado.notificacoes_entregues
                     (1 linha por notificação × canal ligado × destino)
                                     │ pg_net (logo após o COMMIT) e pg_cron (a cada minuto)
                                     ▼
                Edge Function notificacoes-despachar ──► Expo Push ──► FCM / APNs
                Edge Function notificacoes-recibos   ◄── recibos (~15 min depois)
```

- **`public.notificacoes`** é a fonte única. O sino lê dela e tudo o mais deriva dela.
- **Catálogo** (`notificacoes_tipos`): categoria, canais padrão e se o tipo é crítico, para cada
  tipo. Um tipo crítico (hoje, `ATIVIDADE_CANCELADA`) chega mesmo com o push desligado nas
  preferências.
- **Canais** (`notificacoes_canais`): só o `push` está ligado. Uma entrega só é criada para
  canal ligado.
- **Preferências** (`notificacoes_preferencias`): liga/desliga por categoria e canal, no cartão
  "Notificações" do Perfil. Sem preferência gravada, vale o padrão do catálogo.
- **Fila** (`notificacoes_entregues`): estados `PENDENTE → ENVIANDO → ENVIADA → ENTREGUE` ou
  `FALHOU`. Uma falha temporária volta para a fila depois de 1, 5, 15 e 60 min; na 5ª tentativa,
  desiste. Se o envio ou o recibo responder `DeviceNotRegistered`, o token do aparelho é apagado.
  O histórico fica 30 dias.
- **App**: com o push remoto ativo, o Realtime não dispara mais o aviso local, para não aparecer
  duplicado. O toque com o app fechado abre o destino certo, e o token é registrado de novo se o
  sistema o renovar.

## Colocar no ar (uma vez)

### 1. Banco

1. Ligar as extensões **pg_net** e **pg_cron** (Database → Extensions). Feito em 01/11/2026.
2. Aplicar, nesta ordem e como `postgres` no SQL Editor (role **postgres** no seletor ao lado do
   Run): `20261026120000_dispositivos_push.sql` e depois `20261101120000_notificacoes_entregues.sql`.
   Feito em 02/11/2026.
3. Criar os segredos no Vault, **um comando por vez** (o SQL Editor mostra só um resultado). O
   segredo é gerado no próprio banco, sem passar por chat ou terminal. Feito em 02/11/2026.
   ```sql
   SELECT vault.create_secret('https://hnawclapixopwjyrpxpq.supabase.co', 'notificacoes_url_base');
   SELECT vault.create_secret(
     replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'notificacoes_segredo');
   -- Conferir: 2 linhas, tamanhos 40 e 64
   SELECT name, length(decrypted_secret) FROM vault.decrypted_secrets WHERE name LIKE 'notificacoes_%';
   ```
   `extensions.gen_random_bytes` (pgcrypto) falhou no projeto. Use `gen_random_uuid`, que é nativo.
4. Conferir: `SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'notificacoes-%';`
   deve listar `notificacoes-rotina` e `notificacoes-limpeza`. Se a migration foi aplicada antes
   de ligar o pg_cron, agende manualmente com os dois `cron.schedule` do final da migration.

### 2. Edge Functions

1. Copiar o segredo do Vault (`SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='notificacoes_segredo';`)
   e cadastrá-lo no painel em **Edge Functions → Secrets** como `NOTIFICACOES_SEGREDO`. Pelo painel,
   o valor não passa pelo terminal. Opcional: `EXPO_ACCESS_TOKEN`, só se "Enhanced push security"
   for ligado no EAS.
2. Publicar (feito em 02/11/2026):
   ```sh
   npx supabase login
   npx supabase functions deploy notificacoes-despachar --project-ref hnawclapixopwjyrpxpq --no-verify-jwt --use-api
   npx supabase functions deploy notificacoes-recibos --project-ref hnawclapixopwjyrpxpq --no-verify-jwt --use-api
   ```
   `--use-api` dispensa o Docker. O `supabase/.temp/` criado pela CLI fica fora do git.

As functions vêm com `--no-verify-jwt` porque quem as chama é o banco, não o app. A proteção é o
cabeçalho `x-notificacoes-segredo`, e sem ele a resposta é 401.

### 3. Firebase (Android)

No Android, o push com o app fechado sempre passa pelo FCM do Google. O Expo faz a ponte, então
não há código de Firebase no app.

1. Em <https://console.firebase.google.com>, criar um projeto (pode desligar o Analytics).
2. Adicionar um app **Android** com o pacote `br.com.hortaconecta.app`, baixar o
   `google-services.json` e colocá-lo na raiz do projeto.
3. Em `app.json`, dentro de `expo.android`, acrescentar
   `"googleServicesFile": "./google-services.json"`.
4. Em Configurações do projeto → Contas de serviço → **Gerar nova chave privada**. Isso baixa um
   JSON que **não vai para o git**.
5. `npx eas-cli credentials -p android` → `development` → **Google Service Account** →
   **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **Set up** →
   informar o caminho do JSON. Não use "Push Notifications (Legacy)", que é a API antiga e foi
   desativada pelo Google.

Tudo gratuito e sem cartão: o FCM não cobra (plano Spark; recuse o upgrade para Blaze), o Expo
Push é gratuito e o EAS Free cobre os development builds. Feito em 02/11/2026: projeto Firebase
`horta-conecta`, chave FCM V1 enviada ao EAS.

O iOS exige uma conta Apple Developer paga (APNs). O `eas credentials` gera a chave quando ela
existir.

### 4. App

1. Em `.env`, definir `EXPO_PUBLIC_PUSH_REMOTO=true`.
2. Gerar o development build (ver [EXECUTAR_APP.md](../EXECUTAR_APP.md#development-build-push-com-o-app-fechado))
   e instalar o APK **num Android físico** ou num emulador com imagem **Google Play** (sem os Play
   Services, o push não chega). **O Expo Go não recebe push remoto no Android.** O primeiro build
   foi gerado em 02/11/2026.
3. Entrar com uma conta. O aparelho aparece em `voluntariado_privado.dispositivos_push`.

## Testar o servidor sem aparelho

Um token falso percorre o caminho inteiro. O Expo responde `DeviceNotRegistered`, e o sistema
deve marcar a entrega como `FALHOU` e apagar o token. Rode um bloco por vez:

```sql
-- 1. Aparelho falso para a conta da equipe
INSERT INTO voluntariado_privado.dispositivos_push(usuario_id, token, plataforma)
SELECT id, 'ExponentPushToken[testeHortaConecta000001]', 'android'
  FROM auth.users WHERE email = 'devshortaconecta@gmail.com';
-- 2. Notificação (dispara gatilho → pg_net → function)
INSERT INTO public.notificacoes(usuario_id, tipo, titulo, corpo)
SELECT usuario_id, 'CONTRIBUICAO_APROVADA', 'Teste de push', 'Teste do servidor (pode ignorar).'
  FROM voluntariado_privado.dispositivos_push WHERE token = 'ExponentPushToken[testeHortaConecta000001]';
-- 3. Depois de ~10 s: esperado FALHOU, DeviceNotRegistered, token 0, http 200
SELECT e.status, e.tentativas, e.erro,
       (SELECT count(*) FROM voluntariado_privado.dispositivos_push
         WHERE token = 'ExponentPushToken[testeHortaConecta000001]') AS token_ainda_existe,
       (SELECT status_code FROM net._http_response ORDER BY created DESC LIMIT 1) AS http_function
  FROM voluntariado_privado.notificacoes_entregues e
 WHERE e.destino = 'ExponentPushToken[testeHortaConecta000001]';
-- 4. Limpar
DELETE FROM public.notificacoes WHERE titulo = 'Teste de push';
```

Resultado em 02/11/2026: `FALHOU` / `DeviceNotRegistered` / token apagado / HTTP 200. Se vier
`http_function = 401`, o segredo das Edge Functions difere do segredo do Vault.

## Testar ponta a ponta (Android real, pendente)

1. Com o app **fechado** no aparelho A (voluntário), aprove a candidatura dele pela gestão em
   outro aparelho ou no painel.
2. O aviso chega na central do Android. Ao tocar, o app abre na atividade.
3. Acompanhe a entrega no banco:
   ```sql
   SELECT id, canal, status, tentativas, erro, enviado_em
     FROM voluntariado_privado.notificacoes_entregues ORDER BY id DESC LIMIT 20;
   ```
   O status vai para `ENVIADA` em segundos e para `ENTREGUE` uns 15 min depois. Um `FALHOU` com
   `InvalidCredentials` indica que falta a chave FCM no EAS (passo 3.5).
4. Logs: Supabase → Edge Functions → `notificacoes-despachar` → Logs.

## Novo canal (e-mail, WhatsApp/B18)

1. Criar `supabase/functions/_compartilhado/canais/<canal>.ts`, que implementa `Canal` (ver
   `tipos.ts`), e registrá-lo em `canais/index.ts`.
2. Conferir o destino em `voluntariado_privado.notificacoes_destinos`. O e-mail já usa o da
   conta, e o WhatsApp ainda precisa de um telefone.
3. Ligar o canal com `UPDATE voluntariado_privado.notificacoes_canais SET ativo=true WHERE canal='email';`.
   Os tipos com esse canal em `canais_padrao` passam a gerar entregas, e o canal aparece nas
   preferências do app.
4. Para mudar quais tipos usam o canal, basta um `UPDATE` em `notificacoes_tipos.canais_padrao`.

## Testes

- `node --test tests/notificacoes-entregues.test.cjs`: fila, retentativa, recibos, preferências,
  tipo crítico e permissões (PGlite, sem pg_net e sem cron).
- `node --test tests/notificacoes-expo-push.test.cjs`: adaptador Expo (lotes, tickets, recibos,
  erros), com fetch falso.
- `node --test tests/notificacoes-runtime.test.cjs`: app (toque com o app fechado, sem
  duplicar o aviso, renovação de token).
