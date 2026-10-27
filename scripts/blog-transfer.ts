import {createClient} from '@supabase/supabase-js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {portableData} from './blog-portable';
const command=process.argv[2],folder=resolve(process.argv[3]||'artifacts/blog-transfer');
if(!['export','import','verify'].includes(command))throw new Error('Use: blog-transfer.ts export|import|verify pasta');
const source=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const tables=['blog_taxonomies','blog_media','blog_posts','blog_revisions','blog_publications','blog_schedules','blog_redirects'];
async function all(table:string){let rows:any[]=[];for(let offset=0;;offset+=500){const r=await source.from(table).select('*').range(offset,offset+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)return rows;}}
if(command==='export'){
 const raw:Record<string,any[]>={};for(const table of tables)raw[table]=await all(table);const data=portableData(raw);
 await mkdir(join(folder,'files'),{recursive:true});const files:any[]=[];
 for(const a of data.blog_media){for(const [bucket,path] of [['blog-private',a.original_path],...a.variants.flatMap((v:any)=>[['blog-private',v.path],...(a.status==='published'?[['blog-public',v.path]]:[])])]){const r=await source.storage.from(bucket).download(path);if(r.error)throw r.error;const buffer=Buffer.from(await r.data.arrayBuffer());const hash=createHash('sha256').update(buffer).digest('hex');await writeFile(join(folder,'files',hash),buffer);files.push({bucket,path,hash,type:r.data.type});}}
 await writeFile(join(folder,'manifest.json'),JSON.stringify({version:1,exportedAt:new Date().toISOString(),data,files},null,2));console.log('Exportação conferível concluída, sem demonstrações ou contas de acesso.');
}else{
 const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));if(manifest.version!==1)throw new Error('Versão de exportação inválida.');
 if(command==='import'){
  if(process.env.BLOG_IMPORT_CONFIRMED!=='true')throw new Error('Confirme o projeto DESTINO vazio com BLOG_IMPORT_CONFIRMED=true. Use as chaves do destino.');
  for(const t of tables){const check=await source.from(t).select('*',{count:'exact',head:true});if(check.error)throw check.error;if(check.count)throw new Error('Destino deve estar vazio; preserve o ambiente anterior para retorno.');}
  for(const f of manifest.files){const buffer=await readFile(join(folder,'files',f.hash));if(createHash('sha256').update(buffer).digest('hex')!==f.hash)throw new Error('Arquivo corrompido.');const r=await source.storage.from(f.bucket).upload(f.path,buffer,{contentType:f.type,upsert:false});if(r.error)throw r.error;}
  // Taxonomy image references are applied only after media exists.
  for(const t of ['blog_media','blog_taxonomies','blog_posts','blog_revisions','blog_publications','blog_schedules','blog_redirects']){for(let i=0;i<manifest.data[t].length;i+=100){const rows=manifest.data[t].slice(i,i+100).map((r:any)=>{const row={...r};delete row.search_vector;return row;});if(rows.length){const r=await source.from(t).insert(rows);if(r.error)throw r.error;}}}
 }
 for(const t of tables){const rows=await all(t);if(rows.length!==manifest.data[t].length)throw new Error('Contagem divergente: '+t);const key=t==='blog_redirects'?'slug':t==='blog_schedules'?'post_id':'id';for(const expected of manifest.data[t]){const actual=rows.find(r=>r[key]===expected[key]);if(!actual)throw new Error('Registro ausente: '+t);for(const field of Object.keys(expected).filter(k=>k!=='search_vector'))if(JSON.stringify(actual[field])!==JSON.stringify(expected[field]))throw new Error('Campo divergente: '+t+'.'+field);}}
 for(const f of manifest.files){const r=await source.storage.from(f.bucket).download(f.path);if(r.error)throw r.error;const hash=createHash('sha256').update(Buffer.from(await r.data.arrayBuffer())).digest('hex');if(hash!==f.hash)throw new Error('Arquivo divergente: '+f.path);}
 console.log('Conferência concluída: registros, slugs, revisões, agendamentos e hashes dos arquivos coincidem.');
}
