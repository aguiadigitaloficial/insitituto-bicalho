// This gateway uses the same publisher as the editorial panel. Secrets stay server-side.
// Configure verify_jwt=false ONLY with this independent cron-secret check enabled.
// @ts-nocheck -- deployed by the Supabase Deno runtime, not the Astro TypeScript compiler.
Deno.serve(async(request) => {
  const secret=Deno.env.get('BLOG_CRON_SECRET');
  if(!secret || request.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
  const headers={authorization:`Bearer ${secret}`};
  const bypass=Deno.env.get('VERCEL_AUTOMATION_BYPASS_SECRET');if(bypass)headers['x-vercel-protection-bypass']=bypass;
  const response=await fetch(`${Deno.env.get('BLOG_APP_ORIGIN')}/api/blog/cron/`,{method:'POST',headers});
  return new Response(await response.text(),{status:response.status,headers:{'content-type':'application/json'}});
});
