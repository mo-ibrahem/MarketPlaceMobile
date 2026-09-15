/**
 * Builds the product-model catalogue: one entry per model, with
 * photographs and the credit each photograph's licence requires.
 *
 * Why this exists: a sealed iPhone 15 Pro Max in Blue Titanium looks the
 * same in every box, so making each seller photograph one is busywork
 * that leaves the app empty. A curated catalogue photo is the honest
 * answer *for a new item*. It is not the answer for a used one -- there
 * the condition is precisely what the buyer is judging -- and the
 * database enforces that (products_photos_or_model_check).
 *
 * Photos come from Openverse filtered to commercially-licensed sources,
 * are re-hosted in our own storage bucket (so a listing never hotlinks
 * someone else's server), and every one carries its creator and licence
 * through to the listing that displays it.
 *
 *   node scripts/seed/curate-models.cjs --dry-run
 *   node scripts/seed/curate-models.cjs
 */
const fs = require('node:fs');
for (const f of ['/home/pc/dev/EgbayWeb/.env', '/home/pc/dev/EgbayWeb/.env.local']) {
  if (fs.existsSync(f)) process.loadEnvFile(f);
}
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const UA = 'egbay-catalogue/1.0 (product model photos; commercially licensed only)';
const DRY = process.argv.includes('--dry-run');

/** Models worth catalogue photos: standardised goods sold sealed. */
const MODELS = [
  { brand: 'Apple',    name: 'iPhone 15 Pro Max',        category: 'Electronics', q: 'iPhone 15 Pro',            variants: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'] },
  { brand: 'Apple',    name: 'iPhone 15',                category: 'Electronics', q: 'iPhone 15',                variants: ['Black', 'Blue', 'Green', 'Pink', 'Yellow'] },
  { brand: 'Apple',    name: 'iPhone 14 Pro',            category: 'Electronics', q: 'iPhone 14 Pro',            variants: ['Space Black', 'Silver', 'Gold', 'Deep Purple'] },
  { brand: 'Apple',    name: 'iPhone 13 Pro',            category: 'Electronics', q: 'iPhone 13 Pro',            variants: ['Graphite', 'Gold', 'Silver', 'Sierra Blue'] },
  { brand: 'Samsung',  name: 'Galaxy S24 Ultra',         category: 'Electronics', q: 'Samsung Galaxy S24 Ultra', variants: ['Titanium Black', 'Titanium Gray', 'Titanium Violet', 'Titanium Yellow'] },
  { brand: 'Apple',    name: 'MacBook Air 13-inch M3',   category: 'Electronics', q: 'MacBook Air M3',           variants: ['Midnight', 'Starlight', 'Space Gray', 'Silver'] },
  { brand: 'Apple',    name: 'AirPods Pro 2',            category: 'Electronics', q: 'AirPods Pro',              variants: ['White'] },
  { brand: 'Apple',    name: 'Apple Watch Series 9',     category: 'Electronics', q: 'Apple Watch Series 9',     variants: ['Midnight', 'Starlight', 'Silver', 'Pink'] },
  { brand: 'Sony',     name: 'PlayStation 5 Slim',       category: 'Toys',        q: 'PlayStation 5',            variants: ['Disc edition', 'Digital edition'] },
  { brand: 'Microsoft',name: 'Xbox Series S',            category: 'Toys',        q: 'Xbox Series S',            variants: ['White', 'Black'] },
  { brand: 'Nintendo', name: 'Nintendo Switch OLED',     category: 'Toys',        q: 'Nintendo Switch OLED',     variants: ['White', 'Neon'] },
];

const PHOTOS_PER_MODEL = 2;
const MAX_BYTES = 9 * 1024 * 1024;   // the bucket caps objects at 10MB
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Openverse rate-limits anonymous callers; back off rather than give up. */
const get = async (u, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (r.ok) return r;
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
    throw Error(`${r.status}`);
  }
  throw Error('429 after retries');
};
const creditOf = (x) => {
  const who = x.creator || 'Unknown';
  const lic = `${(x.license || '').toUpperCase()}${x.license_version ? ' ' + x.license_version : ''}`;
  return `Photo: ${who} / ${x.source || 'Openverse'} (${lic})`;
};

(async () => {
  for (const m of MODELS) {
    try {
      const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(m.q)}&license_type=commercial&page_size=20&mature=false`;
      const { results = [] } = await (await get(api)).json();
      // Prefer a usable size over the largest available: a 12,000px
      // original blows the bucket's object limit and nothing on a phone
      // renders it. Rank by distance from ~2000px wide, keep the rest as
      // fallbacks for when a URL 404s.
      const candidates = results
        .filter(r => r.url && (r.width ?? 0) >= 900)
        .sort((a, b) => Math.abs((a.width ?? 0) - 2000) - Math.abs((b.width ?? 0) - 2000));

      if (!candidates.length) { console.log(`  NONE   ${m.brand} ${m.name} -- no commercially-licensed photo`); continue; }
      if (DRY) {
        const preview = candidates.slice(0, PHOTOS_PER_MODEL);
        console.log(`  ${(m.brand + ' ' + m.name).padEnd(34)} ${preview.length} photo(s): ${preview.map(p => `${p.width}w ${p.license}`).join(', ')}`);
        continue;
      }

      const { data: model, error: mErr } = await admin.from('product_models')
        .upsert({ name: m.name, brand: m.brand, category: m.category, variants: m.variants }, { onConflict: 'brand,name' })
        .select('id').single();
      if (mErr) throw Error('model: ' + mErr.message);

      await admin.from('product_model_photos').delete().eq('model_id', model.id);

      let i = 0;
      for (const p of candidates) {
        if (i >= PHOTOS_PER_MODEL) break;
        let bytes;
        try {
          bytes = Buffer.from(await (await get(p.url)).arrayBuffer());
        } catch (e) {
          continue;  // dead URL -- try the next candidate
        }
        if (bytes.length > MAX_BYTES) continue;

        const key = `models/${model.id}/${i}.jpg`;
        const { error: upErr } = await admin.storage.from('product-images')
          .upload(key, bytes, { contentType: 'image/jpeg', upsert: true });
        if (upErr) throw Error('upload: ' + upErr.message);
        const url = admin.storage.from('product-images').getPublicUrl(key).data.publicUrl;

        const { error: pErr } = await admin.from('product_model_photos').insert({
          model_id: model.id, variant: null, url,
          credit: creditOf(p),
          license: `${p.license}${p.license_version ? ' ' + p.license_version : ''}`,
          source_url: p.foreign_landing_url ?? null,
          position: i,
        });
        if (pErr) throw Error('photo: ' + pErr.message);
        i++;
      }
      if (!i) { console.log(`  NONE   ${m.brand} ${m.name} -- every candidate failed to download`); continue; }
      console.log(`  ok     ${(m.brand + ' ' + m.name).padEnd(34)} ${i} photo(s), ${m.variants.length} variant(s)`);
      await sleep(1200);   // stay under the anonymous rate limit
    } catch (e) {
      console.log(`  FAILED ${m.brand} ${m.name} -- ${e.message}`);
    }
  }
  if (DRY) console.log('\nDry run: nothing written.');
})();
