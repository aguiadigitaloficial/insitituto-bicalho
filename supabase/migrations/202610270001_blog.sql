-- Dedicated test project only. Run through migrations; never against another client's project.
create extension if not exists pgcrypto;
create table public.blog_members(user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('owner','editor')), created_at timestamptz not null default now());
create table public.blog_taxonomies(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('category','tag','author')),name text not null,slug text not null,description text not null default '',image_id uuid,unique(kind,slug));
create table public.blog_media(id uuid primary key default gen_random_uuid(),original_path text not null unique,alt text not null default '',caption text not null default '',credit text not null default '',copyright text not null default 'Instituto Bicalho Odontologia de Precisão',status text not null default 'uploading' check(status in ('uploading','ready','published','failed')),variants jsonb not null default '[]',width integer not null default 0,height integer not null default 0,is_demo boolean not null default false,created_by uuid references auth.users(id),created_at timestamptz not null default now());
alter table public.blog_taxonomies add foreign key(image_id) references public.blog_media(id);
create table public.blog_posts(id uuid primary key default gen_random_uuid(),draft jsonb not null,version integer not null default 1,trashed_at timestamptz,is_demo boolean not null default false,created_by uuid references auth.users(id),updated_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.blog_revisions(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.blog_posts(id) on delete cascade,snapshot jsonb not null,version integer not null,created_by uuid references auth.users(id),created_at timestamptz not null default now(),unique(post_id,version));
create table public.blog_publications(id uuid primary key references public.blog_posts(id) on delete cascade,slug text not null unique,snapshot jsonb not null,first_published_at timestamptz not null default now(),published_at timestamptz not null default now(),is_demo boolean not null default false,search_text text not null default '',search_vector tsvector generated always as(to_tsvector('portuguese',search_text)) stored);
create index blog_publications_search on public.blog_publications using gin(search_vector);
create table public.blog_schedules(post_id uuid primary key references public.blog_posts(id) on delete cascade,revision_id uuid not null references public.blog_revisions(id),run_at timestamptz not null,status text not null default 'pending' check(status in ('pending','published','cancelled')),attempts integer not null default 0,last_error text,updated_at timestamptz not null default now());
create index blog_schedule_due on public.blog_schedules(run_at) where status='pending';
create table public.blog_redirects(slug text primary key,post_id uuid not null references public.blog_posts(id) on delete cascade);

-- Clients can read their own membership. All mutations are verified by the server.
alter table public.blog_members enable row level security;
create policy member_self on public.blog_members for select to authenticated using(user_id=auth.uid());
alter table public.blog_posts enable row level security;
alter table public.blog_revisions enable row level security;
alter table public.blog_schedules enable row level security;
alter table public.blog_redirects enable row level security;
alter table public.blog_media enable row level security;
alter table public.blog_taxonomies enable row level security;
alter table public.blog_publications enable row level security;
create policy public_posts on public.blog_publications for select to anon,authenticated using(true);
create policy public_taxonomies on public.blog_taxonomies for select to anon,authenticated using(true);
create policy public_media on public.blog_media for select to anon,authenticated using(status='published');
-- Do not expose original_path, private staging metadata or editorial users.
revoke all on public.blog_media from anon,authenticated;
grant select(id,alt,caption,credit,copyright,status,variants,width,height) on public.blog_media to anon,authenticated;
revoke all on public.blog_posts,public.blog_revisions,public.blog_schedules,public.blog_redirects from anon,authenticated;
revoke insert,update,delete on public.blog_members,public.blog_taxonomies,public.blog_publications from anon,authenticated;
grant select on public.blog_publications,public.blog_taxonomies to anon,authenticated;
grant select on public.blog_members to authenticated;
grant all on public.blog_members,public.blog_taxonomies,public.blog_media,public.blog_posts,public.blog_revisions,public.blog_publications,public.blog_schedules,public.blog_redirects to service_role;

create or replace function public.blog_save(p_id uuid,p_snapshot jsonb,p_version integer,p_actor uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.blog_posts;
begin
 if not exists(select 1 from blog_members where user_id=p_actor) then raise exception 'Access denied'; end if;
 if p_id is null then
   insert into blog_posts(draft,created_by,updated_by) values(p_snapshot,p_actor,p_actor) returning * into result;
 else
   update blog_posts set draft=p_snapshot,version=version+1,updated_by=p_actor,updated_at=now() where id=p_id and version=p_version and trashed_at is null returning * into result;
   if result.id is null then raise exception 'CONFLICT: another revision was saved; reload before editing'; end if;
 end if;
 insert into blog_revisions(post_id,snapshot,version,created_by) values(result.id,result.draft,result.version,p_actor);
 return to_jsonb(result);
end $$;

create or replace function public.blog_publish(p_id uuid,p_revision uuid,p_search text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; old_slug text; new_slug text; demo boolean; media_id text; ids jsonb; version integer;
begin
 perform 1 from blog_posts where id=p_id and trashed_at is null for update;
 if not found then raise exception 'Post unavailable'; end if;
 select snapshot into s from blog_revisions where id=p_revision and post_id=p_id;
 if s is null then raise exception 'Revision unavailable'; end if;
 new_slug=s->>'slug';
 if coalesce(s->>'title','')='' or coalesce(new_slug,'')='' or coalesce(s->>'authorId','')='' or coalesce(s->>'primaryCategoryId','')='' then raise exception 'Incomplete revision'; end if;
 if new_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or new_slug in ('busca','autor','tag','categoria') then raise exception 'Invalid slug'; end if;
 if not exists(select 1 from blog_taxonomies where id=(s->>'authorId')::uuid and kind='author') then raise exception 'Author unavailable'; end if;
 if exists(select 1 from blog_publications where slug=new_slug and id<>p_id) or exists(select 1 from blog_redirects where slug=new_slug and post_id<>p_id) then raise exception 'Slug already in use'; end if;
 select slug into old_slug from blog_publications where id=p_id;
 select is_demo into demo from blog_posts where id=p_id;
 delete from blog_redirects where slug=new_slug and post_id=p_id;
 if old_slug is not null and old_slug<>new_slug then insert into blog_redirects(slug,post_id) values(old_slug,p_id) on conflict(slug) do update set post_id=excluded.post_id; end if;
 insert into blog_publications(id,slug,snapshot,is_demo,search_text) values(p_id,new_slug,s,demo,p_search)
 on conflict(id) do update set slug=excluded.slug,snapshot=excluded.snapshot,published_at=now(),search_text=excluded.search_text;
 update blog_schedules set status='published',last_error=null,updated_at=now() where post_id=p_id and revision_id=p_revision and status='pending';
 return new_slug;
end $$;
revoke all on function public.blog_save(uuid,jsonb,integer,uuid),public.blog_publish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.blog_save(uuid,jsonb,integer,uuid),public.blog_publish(uuid,uuid,text) to service_role;

create or replace function public.blog_search(q text) returns setof public.blog_publications language sql stable security invoker set search_path=public,pg_temp as $$
 select * from blog_publications where search_vector @@ websearch_to_tsquery('portuguese',left(q,200)) order by ts_rank(search_vector,websearch_to_tsquery('portuguese',left(q,200))) desc,first_published_at desc;
$$;

insert into public.blog_taxonomies(kind,name,slug) values('category','Tratamentos','tratamentos'),('category','Estética','estetica'),('category','Ortodontia e Cirurgia','ortodontia-e-cirurgia'),('category','Odontologia de Precisão','odontologia-de-precisao'),('author','Instituto Bicalho Odontologia de Precisão','instituto-bicalho');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('blog-private','blog-private',false,20971520,array['image/jpeg','image/png','image/webp','image/avif']),('blog-public','blog-public',true,20971520,array['image/jpeg','image/png','image/webp','image/avif']) on conflict(id) do nothing;
-- No storage write policy for anonymous/authenticated users: signed one-object uploads only.
