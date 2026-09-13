// Runs real TypeScript functions with isolated adapters; never contacts production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto, createHmac } = require('node:crypto');

function load(file, additions = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, URL, Request, Response, TextEncoder, Uint8Array,
    crypto: webcrypto, AbortSignal, console, ...additions };
  vm.runInNewContext(source, context, { filename: file });
  return context.exports;
}
let count = 0;
async function test(name, run) { await run(); count++; console.log('PASS', name); }

(async () => {
  const safety = load('src/services/lib/paymentSafety.ts');
  for (const url of [
    'https://egbay.shop.evil.example/?success=true',
    'https://evil.example/?next=https://egbay.shop&success=true',
    'https://evil.example/wallet?success=false',
    'http://egbay.shop/?success=true',
    'javascript:alert(1)', 'not a URL',
    'https://accept.paymob.com/?payment_token=declined',
  ]) await test('Ignore unrelated or misleading URL: ' + url, () => assert.equal(safety.classifyPaymobUrl(url), 'none'));
  await test('Decline beats approval', () => assert.equal(safety.classifyPaymobUrl('https://egbay.shop/?success=true&is_voided=true'), 'declined'));
  await test('Approved redirect only initiates verification', () => assert.equal(safety.classifyPaymobUrl('https://accept.paymob.com/?success=true'), 'returned'));
  for (const status of [undefined, null, '', 'refunded', 'new_status', 'pending_payment'])
    await test('Unconfirmed backend state: ' + status, () => assert.equal(safety.paymentBackendState(status, false), 'pending'));
  await test('Backend escrow confirmation', () => assert.equal(safety.paymentBackendState('escrow_secured', false), 'confirmed'));
  await test('Top-ups require paid state', () => assert.equal(safety.paymentBackendState('completed', true), 'pending'));
  await test('Inline script breakout is escaped and round trips', () => {
    const input = "';alert(1);//</script><script>alert(2)</script>";
    const encoded = safety.inlineScriptValue(input);
    assert.ok(!encoded.includes('<'));
    assert.equal(JSON.parse(encoded), input);
  });

  let storage;
  const write = Promise.resolve();
  const remove = Promise.resolve();
  load('src/services/lib/supabase.ts', {
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-test' } },
    require: name => {
      if (name === '@supabase/supabase-js') return { createClient: (_url, _key, options) => { storage = options.auth.storage; return {}; } };
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name === 'expo-secure-store') return { setItemAsync: () => write, deleteItemAsync: () => remove, getItemAsync: async () => null };
      return {};
    },
  });
  await test('Session persistence awaits SecureStore writes', () => assert.equal(storage.setItem('session', 'test'), write));
  await test('Sign-out awaits SecureStore removal', () => assert.equal(storage.removeItem('session'), remove));

  let handler;
  let removed = [];
  let ownedImagePaths = [];
  let rpcCalls = 0;
  let lastRpcParams;
  let providerTxn;
  let providerDown = false;
  let rpcError = null;
  const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only',
    PRODUCT_IMAGES_WEBHOOK_SECRET: 'test-webhook-secret', PAYMOB_HMAC_SECRET: 'test-hmac-secret', PAYMOB_API_KEY: 'test-provider-key', PAYMOB_INTEGRATION_ID: '12' };
  const adapters = {
    fetch: async url => {
      if (providerDown) throw new Error('simulated provider outage');
      return new Response(JSON.stringify(url.endsWith('/auth/tokens') ? { token: 'test-provider-token' } : providerTxn));
    },
    Deno: { env: { get: key => env[key] }, serve: callback => { handler = callback; } },
    require: () => ({ createClient: () => ({
      storage: { from: () => ({ remove: async paths => { removed.push(...paths); return { data: [], error: null }; } }) },
      from: () => ({ insert: async () => ({ error: null }) }),
      rpc: async (_name, params) => { if (_name === 'commerce_is_enabled') return { data: true, error: null }; if (_name === 'product_image_cleanup_paths') return { data: ownedImagePaths, error: null }; rpcCalls++; lastRpcParams = params; return { data: null, error: rpcError }; },
    }) }),
  };
  load('supabase/functions/create-payment-key/index.ts', adapters);
  await test('Legacy client-priced payment endpoint is retired', async () => {
    assert.equal((await handler(new Request('https://example.test', { method: 'POST' }))).status, 410);
  });
  load('supabase/functions/delete-product-images/index.ts', adapters);
  const deletion = { type: 'DELETE', schema: 'public', table: 'products', old_record: {
    seller_id: '11111111-1111-4111-8111-111111111111',
    images: ['https://project.supabase.co/storage/v1/object/public/product-images/owner/item.jpg'],
  } };
  const imageRequest = (event, secret) => new Request('https://example.test', {
    method: 'POST', headers: secret ? { 'x-webhook-secret': secret } : {},
    body: JSON.stringify(event),
  });
  await test('JWT callers cannot delete images without webhook authorization', async () => {
    assert.equal((await handler(imageRequest(deletion))).status, 401);
    assert.equal(removed.length, 0);
  });
  await test('Missing webhook secret fails closed', async () => {
    const old = env.PRODUCT_IMAGES_WEBHOOK_SECRET; delete env.PRODUCT_IMAGES_WEBHOOK_SECRET;
    assert.equal((await handler(imageRequest(deletion, old))).status, 503);
    env.PRODUCT_IMAGES_WEBHOOK_SECRET = old;
  });
  await test('Wrong event cannot delete images', async () => {
    assert.equal((await handler(imageRequest({ ...deletion, type: 'INSERT' }, env.PRODUCT_IMAGES_WEBHOOK_SECRET))).status, 400);
  });
  await test('Foreign storage hosts cannot select deletion paths', async () => {
    const event = { ...deletion, old_record: { seller_id: deletion.old_record.seller_id, images: ['https://evil.example/storage/v1/object/public/product-images/item.jpg'] } };
    await handler(imageRequest(event, env.PRODUCT_IMAGES_WEBHOOK_SECRET));
    assert.equal(removed.length, 0);
  });
  await test('A copied public URL cannot delete another seller image', async () => {
    await handler(imageRequest(deletion, env.PRODUCT_IMAGES_WEBHOOK_SECRET));
    assert.equal(removed.length, 0);
  });
  ownedImagePaths = ['owner/item.jpg'];
  await test('Authenticated database DELETE consumes old_record', async () => {
    assert.equal((await handler(imageRequest(deletion, env.PRODUCT_IMAGES_WEBHOOK_SECRET))).status, 200);
    assert.equal(removed[0], 'owner/item.jpg');
  });

  load('supabase/functions/paymob-webhook/index.ts', adapters);
  // Independently ordered Paymob POST signature fields from the provider reference.
  const fields = ['amount_cents','created_at','currency','error_occured','has_parent_transaction','id',
    'integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment',
    'is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
  const txn = { amount_cents: 10000, created_at: '2026-09-13', currency: 'EGP', error_occured: false,
    has_parent_transaction: false, id: 1234, integration_id: 12, is_3d_secure: true,
    is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true,
    is_voided: false, order: { id: 5678, merchant_order_id: '11111111-1111-4111-8111-111111111111' }, owner: 1,
    pending: false, source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true };
  providerTxn = structuredClone(txn);
  function callback(obj, signature) {
    const input = fields.map(field => String(field.split('.').reduce((v,k) => v?.[k], obj) ?? '')).join('');
    const hmac = signature ?? createHmac('sha512', env.PAYMOB_HMAC_SECRET).update(input).digest('hex');
    return new Request('https://example.test?hmac=' + hmac, { method: 'POST', body: JSON.stringify({ obj }) });
  }
  await test('Invalid payment signature rejected', async () => {
    assert.equal((await handler(callback(txn, 'bad'))).status, 401); assert.equal(rpcCalls, 0);
  });
  for (const flag of ['pending', 'is_refunded', 'is_voided', 'is_auth'])
    await test('Non-settled payment ignored: ' + flag, async () => {
      assert.equal((await handler(callback({ ...txn, [flag]: true }))).status, 200);
      assert.equal(rpcCalls, 0);
    });
  await test('Valid signed payment reaches persistence', async () => {
    assert.equal((await handler(callback(txn))).status, 200); assert.equal(rpcCalls, 1);
  });
  await test('Persistence failure is not acknowledged as success', async () => {
    rpcError = new Error('simulated database outage');
    assert.equal((await handler(callback(txn))).status, 503);
  });

  rpcError = null;
  await test('Unsigned merchant reference cannot redirect fulfillment', async () => {
    const forged = { ...txn, order: { ...txn.order, merchant_order_id: '22222222-2222-4222-8222-222222222222' } };
    assert.equal((await handler(callback(forged))).status, 200);
    assert.equal(lastRpcParams.p_merchant_order_id, txn.order.merchant_order_id);
  });
  await test('Wrong provider integration cannot fulfill', async () => {
    const before = rpcCalls; providerTxn.integration_id = 99;
    assert.equal((await handler(callback(txn))).status, 400); assert.equal(rpcCalls, before);
    providerTxn.integration_id = 12;
  });
  await test('Provider outage cannot acknowledge an unverified payment', async () => {
    const before = rpcCalls; providerDown = true;
    assert.equal((await handler(callback(txn))).status, 503); assert.equal(rpcCalls, before);
    providerDown = false;
  });
  await test('Provider amount mismatch cannot fulfill', async () => {
    const before = rpcCalls; providerTxn.amount_cents = 1;
    assert.equal((await handler(callback(txn))).status, 400); assert.equal(rpcCalls, before);
    providerTxn.amount_cents = txn.amount_cents;
  });

  let liveUser = { id: 'seller' };
  let liveSession = { seller_id: 'seller', status: 'live', wallet_charge_id: 'paid-charge' };
  let liveAllowed = true;
  let minted = 0;
  const liveEnv = { ...env, SUPABASE_ANON_KEY: 'public-test', AGORA_APP_ID: 'test-app',
    AGORA_APP_CERT: 'test-certificate', AGORA_CO_HOST_AUTH_ENABLED: 'true' };
  load('supabase/functions/generate-agora-token/index.ts', {
    Deno: { env: { get: key => liveEnv[key] }, serve: callback => { handler = callback; } },
    require: name => name.startsWith('npm:agora-token') ? {
      RtcRole: { PUBLISHER: 1, SUBSCRIBER: 2 },
      RtcTokenBuilder: { buildTokenWithUid: (_app, _cert, _channel, _uid, role) => { minted++; return 'test-role-' + role; } },
    } : { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: liveUser }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: liveSession, error: null }) }) }) }),
      rpc: async name => ({ data: name === 'commerce_is_enabled' ? true : liveAllowed, error: null }),
    }) },
  });
  const liveRequest = (body = {}, auth = true) => new Request('https://example.test', {
    method: 'POST', headers: auth ? { authorization: 'Bearer test-user' } : {},
    body: JSON.stringify({ channelName: 'egbay_live_test', uid: 7, role: 'host', ...body }),
  });
  await test('Unauthenticated callers cannot mint Agora tokens', async () => {
    assert.equal((await handler(liveRequest({}, false))).status, 401); assert.equal(minted, 0);
  });
  await test('Non-owners cannot mint host tokens', async () => {
    liveUser = { id: 'viewer' };
    assert.equal((await handler(liveRequest())).status, 403); assert.equal(minted, 0);
  });
  await test('Audience receives subscriber role only', async () => {
    const response = await handler(liveRequest({ role: 'audience' }));
    assert.equal(response.status, 200); assert.equal((await response.json()).token, 'test-role-2');
  });
  await test('Arbitrary Agora roles rejected', async () => assert.equal((await handler(liveRequest({ role: 'admin' }))).status, 400));
  await test('Wildcard Agora UID rejected', async () => assert.equal((await handler(liveRequest({ uid: 0 }))).status, 400));
  await test('Blocked viewer cannot join', async () => {
    liveAllowed = false; assert.equal((await handler(liveRequest({ role: 'audience' }))).status, 403);
    liveAllowed = true;
  });
  await test('Ended live session cannot issue tokens', async () => {
    liveSession.status = 'ended'; assert.equal((await handler(liveRequest({ role: 'audience' }))).status, 403);
    liveSession.status = 'live';
  });
  await test('Missing provider audience protection fails closed', async () => {
    liveEnv.AGORA_CO_HOST_AUTH_ENABLED = 'false'; assert.equal((await handler(liveRequest({ role: 'audience' }))).status, 503);
    liveEnv.AGORA_CO_HOST_AUTH_ENABLED = 'true';
  });
  await test('Owner receives publisher token for paid live session', async () => {
    liveUser = { id: 'seller' };
    const response = await handler(liveRequest());
    assert.equal(response.status, 200); assert.equal((await response.json()).token, 'test-role-1');
  });

  console.log(count + ' security checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
