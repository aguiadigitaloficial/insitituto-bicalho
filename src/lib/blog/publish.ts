import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {assetIds,contentText,validatePublication,type Asset,type Snapshot} from './model';
import {db,HttpError,demoEnabled} from './server';

export async function processUpload(asset:Asset){
  const client=db();const {data,error}=await client.storage.from('blog-private').download(asset.original_path);if(error||!data)throw new HttpError(400,'O envio ainda não foi concluído.');
  const input=Buffer.from(await data.arrayBuffer());if(input.length>20*1024*1024)throw new HttpError(400,'Envie uma imagem de até 20 MB.');
  const image=sharp(input,{limitInputPixels:60000000}).rotate();const m=await image.metadata();if(!['jpeg','png','webp','avif','heif'].includes(m.format||''))throw new HttpError(400,'Formato de imagem não permitido.');
  const width=m.autoOrient?.width||m.width||0,height=m.autoOrient?.height||m.height||0;if(!width||!height)throw new HttpError(400,'A imagem não pôde ser lida.');
  const stamp=createHash('sha256').update(input).update(asset.copyright).digest('hex').slice(0,16);
  const variants:Asset['variants']=[];
  for(const size of [...new Set([480,800,1200,1600,1920,2560,2936].filter(w=>w<width).concat(Math.min(width,2936)))]){
    for(const format of ['webp','avif'] as const){
      const xmp=`<?xpacket begin="﻿"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${asset.copyright.replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!))}</rdf:li></rdf:Alt></dc:rights></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
      const {data:buffer,info}=await sharp(input,{limitInputPixels:60000000}).rotate().resize({width:size,withoutEnlargement:true}).withExif({IFD0:{Copyright:asset.copyright}}).withXmp(xmp).toFormat(format,{quality:format==='avif'?65:86}).toBuffer({resolveWithObject:true});
      const path=`${asset.id}/${stamp}-${size}.${format}`;const result=await client.storage.from('blog-private').upload(path,buffer,{contentType:`image/${format}`,upsert:true});if(result.error)throw new Error('Não foi possível preparar as versões da imagem.');variants.push({path,width:info.width,height:info.height,format});
    }
  }
  const update=await client.from('blog_media').update({variants,width,height,status:'ready'}).eq('id',asset.id).select().single();if(update.error)throw update.error;return update.data as Asset;
}
export async function publishRevision(postId:string,revisionId:string,scheduled=false){
  const client=db();const revision=await client.from('blog_revisions').select('snapshot,post_id').eq('id',revisionId).eq('post_id',postId).single();if(revision.error)throw new HttpError(404,'Revisão não encontrada.');
  const s=revision.data.snapshot as Snapshot;validatePublication(s);
  const p=await client.from('blog_posts').select('is_demo').eq('id',postId).single();if(p.data?.is_demo&&!demoEnabled())throw new HttpError(403,'Demonstrações só podem ser publicadas no ambiente de teste.');
  const ids=assetIds(s);let assets:Asset[]=[];
  if(ids.length){const result=await client.from('blog_media').select('*').in('id',ids);if(result.error)throw result.error;assets=result.data as Asset[];if(assets.length!==ids.length||assets.some(a=>!['ready','published'].includes(a.status)||!a.alt.trim()||!a.variants.length))throw new HttpError(400,'Todas as imagens precisam estar prontas e ter texto alternativo.');}
  const tax=await client.from('blog_taxonomies').select('id,kind').in('id',[s.authorId,...s.categoryIds,...s.tagIds]);if(tax.error)throw tax.error;
  if(!tax.data.some(t=>t.id===s.authorId&&t.kind==='author')||s.categoryIds.some(id=>!tax.data.some(t=>t.id===id&&t.kind==='category'))||s.tagIds.some(id=>!tax.data.some(t=>t.id===id&&t.kind==='tag')))throw new HttpError(400,'Revise a autoria, as categorias e as tags.');
  for(const a of assets){for(const v of a.variants){const {data,error}=await client.storage.from('blog-private').download(v.path);if(error||!data)throw new Error('Uma imagem não está disponível. A publicação continua pendente.');const upload=await client.storage.from('blog-public').upload(v.path,data,{contentType:`image/${v.format}`,upsert:true});if(upload.error)throw upload.error;}}
  const publicMedia=assets.map(({id,alt,caption,credit,copyright,variants,width,height})=>({id,alt,caption,credit,copyright,variants,width,height,status:'published'}));
  const {data,error}=await client.rpc('blog_publish',{p_id:postId,p_revision:revisionId,p_search:`${s.title} ${s.excerpt} ${contentText(s.content)}`,p_media:publicMedia,p_scheduled:scheduled});if(error)throw new HttpError(error.message.includes('Slug')?409:400,error.message.includes('Slug')?'Este endereço já está em uso.':'Não foi possível publicar esta revisão.');return data as string|null;
}
