// Explicit live verification. Creates only marked disposable fixtures, never charges money.
const fs=require('node:fs'), assert=require('node:assert/strict'), {randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
for(const f of ['/home/pc/dev/EgbayWeb/.env','/home/pc/dev/EgbayWeb/.env.local'])if(fs.existsSync(f))process.loadEnvFile(f);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if(url!=='https://fpqbocohjzwlfcmfropr.supabase.co'||!key||!anon)throw Error('Expected project credentials are unavailable');
if(!process.argv.includes('--run'))throw Error('Pass --run to create disposable live fixtures');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],products=[],orders=[],objects=[];
let checks=0;
async function ok(name,fn){await fn();checks++;console.log('PASS',name);}
function checked(r){if(r.error)throw Error(r.error.message);return r.data;}
async function newUser(){
 const email='security-check-'+randomUUID()+'@example.invalid',password=randomUUID()+randomUUID();
 const u=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Security verification'}})).user;
 users.push(u.id);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 checked(await client.auth.signInWithPassword({email,password}));
 return {id:u.id,client};
}
async function scalar(table,id){return checked(await admin.from(table).select('*').eq('id',id).maybeSingle());}
(async()=>{
 checked(await admin.from('account_deletion_jobs').select('user_id').limit(0));
 const A=await newUser(),B=await newUser(),C=await newUser();
 const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZ8AAAAASUVORK5CYII=','base64');
 for(const [bucket,who] of [['avatars',A],['product-images',B]]){
   const name=who.id+'/'+randomUUID()+'.png';checked(await who.client.storage.from(bucket).upload(name,tiny,{contentType:'image/png'}));
   objects.push({bucket,name});
 }
 const product=checked(await B.client.from('products').insert({title:'Security verification — temporary',description:'Disposable test listing',category:'Other',price:100,stock:1,seller_id:B.id,images:[url+'/storage/v1/object/public/product-images/'+objects[1].name]}).select('id').single()).id;
 products.push(product);
 const room=checked(await A.client.from('chat_rooms').insert({participant_ids:[A.id,B.id],product_id:product}).select('id').single()).id;
 await ok('Product deletion worker removes an owned unused image',async()=>{
   const name=B.id+'/'+randomUUID()+'.png';
   checked(await B.client.storage.from('product-images').upload(name,tiny,{contentType:'image/png'}));objects.push({bucket:'product-images',name});
   const id=checked(await B.client.from('products').insert({title:'Security verification — temporary',description:'Queue fixture',category:'Other',price:10,stock:1,seller_id:B.id,images:[url+'/storage/v1/object/public/product-images/'+name]}).select('id').single()).id;products.push(id);
   checked(await B.client.from('products').delete().eq('id',id));checked(await admin.rpc('dispatch_cleanup_jobs'));
   for(let i=0;i<20;i++){
     if(!checked(await admin.storage.from('product-images').list(B.id,{search:name.split('/')[1]})).length)return;
     await new Promise(r=>setTimeout(r,1500));
   }
   throw Error('Image cleanup worker did not remove the fixture');
 });
 await ok('Deletion worker preserves an image still used by another listing',async()=>{
   const id=checked(await B.client.from('products').insert({title:'Security verification — temporary',description:'Shared image fixture',category:'Other',price:10,stock:1,seller_id:B.id,images:[url+'/storage/v1/object/public/product-images/'+objects[1].name]}).select('id').single()).id;products.push(id);
   checked(await B.client.from('products').delete().eq('id',id));checked(await admin.rpc('dispatch_cleanup_jobs'));
   for(let i=0;i<20;i++){
     const jobs=checked(await admin.from('product_image_cleanup_jobs').select('id').contains('old_record',{seller_id:B.id}));
     if(!jobs.length){checked(await B.client.storage.from('product-images').download(objects[1].name));return;}
     await new Promise(r=>setTimeout(r,1500));
   }
   throw Error('Shared image queue did not finish');
 });
 checked(await A.client.from('messages').insert({room_id:room,sender_id:A.id,content:'Disposable A message'}));
 checked(await B.client.from('messages').insert({room_id:room,sender_id:B.id,content:'Disposable B message'}));
 await ok('Third account cannot read private messages',async()=>assert.equal(checked(await C.client.from('messages').select('id').eq('room_id',room)).length,0));
 await ok('Sender impersonation denied',async()=>assert.ok((await A.client.from('messages').insert({room_id:room,sender_id:B.id,content:'forged'})).error));
 checked(await A.client.rpc('block_user',{p_user_id:B.id}));
 await ok('Bidirectional blocking denies direct API messages',async()=>{
   for(const u of [A,B])assert.ok((await u.client.from('messages').insert({room_id:room,sender_id:u.id,content:'blocked'})).error);
 });
 checked(await A.client.rpc('unblock_user',{p_user_id:B.id}));
 await ok('Unblocking restores messaging',async()=>checked(await B.client.from('messages').insert({room_id:room,sender_id:B.id,content:'restored'})));
 await ok('Legacy image endpoint cannot delete with a user JWT alone',async()=>{
   const r=await A.client.functions.invoke('delete-product-images',{body:{record:{images:[url+'/storage/v1/object/public/product-images/'+objects[1].name]}}});
   assert.ok(r.error);checked(await B.client.storage.from('product-images').download(objects[1].name));
 });
 const live=checked(await admin.rpc('book_live_session',{p_seller_id:C.id,p_title:'Security verification — temporary',p_title_ar:null,p_description:null,p_tier:'flash',p_category:'Other',p_scheduled_at:null,p_thumbnail_url:null}));
 await ok('Free live remains bookable without a charge',async()=>{assert.equal(live.pass_price_egp,0);assert.equal(live.wallet_charge_id,null);});
 checked(await C.client.from('live_sessions').update({status:'live',started_at:new Date().toISOString()}).eq('id',live.id));
 await ok('Live chat host impersonation denied',async()=>assert.ok((await B.client.from('live_chat_messages').insert({session_id:live.id,user_id:B.id,username:'forged',message:'forged',is_host:true,msg_type:'chat'})).error));
 await ok('Normal audience chat still works',async()=>checked(await B.client.from('live_chat_messages').insert({session_id:live.id,user_id:B.id,username:'test',message:'hello',is_host:false,msg_type:'chat'})));
 // The studio reverts a session whose broadcast never started (what build 26
 // hit with an empty Agora App ID). Only the owner may, and it must be
 // re-livable afterwards -- an `ended` row would be final.
 await ok('Non-owner cannot revert a live session to scheduled',async()=>{
   checked(await B.client.from('live_sessions').update({status:'scheduled'}).eq('id',live.id).eq('status','live'));
   assert.equal((await scalar('live_sessions',live.id)).status,'live');
 });
 await ok('Owner reverts a failed broadcast to scheduled and can go live again',async()=>{
   checked(await C.client.from('live_sessions').update({status:'scheduled'}).eq('id',live.id).eq('status','live'));
   assert.equal((await scalar('live_sessions',live.id)).status,'scheduled');
   assert.ok((await B.client.from('live_chat_messages').insert({session_id:live.id,user_id:B.id,username:'test',message:'not live',is_host:false,msg_type:'chat'})).error,'chat must close while scheduled');
   checked(await C.client.from('live_sessions').update({status:'live'}).eq('id',live.id));
   assert.equal((await scalar('live_sessions',live.id)).status,'live');
 });
 checked(await C.client.from('live_sessions').update({status:'ended',ended_at:new Date().toISOString()}).eq('id',live.id));
 await ok('Ended sessions cannot be reopened',async()=>assert.ok((await C.client.from('live_sessions').update({status:'live'}).eq('id',live.id)).error));
 // A pending test order, without Paymob or wallet fulfillment.
 const order=checked(await admin.from('orders').insert({product_id:product,buyer_id:A.id,seller_id:B.id,amount:100,shipping_address:{name:'Disposable A',street:'Temporary'},notes:'Disposable note'}).select('id').single()).id;
 orders.push(order);
 const balanceBefore=checked(await admin.from('user_wallets').select('available_balance,pending_balance').eq('user_id',B.id).single());
 let receipt;
 await ok('Account deletion erases auth, uploads and owned messages without changing counterparty balance',async()=>{
   const response=checked(await A.client.functions.invoke('delete-account',{body:{user_id:B.id}}));receipt=response.receipt;
   if(response.status==='pending'){
     checked(await admin.rpc('dispatch_cleanup_jobs'));
     for(let i=0;i<20 && response.status!=='complete';i++){
       await new Promise(r=>setTimeout(r,1500));
       const row=checked(await admin.from('account_deletion_jobs').select('status').eq('user_id',A.id).single());response.status=row.status;
     }
   }
   assert.equal(response.status,'complete');
   const lookup=await admin.auth.admin.getUserById(A.id);assert.ok(lookup.error);
   assert.ok((await admin.storage.from('avatars').download(objects[0].name)).error);
   assert.equal(checked(await admin.from('messages').select('id').eq('sender_id',A.id)).length,0);
   assert.ok(checked(await B.client.from('messages').select('id').eq('room_id',room)).length>0);
   const row=await scalar('orders',order);assert.equal(row.buyer_id,null);assert.equal(row.shipping_address,null);
   assert.deepEqual(checked(await admin.from('user_wallets').select('available_balance,pending_balance').eq('user_id',B.id).single()),balanceBefore);
 });
 await ok('Receipt confirms completion without exposing account data',async()=>{
   const publicClient=createClient(url,anon,{auth:{persistSession:false}});
   const data=checked(await publicClient.rpc('account_deletion_status',{p_receipt:receipt}));
   assert.equal(data[0].status,'complete');assert.deepEqual(Object.keys(data[0]).sort(),['completed_at','status']);
 });
 await ok('Old JWT loses protected access',async()=>{
   const r=await A.client.from('messages').select('id');assert.ok(r.error||r.data.length===0);
 });
 await ok('Shipped deletion RPC enqueues cleanup and disables the account',async()=>{
   checked(await C.client.rpc('delete_my_account'));
   assert.equal(checked(await admin.rpc('account_is_active',{p_user_id:C.id})),false);
   checked(await admin.rpc('dispatch_cleanup_jobs'));
   for(let i=0;i<20;i++){
     const row=checked(await admin.from('account_deletion_jobs').select('status').eq('user_id',C.id).single());
     if(row.status==='complete')return;
     await new Promise(r=>setTimeout(r,1500));
   }
   throw Error('Legacy deletion worker did not complete within 30 seconds');
 });
 console.log(checks+' live security checks passed. No provider payment or Agora stream was created.');
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;}).finally(async()=>{
 // Cleanup uses only exact fixture IDs created by this process.
 for(const id of orders)await admin.from('orders').delete().eq('id',id);
 for(const id of products)await admin.from('products').delete().eq('id',id);
 for(const o of objects)await admin.storage.from(o.bucket).remove([o.name]);
 try{
   for(const id of users){
     await admin.from('live_sessions').delete().eq('seller_id',id);
     await admin.from('chat_rooms').delete().contains('participant_ids',[id]);
     const lookup=await admin.auth.admin.getUserById(id);
     if(lookup.data?.user)checked(await admin.rpc('begin_account_deletion',{p_user_id:id}));
     else if(lookup.error?.status!==404 && lookup.error?.code!=='user_not_found')throw Error('Could not verify fixture account removal');
   }
   checked(await admin.rpc('dispatch_cleanup_jobs'));
   for(let i=0;i<20;i++){
     const jobs=checked(await admin.from('account_deletion_jobs').select('user_id').in('user_id',users).neq('status','complete'));
     if(!jobs.length){console.log('Disposable fixture account cleanup confirmed.');return;}
     await new Promise(r=>setTimeout(r,1500));
   }
   throw Error('Fixture cleanup remains pending');
 }catch(e){console.error('Cleanup:',e.message);process.exitCode=1;}
});
