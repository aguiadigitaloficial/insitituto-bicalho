import {createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Only product inputs participate: reports and documentation can change without rebuilding.
export async function cloudflareSourceDigest(){
  const hash=createHash('sha256');
  async function visit(path){
    const entries=await readdir(path,{withFileTypes:true});
    for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
      const file=join(path,entry.name);
      if(entry.isDirectory())await visit(file);
      else{hash.update(file.replaceAll('\\','/'));hash.update(await readFile(file));}
    }
  }
  await visit('src');await visit('public');
  for(const file of ['astro.config.mjs','astro.cloudflare.config.mjs','wrangler.jsonc','package.json','package-lock.json','redirects.json']){hash.update(file);hash.update(await readFile(file));}
  return hash.digest('hex');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await mkdir('artifacts/provision',{recursive:true});
  await writeFile('artifacts/provision/cloudflare-build.json',JSON.stringify({builtAt:new Date().toISOString(),sourceDigest:await cloudflareSourceDigest()}));
  console.log('Cloudflare build source fingerprint saved.');
}
