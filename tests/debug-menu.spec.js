const { test, expect } = require('@playwright/test');

test.use({
    storageState: 'tests/login.json'
});

test('Debug control menu items', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('https://www.linkedin.com/search/results/content/?keywords=JAVA%20DEVELOPER%20C2C%20USA%20-fulltime%20-w2%20-hotlist%20-bench%20-sales&origin=FACETED_SEARCH&datePosted=%5B%22past-24h%22%5D', { waitUntil: 'domcontentloaded' });

    const postSelector = 'div.feed-shared-update-v2, li.reusable-search__result-container, [role="listitem"]';
    await page.waitForSelector(postSelector, { timeout: 15000 });

    const post = page.locator(postSelector).first();
    const menuButton = post.locator('button[aria-label*="control menu" i], button[aria-label*="option" i]').first();

    console.log('Clicking control menu button...');
    await menuButton.click();
    await page.waitForTimeout(1000);

    // Get all options in the open menu
    const menuItems = await page.locator('div[role="menu"] div[role="button"], div[role="menu"] li, .feed-shared-control-menu__content li').evaluateAll(els => {
        return els.map(el => ({
            text: el.innerText.trim(),
            outerHTML: el.outerHTML,
            attributes: Array.from(el.attributes).map(a => ({ name: a.name, value: a.value }))
        }));
    });

    console.log('Found menu items:', JSON.stringify(menuItems, null, 2));
});
