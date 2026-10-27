alter table public.blog_publications add column revision_id uuid references public.blog_revisions(id),add column media jsonb not null default '[]';
alter table public.blog_posts add column first_published_at timestamptz;
update public.blog_posts p set first_published_at=b.first_published_at from public.blog_publications b where b.id=p.id;
drop function public.blog_publish(uuid,uuid,text);
create function public.blog_publish(p_id uuid,p_revision uuid,p_search text,p_media jsonb,p_scheduled boolean default false) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; old_slug text; new_slug text; demo boolean;
begin
 perform 1 from blog_posts where id=p_id and trashed_at is null for update;
 if not found then raise exception 'Post unavailable'; end if;
 if p_scheduled and not exists(select 1 from blog_schedules where post_id=p_id and revision_id=p_revision and status='pending' and run_at<=now()) then return null; end if;
 select slug into new_slug from blog_publications where id=p_id and revision_id=p_revision and media=p_media;
 if found then return new_slug; end if;
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
 update blog_posts set first_published_at=coalesce(first_published_at,now()) where id=p_id;
 insert into blog_publications(id,slug,snapshot,is_demo,search_text,revision_id,media) values(p_id,new_slug,s,demo,p_search,p_revision,p_media)
 on conflict(id) do update set slug=excluded.slug,snapshot=excluded.snapshot,published_at=now(),search_text=excluded.search_text,revision_id=excluded.revision_id,media=excluded.media;
 update blog_publications set first_published_at=(select first_published_at from blog_posts where id=p_id) where id=p_id;
 update blog_media set status='published' where id in(select (value->>'id')::uuid from jsonb_array_elements(p_media));
 update blog_schedules set status='published',last_error=null,updated_at=now() where post_id=p_id and revision_id=p_revision and status='pending';
 return new_slug;
end $$;
create function public.blog_transition(p_id uuid,p_action text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from blog_posts where id=p_id for update;
 if not found then raise exception 'Post unavailable'; end if;
 if p_action in ('unpublish','trash') then delete from blog_publications where id=p_id; end if;
 if p_action='trash' then update blog_posts set trashed_at=now() where id=p_id; end if;
 if p_action='restore' then update blog_posts set trashed_at=null where id=p_id; end if;
 if p_action<>'restore' then update blog_schedules set status='cancelled',updated_at=now() where post_id=p_id; end if;
end $$;
create function public.blog_schedule(p_id uuid,p_version integer,p_at timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare rev uuid;
begin
 perform 1 from blog_posts where id=p_id and trashed_at is null and version=p_version for update;
 if not found then raise exception 'CONFLICT'; end if;
 if exists(select 1 from blog_posts where id=p_id and first_published_at is not null) or p_at<now()+interval '1 minute' then raise exception 'Invalid schedule'; end if;
 select id into rev from blog_revisions where post_id=p_id and version=p_version;
 insert into blog_schedules(post_id,revision_id,run_at) values(p_id,rev,p_at) on conflict(post_id) do update set revision_id=excluded.revision_id,run_at=excluded.run_at,status='pending',last_error=null,updated_at=now();
end $$;
revoke all on function public.blog_publish(uuid,uuid,text,jsonb,boolean),public.blog_transition(uuid,text),public.blog_schedule(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.blog_publish(uuid,uuid,text,jsonb,boolean),public.blog_transition(uuid,text),public.blog_schedule(uuid,integer,timestamptz) to service_role;
