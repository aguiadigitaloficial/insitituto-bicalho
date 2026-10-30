-- Private publication preparation state. Existing column-level grants keep it inaccessible to visitors.
alter table public.blog_media add column public_ready_stamp text;
revoke select(public_ready_stamp) on public.blog_media from anon,authenticated;

create or replace function public.blog_publish(p_id uuid,p_revision uuid,p_search text,p_media jsonb,p_scheduled boolean default false) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; old_slug text; new_slug text; demo boolean; media_item jsonb;
begin
 perform 1 from blog_posts where id=p_id and trashed_at is null for update;
 if not found then raise exception 'Post unavailable'; end if;
 if p_scheduled and not exists(select 1 from blog_schedules where post_id=p_id and revision_id=p_revision and status='pending' and run_at<=now()) then return null; end if;
 select slug into new_slug from blog_publications where id=p_id and revision_id=p_revision and media=p_media;
 if found then return new_slug; end if;
 -- Lock media in a consistent order and reject stale preparation before committing a public version.
 for media_item in select value from jsonb_array_elements(p_media) order by value->>'id' loop
   perform 1 from blog_media where id=(media_item->>'id')::uuid
     and status in ('ready','published') and public_ready_stamp is not null
     and variants=media_item->'variants' and alt=media_item->>'alt'
     and caption=media_item->>'caption' and credit=media_item->>'credit'
     and copyright=media_item->>'copyright' for update;
   if not found then raise exception 'Media changed or not prepared'; end if;
 end loop;
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
revoke all on function public.blog_publish(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.blog_publish(uuid,uuid,text,jsonb,boolean) to service_role;
