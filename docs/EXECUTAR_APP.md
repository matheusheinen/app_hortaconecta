# Executar o HortaConecta no Windows

O projeto usa [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) e Node.js 22.13 ou superior.

## Primeira execução

Abra o PowerShell na pasta do repositório clonado (o caminho varia em cada máquina):

```powershell
Set-Location -LiteralPath '<pasta do projeto>\app_hortaconecta'
git switch integracao/mvp      # branch de trabalho em 05/10/2026; ver DOCUMENTACAO.md
npm.cmd ci
Copy-Item .env.example .env
```

Preencha o `.env` com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY` (chave **pública**) do painel do Supabase. O arquivo não é versionado; nunca use a chave `service_role` no app. Sem essas variáveis o app encerra na abertura com a mensagem "Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY".

Antes de commitar:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

`npm run format` corrige a formatação apontada pelo lint. `npm test` roda a suíte em sequência (bancos PGlite em memória); leva cerca de 40 segundos.

## Iniciar o app

Escolha o comando conforme a conexão do aparelho:

| Situação | Comando |
| --- | --- |
| Computador e celular no mesmo Wi-Fi, com comunicação entre eles | `npm.cmd run start:lan` |
| Redes diferentes, rede móvel ou Wi-Fi com aparelhos isolados | `npm.cmd run start:cloudflare` |
| Navegador ou emulador no computador | `npm.cmd run start:local` |
| Túnel Ngrok integrado ao Expo | `npm.cmd run start:tunnel` |

## Mesmo Wi-Fi

```powershell
npm.cmd run start:lan
```

Abra o Expo Go compatível com o SDK 58 no celular e leia o QR code do terminal. Se o Wi-Fi bloquear a comunicação entre dispositivos, use o comando Cloudflare abaixo. LAN e localhost são opções oficiais da [Expo CLI](https://docs.expo.dev/more/expo-cli/#server-url).

## Conectar pela internet com Cloudflare

```powershell
npm.cmd run start:cloudflare
```

Na primeira execução em Windows x64, o script baixa o `cloudflared` oficial, versão **2026.9.3**, valida seu SHA-256 e guarda o executável em `.expo/tools`. A cópia é reutilizada nas próximas execuções, sem instalação global. O download vem do [release oficial da Cloudflare](https://github.com/cloudflare/cloudflared/releases/tag/2026.9.3).

O script inicia o Expo e cria um endereço HTTPS temporário. Use o QR code e o link **`exps://…trycloudflare.com`** impressos na seção Cloudflare para abrir no Expo Go: o prefixo `exps` mantém a conexão HTTPS. Para abrir a versão web no navegador, use o endereço **`https://…trycloudflare.com`** da mesma seção.

Mantenha o terminal aberto enquanto usa o app. O Fast Refresh continua atualizando a tela ao salvar os arquivos. Pressione **Ctrl+C** para encerrar o Expo e o túnel. Ao iniciar novamente, leia o novo QR code, pois o endereço muda. Os [Quick Tunnels da Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) servem para desenvolvimento e testes, com URL temporária e sem garantia de disponibilidade.

A porta padrão é **8081**. Para escolher outra porta ou limpar o cache do Metro na inicialização:

```powershell
npm.cmd run start:cloudflare -- --port 8083
npm.cmd run start:cloudflare -- --clear
npm.cmd run start:cloudflare -- --help
```

Os comandos de desenvolvimento usam a configuração existente do app para autenticação e acesso ao Supabase. O túnel muda apenas o endereço pelo qual o aparelho carrega o projeto.

## Navegador ou emulador local

```powershell
npm.cmd run start:local
```

No terminal do Expo, pressione **w** para abrir o navegador ou **a** para abrir o emulador Android configurado. O modo localhost atende aos clientes no próprio computador. Para um celular físico, escolha LAN ou Cloudflare.

## Development build (push com o app fechado)

O Expo Go não recebe push remoto no Android. Para testar o push, use o development build do
projeto `@hortaconecta/horta-conecta` no EAS, com o login da conta da equipe
(`npx eas-cli whoami` deve mostrar `hortaconecta`).

```powershell
# A pasta extraída do .zip não é repositório git: EAS_NO_VCS faz o EAS enviar a pasta mesmo assim
$env:EAS_NO_VCS=1; npx eas-cli build --profile development --platform android
```

- O build leva de 15 a 20 minutos e termina com um link/QR code para instalar o APK **num celular
  Android**. Responda **no** a "Install and run on an emulator?" se o computador não tiver o Android
  Studio, ou o comando termina com `spawn adb ENOENT` (o APK continua válido).
- Com o APK instalado, rode `npx expo start --dev-client` (com `EXPO_PUBLIC_PUSH_REMOTO=true` no
  `.env`) e abra o app instalado, não o Expo Go.
- Sem git, o EAS respeita o `.gitignore` e o `.env` não vai junto. Isso não importa no development
  build, porque o JavaScript vem do Metro local, que lê o `.env`.
- Configuração do push (Firebase, Vault, Edge Functions): [NOTIFICACOES.md](mvp/NOTIFICACOES.md).

## Quando o túnel Ngrok falhar

```powershell
npm.cmd run start:tunnel
```

O modo integrado usa `@expo/ngrok`, instalado no projeto. Se aparecer `Cannot read properties of undefined (reading 'body')` ou ocorrer timeout, use LAN ou Cloudflare para continuar trabalhando.

A equipe do Expo já [registrou limites da conta Ngrok compartilhada](https://github.com/expo/expo/issues/43335). Um estado operacional na [página de status do Ngrok](https://status.ngrok.com/) descreve o serviço em geral e pode coexistir com limites de uma conta; isoladamente, ele não identifica a causa da falha neste projeto. A documentação da [Expo CLI sobre túneis](https://docs.expo.dev/more/expo-cli/#tunneling) também descreve sua dependência de serviços externos.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| "Failed to fetch" no login; tela de carregamento demora ~30 s | Projeto Supabase fora do ar (pausado) ou URL errada no `.env` | Conferir no painel do Supabase se o projeto está ativo e restaurar; conferir a URL. O app espera até 30 s antes de desistir. |
| `EADDRINUSE ... 8081` | Outro Expo já usa a porta | Encerrar o processo anterior ou usar `-- --port 8083`. |
| `Cannot find native module 'ExpoTopicSubscriptionModule'` ao abrir no Expo Go Android | O pacote de notificações exige um módulo nativo ausente no Expo Go | A integração evita carregar esse pacote no Expo Go Android; reiniciar com `npm.cmd run start:cloudflare -- --clear` e abrir o novo QR code. O sino e a lista de notificações continuam disponíveis; avisos do sistema no Android exigem um build próprio. |
| Mudanças no `.env` não aparecem | Variáveis `EXPO_PUBLIC_*` são lidas ao iniciar o Metro | Reiniciar o Expo, se necessário com `-- --clear`. |
| Testes de banco falham com "diverge do catálogo auditado" | Arquivos SQL com CRLF no checkout | O `.gitattributes` exige LF; reextrair os arquivos (`git rm --cached -r . ; git reset --hard`) com a árvore limpa. |
| EAS Build falha em "Install dependencies" com `fatal: not in a git directory` | O script `prepare` rodava `git config` sem tolerar a ausência de git | Corrigido em 02/11/2026 (`... \|\| exit 0`); se reaparecer, conferir o `prepare` no `package.json`. |
| EAS pede para escolher conta ou recusa o projeto | Login com conta pessoal; o projeto pertence a `hortaconecta` | `npx eas-cli logout` e `npx eas-cli login` com a conta da equipe. |
| Seção de PIX indisponível no perfil da gestão | Reconciliação `20261005150000` ainda não aplicada no Supabase | Ver [CONTRIBUICOES.md](mvp/CONTRIBUICOES.md). |
