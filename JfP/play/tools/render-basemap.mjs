// usage: node render-basemap.mjs <basemap-source.svg> <out.png>   (needs playwright + chromium)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2);
const svg = readFileSync(src, 'utf8').replace('width="100%" height="100%"', 'width="2400" height="1200"');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
await page.setContent(`<body style="margin:0">${svg.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '')}</body>`);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 2400, height: 1200 } });
await browser.close();
