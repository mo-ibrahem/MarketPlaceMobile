const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputDir = path.join(__dirname, '../app_store_screenshots/6.5_inch');
const outputDir = path.join(__dirname, '../app_store_screenshots/ipad_13_inch');

fs.mkdirSync(outputDir, { recursive: true });

async function generateIPadScreenshots() {
  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.png'));
  console.log('Generating iPad 13" screenshots from:', files);

  for (const f of files) {
    const inputPath = path.join(inputDir, f);
    const outputPath = path.join(outputDir, f);

    // iPad Pro 13" / 12.9" native spec: 2048 x 2732 px (3:4 ratio)
    await sharp(inputPath)
      .flatten({ background: '#FFFFFF' })
      .resize(2048, 2732, { fit: 'contain', background: '#F8FAFC' })
      .png({ palette: false, quality: 100, compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`Generated iPad 13" (2048x2732): ${outputPath}`);
  }
  console.log('✅ All 5 iPad screenshots generated successfully!');
}

generateIPadScreenshots().catch(console.error);
