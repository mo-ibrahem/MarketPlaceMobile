// Real PostgreSQL (PGlite) authorization tests against a schema-only production fixture.
// No credentials, network, production writes or user data. PostgreSQL version differs from hosting.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const schema = require('./fixtures/production-schema-20260913.json');
const grants = require('./fixtures/production-grants-20260913.json');
const qi = s => '"' + s.replaceAll('"','""') + '"';
const db = new PGlite();
let checks=0;
async function test(name,fn){await fn();console.log('PASS',name);checks++;}
async function as(role,id,sql,params=[]){
 await db.exec('RESET ROLE');
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id||'',JSON.stringify({sub:id,role})]);
 await db.exec('SET ROLE '+role);
 try{return await db.query(sql,params);}finally{await db.exec('RESET ROLE');}
}
async function denied(role,id,sql,params=[]){await assert.rejects(as(role,id,sql,params));}
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
(async()=>{
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
 CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'select gen_random_uuid()';
 SET search_path = public, extensions;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,phone text,encrypted_password text,raw_user_meta_data jsonb DEFAULT '{}',
 deleted_at timestamptz,banned_until timestamptz,email_change text,email_change_token_new text,email_change_token_current text,
 phone_change text,recovery_token text,updated_at timestamptz);
 CREATE TABLE auth.sessions(id uuid DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
 CREATE TABLE auth.identities(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
 CREATE TABLE auth.mfa_factors(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'$$;
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
 GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
 `);
 const tables=[...new Set(schema.columns.map(c=>c.table))].filter(t=>t!=='public_profiles');
 for(const t of tables){
   const cols=schema.columns.filter(c=>c.table===t).map(c=>qi(c.column)+' '+c.type+(c.default?' DEFAULT '+c.default:'')+(c.nullable==='NO'?' NOT NULL':''));
   await db.exec('CREATE TABLE public.'+qi(t)+' ('+cols.join(',')+'); ALTER TABLE public.'+qi(t)+' ENABLE ROW LEVEL SECURITY;');
 }
 for(const c of [...schema.constraints].sort((a,b)=>Number(a.definition.startsWith('FOREIGN'))-Number(b.definition.startsWith('FOREIGN'))))
   await db.exec('ALTER TABLE '+c.table+' ADD CONSTRAINT '+qi(c.name)+' '+c.definition);
 await db.exec('CREATE VIEW public.public_profiles AS SELECT id,full_name,avatar_url,tier,is_verified_seller,rating_avg,rating_count FROM public.user_profiles;');
 for(const f of schema.functions)await db.exec(f.definition);
 for(const p of schema.policies)await db.exec('CREATE POLICY '+qi(p.policyname)+' ON '+p.schemaname+'.'+qi(p.tablename)+' AS '+p.permissive+' FOR '+p.cmd+' TO '+p.roles.map(qi).join(',')+(p.qual?' USING ('+p.qual+')':'')+(p.with_check?' WITH CHECK ('+p.with_check+')':''));
 for(const t of schema.triggers)await db.exec(t.definition);
 await db.exec('CREATE TRIGGER on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();');
 for(const g of grants.filter(g=>g.schema==='public'||g.table==='objects')){
   for(const p of g.privileges||[])await db.exec('GRANT '+p+' ON '+g.schema+'.'+qi(g.table)+' TO '+g.role);
   for(const c of g.columns||[])for(const p of ['insert','update'])if(c[p] && (g.schema!=='storage'||['id','bucket_id','name','owner_id'].includes(c.name)))await db.exec('GRANT '+p+'('+qi(c.name)+') ON '+g.schema+'.'+qi(g.table)+' TO '+g.role);
 }
 await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public,storage TO service_role; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;');
 for(const f of schema.functions){
   await db.exec('REVOKE EXECUTE ON FUNCTION public.'+f.name+' FROM PUBLIC,anon,authenticated');
   if(f.auth_execute)await db.exec('GRANT EXECUTE ON FUNCTION public.'+f.name+' TO authenticated');
 }
 for(const id of [A,B,C])await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)",[id,id+'@example.invalid']);
 for(const name of ['20260913190000_classifieds_security.sql','20260913190100_guard_rpcs_and_delete_data.sql','20260913190200_cleanup_queue.sql'])
   await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await test('Anonymous public names mask legacy email fallback',async()=>{
   const r=await as('anon',null,'SELECT full_name FROM public.public_profiles');
   assert.equal(r.rows.length,3);assert.ok(r.rows.every(r=>!r.full_name.includes('@')));
 });
 await test('New signup with no name never defaults to email',async()=>{
   const id='44444444-4444-4444-8444-444444444444';
   await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,'private@example.invalid']);
   assert.equal((await db.query('SELECT full_name FROM public.user_profiles WHERE id=$1',[id])).rows[0].full_name,'EgyBay User');
 });
 const room=(await as('authenticated',A,'INSERT INTO public.chat_rooms(participant_ids) VALUES($1) RETURNING id',[[A,B]])).rows[0].id;
 await test('Members can send before blocking',()=>as('authenticated',A,'INSERT INTO public.messages(room_id,sender_id,content) VALUES($1,$2,$3)',[room,A,'hello']));
 await test('Third party cannot read room or messages',async()=>{
   assert.equal((await as('authenticated',C,'SELECT * FROM public.messages WHERE room_id=$1',[room])).rows.length,0);
   assert.equal((await as('authenticated',C,'SELECT * FROM public.chat_rooms WHERE id=$1',[room])).rows.length,0);
 });
 await test('Sender impersonation is denied',()=>denied('authenticated',A,'INSERT INTO public.messages(room_id,sender_id,content) VALUES($1,$2,$3)',[room,B,'forged']));
 await test('Room membership cannot be edited',()=>denied('authenticated',A,'UPDATE public.chat_rooms SET participant_ids=$1 WHERE id=$2',[[A,C],room]));
 await as('authenticated',A,'SELECT public.block_user($1)',[B]);
 for(const [from,to] of [[A,B],[B,A]]){
   await test('Block denies new messages from '+from[0],()=>denied('authenticated',from,'INSERT INTO public.messages(room_id,sender_id,content) VALUES($1,$2,$3)',[room,from,'blocked']));
   await test('Block denies new rooms from '+from[0],()=>denied('authenticated',from,'INSERT INTO public.chat_rooms(participant_ids) VALUES($1)',[[from,to]]));
 }
 await test('Unrelated user can still contact A',()=>as('authenticated',A,'INSERT INTO public.chat_rooms(participant_ids) VALUES($1)',[[A,C]]));
 await test('Three-member direct room is rejected',()=>denied('authenticated',A,'INSERT INTO public.chat_rooms(participant_ids) VALUES($1)',[[A,B,C]]));
 await as('authenticated',A,'SELECT public.unblock_user($1)',[B]);
 await test('Unblocking restores sending',()=>as('authenticated',B,'INSERT INTO public.messages(room_id,sender_id,content) VALUES($1,$2,$3)',[room,B,'restored']));
 await test('Live mutations remain denied',()=>denied('authenticated',A,"INSERT INTO public.live_sessions(seller_id,title,pass_tier,pass_price_egp,max_viewers) VALUES($1,'test','flash',10,5)",[A]));
 await test('Server booking is also disabled',()=>denied('service_role',null,"SELECT public.require_commerce_enabled()"));
 await test('Users cannot enable commerce or inspect worker credentials',async()=>{
   await denied('authenticated',A,'UPDATE private.launch_settings SET payments_enabled=true');
   await denied('authenticated',A,'SELECT * FROM private.worker_credentials');
   await denied('authenticated',A,'SELECT public.authorize_cleanup_worker($1)',['x'.repeat(72)]);
 });
 await test('Wrong currency rejected inside payment RPC',()=>denied('service_role',null,"SELECT public.process_paymob_order_payment($1,123,500,'USD')",[room]));
 await test('Reporting private messages requires room membership',async()=>{
   const msg=(await as('authenticated',A,'SELECT id FROM public.messages WHERE room_id=$1 LIMIT 1',[room])).rows[0].id;
   await denied('authenticated',C,"SELECT public.report_content('message',$1,'abuse')",[msg]);
   assert.ok((await as('authenticated',A,"SELECT public.report_content('message',$1,'abuse')",[msg])).rows[0].report_content);
 });
 await test('Test financial history is cleaned without leaving auth foreign keys',async()=>{
   await db.exec('UPDATE private.launch_settings SET payments_enabled=true,financial_records_are_test_data=false');
   const product=(await db.query("INSERT INTO public.products(title,description,category,price,seller_id,stock) VALUES('test','test','Other',100,$1,1) RETURNING id",[B])).rows[0].id;
   const order=(await db.query('INSERT INTO public.orders(product_id,buyer_id,seller_id,amount) VALUES($1,$2,$3,100) RETURNING id',[product,A,B])).rows[0].id;
   await as('service_role',null,"SELECT public.process_paymob_order_payment($1,555,10000,'EGP')",[order]);
   await db.query("UPDATE public.orders SET status='completed' WHERE id=$1",[order]);
   await as('service_role',null,"SELECT public.process_paymob_order_payment($1,555,10000,'EGP')",[order]);
   assert.equal((await db.query('SELECT count(*)::int n FROM public.wallet_transactions WHERE paymob_transaction_id=555')).rows[0].n,1);
   await denied('service_role',null,"SELECT public.process_paymob_order_payment($1,555,10000,'USD')",[order]);
   await db.exec('UPDATE private.launch_settings SET payments_enabled=false,financial_records_are_test_data=true');
 });
 await as('service_role',null,'SELECT public.begin_account_deletion($1)',[A]);
 await test('Stale JWT cannot read private messages',async()=>assert.equal((await as('authenticated',A,'SELECT * FROM public.messages')).rows.length,0));
 await test('Stale JWT cannot use SECURITY DEFINER profile RPC',()=>denied('authenticated',A,"SELECT public.update_my_profile('changed',NULL,NULL)"));
 await test('Stale JWT cannot upload storage objects',()=>denied('authenticated',A,"INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('product-images','x',$1)",[A]));
 await test('Pending deletion profile is no longer public',async()=>assert.equal((await as('anon',null,'SELECT * FROM public.public_profiles WHERE id=$1',[A])).rows.length,0));
 await as('service_role',null,'SELECT * FROM public.claim_account_deletions($1)',[A]);
 await test('Account cleanup is retryable and permits real auth deletion',async()=>{
   await as('service_role',null,'SELECT public.purge_account_data($1)',[A]);
   await as('service_role',null,'SELECT public.purge_account_data($1)',[A]);
   await db.query('DELETE FROM auth.users WHERE id=$1',[A]);
   assert.equal((await db.query('SELECT * FROM auth.users WHERE id=$1',[B])).rows.length,1);
   assert.equal((await db.query('SELECT * FROM public.messages WHERE sender_id=$1',[A])).rows.length,0);
 });
 console.log(checks+' database security checks passed.');await db.close();
})().catch(async e=>{console.error(e.message);process.exitCode=1;await db.close();});
