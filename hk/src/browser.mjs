import puppeteer from 'puppeteer';

const BLOCKED_RESOURCES = ['image', 'media', 'font', 'stylesheet'];
const BLOCKED_DOMAINS = [
  'google-analytics.com',
  '://google.com',
  'googletagmanager.com',
  'facebook.net',
  'doubleclick.net',
  'hotjar.com',
  'mixpanel.com',
  'datadoghq',
  'segment.io',
];

export async function fetchPageText(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const isTracker = BLOCKED_DOMAINS.some((domain) => req.url().includes(domain));
      const isUnnecessaryAsset = BLOCKED_RESOURCES.includes(req.resourceType());
      if (isTracker || isUnnecessaryAsset) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    try {
      await page.waitForFunction(() => /[₹]|Rs\.?\s?\d/.test(document.body.innerText), { timeout: 4000 });
    } catch {
      // proceed with whatever rendered, price text may already be present
    }

    const renderedText = await page.evaluate(() => document.body.innerText);
    return renderedText.replace(/\s+/g, ' ').trim().slice(0, 35000);
  } finally {
    await browser.close();
  }
}
