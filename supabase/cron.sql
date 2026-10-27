-- Store secrets in Vault through the dashboard. Never commit their values.
-- Required Vault names: blog_edge_url (full Edge Function URL), blog_cron_secret.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('bicalho-blog-publish','* * * * *',$$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='blog_edge_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='blog_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=55000
 );
$$);
