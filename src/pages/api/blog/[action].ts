import type {APIRoute} from 'astro';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {db,authClient,configured,requireEditor,HttpError,originGuard,privateHeaders,env} from '../../../lib/blog/server';
import {snapshotSchema,validateAdvanced,validateDocument,validatePublication,assetIds,COPYRIGHT} from '../../../lib/blog/model';
import {processUpload,publishRevision,preparePublicMedia,publicationAssets} from '../../../lib/blog/publish';
export const prerender=false;
const uuid=z.uuid();
async function requestBody(request:Request){const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Corpo da solicitação ausente.');let length=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2000000){await reader.cancel();throw new HttpError(413,'Conteúdo excedeu o limite de 2 MB.');}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'Solicitação inválida.');}}
export const ALL:APIRoute=async(ctx)=>{
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders()});
 try{
  const action=ctx.params.action;
  if(action==='cron'){
   const expected=env('BLOG_CRON_SECRET'),token=ctx.request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
   if(ctx.request.method!=='POST'||!expected||token.length!==expected.length||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))throw new HttpError(401,'Acesso não autorizado.');
   const c=db();const due=await c.from('blog_schedules').select('*').eq('status','pending').lte('run_at',new Date().toISOString()).order('run_at').limit(5);if(due.error)throw due.error;
   const results=await Promise.all(due.data.map(async job=>{try{const slug=await publishRevision(job.post_id,job.revision_id,true);return {id:job.post_id,slug,status:slug?'published':'cancelled'};}catch(error){await c.from('blog_schedules').update({attempts:job.attempts+1,last_error:(error as Error).message,updated_at:new Date().toISOString()}).eq('post_id',job.post_id).eq('revision_id',job.revision_id).eq('status','pending');return {id:job.post_id,error:'Publicação pendente; nova tentativa no próximo ciclo.'};}}));return reply({results});
  }
  if(!configured())throw new HttpError(503,'O ambiente de teste ainda não foi conectado ao Supabase.');
  if(action==='callback'){
   const code=ctx.url.searchParams.get('code'),hash=ctx.url.searchParams.get('token_hash'),type=ctx.url.searchParams.get('type');const client=authClient(ctx);const result=code?await client.auth.exchangeCodeForSession(code):hash&&['invite','recovery'].includes(type||'')?await client.auth.verifyOtp({token_hash:hash,type:type as 'invite'|'recovery'}):{error:true};if(result.error)throw new HttpError(400,'Link de acesso inválido ou expirado. Solicite outro.');return ctx.redirect(ctx.url.searchParams.get('next')==='password'?'/admin/?password=1':'/admin/',303);
  }
  originGuard(ctx);
  if(action==='login'){
   if(ctx.request.method!=='POST')throw new HttpError(405,'Método não permitido.');const b=z.object({email:z.email(),password:z.string().min(1).max(200)}).parse(await requestBody(ctx.request));const c=authClient(ctx);const result=await c.auth.signInWithPassword(b);if(result.error)throw new HttpError(401,'E-mail ou senha inválidos.');const member=await db().from('blog_members').select('role').eq('user_id',result.data.user.id).maybeSingle();if(!member.data){await c.auth.signOut();throw new HttpError(403,'Este acesso não foi convidado.');}return reply({ok:true});
  }
  if(action==='recover'){
   if(ctx.request.method!=='POST')throw new HttpError(405,'Método não permitido.');const b=z.object({email:z.email()}).parse(await requestBody(ctx.request));const r=await authClient(ctx).auth.resetPasswordForEmail(b.email,{redirectTo:`${ctx.url.origin}/api/blog/callback/?next=password`});if(r.error)throw new HttpError(429,'Não foi possível enviar agora. Aguarde e tente novamente.');return reply({message:'Se houver um acesso para este e-mail, você receberá um link para definir a senha.'});
  }
  if(action==='session-bootstrap'){
   if(ctx.request.method!=='POST')throw new HttpError(405,'Método não permitido.');const b=z.object({access_token:z.string().max(10000),refresh_token:z.string().max(10000)}).parse(await requestBody(ctx.request));const client=authClient(ctx);const result=await client.auth.setSession(b);if(result.error||!result.data.user)throw new HttpError(401,'Link inválido ou expirado.');const member=await db().from('blog_members').select('role').eq('user_id',result.data.user.id).maybeSingle();if(!member.data){await client.auth.signOut();throw new HttpError(403,'Este acesso não foi convidado.');}return reply({ok:true});
  }
  const {user,role}=await requireEditor(ctx);const c=db();
  if(action==='session')return reply({email:user.email,role});
  if(!['list','media-file','revisions'].includes(action||'')&&ctx.request.method!=='POST')throw new HttpError(405,'Método não permitido.');
  if(ctx.request.method!=='GET'&&ctx.request.method!=='POST')throw new HttpError(405,'Método não permitido.');
  if(action==='logout'){await authClient(ctx).auth.signOut();return reply({ok:true});}
  if(action==='password'){const {password}=z.object({password:z.string().min(12).max(200)}).parse(await ctx.request.json());const r=await authClient(ctx).auth.updateUser({password});if(r.error)throw new HttpError(400,'Não foi possível definir a senha. Solicite um novo link.');return reply({ok:true});}
  if(action==='list'){
   const [posts,taxonomies,media,publications,schedules]=await Promise.all([c.from('blog_posts').select('*').order('updated_at',{ascending:false}),c.from('blog_taxonomies').select('*').order('name'),c.from('blog_media').select('*').order('created_at',{ascending:false}),c.from('blog_publications').select('id,slug,published_at'),c.from('blog_schedules').select('*').eq('status','pending')]);for(const r of [posts,taxonomies,media,publications,schedules])if(r.error)throw r.error;
   return reply({posts:posts.data,taxonomies:taxonomies.data,media:media.data,publications:publications.data,schedules:schedules.data,role,email:user.email});
  }
  if(action==='media-file'){
   const assetId=uuid.parse(ctx.url.searchParams.get('id'));const r=await c.from('blog_media').select('*').eq('id',assetId).single();if(r.error)throw new HttpError(404,'Imagem não encontrada.');const path=r.data.variants?.find((v:any)=>v.format==='webp'&&v.width>=480)?.path||r.data.original_path;const result=await c.storage.from('blog-private').createSignedUrl(path,120);if(result.error)throw result.error;return new Response(null,{status:302,headers:{...privateHeaders(),Location:result.data.signedUrl}});
  }
  if(action==='revisions'){const postId=uuid.parse(ctx.url.searchParams.get('id'));const r=await c.from('blog_revisions').select('*').eq('post_id',postId).order('version',{ascending:false}).limit(100);if(r.error)throw r.error;return reply(r.data);}
  const body=await requestBody(ctx.request);
  if(action==='prepare-media'){
   const b=z.object({id:uuid,version:z.number().int().positive(),assetId:uuid}).parse(body);const post=await c.from('blog_posts').select('draft,version,trashed_at').eq('id',b.id).single();if(post.error||post.data.trashed_at)throw new HttpError(404,'Publicação não encontrada.');if(post.data.version!==b.version)throw new HttpError(409,'O rascunho mudou. Salve e prepare a publicação novamente.');validatePublication(post.data.draft);if(!assetIds(post.data.draft).includes(b.assetId))throw new HttpError(400,'A imagem não pertence a esta publicação.');const asset=await c.from('blog_media').select('*').eq('id',b.assetId).single();if(asset.error)throw asset.error;await preparePublicMedia(asset.data);return reply({ok:true});
  }
  if(action==='save'){
   const s=snapshotSchema.parse(body.snapshot);validateAdvanced(s);validateDocument(s.content);const r=await c.rpc('blog_save',{p_id:body.id?uuid.parse(body.id):null,p_snapshot:s,p_version:z.number().int().nonnegative().parse(body.version||0),p_actor:user.id});if(r.error)throw new HttpError(r.error.message.includes('CONFLICT')?409:400,r.error.message.includes('CONFLICT')?'Outra revisão foi salva. Reabra o artigo antes de continuar para preservar as alterações.':'Não foi possível salvar.');return reply(r.data);
  }
  if(action==='publish'){
   const postId=uuid.parse(body.id);const revision=await c.from('blog_revisions').select('id').eq('post_id',postId).eq('version',z.number().int().positive().parse(body.version)).single();if(revision.error)throw new HttpError(409,'Salve o artigo antes de publicar.');const current=await c.from('blog_posts').select('version').eq('id',postId).single();if(current.data?.version!==body.version)throw new HttpError(409,'Uma revisão mais recente foi salva. Reabra antes de publicar.');return reply({slug:await publishRevision(postId,revision.data.id)});
  }
  if(action==='schedule'){
   const id=uuid.parse(body.id);const date=new Date(body.at);if(!Number.isFinite(+date)||+date<Date.now()+60000)throw new HttpError(400,'Escolha um horário futuro.');const live=await c.from('blog_posts').select('first_published_at').eq('id',id).single();if(live.data?.first_published_at)throw new HttpError(400,'O agendamento está disponível para artigos inéditos.');const revision=await c.from('blog_revisions').select('*').eq('post_id',id).eq('version',body.version).single();if(revision.error)throw new HttpError(409,'Salve antes de agendar.');validatePublication(revision.data.snapshot);await publicationAssets(revision.data.snapshot);const r=await c.rpc('blog_schedule',{p_id:id,p_version:body.version,p_at:date.toISOString()});if(r.error)throw new HttpError(409,'O artigo mudou. Reabra antes de agendar.');return reply({ok:true});
  }
  if(['unpublish','trash','restore','cancel-schedule'].includes(action||'')){
   const id=uuid.parse(body.id);const r=await c.rpc('blog_transition',{p_id:id,p_action:action});if(r.error)throw r.error;return reply({ok:true});
  }
  if(action==='taxonomy'){
   const t=z.object({id:uuid.optional(),kind:z.enum(['category','tag','author']),name:z.string().trim().min(1).max(180),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),description:z.string().max(2000),image_id:z.union([uuid,z.null()]).optional()}).parse(body);const r=await c.from('blog_taxonomies').upsert(t).select().single();if(r.error)throw new HttpError(409,'Nome ou endereço já cadastrado.');return reply(r.data);
  }
  if(action==='upload'){
   const b=z.object({name:z.string().max(200),type:z.enum(['image/jpeg','image/png','image/webp','image/avif']),size:z.number().positive().max(20971520),alt:z.string().max(500),caption:z.string().max(1000),credit:z.string().max(300),copyright:z.string().max(300)}).parse(body);const id=randomUUID();const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[b.type];const path=`originals/${id}.${ext}`;const r=await c.from('blog_media').insert({id,original_path:path,alt:b.alt,caption:b.caption,credit:b.credit,copyright:b.copyright||COPYRIGHT,created_by:user.id}).select().single();if(r.error)throw r.error;const signed=await c.storage.from('blog-private').createSignedUploadUrl(path);if(signed.error)throw signed.error;return reply({asset:r.data,...signed.data});
  }
  if(action==='media-ready'){const id=uuid.parse(body.id);const r=await c.from('blog_media').select('*').eq('id',id).single();if(r.error)throw r.error;return reply(['ready','published'].includes(r.data.status)&&r.data.variants.length?r.data:await processUpload(r.data));}
  if(action==='media-update'){
   const b=z.object({id:uuid,alt:z.string().max(500),caption:z.string().max(1000),credit:z.string().max(300),copyright:z.string().max(300)}).parse(body);const current=await c.from('blog_media').select('*').eq('id',b.id).single();if(current.error)throw current.error;const copyright=b.copyright.trim()||COPYRIGHT;
   const regenerate=copyright!==current.data.copyright||!['ready','published'].includes(current.data.status)||!current.data.variants.length;
   const r=await c.from('blog_media').update({...b,copyright,...(regenerate?{status:'uploading',public_ready_stamp:null}:{})}).eq('id',b.id).eq('copyright',current.data.copyright).select().single();if(r.error)throw new HttpError(409,'A imagem mudou. Reabra a biblioteca e tente novamente.');return reply(regenerate?await processUpload(r.data):r.data);
  }
  if(action==='invite'){
   if(role!=='owner')throw new HttpError(403,'Somente o proprietário pode convidar acessos.');const b=z.object({email:z.email(),role:z.enum(['owner','editor'])}).parse(body);const r=await c.auth.admin.inviteUserByEmail(b.email,{redirectTo:`${ctx.url.origin}/admin/?password=1`});if(r.error||!r.data.user)throw new HttpError(400,'O convite não foi enviado. Confira o SMTP, os limites e o e-mail informado.');const m=await c.from('blog_members').upsert({user_id:r.data.user.id,role:b.role});if(m.error)throw m.error;return reply({ok:true});
  }
  if(action==='members'){
   if(role!=='owner')throw new HttpError(403,'Acesso restrito ao proprietário.');const r=await c.from('blog_members').select('*');if(r.error)throw r.error;const list=await Promise.all(r.data.map(async m=>{const u=await c.auth.admin.getUserById(m.user_id);return {...m,email:u.data.user?.email};}));return reply(list);
  }
  if(action==='member-remove'){
   if(role!=='owner')throw new HttpError(403,'Acesso restrito ao proprietário.');const id=uuid.parse(body.id);if(id===user.id)throw new HttpError(400,'Você não pode remover o próprio acesso.');const r=await c.from('blog_members').delete().eq('user_id',id);if(r.error)throw r.error;return reply({ok:true});
  }
  throw new HttpError(404,'Operação não encontrada.');
 }catch(error){if(error instanceof HttpError)return reply({error:error.message},error.status);if(error instanceof z.ZodError)return reply({error:'Revise os campos informados.',fields:error.issues.map(i=>i.path.join('.'))},400);console.error('[blog]',error instanceof Error?error.message:'Falha interna');return reply({error:'Não foi possível concluir. Suas alterações continuam no editor.'},400);}
};
