import {assetIds,type Snapshot} from '../src/lib/blog/model';
export function portableData(source:Record<string,any[]>){
 const data=structuredClone(source);const posts=new Set(data.blog_posts.filter(p=>!p.is_demo).map(p=>p.id));
 data.blog_posts=data.blog_posts.filter(p=>posts.has(p.id));for(const t of ['blog_revisions','blog_schedules','blog_redirects'])data[t]=data[t].filter(r=>posts.has(r.post_id));data.blog_publications=data.blog_publications.filter(p=>posts.has(p.id)&&!p.is_demo);
 const referenced=new Set<string>();
 for(const p of data.blog_posts)assetIds(p.draft).forEach(id=>referenced.add(id));for(const r of data.blog_revisions)assetIds(r.snapshot).forEach(id=>referenced.add(id));for(const p of data.blog_publications)assetIds(p.snapshot).forEach(id=>referenced.add(id));for(const t of data.blog_taxonomies)if(t.image_id)referenced.add(t.image_id);
 data.blog_media=data.blog_media.filter(a=>!a.is_demo||referenced.has(a.id)).map(a=>({...a,is_demo:false}));const media=new Set(data.blog_media.map(a=>a.id));
 const clean=(s:Snapshot)=>{s.relatedIds=s.relatedIds.filter(id=>posts.has(id));for(const id of assetIds(s))if(!media.has(id))throw new Error('Conteúdo referencia mídia ausente: '+id);};
 for(const p of data.blog_posts)clean(p.draft);for(const r of data.blog_revisions)clean(r.snapshot);for(const p of data.blog_publications)clean(p.snapshot);
 for(const rows of Object.values(data))for(const row of rows){if('created_by'in row)row.created_by=null;if('updated_by'in row)row.updated_by=null;if('image_id'in row&&!media.has(row.image_id))row.image_id=null;}
 return data;
}
