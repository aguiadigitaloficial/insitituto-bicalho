import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve} from 'node:path';
import {TARGET, REQUIRED_SECRETS, validateConfig, isolatedEnv, validateDeploymentEnvironment, deployWithRuntimeSecrets} from './cloudflare-production.mjs';

// Pure guard checks only: no build, network, credentials, database or deployment.
const failures = [];
let passed = 0;
function check(name, run) {
  try {run(); passed++;} catch (error) {failures.push({name, message: error.message});}
}
async function checkAsync(name, run) {
  try {await run(); passed++;} catch (error) {failures.push({name, message: error.message});}
}
const source = JSON.parse(await readFile(new URL('../wrangler.production.jsonc', import.meta.url), 'utf8'));
const clone = () => structuredClone(source);
function rejectsConfig(name, mutate) {
  check(`config: ${name}`, () => {const candidate = clone(); mutate(candidate); assert.throws(() => validateConfig(candidate), assert.AssertionError);});
}

check('config: accepts the checked-in candidate without mutation', () => {
  const candidate = clone(); validateConfig(candidate); assert.deepEqual(candidate, source);
});
check('config: allows adapter-generated metadata without relaxing deployment scope', () => {
  validateConfig({...clone(), main: 'entry.mjs', no_bundle: true, base_dir: '.'});
});
check('target: remains the existing production candidate account, worker and branch', () => {
  assert.deepEqual(TARGET, {account: '3799fcca9a44fc397332387e593b9cc5', name: 'insitituto-bicalho', branch: 'codex/cloudflare-production'});
});
check('secrets: requires runtime database and scheduler bindings', () => {
  assert.deepEqual(REQUIRED_SECRETS, ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BLOG_CRON_SECRET']);
});

rejectsConfig('missing account', config => {delete config.account_id;});
rejectsConfig('preview account', config => {config.account_id = '7803c3e071f890d75cda7f82cc8b1f54';});
rejectsConfig('missing worker name', config => {delete config.name;});
rejectsConfig('preview worker', config => {config.name = 'instituto-bicalho-blog-preview';});
rejectsConfig('a new similarly named worker', config => {config.name = 'instituto-bicalho';});
rejectsConfig('missing vars', config => {delete config.vars;});
for (const [key, value] of Object.entries({BLOG_HOST: 'vercel', BLOG_ENVIRONMENT: 'preview', BLOG_DEMO: 'true', PUBLIC_INDEXABLE: 'true', PUBLIC_SITE_URL: 'https://example.invalid'})) {
  rejectsConfig(`invalid ${key}`, config => {config.vars[key] = value;});
  rejectsConfig(`missing ${key}`, config => {delete config.vars[key];});
}
rejectsConfig('boolean demo toggle bypass', config => {config.vars.BLOG_DEMO = false;});
rejectsConfig('boolean index toggle bypass', config => {config.vars.PUBLIC_INDEXABLE = false;});
rejectsConfig('secret accidentally placed in vars', config => {config.vars.SUPABASE_SERVICE_ROLE_KEY = 'FAKE_TEST_SECRET';});
rejectsConfig('extra public override', config => {config.vars.PUBLIC_GA_ID = 'G-TEST12345';});
rejectsConfig('workers.dev disabled', config => {config.workers_dev = false;});
rejectsConfig('version preview URLs enabled', config => {config.preview_urls = true;});
rejectsConfig('missing workers.dev flag', config => {delete config.workers_dev;});
rejectsConfig('missing preview flag', config => {delete config.preview_urls;});
rejectsConfig('domain route string', config => {config.route = 'institutobicalho.com/*';});
rejectsConfig('domain route list', config => {config.routes = ['institutobicalho.com/*'];});
rejectsConfig('custom-domain route object', config => {config.routes = [{pattern: 'institutobicalho.com', custom_domain: true}];});
rejectsConfig('named environment override', config => {config.env = {production: {name: 'another-worker'}};});
rejectsConfig('dispatch namespace', config => {config.dispatch_namespaces = [{binding: 'NAMESPACE', namespace: 'other'}];});
rejectsConfig('Worker cron added', config => {config.triggers = {crons: ['* * * * *']};});
rejectsConfig('missing image binding', config => {delete config.images;});
rejectsConfig('wrong image binding', config => {config.images.binding = 'OTHER';});
rejectsConfig('missing assets binding', config => {delete config.assets;});
rejectsConfig('wrong assets binding', config => {config.assets.binding = 'OTHER';});
rejectsConfig('SPA fallback instead of real 404', config => {config.assets.not_found_handling = 'single-page-application';});
for (const path of source.assets.run_worker_first) {
  rejectsConfig(`SSR bypass by omitting ${path}`, config => {config.assets.run_worker_first = config.assets.run_worker_first.filter(value => value !== path);});
}
rejectsConfig('worker-first wildcard', config => {config.assets.run_worker_first = ['/*'];});
rejectsConfig('extra worker-first route', config => {config.assets.run_worker_first.push('/assets/*');});

const appSecrets = Object.fromEntries([
  ...REQUIRED_SECRETS, 'SUPABASE_ACCESS_TOKEN', 'BLOG_TEST_PROJECT_REF', 'BLOG_SEED_ACTOR',
  'BREVO_API_KEY', 'SMTP_PASSWORD', 'PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
].map(key => [key, `FAKE_TEST_VALUE_${key}`]));
const inherited = {
  ...appSecrets,
  PATH: '/safe/test/path', TEMP: '/safe/test/tmp', CI: 'true',
  BLOG_HOST: 'vercel', BLOG_ENVIRONMENT: 'preview', BLOG_DEMO: 'true',
  PUBLIC_INDEXABLE: 'true', PUBLIC_SITE_URL: 'https://wrong.invalid', PUBLIC_GA_ID: 'G-TEST12345',
  BICALHO_WRANGLER_CONFIG: './wrong.jsonc', CLOUDFLARE_ENV: 'wrong-environment',
  WRANGLER_CI_OVERRIDE_NAME: 'another-worker',
  CLOUDFLARE_API_TOKEN: 'FAKE_TEST_CLOUDFLARE_TOKEN', CLOUDFLARE_API_KEY: 'FAKE_TEST_GLOBAL_KEY',
  CLOUDFLARE_ACCOUNT_ID: 'other-account',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'true', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', WRANGLER_SEND_METRICS: 'true',
};
const before = structuredClone(inherited);
const buildEnv = isolatedEnv(inherited);
check('build environment: never mutates the parent process environment', () => assert.deepEqual(inherited, before));
check('build environment: preserves ordinary process paths and CI', () => {
  for (const key of ['PATH', 'TEMP', 'CI']) assert.equal(buildEnv[key], inherited[key]);
});
check('build environment: enforces the candidate settings', () => {
  for (const [key, value] of Object.entries(source.vars)) assert.equal(buildEnv[key], value, key);
});
for (const key of [...Object.keys(appSecrets), 'PUBLIC_GA_ID', 'BICALHO_WRANGLER_CONFIG', 'CLOUDFLARE_ENV', 'WRANGLER_CI_OVERRIDE_NAME', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_ACCOUNT_ID']) {
  check(`build environment: excludes ${key}`, () => assert.equal(Object.hasOwn(buildEnv, key), false, `${key} must not reach the build environment`));
}
for (const key of ['CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV', 'CLOUDFLARE_INCLUDE_PROCESS_ENV', 'WRANGLER_SEND_METRICS']) {
  check(`build environment: disables ${key}`, () => assert.equal(buildEnv[key], 'false'));
}

const deployment = {
  CLOUDFLARE_API_TOKEN: 'FAKE_TEST_TOKEN_NOT_A_CREDENTIAL', CLOUDFLARE_ACCOUNT_ID: TARGET.account,
  WORKERS_CI_BRANCH: TARGET.branch, WRANGLER_CI_OVERRIDE_NAME: TARGET.name,
};
check('deployment environment: accepts matching explicit CI settings', () => validateDeploymentEnvironment(deployment, TARGET.branch));
check('deployment environment: accepts local candidate branch with explicit token', () => validateDeploymentEnvironment({CLOUDFLARE_API_TOKEN: deployment.CLOUDFLARE_API_TOKEN}, TARGET.branch));
check('deployment environment: does not mutate the provided settings', () => {
  const env = structuredClone(deployment); validateDeploymentEnvironment(env, TARGET.branch); assert.deepEqual(env, deployment);
});
for (const branch of ['main', 'codex/blog-preview', '', undefined]) {
  check(`deployment environment: rejects branch ${String(branch)}`, () => assert.throws(() => validateDeploymentEnvironment(deployment, branch), assert.AssertionError));
}
for (const [key, value] of Object.entries({WORKERS_CI_BRANCH: 'main', WRANGLER_CI_OVERRIDE_NAME: 'instituto-bicalho-blog-preview', CLOUDFLARE_ACCOUNT_ID: 'other-account', CLOUDFLARE_API_TOKEN: ''})) {
  check(`deployment environment: rejects ${key} mismatch`, () => assert.throws(() => validateDeploymentEnvironment({...deployment, [key]: value}, TARGET.branch), assert.AssertionError));
}
check('deployment environment: rejects missing token instead of global login fallback', () => {
  const env = {...deployment}; delete env.CLOUDFLARE_API_TOKEN;
  assert.throws(() => validateDeploymentEnvironment(env, TARGET.branch), assert.AssertionError);
});

// Exercise the deployment boundary with fake values and injected callbacks only.
// No fetch, Wrangler subprocess or real credentials are used by these checks.
const fakeSecrets = Object.fromEntries(REQUIRED_SECRETS.map((key, index) => [key, `FAKE_${index}_literal_$VALUE_"quote"_\\slash\nline`]));
const fakeEnv = {...deployment, ...fakeSecrets, BREVO_API_KEY: 'FAKE_UNRELATED_KEY', WRANGLER_LOG: 'debug', WRANGLER_LOG_SANITIZE: 'false', WRANGLER_WRITE_LOGS: 'true', CLOUDFLARE_API_BASE_URL: 'https://wrong.invalid', CF_API_BASE_URL: 'https://wrong-alias.invalid'};
function secretPath(args) {
  const index = args.indexOf('--secrets-file');
  return index === -1 ? undefined : args[index + 1];
}
async function assertRemoved(path) {
  assert(path, 'The upload callback must observe a temporary file.');
  await assert.rejects(stat(path), error => error.code === 'ENOENT');
  await assert.rejects(stat(dirname(path)), error => error.code === 'ENOENT');
}

await checkAsync('bootstrap: uploads code and all missing secrets together, then removes the protected temporary file', async () => {
  const parentBefore = structuredClone(fakeEnv);
  const events = [];
  let path;
  await deployWithRuntimeSecrets({
    env: fakeEnv, branch: TARGET.branch,
    readSecretNames: async () => {
      events.push('read');
      return events.length === 1 ? new Set() : new Set(REQUIRED_SECRETS);
    },
    upload: async ({args, env}) => {
      events.push('upload');
      assert.deepEqual(args.slice(0, 3), ['deploy', '--config', resolve('dist-cloudflare-production/server/wrangler.json')]);
      path = secretPath(args);
      assert(isAbsolute(path));
      const fromCheckout = relative(process.cwd(), path);
      assert(fromCheckout.startsWith('..') || isAbsolute(fromCheckout), 'Temporary secrets must stay outside the checkout and build output.');
      assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), fakeSecrets, 'JSON must preserve literal dollars, quotes, backslashes and newlines.');
      if (process.platform !== 'win32') {
        assert.equal((await stat(path)).mode & 0o777, 0o600);
        assert.equal((await stat(dirname(path))).mode & 0o777, 0o700);
      }
      for (const name of [...REQUIRED_SECRETS, 'BREVO_API_KEY']) assert(!Object.hasOwn(env, name), `${name} must not enter the Wrangler process environment.`);
      assert.equal(env.CLOUDFLARE_ACCOUNT_ID, TARGET.account);
      assert.equal(env.CLOUDFLARE_API_TOKEN, fakeEnv.CLOUDFLARE_API_TOKEN);
      assert.equal(env.CLOUDFLARE_API_BASE_URL, 'https://api.cloudflare.com/client/v4');
      assert.equal(env.WRANGLER_LOG, 'info', 'Inherited debug logging must not expose the upload payload.');
      assert.equal(env.WRANGLER_LOG_SANITIZE, 'true');
      assert.equal(env.WRANGLER_WRITE_LOGS, 'false', 'Wrangler debug files must not retain upload payloads.');
      assert.equal(env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, 'false');
      assert.equal(env.CLOUDFLARE_INCLUDE_PROCESS_ENV, 'false');
      for (const value of Object.values(fakeSecrets)) assert(!args.join(' ').includes(value), 'Secret values must not become CLI arguments.');
    },
  });
  assert.deepEqual(events, ['read', 'upload', 'read']);
  assert.deepEqual(fakeEnv, parentBefore);
  await assertRemoved(path);
});

await checkAsync('bootstrap: existing runtime secrets are never replaced by stale build secrets', async () => {
  const existing = new Set(REQUIRED_SECRETS.slice(0, 2));
  let reads = 0;
  let path;
  await deployWithRuntimeSecrets({
    env: fakeEnv, branch: TARGET.branch,
    readSecretNames: async () => ++reads === 1 ? existing : new Set(REQUIRED_SECRETS),
    upload: async ({args}) => {
      path = secretPath(args);
      const uploaded = JSON.parse(await readFile(path, 'utf8'));
      assert.deepEqual(Object.keys(uploaded), REQUIRED_SECRETS.slice(2));
      for (const name of existing) assert(!Object.hasOwn(uploaded, name));
    },
  });
  assert.deepEqual([...existing], REQUIRED_SECRETS.slice(0, 2));
  await assertRemoved(path);
});

await checkAsync('bootstrap: later deployments need no build secrets when all runtime secrets already exist', async () => {
  let uploads = 0;
  let reads = 0;
  await deployWithRuntimeSecrets({
    env: {...deployment}, branch: TARGET.branch,
    readSecretNames: async () => {reads++; return new Set(REQUIRED_SECRETS);},
    upload: async ({args}) => {uploads++; assert.equal(secretPath(args), undefined); assert.equal(args.length, 3);},
  });
  assert.equal(uploads, 1);
  assert.equal(reads, 2);
});

for (const invalid of [undefined, '', ' \t\n']) {
  await checkAsync(`bootstrap: missing build value ${String(invalid)} blocks before any upload and names the field`, async () => {
    const missingName = REQUIRED_SECRETS[2];
    let uploads = 0;
    let reads = 0;
    await assert.rejects(deployWithRuntimeSecrets({
      env: {...fakeEnv, [missingName]: invalid}, branch: TARGET.branch,
      readSecretNames: async () => {reads++; return new Set();},
      upload: async () => {uploads++;},
    }), error => {
      assert(error.message.includes(missingName));
      for (const value of Object.values(fakeSecrets)) assert(!error.message.includes(value));
      return true;
    });
    assert.equal(uploads, 0);
    assert.equal(reads, 1);
  });
}

await checkAsync('bootstrap: an existing runtime value does not need its build counterpart', async () => {
  const existingName = REQUIRED_SECRETS[0];
  const env = {...fakeEnv}; delete env[existingName];
  let reads = 0;
  let path;
  await deployWithRuntimeSecrets({
    env, branch: TARGET.branch,
    readSecretNames: async () => ++reads === 1 ? new Set([existingName]) : new Set(REQUIRED_SECRETS),
    upload: async ({args}) => {
      path = secretPath(args);
      const uploaded = JSON.parse(await readFile(path, 'utf8'));
      assert(!Object.hasOwn(uploaded, existingName));
      assert.equal(Object.keys(uploaded).length, 3);
    },
  });
  await assertRemoved(path);
});

await checkAsync('bootstrap: upload failures still remove the temporary file and do not claim post-deploy verification', async () => {
  let path;
  let reads = 0;
  await assert.rejects(deployWithRuntimeSecrets({
    env: fakeEnv, branch: TARGET.branch,
    readSecretNames: async () => {reads++; return new Set();},
    upload: async ({args}) => {path = secretPath(args); await stat(path); throw new Error('Simulated upload failure');},
  }));
  assert.equal(reads, 1);
  await assertRemoved(path);
});

await checkAsync('bootstrap: absent runtime bindings after upload are reported and the temporary file is removed', async () => {
  let path;
  let reads = 0;
  await assert.rejects(deployWithRuntimeSecrets({
    env: fakeEnv, branch: TARGET.branch,
    readSecretNames: async () => {reads++; return new Set();},
    upload: async ({args}) => {path = secretPath(args); await stat(path);},
  }), error => {
    for (const name of REQUIRED_SECRETS) assert(error.message.includes(name));
    for (const value of Object.values(fakeSecrets)) assert(!error.message.includes(value));
    return true;
  });
  assert.equal(reads, 2);
  await assertRemoved(path);
});

await checkAsync('bootstrap: post-upload API failure also removes the temporary file', async () => {
  let path;
  let reads = 0;
  await assert.rejects(deployWithRuntimeSecrets({
    env: fakeEnv, branch: TARGET.branch,
    readSecretNames: async () => {if (++reads > 1) throw new Error('Simulated settings failure'); return new Set();},
    upload: async ({args}) => {path = secretPath(args);},
  }));
  await assertRemoved(path);
});

await checkAsync('bootstrap: initial settings API failure prevents upload', async () => {
  let uploads = 0;
  await assert.rejects(deployWithRuntimeSecrets({
    env: fakeEnv, branch: TARGET.branch,
    readSecretNames: async () => {throw new Error('Simulated authorization failure');},
    upload: async () => {uploads++;},
  }));
  assert.equal(uploads, 0);
});

for (const [name, env, branch] of [
  ['branch', fakeEnv, 'main'],
  ['account', {...fakeEnv, CLOUDFLARE_ACCOUNT_ID: 'other-account'}, TARGET.branch],
  ['worker', {...fakeEnv, WRANGLER_CI_OVERRIDE_NAME: 'instituto-bicalho-blog-preview'}, TARGET.branch],
  ['credential', {...fakeEnv, CLOUDFLARE_API_TOKEN: ''}, TARGET.branch],
]) {
  await checkAsync(`bootstrap: ${name} guard runs before accessing settings or upload`, async () => {
    let calls = 0;
    await assert.rejects(deployWithRuntimeSecrets({
      env, branch,
      readSecretNames: async () => {calls++; return new Set();},
      upload: async () => {calls++;},
    }));
    assert.equal(calls, 0);
  });
}

for (const failure of failures) console.error(`FAIL: ${failure.name}\n  ${failure.message}`);
console.log(`${failures.length ? 'FAIL' : 'PASS'}: ${passed}/${passed + failures.length} Cloudflare production guard/bootstrap checks; fake secrets only, no build, network, database or deployment executed.`);
if (failures.length) process.exitCode = 1;
