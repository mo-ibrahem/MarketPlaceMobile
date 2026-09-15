/**
 * Posts the launch catalogue (scripts/seed/catalogue.csv) as one seller.
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
 *   node scripts/seed/seed-listings.cjs --email … --password … --skip-incomplete
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
// Default is all-or-nothing: a half-posted catalogue is hard to reason
// about. --skip-incomplete posts the rows that are ready and leaves the
// rest for when their photos exist. It never relaxes what "ready" means.
const SKIP = process.argv.includes('--skip-incomplete');
const email = arg('email');
const password = arg('password');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (URL !== 'https://fpqbocohjzwlfcmfropr.supabase.co') throw Error('Expected the Egbay project');
if (!DRY && (!email || !password)) throw Error('Pass --email and --password for the seller account (or --dry-run)');

const PHOTO_DIR = path.join(__dirname, 'photos');

/**
 * catalogue.csv is the source of truth so it can be edited in a
 * spreadsheet. Columns: title, category, condition, price_egp,
 * lead_time_days, photos (pipe-separated filenames), description.
 */
function readCatalogue() {
  const text = fs.readFileSync(path.join(__dirname, 'catalogue.csv'), 'utf8').trim();
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(c => c.trim())).map((r, n) => {
    const o = Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]));
    const price = Number(o.price_egp);
    const lead = Number(o.lead_time_days);
    if (!o.title) throw Error(`row ${n + 2}: missing title`);
    if (!Number.isFinite(price) || price <= 0) throw Error(`row ${n + 2} (${o.title}): price_egp must be a positive number`);
    if (!Number.isInteger(lead) || lead < 1 || lead > 30) throw Error(`row ${n + 2} (${o.title}): lead_time_days must be 1-30`);
    if (!['New', 'Used'].includes(o.condition)) throw Error(`row ${n + 2} (${o.title}): condition must be New or Used`);
    return {
      title: o.title,
      category: o.category,
      condition: o.condition,
      price,
      lead_time_days: lead,
      description: o.description,
      photos: o.photos.split('|').map(x => x.trim()).filter(Boolean),
      // "Brand|Model Name" -- the listing then shows the catalogue photo
      // of that model instead of needing its own. Only legal for a New
      // item; the database refuses it for a used one.
      model: (o.model || '').trim(),
      variant: (o.variant || '').trim(),
    };
  });
}

const catalogue = readCatalogue();

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };

(async () => {
  // Resolve any model references up front so a typo fails before posting.
  const models = new Map();
  const wantsModel = catalogue.filter(l => l.model);
  if (wantsModel.length) {
    const sb = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data } = await sb.from('product_models').select('id, brand, name, variants');
    for (const m of data ?? []) models.set(`${m.brand}|${m.name}`, m);
  }

  // A listing needs its own photos on disk, unless it is a New item
  // pointing at a catalogue model.
  const problems = [];
  const blocked = new Set();
  const fault = (l, msg) => { problems.push(`${l.title}: ${msg}`); blocked.add(l); };
  for (const l of catalogue) {
    if (l.model) {
      const m = models.get(l.model);
      if (!m) { fault(l, `no catalogue model "${l.model}" -- run curate-models.cjs`); continue; }
      if (l.condition !== 'New') { fault(l, 'only a New listing may use a catalogue model'); continue; }
      if (l.variant && !(m.variants ?? []).includes(l.variant)) {
        fault(l, `"${l.variant}" is not a variant of ${l.model} (${(m.variants ?? []).join(', ')})`);
      }
      continue;   // catalogue photos stand in; no local files required
    }
    for (const photo of l.photos) {
      const p = path.join(PHOTO_DIR, photo);
      if (!fs.existsSync(p)) fault(l, `missing ${photo}`);
      else if (!MIME[path.extname(photo).toLowerCase()]) fault(l, `${photo} is not a jpg/png/webp/heic`);
    }
  }
  if (problems.length && SKIP) {
    console.log(`\nSkipping ${blocked.size} listing(s) that are not ready:\n`);
    for (const p of problems) console.log('  ' + p);
    console.log('\nThese stay unposted until their photos exist in scripts/seed/photos/.\n');
  }
  if (problems.length && !SKIP) {
    console.log(`\n${problems.length} listing(s) not ready:\n`);
    for (const p of problems) console.log('  ' + p);
    console.log('\nDrop your own photos there with those filenames, then re-run. Nothing was posted.');
    console.log('(Filenames are the "photos" column in scripts/seed/catalogue.csv.)');
    console.log('Or pass --skip-incomplete to post only the ones that are ready.\n');
    process.exitCode = 1;
    return;
  }

  const ready = catalogue.filter(l => !blocked.has(l));
  console.log(`${ready.length} listings ready.`);
  if (DRY) {
    for (const l of ready) {
      const src = l.model ? `catalogue: ${l.model}${l.variant ? ' / ' + l.variant : ''}` : `${l.photos.length} own photo(s)`;
      console.log(`  ${l.title.padEnd(42)} EGP ${String(l.price).padStart(7)}  ${l.condition.padEnd(4)} ${l.category.padEnd(12)} sourced/${l.lead_time_days}d  ${src}`);
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
  for (const l of ready) {
    try {
      const urls = [];
      for (const photo of (l.model ? [] : l.photos)) {
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
        model_id: l.model ? models.get(l.model).id : null,
        variant: l.variant || null,
      });
      if (error) throw Error(error.message);

      posted++;
      console.log(`  posted  ${l.title}`);
    } catch (e) {
      console.log(`  FAILED  ${l.title} -- ${e.message}`);
    }
  }
  console.log(`\n${posted}/${ready.length} posted.`);
})();
