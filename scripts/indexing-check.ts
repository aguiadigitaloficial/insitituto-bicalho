import assert from 'node:assert/strict';
import {isIndexableHost, isPrivateIndexingPath} from '../src/lib/indexing';

const hosts = ['institutobicalho.com', 'www.institutobicalho.com', 'insitituto-bicalho.cbicalhogarcia.workers.dev', 'instituto-bicalho-blog-preview.institutobicalho-site.workers.dev', 'localhost', 'institutobicalho.com.example.org'];
for (const hostname of hosts) for (const enabled of ['true', 'false', '']) for (const environment of ['production', 'preview', 'development', '']) {
  assert.equal(isIndexableHost(hostname, enabled, environment), hostname === hosts[0] && enabled === 'true' && environment === 'production', `${hostname}/${enabled}/${environment}`);
}
for (const path of ['/admin', '/admin/', '/api/blog/posts/', '/404.html', '/404/', '/conteudos/busca/', '/conteudos/tag/teste/', '/conteudos/previa/id/']) assert(isPrivateIndexingPath(path), path);
for (const path of ['/', '/tratamentos/', '/conteudos/', '/conteudos/artigo/', '/conteudos/categoria/tratamentos/', '/conteudos/autor/instituto/']) assert(!isPrivateIndexingPath(path), path);
console.log('PASS: official-host indexing policy, preview isolation and private routes.');
