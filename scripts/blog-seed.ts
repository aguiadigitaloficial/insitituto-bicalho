import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {demoSnapshot} from '../src/lib/blog/demo';
import {COPYRIGHT,contentText} from '../src/lib/blog/model';
import {media} from '../src/data/photos';
if(process.env.BLOG_DEMO!=='true'||(process.env.BLOG_ENVIRONMENT||process.env.VERCEL_ENV)==='production')throw new Error('Seed permitido somente no projeto exclusivo de teste com BLOG_DEMO=true.');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,actor=process.env.BLOG_SEED_ACTOR;
if(!url||!key||!actor)throw new Error('Configure o projeto de teste e BLOG_SEED_ACTOR (UUID do proprietário convidado).');
const db=createClient(url,key,{auth:{persistSession:false}});const tax=await db.from('blog_taxonomies').select('*');if(tax.error)throw tax.error;const author=tax.data.find(t=>t.kind==='author'&&t.slug==='instituto-bicalho');const categories=tax.data.filter(t=>t.kind==='category');if(!author||categories.length!==4)throw new Error('Execute as migrations antes do seed.');
async function put(bucket:string,path:string,bytes:Buffer,contentType:string){
 for(let attempt=0;;attempt++){
  const result=await db.storage.from(bucket).upload(path,bytes,{contentType,upsert:true});
  if(!result.error)return;
  const status=Number((result.error as any).status||Number((result.error as any).statusCode));
  if(attempt>=3||!(status===429||status>=500))throw result.error;
  console.log('Falha transitória de armazenamento; repetindo o mesmo arquivo.');
  await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
 }
}
const photos=[media.hero,media.clinic,media.serviceTreatments,media.servicePrecision,media.team,media.serviceAesthetics,media.precision,media.aligners,media.smile,media.serviceOrthodontics,media.clinic,media.hero];
const existing=await db.from('blog_posts').select('draft').eq('is_demo',true);if(existing.error)throw existing.error;
if(existing.data.some(p=>!/^demonstracao-editorial-\d+$/.test(p.draft.slug)))throw new Error('A prévia já possui demonstrações personalizadas. Use scripts/blog-presentation.ts; não recrie os exemplos iniciais.');
for(let i=0;i<12;i++){
 if(existing.data.some(p=>p.draft.slug===`demonstracao-editorial-${i+1}`))continue;
 const photo=photos[i],id=randomUUID(),variants:any[]=[];const original=`originals/${id}.jpg`;const source=await readFile(new URL(`../assets/originals/${photo.original}`,import.meta.url));const dimensions=await sharp(source).metadata();await put('blog-private',original,source,'image/jpeg');
 for(const format of ['webp','avif'])for(const width of [480,800,1200,1600,1920,2560,2936]){
  const path=`${id}/demo-${width}.${format}`,buffer=await readFile(new URL(`../public/assets/${photo.src}-${width}.${format}`,import.meta.url));const height=Math.round((dimensions.height||1)*width/(dimensions.width||1));for(const bucket of ['blog-private','blog-public'])await put(bucket,path,buffer,`image/${format}`);variants.push({path,width,height,format});
 }
 const a={id,original_path:original,alt:photo.alt,caption:'Fotografia institucional usada nesta demonstração.',credit:'Acervo institucional do Instituto Bicalho',copyright:COPYRIGHT,status:'published',width:dimensions.width,height:dimensions.height,variants,is_demo:true,created_by:actor,public_ready_stamp:createHash('sha256').update(JSON.stringify(variants)).digest('hex')};const r=await db.from('blog_media').insert(a);if(r.error)throw r.error;
 const s=demoSnapshot(i,author.id,categories[i%4].id,id);const saved=await db.rpc('blog_save',{p_id:null,p_snapshot:s,p_version:0,p_actor:actor});if(saved.error)throw saved.error;const postId=saved.data.id;const demo=await db.from('blog_posts').update({is_demo:true}).eq('id',postId);if(demo.error)throw demo.error;const rev=await db.from('blog_revisions').select('id').eq('post_id',postId).eq('version',1).single();if(rev.error)throw rev.error;const {original_path,created_by,public_ready_stamp,...publicMedia}=a;const pub=await db.rpc('blog_publish',{p_id:postId,p_revision:rev.data.id,p_search:`${s.title} ${s.excerpt} ${contentText(s.content)}`,p_media:[publicMedia]});if(pub.error)throw pub.error;console.log(`Demonstração ${i+1}/12 preparada.`);
}
