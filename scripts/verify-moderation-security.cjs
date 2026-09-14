// Explicit disposable-account verification of the local production web build
// against the project's deployed report permissions. No provider payments.
const fs=require('node:fs'), assert=require('node:assert/strict'), {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
if(!process.argv.includes('--run'))throw Error('Pass --run to create disposable moderation fixtures');
for(const p of ['/home/pc/dev/EgbayWeb/.env','/home/pc/dev/EgbayWeb/.env.local'])process.loadEnvFile(p);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(url,'https://fpqbocohjzwlfcmfropr.supabase.co');
const db=createClient(url,key,{auth:{persistSession:false}}), users=[],products=[],reports=[];
let checks=0;
function checked(r){if(r.error)throw Error(r.error.message);return r.data;}
async function user(){const email='security-check-'+randomUUID()+'@example.invalid',password=randomUUID()+randomUUID();
 const u=checked(await db.auth.admin.createUser({email,password,email_confirm:true})).user; users.push(u.id);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const data=checked(await client.auth.signInWithPassword({email,password}));
 return {id:u.id,client,headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'}};
}
async function api(headers={},body){return fetch('http://127.0.0.1:3200/api/admin/reports',{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});}
async function ok(label,fn){await fn();console.log('PASS',label);checks++;}
(async()=>{
 const A=await user(),B=await user();
 checked(await db.from('user_profiles').update({is_admin:true}).eq('id',A.id));
 const product=checked(await B.client.from('products').insert({title:'Security moderation fixture',description:'Temporary verification',category:'Other',price:10,seller_id:B.id,stock:1}).select('id').single()).id;products.push(product);
 const report=checked(await A.client.rpc('report_content',{p_target_type:'listing',p_target_id:product,p_reason:'Disposable moderation test'}));reports.push(report);
 await ok('Anonymous report queue access denied',async()=>assert.equal((await api()).status,401));
 await ok('Ordinary users cannot list or moderate reports',async()=>{
  assert.equal((await api(B.headers)).status,403);
  assert.equal((await api(B.headers,{reportId:report,action:'remove'})).status,403);
 });
 await ok('Moderator queue contains the reported content',async()=>{
  const r=await api(A.headers);assert.equal(r.status,200);assert.ok((await r.json()).reports.some(x=>x.id===report&&x.preview.title==='Security moderation fixture'));
 });
 await ok('Moderator removal is recorded and seller cannot republish',async()=>{
  assert.equal((await api(A.headers,{reportId:report,action:'remove',notes:'Disposable test removal'})).status,200);
  const r=checked(await db.from('content_reports').select('status,reviewed_by').eq('id',report).single());assert.equal(r.status,'actioned');assert.equal(r.reviewed_by,A.id);
  checked(await B.client.from('products').update({status:'active'}).eq('id',product));
  assert.equal(checked(await B.client.from('products').select('id').eq('id',product)).length,0);
 });
 await ok('Direct API prohibited-text insert denied',async()=>assert.ok((await B.client.from('products').insert({title:'buy cocaine',description:'Temporary blocked fixture',category:'Other',price:10,seller_id:B.id})).error));
 console.log(checks+' moderation API checks passed.');
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;}).finally(async()=>{
 try {
  for(const id of reports)checked(await db.from('content_reports').delete().eq('id',id));
  for(const id of products)checked(await db.from('products').delete().eq('id',id));
  for(const id of users){
   checked(await db.rpc('begin_account_deletion',{p_user_id:id}));
  }
  checked(await db.rpc('dispatch_cleanup_jobs'));
  for(let i=0;i<20;i++){
   const pending=checked(await db.from('account_deletion_jobs').select('user_id').in('user_id',users).neq('status','complete'));
   if(!pending.length){console.log('Disposable moderator accounts removed.');return;}
   await new Promise(r=>setTimeout(r,1500));
  }
  throw Error('Fixture deletion remains pending');
 } catch(e){console.error('Cleanup:',e.message);process.exitCode=1;}
});
