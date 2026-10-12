/* Optional Node runner for tests/suite.js.
   The app itself has no dependencies and does not need this file -- the suite
   also runs by pasting it into the console. This exists because driving a
   real browser is how the suite is verified automatically.

   Setup (dev machine only):
     npm i playwright-core
     CHROME_PATH="C:\Program Files\Google\Chrome Beta\Application\chrome.exe" node tests/run-suite.js

   Exit code is non-zero when any test fails. */
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe';
const APP = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });

  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await page.addScriptTag({ path: path.join(__dirname, 'suite.js') });

  const results = await page.evaluate(async () => {
    await window.__imsTest();
    return window.__imsLastResults;
  });

  const failed = results.filter(r => r.ok === false);
  failed.forEach(r => console.log('FAIL ' + r.id + '  ' + r.name + '  -> ' + r.msg));
  const skipped = results.filter(r => r.ok === 'skip');
  skipped.forEach(r => console.log('SKIP ' + r.id + '  ' + r.name + '  -> ' + r.msg));
  console.log('failures: ' + failed.length + ' / ' + results.length
    + (errors.length ? '   page errors: ' + [...new Set(errors)].join(' | ') : ''));
  await browser.close();
  if (failed.length || errors.length) process.exitCode = 1;
})();
