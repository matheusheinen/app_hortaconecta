# Executar o HortaConecta no Windows

Abra o PowerShell na pasta do projeto. Para a primeira instalação, use Node.js 22.13 ou superior e instale as dependências com `npm.cmd ci`. O projeto usa [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).

```powershell
Set-Location -LiteralPath 'C:\Projetos\app_hortaconecta'
```

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

Abra o Expo Go compatível com o SDK 57 no celular e leia o QR code do terminal. Se o Wi-Fi bloquear a comunicação entre dispositivos, use o comando Cloudflare abaixo. LAN e localhost são opções oficiais da [Expo CLI](https://docs.expo.dev/more/expo-cli/#server-url).

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

## Quando o túnel Ngrok falhar

```powershell
npm.cmd run start:tunnel
```

O modo integrado usa `@expo/ngrok`, instalado no projeto. Se aparecer `Cannot read properties of undefined (reading 'body')` ou ocorrer timeout, use LAN ou Cloudflare para continuar trabalhando.

A equipe do Expo já [registrou limites da conta Ngrok compartilhada](https://github.com/expo/expo/issues/43335). Um estado operacional na [página de status do Ngrok](https://status.ngrok.com/) descreve o serviço em geral e pode coexistir com limites de uma conta; isoladamente, ele não identifica a causa da falha neste projeto. A documentação da [Expo CLI sobre túneis](https://docs.expo.dev/more/expo-cli/#tunneling) também descreve sua dependência de serviços externos.
