const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { createRequire } = require('node:module');

const raiz = path.resolve(__dirname, '..');
// Binário oficial; SHA-256 publicado no release da Cloudflare em 30/09/2026.
const versao = '2026.9.3';
const sha256 = 'f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2';

function lerArgumentos(argumentos) {
  const opcoes = { porta: 8081, limpar: false, ajuda: false };
  for (let indice = 0; indice < argumentos.length; indice++) {
    const argumento = argumentos[indice];
    if (argumento === '--clear') opcoes.limpar = true;
    else if (argumento === '--help' || argumento === '-h') opcoes.ajuda = true;
    else if (argumento === '--port' || argumento.startsWith('--port=')) {
      const valor = argumento === '--port' ? argumentos[++indice] : argumento.slice(7);
      if (!/^\d+$/.test(valor ?? '') || Number(valor) < 1 || Number(valor) > 65535) {
        throw new Error('Use --port com uma porta entre 1 e 65535.');
      }
      opcoes.porta = Number(valor);
    } else throw new Error(`Opção desconhecida: ${argumento}. Use --help.`);
  }
  return opcoes;
}

function encontrarUrlTunel(texto) {
  return texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/)?.[0] ?? null;
}

async function verificarPorta(porta) {
  await new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once('error', erro => reject(erro.code === 'EADDRINUSE'
      ? new Error(`A porta ${porta} já está em uso. Encerre o Expo anterior com Ctrl+C ou use --port ${porta + 1}.`) : erro));
    servidor.listen(porta, 'localhost', () => servidor.close(resolve));
  });
}

async function obterBinario() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Este iniciador foi preparado para Windows x64. Use start:lan ou o túnel manual descrito em docs/EXECUTAR_APP.md.');
  }
  const destino = path.join(raiz, '.expo', 'tools', `cloudflared-${versao}.exe`);
  try {
    const existente = await fs.readFile(destino);
    if (createHash('sha256').update(existente).digest('hex') === sha256) return destino;
  } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  console.log(`Baixando cloudflared ${versao} do repositório oficial da Cloudflare…`);
  const resposta = await fetch(`https://github.com/cloudflare/cloudflared/releases/download/${versao}/cloudflared-windows-amd64.exe`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!resposta.ok) throw new Error(`Não foi possível baixar cloudflared (HTTP ${resposta.status}).`);
  const binario = Buffer.from(await resposta.arrayBuffer());
  if (createHash('sha256').update(binario).digest('hex') !== sha256) {
    throw new Error('A verificação do download falhou. O binário não foi executado.');
  }
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, binario);
  return destino;
}

function encerrarFilho(filho) {
  if (!filho?.pid || filho.exitCode !== null || filho.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Encerra somente este filho e seus workers, nunca outros processos Node/Expo.
    spawnSync('taskkill.exe', ['/PID', String(filho.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else filho.kill('SIGTERM');
}

async function iniciar(opcoes) {
  await verificarPorta(opcoes.porta);
  const binario = await obterBinario();
  let tunel, expo, finalizando = false;
  const encerrar = codigo => {
    if (finalizando) return;
    finalizando = true;
    encerrarFilho(expo);
    encerrarFilho(tunel);
    process.exitCode = codigo;
  };
  const interromper = () => encerrar(130);
  const terminar = () => encerrar(143);
  process.once('SIGINT', interromper);
  process.once('SIGTERM', terminar);
  try {
    console.log('Abrindo túnel temporário da Cloudflare…');
    tunel = spawn(binario, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${opcoes.porta}`], {
      cwd: raiz, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const url = await new Promise((resolve, reject) => {
      let log = '';
      const tempo = setTimeout(() => reject(new Error('A Cloudflare não abriu o túnel em 45 segundos. Tente start:lan ou outra conexão.')), 45000);
      const capturar = bloco => {
        log = (log + bloco.toString()).slice(-16000);
        const encontrada = encontrarUrlTunel(log);
        if (encontrada) { clearTimeout(tempo); resolve(encontrada); }
      };
      tunel.stdout.on('data', capturar);
      tunel.stderr.on('data', capturar);
      tunel.once('error', erro => { clearTimeout(tempo); reject(erro); });
      tunel.once('exit', codigo => {
        clearTimeout(tempo);
        reject(new Error(`O túnel foi encerrado (${codigo}).\n${log}`));
        if (expo && !finalizando) { console.error('O túnel foi encerrado. Execute o comando novamente.'); encerrar(1); }
      });
    });
    if (finalizando) return;
    const parametros = [require.resolve('expo/bin/cli'), 'start', '--go', '--localhost', '--port', String(opcoes.porta)];
    if (opcoes.limpar) parametros.push('--clear');
    // Env apenas deste subprocesso: não grava URL em .env e não altera Supabase.
    expo = spawn(process.execPath, parametros, {
      cwd: raiz, windowsHide: true,
      env: { ...process.env, EXPO_PACKAGER_PROXY_URL: url },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expo.stdout.pipe(process.stdout);
    expo.stderr.pipe(process.stderr);
    expo.once('error', erro => { console.error(erro.message); encerrar(1); });
    expo.once('exit', codigo => encerrar(codigo ?? 1));
    let pronto = false;
    for (let tentativa = 0; tentativa < 45 && !finalizando; tentativa++) {
      try {
        const resposta = await fetch(`http://localhost:${opcoes.porta}/status`, { signal: AbortSignal.timeout(2000) });
        if (resposta.ok && (await resposta.text()).includes('packager-status:running')) { pronto = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (finalizando) return;
    if (!pronto) throw new Error('O Metro não iniciou em 45 segundos. Confira as mensagens acima.');
    const link = `exps://${new URL(url).hostname}`;
    console.log(`\nAbra no Expo Go: ${link}\nPrévia web: ${url}\n`);
    try {
      // QR do próprio Expo, com esquema TLS corrigido para o proxy HTTPS no SDK 57.
      const requireExpo = createRequire(require.resolve('expo/package.json'));
      requireExpo('@expo/cli/build/src/utils/qr').printQRCode(link).print();
    } catch { console.log('Se o QR não aparecer, informe o link acima no Expo Go.'); }
    console.log('Mantenha este terminal aberto. Ctrl+C encerra o Expo e o túnel.\nAs alterações continuam usando Fast Refresh; recarregue pelo menu do Expo Go quando necessário.');
    await new Promise(resolve => expo.once('close', resolve));
  } catch (erro) {
    encerrar(1);
    throw erro;
  } finally {
    encerrar(process.exitCode ?? 0);
    process.removeListener('SIGINT', interromper);
    process.removeListener('SIGTERM', terminar);
  }
}

if (require.main === module) {
  Promise.resolve().then(() => {
    const opcoes = lerArgumentos(process.argv.slice(2));
    if (opcoes.ajuda) return console.log('Uso: npm.cmd run start:cloudflare -- [--port 8081] [--clear]\nCloudflare + Expo Go no Windows x64. Ctrl+C encerra os dois processos.');
    return iniciar(opcoes);
  }).catch(erro => { console.error(`\nNão foi possível iniciar: ${erro.message}`); process.exitCode = 1; });
}

module.exports = { lerArgumentos, encontrarUrlTunel, verificarPorta };
