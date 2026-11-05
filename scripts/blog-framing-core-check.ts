import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {defaultFrame, resolveFrame, frameSchema, imageFramingSchema, FRAME_RATIOS, frameGeometry, frameStyle, framedSizes, resetImageFraming, type FrameContext} from '../src/lib/blog/framing';
import {emptySnapshot, snapshotSchema, assetIds} from '../src/lib/blog/model';

const close=(actual:number,expected:number)=>assert(Math.abs(actual-expected)<0.00001,`${actual} != ${expected}`);
const contexts=Object.keys(FRAME_RATIOS) as FrameContext[];
assert.deepEqual(resolveFrame(),{mode:'cover',x:50,y:50,zoom:1});
assert.deepEqual(resolveFrame({x:NaN}),defaultFrame());
const legacy=emptySnapshot();assert.deepEqual(snapshotSchema.parse(legacy),legacy,'Old drafts remain unchanged');
for(const bad of [{...defaultFrame(),x:-1},{...defaultFrame(),x:101},{...defaultFrame(),y:NaN},{...defaultFrame(),zoom:3.01},{...defaultFrame(),zoom:0.9},{...defaultFrame(),mode:'fill'},{...defaultFrame(),extra:'javascript:alert(1)'}])assert(!frameSchema.safeParse(bad).success);
assert(!imageFramingSchema.safeParse({social:defaultFrame()}).success);

let cases=0;
for(const [iw,ih] of [[1957,2936],[2936,1957],[1000,1000],[4000,500],[500,4000]])for(const context of contexts)for(const zoom of [1,1.25,2,3])for(const x of [0,50,100])for(const y of [0,50,100]){
  const g=frameGeometry(iw,ih,context,{mode:'cover',x,y,zoom});
  assert(g.width>=100&&g.height>=100,'Cover cannot expose an empty edge');
  assert(g.left<=0&&g.top<=0&&g.left+g.width>=100-0.00001&&g.top+g.height>=100-0.00001,'Panning remains constrained to image bounds');
  close((g.width/g.height)*FRAME_RATIOS[context],iw/ih);
  const whole=frameGeometry(iw,ih,context,{mode:'contain',x,y,zoom});
  assert(whole.left>=0&&whole.top>=0&&whole.width+whole.left<=100.00001&&whole.height+whole.top<=100.00001,'Contain keeps every pixel visible');
  close((whole.width/whole.height)*FRAME_RATIOS[context],iw/ih);
  cases++;
}
const portrait=frameGeometry(1957,2936,'listing',{...defaultFrame(),y:0});
close(portrait.width,100);close(portrait.top,0);assert(portrait.height>225);
const centered=frameGeometry(1957,2936,'listing',{mode:'contain',x:0,y:100,zoom:3});
close(centered.left,(100-centered.width)/2);close(centered.top,(100-centered.height)/2);
assert(!/NaN|Infinity|undefined/.test(frameStyle(0,0,'listing',defaultFrame())));
assert.equal(framedSizes('150px',200),'calc((150px) * 2)');
assert.equal(framedSizes('(min-width:1200px) 620px, calc(100vw - 40px)',200),'(min-width:1200px) calc((620px) * 2), calc((calc(100vw - 40px)) * 2)');

const cover='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',thumbnail='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',replacement='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const frames=()=>({listing:{...defaultFrame(),y:0},compact:{...defaultFrame(),x:25},article:{...defaultFrame(),zoom:1.2}});
const independent={...emptySnapshot(),coverId:cover,thumbnailId:thumbnail,imageFraming:frames()};
const old=structuredClone(independent);
resetImageFraming(independent,'coverId',cover);assert.deepEqual(independent,old,'Reselecting the same photo does not reset framing');
resetImageFraming(independent,'coverId',replacement);assert.equal(independent.coverId,replacement);assert.deepEqual(independent.imageFraming,{listing:old.imageFraming.listing,compact:old.imageFraming.compact},'An independent thumbnail retains its framing');
const fallback={...emptySnapshot(),coverId:cover,imageFraming:frames()};resetImageFraming(fallback,'coverId',replacement);assert.equal(fallback.imageFraming,undefined,'Replacing a shared cover resets its three uses');
const changeThumbnail={...emptySnapshot(),coverId:cover,thumbnailId:thumbnail,imageFraming:frames()};resetImageFraming(changeThumbnail,'thumbnailId','');assert.deepEqual(changeThumbnail.imageFraming,{article:frames().article});
const framed={...emptySnapshot(),coverId:cover,thumbnailId:thumbnail,imageFraming:frames()};
assert.deepEqual(snapshotSchema.parse(JSON.parse(JSON.stringify(framed))),framed,'Framing survives draft serialization and validation');
assert.deepEqual(assetIds(framed),[cover,thumbnail],'Framing creates no extra asset references');
assert.deepEqual(snapshotSchema.parse({...legacy,imageFraming:{}}).imageFraming,{});

// Exercise the existing JSONB revision/publication boundary. No migration or media rewrites are needed.
const pg=new PGlite();
try {
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);alter default privileges in schema public grant all on tables to anon,authenticated,service_role;grant usage on schema public,auth to anon,authenticated,service_role;`);
  for(const name of ['202610270001_blog.sql','202610270002_atomic_editorial.sql','202610300001_cloudflare_media.sql','202611030001_publication_revision_guard.sql'])await pg.exec((await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
  const actor='dddddddd-dddd-4ddd-dddd-dddddddddddd';await pg.query('insert into auth.users values($1)',[actor]);await pg.query("insert into blog_members values($1,'owner',now())",[actor]);
  const tax=(await pg.query<{id:string;kind:string}>('select id,kind from blog_taxonomies')).rows;
  const authorId=tax.find(t=>t.kind==='author')!.id,categoryId=tax.find(t=>t.kind==='category')!.id;
  const initial=snapshotSchema.parse({...emptySnapshot(),title:'Teste de enquadramento',slug:'teste-enquadramento',authorId,primaryCategoryId:categoryId,categoryIds:[categoryId],imageFraming:frames()});
  const saved=(await pg.query<{blog_save:{id:string;version:number}}>('select blog_save(null,$1,0,$2)',[initial,actor])).rows[0].blog_save;
  const revision=(await pg.query<{id:string;snapshot:typeof initial}>('select id,snapshot from blog_revisions where post_id=$1 and version=1',[saved.id])).rows[0];
  assert.deepEqual(revision.snapshot.imageFraming,initial.imageFraming);
  await pg.query('select blog_publish($1,$2,$3,$4)',[saved.id,revision.id,initial.title,[]]);
  const changed={...initial,imageFraming:{...initial.imageFraming,listing:{...defaultFrame(),y:100,zoom:2}}};
  await pg.query('select blog_save($1,$2,1,$3)',[saved.id,changed,actor]);
  const readPublic=async()=> (await pg.query<{snapshot:typeof initial}>('select snapshot from blog_publications where id=$1',[saved.id])).rows[0].snapshot;
  assert.deepEqual((await readPublic()).imageFraming,initial.imageFraming,'Autosaving a new crop cannot change the public crop');
  const revision2=(await pg.query<{id:string}>('select id from blog_revisions where post_id=$1 and version=2',[saved.id])).rows[0].id;
  await pg.query('select blog_publish($1,$2,$3,$4)',[saved.id,revision2,initial.title,[]]);
  assert.deepEqual((await readPublic()).imageFraming,changed.imageFraming,'Updating publishes the saved crop atomically');
  await pg.query('select blog_save($1,$2,2,$3)',[saved.id,revision.snapshot,actor]);
  assert.deepEqual((await pg.query<{draft:typeof initial}>('select draft from blog_posts where id=$1',[saved.id])).rows[0].draft.imageFraming,initial.imageFraming,'Restoring a revision restores its framing to the draft');
  assert.deepEqual((await readPublic()).imageFraming,changed.imageFraming,'Revision restoration does not overwrite the public crop');
  const scheduled=(await pg.query<{blog_save:{id:string}}>('select blog_save(null,$1,0,$2)',[{...initial,slug:'teste-enquadramento-agendado'},actor])).rows[0].blog_save;
  await pg.query("select blog_schedule($1,1,now()+interval '5 minutes')",[scheduled.id]);
  const scheduledRow=(await pg.query<{snapshot:typeof initial}>('select r.snapshot from blog_schedules s join blog_revisions r on r.id=s.revision_id where s.post_id=$1',[scheduled.id])).rows[0];
  assert.deepEqual(scheduledRow.snapshot.imageFraming,initial.imageFraming,'A schedule retains the exact framed revision');
} finally { await pg.close(); }
console.log(`PASS: ${cases} cover/contain geometry cases, bounded positioning, native aspect, zoom, legacy snapshots, validation, image dependency resets, responsive sizing; PostgreSQL draft/revision/publication isolation, restoration and scheduling.`);
