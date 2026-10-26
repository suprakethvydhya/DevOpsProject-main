const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/login');

  console.log("Login manually and complete any verification.");
  console.log("Press ENTER here after reaching your LinkedIn feed.");

  process.stdin.once('data', async () => {
    await context.storageState({ path: 'tests/login.json' });
    console.log("Storage state saved!");
    await browser.close();
  });
})();