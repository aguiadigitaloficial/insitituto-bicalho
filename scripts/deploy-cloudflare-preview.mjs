import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {execFileSync, spawn} from 'node:child_process';
import {parseEnv} from 'node:util';
import {resolve, join} from 'node:path';

// This command deliberately cannot fall back to the agency's global Wrangler login.
const root = process.cwd(), configPath = resolve('dist-cloudflare/server/wrangler.json');
const source = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
const built = JSON.parse(await readFile(configPath, 'utf8'));
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
const name = 'instituto-bicalho-blog-preview';
if (!token || account !== source.account_id || built.account_id !== account || source.name !== name || built.name !== name) throw new Error('Confirme o token e a conta Cloudflare do Instituto; login global não é aceito.');
const branch = execFileSync('git', ['branch', '--show-current'], {encoding:'utf8'}).trim();
if (!branch.startsWith('codex/')) throw new Error('Publicação permitida somente pela branch de prévia.');
for (const config of [source, built]) {
  if (config.vars?.PUBLIC_INDEXABLE !== 'false' || config.vars?.BLOG_ENVIRONMENT !== 'preview' || config.vars?.BLOG_HOST !== 'cloudflare' || config.workers_dev !== true || config.routes?.length || config.route || config.env || config.dispatch_namespaces?.length) throw new Error('A prévia exige noindex, workers.dev e ausência de rotas/domínios adicionais.');
  if (!['/admin','/admin/*','/api/*','/conteudos','/conteudos/*','/sitemap.xml'].every(path=>config.assets?.run_worker_first?.includes(path))) throw new Error('Rotas editoriais precisam executar o Worker também na navegação do navegador.');
}
const headers = await readFile('dist-cloudflare/client/_headers', 'utf8');
if (!headers.includes('X-Robots-Tag: noindex, nofollow')) throw new Error('Cabeçalhos estáticos da prévia ausentes.');
const ref = process.env.BLOG_TEST_PROJECT_REF;
if (!ref || process.env.SUPABASE_URL !== `https://${ref}.supabase.co`) throw new Error('Supabase diferente do projeto de teste confirmado.');
const secrets = Object.fromEntries(['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','BLOG_CRON_SECRET'].map(key => {
  if (!process.env[key]) throw new Error(`Configure ${key} no arquivo privado.`);
  return [key, process.env[key]];
}));
let local = {}; try {local = parseEnv(await readFile('.env.local','utf8'));} catch {}
const privateValues = Object.entries({...process.env,...local}).filter(([key,value]) => /TOKEN|SECRET|SERVICE_ROLE|PASSWORD/.test(key) && typeof value === 'string' && value.length > 16).map(([,value])=>value);
async function scan(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path = join(dir,entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(?:m?js|cjs|json|html|css|map)$/.test(entry.name)) {
      const content = await readFile(path,'utf8');
      if (privateValues.some(value=>content.includes(value))) throw new Error(`Credencial incorporada ao pacote: ${path}`);
    }
  }
}
await scan(resolve('dist-cloudflare'));
const verify = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`, {headers:{Authorization:`Bearer ${token}`}});
const verified = await verify.json();
if (!verify.ok || !verified.success || verified.result?.status !== 'active') throw new Error('Token de conta Cloudflare inválido ou expirado.');
const list = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts`, {headers:{Authorization:`Bearer ${token}`}});
if (!list.ok || !(await list.json()).success) throw new Error('O token não pode acessar Workers nesta conta do Instituto.');
console.log(`Prévia verificada: ${name}; conta ${account}; branch ${branch}; noindex e pacote sem credenciais.`);
if (process.argv.includes('--deploy')) {
  await mkdir('artifacts/provision',{recursive:true});
  const secretFile = resolve('artifacts/provision/worker-secrets.json');
  await writeFile(secretFile,JSON.stringify(secrets),{mode:0o600});
  const args = ['node_modules/wrangler/bin/wrangler.js','deploy','--config',configPath,'--secrets-file',secretFile,'--message',`Bicalho preview ${execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim()}`];
  const child = spawn(process.execPath,args,{cwd:root,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,WRANGLER_SEND_METRICS:'false'},stdio:'inherit'});
  const code = await new Promise((done,reject)=>{child.on('exit',done);child.on('error',reject);});
  if (code !== 0) throw new Error('A publicação da prévia falhou; consulte o resultado do Wrangler.');
}
