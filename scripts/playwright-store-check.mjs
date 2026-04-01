import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.STORE_URL || 'http://127.0.0.1:3000';
const outDir = path.resolve('artifacts/playwright');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

const checks = [
  { name: 'home', url: '/' },
  { name: 'accesorios', url: '/accessories' },
  { name: 'belleza', url: '/belleza' },
  { name: 'electronica', url: '/electronica' },
  { name: 'hogar', url: '/hogar' },
  { name: 'papeleria', url: '/papeleria' },
  { name: 'ropa', url: '/ropa' }
];

(async () => {
  await ensureDir(outDir);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const results = [];

  for (const c of checks) {
    const url = `${baseURL}${c.url}`;
    try {
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      await shot(page, `${c.name}.png`);
      results.push({ page: c.name, url, status: res?.status() ?? 0, ok: (res?.ok() ?? false) });
    } catch (err) {
      results.push({ page: c.name, url, status: 0, ok: false, error: String(err.message || err) });
    }
  }

  // Quick product card count by category pages
  const categoryCounts = {};
  for (const c of checks.filter(x => x.name !== 'home')) {
    try {
      await page.goto(`${baseURL}${c.url}`, { waitUntil: 'domcontentloaded' });
      const count = await page.locator('a[class*="product"], .product-card, [data-testid="product-item"]').count();
      categoryCounts[c.name] = count;
    } catch {
      categoryCounts[c.name] = -1;
    }
  }

  const report = { baseURL, generatedAt: new Date().toISOString(), results, categoryCounts };
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
})();
