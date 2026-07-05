import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = path.dirname(fileURLToPath(import.meta.url));
const design = path.join(root, 'assets', 'design');
const raw = path.join(root, 'assets', '_raw');
await mkdir(raw, { recursive: true });

const SCALE = 3; // supersample, then downscaled to exact size by finalize_assets.py

const targets = [
  { html: 'icon.html',          out: 'icon-store-128.png',        w: 128,  h: 128,  alpha: true },
  { html: 'promo-small.html',   out: 'promo-small-440x280.png',   w: 440,  h: 280,  alpha: false },
  { html: 'promo-marquee.html', out: 'promo-marquee-1400x560.png', w: 1400, h: 560, alpha: false },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: ['--hide-scrollbars', '--font-render-hinting=none'],
});

for (const t of targets) {
  const page = await browser.newPage();
  await page.setViewport({ width: t.w, height: t.h, deviceScaleFactor: SCALE });
  const url = 'file://' + path.join(design, t.html).replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({
    path: path.join(raw, t.out),
    omitBackground: t.alpha,
    clip: { x: 0, y: 0, width: t.w, height: t.h },
  });
  await page.close();
  console.log('rendered', t.out, `@${SCALE}x`);
}

await browser.close();
console.log('done — run: python finalize_assets.py');
