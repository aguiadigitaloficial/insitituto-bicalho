import {createHash} from 'node:crypto';
import {imageSource} from '@bicalho/images';
import {withCopyright} from './image-metadata';
import {assetIds,assetField,publicationIssues,EditorialValidationError,contentText,validatePublication,type Asset,type Snapshot} from './model';
import {db,HttpError,demoEnabled} from './server';

export async function processUpload(asset:Asset){
  const client=db();const {data,error}=await client.storage.from('blog-private').download(asset.original_path);if(error||!data)throw new HttpError(400,'O envio ainda não foi concluído.');
  const input=Buffer.from(await data.arrayBuffer());if(input.length>20*1024*1024)throw new HttpError(400,'Envie uma imagem de até 20 MB.');
  const image=await imageSource(input);const {width,height}=image;
  const stamp=createHash('sha256').update(input).update(asset.copyright).digest('hex').slice(0,16);
  const variants:Asset['variants']=[];
  for(const size of [...new Set([480,800,1200,1600,1920,2560,2936].filter(w=>w<width).concat(Math.min(width,2936)))]){
    for(const format of ['webp','avif'] as const){
      const info=await image.variant(size,format);if(!info)continue;const buffer=withCopyright(info.bytes,format,asset.copyright,info.width,info.height);
      const path=`${asset.id}/${stamp}-${size}.${format}`;const result=await client.storage.from('blog-private').upload(path,buffer,{contentType:`image/${format}`,upsert:true});if(result.error)throw new Error('Não foi possível preparar as versões da imagem.');variants.push({path,width:info.width,height:info.height,format});
    }
  }
  const update=await client.from('blog_media').update({variants,width,height,status:'ready',public_ready_stamp:null}).eq('id',asset.id).eq('copyright',asset.copyright).select().single();if(update.error)throw update.error;return update.data as Asset;
}
export const mediaStamp=(asset: Pick<Asset,'variants'>)=>createHash('sha256').update(JSON.stringify(asset.variants)).digest('hex');
export async function validateEditorial(s:Snapshot){
  validatePublication(s);
  const tax=await db().from('blog_taxonomies').select('id,kind').in('id',[s.authorId,...s.categoryIds,...s.tagIds]);if(tax.error)throw tax.error;
  const issues=[];
  if(!tax.data.some(t=>t.id===s.authorId&&t.kind==='author'))issues.push({field:'authorId',message:'A autoria selecionada não está mais disponível.'});
  if(s.categoryIds.some(id=>!tax.data.some(t=>t.id===id&&t.kind==='category')))issues.push({field:'categoryIds',message:'Uma categoria selecionada não está mais disponível.'});
  if(s.tagIds.some(id=>!tax.data.some(t=>t.id===id&&t.kind==='tag')))issues.push({field:'tagIds',message:'Uma tag selecionada não está mais disponível.'});
  const ids=assetIds(s);if(ids.length){const media=await db().from('blog_media').select('*').in('id',ids);if(media.error)throw media.error;issues.push(...publicationIssues(s,media.data as Asset[]));}
  if(issues.length)throw new EditorialValidationError(issues);
}
export async function publicationAssets(s:Snapshot){
  const ids=assetIds(s);if(!ids.length)return [];
  const result=await db().from('blog_media').select('*').in('id',ids);if(result.error)throw result.error;const assets=result.data as Asset[];
  const issues=publicationIssues(s,assets);for(const a of assets)if(a.public_ready_stamp!==mediaStamp(a))issues.push({field:assetField(s,a.id),message:'As imagens mudaram ou ainda não foram preparadas. Prepare a publicação novamente.'});if(issues.length)throw new EditorialValidationError(issues);
  return assets;
}
export async function preparePublicMedia(asset:Asset,field='content'){
  const client=db(),stamp=mediaStamp(asset);
  if(asset.public_ready_stamp===stamp)return;
  if(!['ready','published'].includes(asset.status)||!asset.alt.trim()||!asset.variants.length)throw new EditorialValidationError([{field,message:'Prepare a imagem e o texto alternativo na Biblioteca de mídia antes de publicar.'}]);
  // One image per request: at most 28 storage calls for 14 variants, below Workers Free's limit.
  for(const v of asset.variants){const {data,error}=await client.storage.from('blog-private').download(v.path);if(error||!data)throw new HttpError(502,'Uma versão da imagem está indisponível. Tente preparar novamente; o artigo continua salvo.',{code:'MEDIA_PREPARATION_FAILED',fields:[field]});const upload=await client.storage.from('blog-public').upload(v.path,data,{contentType:`image/${v.format}`,upsert:true});if(upload.error)throw new HttpError(502,'O serviço de imagens não concluiu o preparo. Tente novamente.',{code:'MEDIA_PREPARATION_FAILED',fields:[field]});}
  const result=await client.from('blog_media').update({public_ready_stamp:stamp}).eq('id',asset.id).eq('variants',JSON.stringify(asset.variants)).select('id').maybeSingle();if(result.error)throw result.error;if(!result.data)throw new HttpError(409,'A imagem mudou durante o preparo. Confira a biblioteca e publique novamente.',{code:'MEDIA_CONFLICT',fields:[field]});
}
export async function publishRevision(postId:string,revisionId:string,scheduled=false){
  const client=db();const revision=await client.from('blog_revisions').select('snapshot,post_id').eq('id',revisionId).eq('post_id',postId).single();if(revision.error)throw new HttpError(404,'Revisão não encontrada.');
  const s=revision.data.snapshot as Snapshot;await validateEditorial(s);
  const p=await client.from('blog_posts').select('is_demo').eq('id',postId).single();if(p.data?.is_demo&&!demoEnabled())throw new HttpError(403,'Demonstrações só podem ser publicadas no ambiente de teste.');
  const assets=await publicationAssets(s);
  const publicMedia=assets.map(({id,alt,caption,credit,copyright,variants,width,height})=>({id,alt,caption,credit,copyright,variants,width,height,status:'published'}));
  const {data,error}=await client.rpc('blog_publish',{p_id:postId,p_revision:revisionId,p_search:`${s.title} ${s.excerpt} ${contentText(s.content)}`,p_media:publicMedia,p_scheduled:scheduled});if(error){if(error.message.includes('Slug'))throw new HttpError(409,'Este endereço já está em uso.',{code:'SLUG_CONFLICT',fields:['slug']});if(error.message.includes('CONFLICT'))throw new HttpError(409,'Uma revisão mais recente foi salva em outra aba. Suas alterações continuam no editor. Reabra o artigo antes de publicar.');if(error.message.includes('Media changed'))throw new HttpError(409,'Uma imagem mudou durante a publicação. Prepare novamente.',{code:'MEDIA_CONFLICT',fields:['content']});throw new HttpError(502,'O serviço não concluiu a publicação. O rascunho continua salvo. Tente novamente.');}return data as string|null;
}
