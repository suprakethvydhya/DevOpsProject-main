const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.use({
    storageState: 'tests/login.json'
});

test('Debug LinkedIn Posts', async ({ page }) => {
    test.setTimeout(60000);
    console.log('Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/search/results/content/?keywords=JAVA%20DEVELOPER%20C2C%20USA%20-fulltime%20-w2%20-hotlist%20-bench%20-sales&origin=FACETED_SEARCH&datePosted=%5B%22past-24h%22%5D', { waitUntil: 'domcontentloaded' });

    // Wait for posts to load
    const postSelector = 'div.feed-shared-update-v2, li.reusable-search__result-container, [role="listitem"]';
    await page.waitForSelector(postSelector, { timeout: 15000 }).catch(() => {
        console.log('Timeout waiting for posts.');
    });

    const posts = page.locator(postSelector);
    const count = await posts.count();
    console.log(`Found ${count} posts`);

    for (let i = 0; i < Math.min(count, 3); i++) {
        console.log(`\n--- Inspecting Post ${i + 1} ---`);
        const post = posts.nth(i);
        
        // Print outer HTML of first 300 chars to see tags
        const outerHTML = await post.evaluate(el => el.outerHTML.substring(0, 1000));
        console.log('Outer HTML (first 1000 chars):\n', outerHTML);

        // Get all attributes
        const attrs = await post.evaluate(el => {
            const result = {};
            for (let attr of el.attributes) {
                result[attr.name] = attr.value;
            }
            return result;
        });
        console.log('Attributes:', JSON.stringify(attrs, null, 2));

        // Get all links inside this post container
        const links = await post.locator('a').evaluateAll(els => {
            return els.map(el => ({
                href: el.getAttribute('href'),
                text: el.innerText.trim(),
                className: el.className
            }));
        });
        console.log('All Links in Post:');
        console.log(JSON.stringify(links, null, 2));
    }

    await page.screenshot({ path: 'tests/debug_screen.png' });
    console.log('Screenshot saved to tests/debug_screen.png');
});
