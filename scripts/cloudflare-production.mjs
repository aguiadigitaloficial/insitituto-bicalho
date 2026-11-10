import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {readFile, readdir, mkdir, writeFile, mkdtemp, chmod, unlink, rmdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';

export const TARGET = Object.freeze({account: '3799fcca9a44fc397332387e593b9cc5', name: 'insitituto-bicalho', branch: 'codex/cloudflare-production'});
const output = 'dist-cloudflare-production';
const builtPath = `${output}/server/wrangler.json`;
const stampPath = 'artifacts/provision/cloudflare-production-build.json';
export const REQUIRED_SECRETS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BLOG_CRON_SECRET'];
const expectedVars = {BLOG_HOST: 'cloudflare', BLOG_ENVIRONMENT: 'production', BLOG_DEMO: 'false', PUBLIC_INDEXABLE: 'false', PUBLIC_SITE_URL: 'https://institutobicalho.com'};

export function validateConfig(config) {
  assert.equal(config.account_id, TARGET.account, 'Conta diferente da conta do domínio.');
  assert.equal(config.name, TARGET.name, 'Use o Worker existente, sem criar outro projeto.');
  assert.deepEqual(config.vars, expectedVars, 'O candidato exige produção sem demonstrações e com noindex.');
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert(!config.routes?.length && !config.route && !config.env && !config.dispatch_namespaces?.length, 'Este comando não conecta domínios nem altera rotas.');
  assert(!config.triggers?.crons?.length, 'O agendamento do banco será conferido separadamente.');
  assert.equal(config.images?.binding, 'IMAGES');
  assert.equal(config.assets?.binding, 'ASSETS');
  assert.equal(config.assets?.not_found_handling, '404-page');
  assert.deepEqual(config.assets?.run_worker_first, ['/admin', '/admin/*', '/api/*', '/conteudos', '/conteudos/*', '/sitemap.xml']);
}

export function isolatedEnv(input = process.env) {
  const env = {...input};
  for (const key of Object.keys(env)) {
    if (/^(?:SUPABASE_|BLOG_|BREVO_|SMTP_|PUBLIC_|BICALHO_WRANGLER_CONFIG$|CLOUDFLARE_(?:ENV|ACCOUNT_ID|API_TOKEN|API_KEY|EMAIL)$|WRANGLER_CI_OVERRIDE_NAME$)/.test(key)) delete env[key];
  }
  return {...env, ...expectedVars, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: resolve('artifacts/provision/wrangler-production.log'), ASTRO_TELEMETRY_DISABLED: '1'};
}

export function validateDeploymentEnvironment(env, branch) {
  assert.equal(branch, TARGET.branch, 'Use somente a branch do candidato à produção.');
  if (env.WORKERS_CI_BRANCH) assert.equal(env.WORKERS_CI_BRANCH, TARGET.branch, 'Branch do build incorreta.');
  if (env.WRANGLER_CI_OVERRIDE_NAME) assert.equal(env.WRANGLER_CI_OVERRIDE_NAME, TARGET.name, 'O painel está conectado a outro Worker.');
  if (env.CLOUDFLARE_ACCOUNT_ID) assert.equal(env.CLOUDFLARE_ACCOUNT_ID, TARGET.account, 'Credencial de outra conta.');
  assert(env.CLOUDFLARE_API_TOKEN, 'Configure a credencial do Workers Builds; login global não é utilizado.');
}

async function readRuntimeSecretNames(env) {
  // Settings expose binding names/types, never secret values. A failed lookup
  // must not be mistaken for an empty Worker and trigger an overwrite.
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${TARGET.account}/workers/scripts/${TARGET.name}/settings`, {
    headers: {Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`}, signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  assert(response.ok && data.success && Array.isArray(data.result?.bindings), 'Não foi possível confirmar os segredos do Worker existente com a credencial do build.');
  return new Set(data.result.bindings.filter(binding => binding.type === 'secret_text').map(binding => binding.name));
}

export async function deployWithRuntimeSecrets({env, branch, readSecretNames = () => readRuntimeSecretNames(env), upload = ({args, env: childEnv}) => run('node_modules/wrangler/bin/wrangler.js', args, childEnv)}) {
  validateDeploymentEnvironment(env, branch);
  const existing = await readSecretNames();
  const missing = REQUIRED_SECRETS.filter(name => !existing.has(name));
  const unavailable = missing.filter(name => typeof env[name] !== 'string' || !env[name].trim());
  assert.equal(unavailable.length, 0, `Faltam segredos em Compilações para a primeira implantação: ${unavailable.join(', ')}. Cadastre esses nomes como Secret e execute a build novamente.`);

  // Only absent runtime bindings are bootstrapped. Existing secrets remain in
  // Cloudflare even if an old/different value is still present in Build Secrets.
  const childEnv = {
    ...isolatedEnv(env), CLOUDFLARE_ACCOUNT_ID: TARGET.account, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_API_BASE_URL: 'https://api.cloudflare.com/client/v4',
    WRANGLER_LOG: 'info', WRANGLER_LOG_SANITIZE: 'true', WRANGLER_WRITE_LOGS: 'false',
  };
  const args = ['deploy', '--config', resolve(builtPath)];
  let directory;
  let secretPath;
  try {
    if (missing.length) {
      directory = await mkdtemp(join(tmpdir(), 'bicalho-worker-secrets-'));
      await chmod(directory, 0o700);
      secretPath = join(directory, 'secrets.json');
      // JSON keeps literal $, quotes and line breaks intact. Never use dotenv
      // interpolation, persist an upload form, or place this file in the repo.
      await writeFile(secretPath, JSON.stringify(Object.fromEntries(missing.map(name => [name, env[name]]))), {mode: 0o600, flag: 'wx'});
      args.push('--secrets-file', secretPath);
    }
    await upload({args, env: childEnv});
    const published = await readSecretNames();
    const stillMissing = REQUIRED_SECRETS.filter(name => !published.has(name));
    assert.equal(stillMissing.length, 0, `A implantação terminou, mas a conferência não encontrou os segredos de execução: ${stillMissing.join(', ')}.`);
    return {bootstrapped: missing, verified: [...REQUIRED_SECRETS]};
  } finally {
    // No recursive deletion: remove only the exact temporary file/directory
    // created by this invocation, on success or any deployment/check failure.
    try {if (secretPath) await unlink(secretPath).catch(error => {if (error.code !== 'ENOENT') throw error;});}
    finally {if (directory) await rmdir(directory);}
  }
}

async function filesUnder(dir) {
  const files = [];
  for (const entry of (await readdir(dir, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && entry.name === '.wrangler') continue; // Local dev cache is never a deploy input.
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path)); else files.push(path);
  }
  return files;
}
async function digest(files) {
  const hash = createHash('sha256');
  for (const file of files) {hash.update(file.replaceAll('\\', '/')); hash.update(await readFile(file));}
  return hash.digest('hex');
}
async function sourceDigest() {
  return digest([...await filesUnder('src'), ...await filesUnder('public'), 'astro.cloudflare.production.config.mjs', 'wrangler.production.jsonc', 'scripts/cloudflare-production.mjs', 'tsconfig.json', 'package.json', 'package-lock.json', 'redirects.json']);
}
async function readConfig(path) {return JSON.parse(await readFile(path, 'utf8'));}
async function run(file, args, env) {
  const child = spawn(process.execPath, [file, ...args], {env, stdio: 'inherit', windowsHide: true});
  const code = await new Promise((done, reject) => {child.on('error', reject); child.on('exit', done);});
  assert.equal(code, 0, 'O comando falhou; nenhuma publicação posterior será executada.');
}

export async function checkArtifact() {
  validateConfig(await readConfig('wrangler.production.jsonc'));
  const built = await readConfig(builtPath); validateConfig(built);
  const stamp = await readConfig(stampPath);
  assert.equal(stamp.sourceDigest, await sourceDigest(), 'Arquivos mudaram: execute o build novamente.');
  assert.equal(stamp.artifactDigest, await digest(await filesUnder(output)), 'Pacote mudou após o build.');
  assert.equal(built.main, 'entry.mjs', 'Servidor Astro ausente.');
  assert((await readFile(`${output}/client/_headers`, 'utf8')).includes('X-Robots-Tag: noindex, nofollow'));
  const home = await readFile(`${output}/client/index.html`, 'utf8');
  assert(/name="robots" content="noindex/.test(home), 'Página estática sem bloqueio de indexação.');
  assert(home.includes('rel="canonical" href="https://institutobicalho.com/"'), 'Canonical diferente do domínio oficial.');
  assert(home.includes('href="/conteudos/"'), 'O pacote não contém o blog atual.');
  const manifest = await readFile(`${output}/server/manifest.json`, 'utf8').catch(() => '');
  // The adapter may embed its route manifest in JS instead of a separate JSON file.
  const serverFiles = await filesUnder(`${output}/server`);
  const routeCode = manifest + (await Promise.all(serverFiles.filter(f => /\.(?:m?js|json)$/.test(f)).map(f => readFile(f, 'utf8')))).join('\n');
  assert(routeCode.includes('/api/blog/') && routeCode.includes('/conteudos/') && routeCode.includes('/admin/'), 'Rotas editoriais ausentes do servidor.');
  const privateEnvs = [{...process.env}];
  for (const name of (await readdir('.')).filter(name => /^\.env(?:\.|$)/.test(name))) {
    privateEnvs.push(parseEnv(await readFile(name, 'utf8')));
  }
  const secrets = privateEnvs.flatMap(env => Object.entries(env).filter(([key, value]) => (REQUIRED_SECRETS.includes(key) || /TOKEN|SECRET|SERVICE_ROLE|PASSWORD|API_KEY/.test(key)) && typeof value === 'string' && value.length > 16).map(([, value]) => value));
  for (const path of (await filesUnder(output)).filter(path => /\.(?:m?js|cjs|json|html|css|map)$/.test(path))) {
    const content = await readFile(path, 'utf8');
    assert(!secrets.some(secret => content.includes(secret)), `Credencial incorporada ao pacote: ${path}`);
  }
  console.log('PASS: candidato SSR completo, conta/nome corretos, sem domínio conectado e com noindex.');
}

async function main(command) {
  assert(['build', 'check', 'deploy'].includes(command), 'Use build, check ou deploy.');
  if (command === 'build') {
    assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Use Node.js 24.');
    validateConfig(await readConfig('wrangler.production.jsonc'));
    assert(!(await readdir('.')).some(name => name === '.dev.vars' || name.startsWith('.dev.vars.')), 'Remova os arquivos .dev.vars deste checkout antes do build de produção.');
    await mkdir('.astro/production-env', {recursive: true});
    assert.equal((await readdir('.astro/production-env')).length, 0, 'A pasta isolada de variáveis deve estar vazia.');
    const env = isolatedEnv();
    const before = await sourceDigest();
    await run('node_modules/astro/bin/astro.mjs', ['check', '--config', 'astro.cloudflare.production.config.mjs'], env);
    await run('node_modules/astro/bin/astro.mjs', ['build', '--config', 'astro.cloudflare.production.config.mjs'], env);
    assert.equal(await sourceDigest(), before, 'A fonte mudou durante a compilação. Execute o build novamente.');
    await mkdir('artifacts/provision', {recursive: true});
    await writeFile(stampPath, JSON.stringify({builtAt: new Date().toISOString(), sourceDigest: before, artifactDigest: await digest(await filesUnder(output))}, null, 2));
  }
  await checkArtifact();
  if (command !== 'deploy') return;
  const branch = execFileSync('git', ['branch', '--show-current'], {encoding: 'utf8'}).trim() || process.env.WORKERS_CI_BRANCH;
  const result = await deployWithRuntimeSecrets({env: process.env, branch});
  console.log(`PASS: servidor publicado e ${result.verified.length} segredos de execução confirmados; ${result.bootstrapped.length} vínculos ausentes criados junto do código.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch(error => {console.error(error.message); process.exitCode = 1;});
}
