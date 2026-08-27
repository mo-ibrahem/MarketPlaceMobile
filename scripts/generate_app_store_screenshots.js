const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.join(__dirname, '../app_store_screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Launching Chrome for App Store screenshot capture...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: {
      width: 414,
      height: 896,
      deviceScaleFactor: 3, // Produces 1242 x 2688 (Official Apple 6.5" Display spec)
      isMobile: true,
      hasTouch: true,
    },
  });

  const page = await browser.newPage();

  // Helper to wait
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    // 1. Home Screen
    console.log('1. Capturing Home Screen...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle0', timeout: 30000 });
    await wait(3000);
    await page.screenshot({ path: path.join(outputDir, '1_Home_Feed.png') });

    // 2. Product Detail & Escrow Guarantee
    console.log('2. Capturing Product Screen with Escrow Guarantee...');
    const productLinks = await page.$$('a[href*="/products/"]');
    if (productLinks.length > 0) {
      await productLinks[0].click();
      await wait(3000);
      await page.screenshot({ path: path.join(outputDir, '2_Product_Escrow.png') });
    } else {
      await page.goto('http://localhost:8081/products/1', { waitUntil: 'networkidle0' });
      await wait(3000);
      await page.screenshot({ path: path.join(outputDir, '2_Product_Escrow.png') });
    }

    // 3. Wallet Screen
    console.log('3. Capturing Wallet Screen...');
    await page.goto('http://localhost:8081/wallet', { waitUntil: 'networkidle0' });
    await wait(3000);
    await page.screenshot({ path: path.join(outputDir, '3_Wallet_Escrow_Hub.png') });

    // 4. Checkout Screen
    console.log('4. Capturing Checkout Screen...');
    await page.goto('http://localhost:8081/checkout?productId=1', { waitUntil: 'networkidle0' });
    await wait(3000);
    await page.screenshot({ path: path.join(outputDir, '4_Split_Checkout.png') });

    console.log('✅ All 4 App Store screenshots captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
