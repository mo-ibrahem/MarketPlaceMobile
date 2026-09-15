/**
 * Posts the launch catalogue (scripts/seed/catalogue.json) as one seller.
 *
 * Deliberate constraints, do not "fix" them away:
 *
 *  - Photos come from scripts/seed/photos/ -- files you own. The script
 *    refuses to post a listing whose photos are missing rather than
 *    inventing a placeholder, and it never downloads an image from
 *    anywhere. Photos lifted from another marketplace's listings or from
 *    a manufacturer's marketing belong to them, and that is the single
 *    most likely thing to get an App Store submission rejected (5.2.1).
 *  - Every listing is posted as fulfilment 'sourced_to_order' with a lead
 *    time, so it carries the visible badge and can never read as stock
 *    that is already in hand.
 *  - It writes as the seller, through the anon key and that account's own
 *    session -- the same path the app uses, so RLS applies exactly as it
 *    would to any seller. No service-role shortcut.
 *
 * Usage:
 *   node scripts/seed/seed-listings.cjs --email seller@example.com --password '…'
 *   node scripts/seed/seed-listings.cjs --email … --password … --dry-run
 */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

for (const f of ['/home/pc/dev/EgbayWeb/.env', '/home/pc/dev/EgbayWeb/.env.local']) {
  if (fs.existsSync(f)) process.loadEnvFile(f);
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const DRY = process.argv.includes('--dry-run');
const email = arg('email');
const password = arg('password');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (URL !== 'https://fpqbocohjzwlfcmfropr.supabase.co') throw Error('Expected the Egbay project');
if (!DRY && (!email || !password)) throw Error('Pass --email and --password for the seller account (or --dry-run)');

const PHOTO_DIR = path.join(__dirname, 'photos');
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogue.json'), 'utf8')).listings;

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };

(async () => {
  // Every listing must have all of its photos on disk before anything posts.
  const problems = [];
  for (const l of catalogue) {
    for (const photo of l.photos) {
      const p = path.join(PHOTO_DIR, photo);
      if (!fs.existsSync(p)) problems.push(`${l.title}: missing ${photo}`);
      else if (!MIME[path.extname(photo).toLowerCase()]) problems.push(`${l.title}: ${photo} is not a jpg/png/webp/heic`);
    }
  }
  if (problems.length) {
    console.log(`\n${problems.length} listing photo(s) not ready in ${PHOTO_DIR}:\n`);
    for (const p of problems) console.log('  ' + p);
    console.log('\nDrop your own photos there with those filenames, then re-run. Nothing was posted.');
    console.log('(Filenames are listed per item in scripts/seed/catalogue.json.)\n');
    process.exitCode = 1;
    return;
  }

  console.log(`${catalogue.length} listings ready, photos present.`);
  if (DRY) {
    for (const l of catalogue) {
      console.log(`  ${l.title.padEnd(42)} EGP ${String(l.price).padStart(7)}  ${l.condition.padEnd(4)} ${l.category.padEnd(12)} sourced/${l.lead_time_days}d  ${l.photos.length} photo(s)`);
    }
    console.log('\nDry run: nothing posted.');
    return;
  }

  const supabase = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw Error('Sign-in failed: ' + authErr.message);
  const userId = auth.user.id;
  console.log(`Posting as ${email}`);

  let posted = 0;
  for (const l of catalogue) {
    try {
      const urls = [];
      for (const photo of l.photos) {
        const bytes = fs.readFileSync(path.join(PHOTO_DIR, photo));
        const ext = path.extname(photo).toLowerCase();
        const key = `${userId}/${Date.now()}-${photo.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
        const { error } = await supabase.storage
          .from('product-images')
          .upload(key, bytes, { contentType: MIME[ext] });
        if (error) throw Error(`upload ${photo}: ${error.message}`);
        urls.push(supabase.storage.from('product-images').getPublicUrl(key).data.publicUrl);
      }

      const { error } = await supabase.from('products').insert({
        title: l.title,
        description: l.description,
        price: l.price,
        category: l.category,
        condition: l.condition,
        images: urls,
        seller_id: userId,
        status: 'active',
        stock: 1,
        fulfilment: 'sourced_to_order',
        lead_time_days: l.lead_time_days,
      });
      if (error) throw Error(error.message);

      posted++;
      console.log(`  posted  ${l.title}`);
    } catch (e) {
      console.log(`  FAILED  ${l.title} -- ${e.message}`);
    }
  }
  console.log(`\n${posted}/${catalogue.length} posted.`);
})();
