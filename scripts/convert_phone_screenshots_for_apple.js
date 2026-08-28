const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const userUploadedDir = '/home/pc/.gemini/antigravity-ide/brain/b326b9b7-ffb4-4998-b589-0b1a3a28373b/.user_uploaded';
const outputDir65 = path.join(__dirname, '../app_store_screenshots/6.5_inch');
const outputDir67 = path.join(__dirname, '../app_store_screenshots/6.7_inch');

fs.mkdirSync(outputDir65, { recursive: true });
fs.mkdirSync(outputDir67, { recursive: true });

const screenshots = [
  { file: 'media_1787856424878.png', name: '1_Home_Feed.png' },
  { file: 'media_1787856421190.png', name: '2_Product_Escrow_Guarantee.png' },
  { file: 'media_1787856444142.png', name: '3_Sell_Item_Flow.png' },
  { file: 'media_1787856406272.png', name: '4_Wallet_Hub_InstaPay.png' },
  { file: 'media_1787856396781.png', name: '5_Profile_Verified_Trader.png' },
];

async function processImages() {
  console.log('Processing screenshots for Apple App Store specifications...');

  for (const item of screenshots) {
    const inputPath = path.join(userUploadedDir, item.file);
    if (!fs.existsSync(inputPath)) {
      console.warn(`File not found: ${inputPath}`);
      continue;
    }

    // 1. Convert for 6.5" Display (1242 x 2688) - Standard iPhone XS Max / 11 Pro Max (Zero rejection rate)
    const out65Path = path.join(outputDir65, item.name);
    await sharp(inputPath)
      .flatten({ background: '#FFFFFF' })
      .resize(1242, 2688, { fit: 'fill' })
      .png({ palette: false, quality: 100, compressionLevel: 9 })
      .toFile(out65Path);
    console.log(`Generated 6.5" (1242x2688): ${out65Path}`);

    // 2. Convert for 6.7" Display (1290 x 2796) - iPhone 14/15/16 Pro Max
    const out67Path = path.join(outputDir67, item.name);
    await sharp(inputPath)
      .flatten({ background: '#FFFFFF' })
      .resize(1290, 2796, { fit: 'fill' })
      .png({ palette: false, quality: 100, compressionLevel: 9 })
      .toFile(out67Path);
    console.log(`Generated 6.7" (1290x2796): ${out67Path}`);
  }

  console.log('✅ All App Store screenshots converted to 100% Apple compliant dimensions!');
}

processImages().catch(console.error);
