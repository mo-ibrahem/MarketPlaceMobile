/**
 * Fetches public-domain / CC0 photographs for the *generic* items in the
 * catalogue -- an air fryer, a yoga mat, a car phone holder. Things where
 * a representative photo is honest because the item is a commodity and
 * any unit looks like any other.
 *
 * It deliberately covers nothing branded. A buyer looking at an iPhone 15
 * Pro Max or a PS5 is buying that exact model, and a stand-in photo of a
 * different phone is a misleading listing however the badge is worded.
 * Those need photographs of the actual units -- yours, or your supplier's
 * with their permission. (There is also nothing to fetch: CC0 coverage of
 * current flagships is zero, checked before writing this.)
 *
 * Every file downloaded is recorded in photos/LICENSES.json with its
 * source, licence and creator, so the provenance of anything in the
 * catalogue can be shown on demand.
 *
 *   node scripts/seed/fetch-generic-photos.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const PHOTO_DIR = path.join(__dirname, 'photos');
const UA = 'egbay-seed/1.0 (marketplace listing photos; CC0 only)';

// filename -> what to search for. Generic goods only; see the note above.
const GENERIC = {
  'air-fryer-1.jpg': 'air fryer kitchen',
  'washing-machine-1.jpg': 'washing machine laundry',
  'fridge-1.jpg': 'refrigerator kitchen',
  'microwave-1.jpg': 'microwave oven kitchen',
  'robot-vacuum-1.jpg': 'robot vacuum cleaner',
  'espresso-machine-1.jpg': 'espresso coffee machine',
  'leather-jacket-1.jpg': 'leather jacket',
  'handbag-1.jpg': 'handbag purse',
  'hair-dryer-1.jpg': 'hair dryer',
  'hair-straightener-1.jpg': 'hair straightener iron',
  'skincare-set-1.jpg': 'skincare bottles cosmetics',
  'shaver-1.jpg': 'electric shaver razor',
  'dumbbells-1.jpg': 'dumbbell weights gym',
  'treadmill-1.jpg': 'treadmill gym',
  'mountain-bike-1.jpg': 'mountain bike bicycle',
  'yoga-set-1.jpg': 'yoga mat',
  'dashcam-1.jpg': 'dash camera car',
  'car-vacuum-1.jpg': 'vacuum cleaner handheld',
  'phone-holder-1.jpg': 'phone holder car mount',
  'car-battery-1.jpg': 'car battery',
};

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
  return res;
};

(async () => {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const manifestPath = path.join(PHOTO_DIR, 'LICENSES.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

  let got = 0, skipped = 0, failed = 0;
  for (const [filename, query] of Object.entries(GENERIC)) {
    const dest = path.join(PHOTO_DIR, filename);
    if (fs.existsSync(dest)) { console.log(`  keep    ${filename} (already there)`); skipped++; continue; }
    try {
      const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm&page_size=12&mature=false`;
      const { results = [] } = await (await get(api)).json();
      // Widest landscape image wins: listings crop to a square-ish tile.
      const pick = results
        .filter(r => r.url && (r.width ?? 0) >= 800)
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (!pick) { console.log(`  NONE    ${filename} -- no CC0 result for "${query}"`); failed++; continue; }

      const bytes = Buffer.from(await (await get(pick.url)).arrayBuffer());
      fs.writeFileSync(dest, bytes);
      manifest[filename] = {
        query,
        title: pick.title ?? null,
        creator: pick.creator ?? null,
        license: `${pick.license}${pick.license_version ? ' ' + pick.license_version : ''}`,
        source: pick.source ?? null,
        source_url: pick.foreign_landing_url ?? null,
        file_url: pick.url,
        fetched_at: new Date().toISOString(),
      };
      console.log(`  got     ${filename.padEnd(26)} ${pick.width}x${pick.height}  ${pick.license}`);
      got++;
    } catch (e) {
      console.log(`  FAILED  ${filename} -- ${e.message}`);
      failed++;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n${got} fetched, ${skipped} already present, ${failed} unavailable.`);
  console.log(`Provenance written to ${path.relative(process.cwd(), manifestPath)}`);
  console.log('\nBranded items (iPhones, MacBooks, PS5, Switch, Xbox, AirPods, XM5,');
  console.log('Watch, the TV, Air Force 1, Ultraboost) are not fetched and need');
  console.log('photographs of the actual units -- yours, or your supplier\'s with');
  console.log('their permission. Run the dry run to see which are still missing.');
})();
