/**
 * Withdraws obvious test listings from the public catalogue.
 *
 * Sets status = 'removed' rather than deleting: the public SELECT policy
 * only shows 'active', so they vanish from the app immediately, but
 * nothing is destroyed, no order or chat room is orphaned, and any one of
 * them can be brought back with a single status update. Ten products are
 * referenced by orders (ON DELETE RESTRICT) and four by chat rooms, so a
 * hard delete would fail or break history anyway.
 *
 * Only unambiguous junk is listed here -- placeholder strings and
 * impossible prices. Thin-but-plausible listings from other people's
 * accounts are deliberately left alone; that is the owner's call to make,
 * not a script's.
 */
const fs = require('node:fs');
for (const f of ['/home/pc/dev/EgbayWeb/.env', '/home/pc/dev/EgbayWeb/.env.local']) {
  if (fs.existsSync(f)) process.loadEnvFile(f);
}
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// title + price, so a real listing that happens to share a title is never caught
const JUNK = [
  ['asd', 12], ['asdas', 1221],
  ['He', 58], ['care', 123],
  ['Scar', 25], ['Scar', 2000],
  ['Iphone', 25],
  ['Car', 5000000], ['Nw car xiaomi', 6000000],
];

(async () => {
  const dry = process.argv.includes('--dry-run');
  const { data: rows } = await admin.from('products').select('id,title,price,status');
  const targets = rows.filter(r =>
    r.status === 'active' && JUNK.some(([t, p]) => r.title.trim() === t && Number(r.price) === p));

  console.log(`${targets.length} listing(s) to withdraw:`);
  for (const t of targets) console.log(`   ${JSON.stringify(t.title)} @ ${t.price}`);
  if (dry) { console.log('\nDry run: nothing changed.'); return; }

  for (const t of targets) {
    const { error } = await admin.from('products')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', t.id);
    console.log(error ? `   FAILED ${t.title}: ${error.message}` : `   withdrawn ${t.title}`);
  }
  const { count } = await admin.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active');
  console.log(`\n${count} active listings remain.`);
})();
