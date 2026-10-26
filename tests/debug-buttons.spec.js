const { test, expect } = require('@playwright/test');

test.use({
    storageState: 'tests/login.json'
});

test('Find buttons and text', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('https://www.linkedin.com/search/results/content/?keywords=JAVA%20DEVELOPER%20C2C%20USA%20-fulltime%20-w2%20-hotlist%20-bench%20-sales&origin=FACETED_SEARCH&datePosted=%5B%22past-24h%22%5D', { waitUntil: 'domcontentloaded' });

    const postSelector = 'div.feed-shared-update-v2, li.reusable-search__result-container, [role="listitem"]';
    await page.waitForSelector(postSelector, { timeout: 15000 });

    const post = page.locator(postSelector).first();

    // 1. Get all buttons inside this first post
    const buttons = await post.locator('button').evaluateAll(els => {
        return els.map(el => ({
            text: el.innerText.trim(),
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className
        }));
    });
    console.log('Buttons inside first post:', JSON.stringify(buttons, null, 2));

    // 2. Let's look at the menu trigger specifically
    const menuButtons = await post.locator('button[aria-label*="option" i], button[aria-label*="control" i], button[aria-label*="more" i], button[aria-label*="menu" i]').evaluateAll(els => {
        return els.map(el => ({
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className
        }));
    });
    console.log('Potential menu buttons:', JSON.stringify(menuButtons, null, 2));
});
