const { test, expect } = require('@playwright/test');
const axios = require('axios');
const nodemailer = require('nodemailer');
const path = require('path');
const { encodedQuery } = require('./search-config.json');
require('dotenv').config();
const { selectCandidate } = require('./Candidate_Selector');
const resumeData = require('../resume.json');
const skillMap = resumeData.skills || {};
const skills = Object.keys(skillMap);
const roles = resumeData.roles || [];
const { execFileSync } = require('child_process');
const { scoreJob } = require('../score');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
    }
});
const fs = require('fs');
const jdFolder = './job_descriptions';

if (!fs.existsSync(jdFolder)) {
    fs.mkdirSync(jdFolder, { recursive: true });
}
const contactedFile = './contacted.json';

let contacted = {};

if (fs.existsSync(contactedFile)) {
    contacted = JSON.parse(
        fs.readFileSync(contactedFile, 'utf8')
    );
}
/*
const signalHireKeys = (process.env.SIGNALHIRE_KEYS || process.env.API_KEY || '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

let currentKeyIndex = 0;
*/
/*async function fetchEmailFromSignalHire(profileUrl) {
    while (currentKeyIndex < signalHireKeys.length) {
        const apiKey = signalHireKeys[currentKeyIndex];
        try {
            console.log(`Querying SignalHire API (Key #${currentKeyIndex + 1})...`);
            const response = await axios.post(
                'https://www.signalhire.com/api/v1/candidate/search',
                { items: [profileUrl], withoutWaterfall: true },
                { headers: { apikey: apiKey } }
            );
            console.log(
    '[SignalHire] Raw response:',
    JSON.stringify(response.data, null, 2)
);
            const email = response.data?.email ||
                response.data?.[0]?.email ||
                response.data?.candidate?.email;

            if (email) return email;

            console.log(`SignalHire Key #${currentKeyIndex + 1} returned no email. Trying the next key...`);
            currentKeyIndex++;
        } catch (error) {
            const statusCode = error.response?.status;
            // Rotate on quota exhaustion, rate limit, or invalid auth status codes
            if ([401, 402, 403, 429].includes(statusCode)) {
                console.warn(`SignalHire Key #${currentKeyIndex + 1} exhausted/invalid (Status: ${statusCode}). Rotating to Key #${currentKeyIndex + 2}...`);
                currentKeyIndex++;
            } else {
                console.error('SignalHire API error:', error.message);
                break; 
            }
        }
    }
    console.log('All SignalHire API keys have been exhausted or failed.');
    return null;
}*/
 async function fetchEmailFromExplorium(profileUrl) {
    try {
        console.log(`Querying Explorium for ${profileUrl}...`);

        const apiKey = process.env.EXPLORIUM_API_KEY;

        // 1. Match LinkedIn profile → prospect_id
        const matchResponse = await axios.post(
            'https://api.explorium.ai/v1/prospects/match',
            {
                prospects_to_match: [
                    {
                        linkedin: profileUrl
                    }
                ],
                request_context: null
            },
            {
                headers: {
                    'api_key': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const matchedProspect =
            matchResponse.data?.matched_prospects?.[0];

        const prospectId =
            matchedProspect?.prospect_id;

        if (!prospectId) {
            console.log(
                'Explorium could not match this LinkedIn profile.'
            );
            return null;
        }

        console.log(
            `Explorium matched prospect: ${prospectId}`
        );

        // 2. Prospect ID → contact information
        const contactResponse = await axios.post(
            'https://api.explorium.ai/v1/prospects/contacts_information/enrich',
            {
                prospect_id: prospectId
            },
            {
                headers: {
                    'api_key': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = contactResponse.data?.data;

        // Explorium can return multiple email addresses.
        const email =
    data?.professions_email ||
    data?.emails?.find(
        item => item?.type === 'current_professional'
    )?.address ||
    data?.emails?.[0]?.address;

        if (email) {
            console.log(
                `Explorium found email: ${email}`
            );

            return email;
        }

        console.log(
            'Explorium returned no email.'
        );
        console.log(
    '[Explorium Contact Response]',
    JSON.stringify(contactResponse.data, null, 2)
);
        return null;

    } catch (error) {
        console.error(
            'Explorium API error:',
            error.response?.data || error.message
        );

        return null;
    }
}

/*const h1bRegex = /\bh[-\s]?1b\b/i;*/


/**
 * Validates if the post's experience requirement fits within the candidate's target experience limit.
 * @param {string} postText 
 * @param {number} maxYears 
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateExperienceRequirements(postText, maxYears = 10) {
    if (!postText) return { valid: true };

    const lowerText = postText.toLowerCase();

    // 1. Check explicit "X+ years", "X+ yrs", "X+ yr", "X+ yoe", "X+ exp"
    const plusExpRegex =
    /\b(\d+)\s*\+\s*(?:years?|yrs?|yr|yoe|exp|experience)\b/gi;
    let match;
    while ((match = plusExpRegex.exec(lowerText)) !== null) {
        const reqYears = parseInt(match[1], 10);
        if (reqYears > maxYears) {
            return {
                valid: false,
                reason: `Post requires ${reqYears}+ years/exp (exceeds candidate max of ${maxYears} years)`
            };
        }
    }

    // 2. Check range "X-Y years", "X to Y yrs", "X-Y yoe"
    const rangeExpRegex =
    /\b(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?|yr|yoe|exp|experience)\b/gi;
    while ((match = rangeExpRegex.exec(lowerText)) !== null) {
        const maxRequiredYears = parseInt(match[2], 10);
        if (maxRequiredYears > maxYears) {
            return {
                valid: false,
                reason: `Post requires ${match[1]}-${match[2]} years of experience (exceeds candidate max of ${maxYears} years)`
            };
        }
    }

    // 3. Check "X years of experience", "X yrs exp", "X yoe"
    const generalExpRegex =
    /\b(\d+)\s*(?:years?|yrs?|yr|yoe)\s*(?:of\s*)?(?:exp|experience)\b/gi;
    while ((match = generalExpRegex.exec(lowerText)) !== null) {
        const reqYears = parseInt(match[1], 10);
        if (reqYears > maxYears) {
            return {
                valid: false,
                reason: `Post requires ${reqYears} years of experience (exceeds candidate max of ${maxYears} years)`
            };
        }
    }

    // 4. Check "minimum X years", "min X yrs", "at least X years"
    const minExpRegex = /\b(?:at\s+least|minimum|min|req|required)\s*(\d+)\s*(?:years?|yrs?|yr|yoe|exp)?\b/gi;
    while ((match = minExpRegex.exec(lowerText)) !== null) {
        const reqYears = parseInt(match[1], 10);
        if (reqYears > maxYears) {
            return {
                valid: false,
                reason: `Post requires minimum ${reqYears} years of experience (exceeds candidate max of ${maxYears} years)`
            };
        }
    }

    return { valid: true };
}
function validateBlockedWords(postText) {
    if (!postText) return { valid: true };

    const blockedWords = [
        'bench',
        'sales',
        'fulltime',
        'gc',
        'citizen',
        'green card'
    ];

    const lowerText = postText.toLowerCase();

    const matchedWords = blockedWords.filter(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(lowerText);
    });

    if (matchedWords.length > 0) {
        return {
            valid: false,
            reason: `Blocked keyword(s) detected: ${matchedWords.join(', ')}`
        };
    }

    return { valid: true };
}
/**
 * Validates whether the post mentions at least one of the target domains.
 * @param {string} postText 
 * @param {string[]} targetDomains 
 * @returns {{ valid: boolean, matchedDomains?: string[], reason?: string }}
 */
function validateDomainMatch(postText, targetDomains = []) {
    if (!targetDomains || targetDomains.length === 0) return { valid: true, matchedDomains: ['Any'] };

    const lowerText = postText.toLowerCase();
    const matchedDomains = targetDomains.filter(domain => {
        const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(lowerText);
    });

    if (matchedDomains.length === 0) {
        return {
            valid: false,
            reason: `Post does not match any target domains (${targetDomains.join(', ')})`
        };
    }

    return { valid: true, matchedDomains };
}
function validateWorkAuthMatch(postText) {
    if (!postText) return { valid: true };

    const text = postText.toLowerCase();

    // Explicitly restrictive requirements
    const restrictiveRegex = [
        /\b(?:us|u\.s\.)\s*(?:citizen|citizenship)s?\s*only\b/i,
        /\bu\.?s\.?\s*citizens?\s*only\b/i,
        /\bgreen\s*card\s*holders?\s*only\b/i,
        /\bpermanent\s*residents?\s*only\b/i,
        /\bmust\s+be\s+a\s+u\.?s\.?\s+citizen\b/i,
        /\bmust\s+have\s+(?:a\s+)?green\s+card\b/i
    ];

    for (const regex of restrictiveRegex) {
        if (regex.test(text)) {
            return {
                valid: false,
                reason: 'Post has a citizenship/green-card-only requirement'
            };
        }
    }

    // H1B mentioned → good
    if (/\bh[-\s]?1b\b/i.test(text)) {
        return {
            valid: true,
            reason: 'H1B mentioned'
        };
    }

    // No visa information → don't reject
    return {
        valid: true,
        reason: 'No restrictive work-authorization requirement mentioned'
    };
}
function hasHiringHashtag(postText) {
    if (!postText) return false;

    const hashtags = postText.match(/#[a-z0-9_]+/gi) || [];

    const hiringHashtags = new Set([
        '#hiring',
        '#jobopening',
        '#jobopenings',
        '#jobopportunity',
        '#jobopportunities',
        '#hiringnow',
        '#careers',
        '#recruiting',
        '#recruitment',
        'c2c',
    ]);

    return hashtags.some(tag =>
        hiringHashtags.has(tag.toLowerCase())
    );
}
function validateLocationMatch(postText) {
    if (!postText) return { valid: true };

    const text = postText.toLowerCase();

    // Explicit U.S. location signals
    const usLocationRegex =
        /\b(?:united states|u\.s\.a?\.|usa|america|california|texas|florida|new york|new jersey|washington|illinois|massachusetts|virginia|georgia|colorado|arizona|maryland|north carolina|ohio|pennsylvania)\b/i;

    // Obvious non-US locations we don't want
    const nonUsLocationRegex =
        /\b(?:mumbai|indore|delhi|bangalore|bengaluru|hyderabad|pune|chennai|kolkata|ahmedabad|india)\b/i;

    if (nonUsLocationRegex.test(text) && !usLocationRegex.test(text)) {
        return {
            valid: false,
            reason: 'Post appears to target a non-US location'
        };
    }

    if (usLocationRegex.test(text)) {
        return {
            valid: true,
            reason: 'US location detected'
        };
    }

    // No clear location → don't reject
    return {
        valid: true,
        reason: 'No clear location detected'
    };
}
// Helper function to extract email using Regex from text
function extractEmailFromText(text) {
    if (!text) return null;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : null;
}

test.use({
    storageState: 'tests/login.json'
});

test('LinkedIn Search', async ({ page }) => {
    test.setTimeout(180000);
    const context = page.context();
    console.log('Playwright sees CANDIDATE:', process.env.CANDIDATE);
    const selectedCandidate =selectCandidate();
    console.log(`Using candidate: ${selectedCandidate.name}`);
    const FILTER_CONFIG = selectedCandidate.filters;
    const candidateDetails = fs.readFileSync(
    selectedCandidate.details,
    'utf8'
);
    await context.grantPermissions(
        ["clipboard-read", "clipboard-write"],
        { origin: "https://www.linkedin.com" }
    );

    // Open LinkedIn Feed
    await page.goto('https://www.linkedin.com/feed/');
    await expect(page).toHaveURL(/feed/);

    // Build search keywords incorporating target domains into initial LinkedIn search query
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodedQuery}&origin=FACETED_SEARCH&datePosted=%5B%22past-24h%22%5D`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Wait for feed items to load
    const postSelector = 'div.feed-shared-update-v2, [role="listitem"]';
    await page.waitForSelector(postSelector, { timeout: 15000 }).catch(() => {
        console.log('Timeout waiting for initial post list.');
    });

    let successfulApplications = 0;
    let postIndex = 0;
    const appliedPostUrls = new Set();

    console.log(`Starting post processing (Goal: ${FILTER_CONFIG.targetApplicationsCount} matching applications)...`);

    while (successfulApplications < FILTER_CONFIG.targetApplicationsCount && postIndex < FILTER_CONFIG.maxPostsToInspect) {
        let postContainers = page.locator(postSelector);
        let postCount = await postContainers.count();

        if (postCount === 0) {
            console.log('No posts found on the page.');
            return;
        }

        // If we reached the end of currently loaded posts, scroll down to load more!
        if (postIndex >= postCount) {
            console.log(`\nReached end of currently visible posts (${postCount}). Scrolling down to load more...`);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(3000);

            postContainers = page.locator(postSelector);
            const newCount = await postContainers.count();
            if (newCount <= postCount) {
                console.log('No additional posts loaded after scrolling. Exiting search loop.');
                break;
            }
            postCount = newCount;
        }

        console.log(`\n--- Processing Post ${postIndex + 1} (Successful Applications: ${successfulApplications}/${FILTER_CONFIG.targetApplicationsCount}) ---`);
        const post = postContainers.nth(postIndex);
        postIndex++;
        
        let posterName = "";
        let posterUrl = "";
        let email = null;
        let postText = "";

        try {
            postText = await post.innerText({ timeout: 5000 });
        } catch (error) {
            console.log(`Could not get text from post ${postIndex}. Skipping.`);
            continue;
        }

        // 1. Extract email directly from post text if available
        email = extractEmailFromText(postText);
        
        // Extract poster name using regex pattern as fallback
        const nameMatch = postText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:•\s*)?(?:3rd\+)?/);

        // Check if profile link exists
        const profileLink = post.locator('a[href*="/in/"]').first();
        const hasProfile = await profileLink.count() > 0;
        
        if (hasProfile) {
            posterUrl = await profileLink.getAttribute('href') || "";
            
            // Scrape recruiter name directly from profile URL slug and strip any segment with digits
            const urlSlug = posterUrl.split('/in/')[1]?.split('/')[0]?.split('?')[0] || '';
            const scrapedName = urlSlug
                .split('-')
                .filter(part => part && !/\d/.test(part))
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            posterName = scrapedName || (nameMatch ? nameMatch[1].trim() : "Recruiter");
        } else {
            const groupLink = post.locator('a[href*="/groups/"]').first();
            if (await groupLink.count() > 0) {
                posterUrl = await groupLink.getAttribute('href') || "Group Post";
                posterName = nameMatch ? nameMatch[1].trim() : "Group Contributor";
            } else {
                posterName = nameMatch ? nameMatch[1].trim() : "Recruiter";
            }
        }

        if (!posterName) posterName = "Recruiter";
        console.log('Poster name:', posterName);

        const excludedPosters = [
            'Hamza Jabbar'
        ];

        if (excludedPosters.some(
            name => posterName.trim().toLowerCase() === name.toLowerCase()
        )) {
            console.log(`[Poster Filter] Excluded: ${posterName}. Skipping post ${postIndex}.`);
            continue;
        }

        // 2. Get post URL — try 3 methods in order, stop as soon as one works
        let postUrl = "Not available";

        // Method 1: Look for post links directly inside the post container HTML
        try {
            const directLinkSelectors = ['a[href*="/feed/update/"]', 'a[href*="/posts/"]'];
            for (const selector of directLinkSelectors) {
                const linkEl = post.locator(selector).first();
                if (await linkEl.count() > 0) {
                    const href = await linkEl.getAttribute('href');
                    if (href) {
                        const abs = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
                        postUrl = abs.split('?')[0];
                        console.log('Method 1 Success - Found post URL:', postUrl);
                        break;
                    }
                }
            }
        } catch (err) {
            console.log('Method 1 (direct link) failed:', err.message);
        }

        // Method 2: Construct URL from data-urn
        if (postUrl === "Not available") {
            try {
                const urn = await post.getAttribute('data-urn') || await post.getAttribute('data-id');
                if (urn && urn.includes('activity')) {
                    postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`;
                    console.log('Method 2 Success - Constructed post URL:', postUrl);
                }
            } catch (err) {
                console.log('Method 2 (data-urn) failed:', err.message);
            }
        }

        // Method 3: Click 3-dots menu -> "Copy link to post" -> read clipboard
        if (postUrl === "Not available") {
            try {
                // Use case-insensitive matching for "control menu" to match "Open control menu..."
                const threeDotsButton = post.locator('button[aria-label*="control menu" i], button[aria-label*="option" i]').first();

                if (await threeDotsButton.count() > 0) {
                    console.log('Clicking 3-dots menu button...');
                    await threeDotsButton.click();
                    
                    // Look for the "Copy link to post" option globally on the page
                    // Use getByText to target the specific text element instead of matching generic parent divs
                    const copyLinkOption = page.getByText('Copy link to post', { exact: true }).first();

                    // Wait up to 3 seconds for the dropdown option to render and be visible
                    console.log('Waiting for "Copy link to post" option to appear...');
                    await copyLinkOption.waitFor({ state: 'visible', timeout: 3000 });
                    
                    console.log('Clicking "Copy link to post" option...');
                    await copyLinkOption.click();
                    await page.waitForTimeout(1000); // allow clipboard write

                    const clipboardUrl = await page.evaluate(async () => {
                        return await navigator.clipboard.readText();
                    });

                    if (clipboardUrl && clipboardUrl.startsWith('http') &&
                        (clipboardUrl.includes('/posts/') || clipboardUrl.includes('/feed/update/') || clipboardUrl.includes('lnkd.in/'))) {
                        postUrl = clipboardUrl;
                        console.log('Method 3 Success - Copied post URL from clipboard:', postUrl);
                    } else {
                        console.log('Clipboard contents invalid or non-post link:', clipboardUrl);
                        await page.keyboard.press('Escape'); // dismiss menu if still open
                    }
                } else {
                    console.log('3-dots button not found in this post container.');
                }
            } catch (err) {
                console.error('Method 3 (clipboard) failed:', err.message);
                await page.keyboard.press('Escape').catch(() => {}); // safety cleanup
            }
        }

        if (postUrl === "Not available") {
            console.log('Could not determine post URL — all 3 methods failed.');
        } else if (appliedPostUrls.has(postUrl)) {
            console.log(`Already applied to post URL (${postUrl}). Skipping duplicate.`);
            continue;
        }

        // 3. Fallback check: look for mailto links in <a> elements if email wasn't in text
        if (!email) {
    const emailLink = post
        .locator('[data-testid="expandable-text-box"] a[href^="mailto:"]')
        .first();

    if (await emailLink.count()) {
        const href = await emailLink.getAttribute("href");

        if (href) {
            email = href.replace('mailto:', '').split('?')[0].trim();
        }
    }
}

    const removeWords = ["Follow", "Like", "Comment", "Repost", "Send", "Share", "See more", "Feed post", "Feed Post"];

let jobDescription = postText
    .split("\n")
    .filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;

        // 1. Skip line if it equals any remove word or contains "feed post"
        if (removeWords.includes(trimmed)) return false;
        if (/feed\s*post/i.test(trimmed)) return false;

        // Filter out lines containing or matching the poster's name
        if (posterName && posterName !== "Recruiter" && trimmed.toLowerCase().includes(posterName.toLowerCase())) {
            return false;
        }

        // Skip lines with connection degrees (e.g., "3rd+", "1st")
        if (/^(1st|2nd|3rd)\+?$/i.test(trimmed)) return false;

        // Skip standalone timestamp lines (e.g., "14h", "2d", "14h •")
        if (/^\d+\s*(m|min|h|hr|hrs|d|day|days)\s*(•.*)?$/i.test(trimmed)) return false;

        return true;
    })
    .join("\n")
    // 2. Strip inline instances of "Feed post" if embedded within other sentences
    .replace(/feed\s*post/gi, '')
    // Strip inline instances of posterName
    .replace(new RegExp(posterName, 'gi'), '')
    // Strip inline degrees (e.g., " • 3rd+")
    .replace(/•?\s*(1st|2nd|3rd)\+?/gi, '')
    // Strip inline timestamps (e.g., " • 14h", "14h •")
    .replace(/•?\s*\d+\s*(m|min|h|hr|hrs|d|day|days)\b\s*•?/gi, '')
    // Clean up empty line artifacts & stray bullets
    .replace(/^\s*•\s*/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
        // 1. Perform Domain Filter Check
        if (FILTER_CONFIG.enableDomainFilter) {
            const domainCheck = validateDomainMatch(jobDescription, FILTER_CONFIG.targetDomains);
            if (!domainCheck.valid) {
                console.log(`[Domain Filter Skipped] ${domainCheck.reason}. Skipping post ${postIndex}.`);
                continue;
            }
            console.log(`Matched Domain(s): ${domainCheck.matchedDomains.join(', ')}`);
        }

        // 2. Perform Candidate Experience Filter Check
        if (FILTER_CONFIG.enableExperienceFilter) {
            const expCheck = validateExperienceRequirements(jobDescription, FILTER_CONFIG.maxExperienceYears);
            if (!expCheck.valid) {
                console.log(`[Experience Filter Skipped] ${expCheck.reason}. Skipping post ${postIndex}.`);
                continue;
            }
            console.log(`Experience check passed (within ${FILTER_CONFIG.maxExperienceYears} years limit).`);
        }
        // 3. Perform Work Authorization Filter Check
        if (FILTER_CONFIG.enableWorkAuthFilter) {
            const workAuthCheck = validateWorkAuthMatch(
                jobDescription,
                FILTER_CONFIG.targetWorkAuth
            );

            if (!workAuthCheck.valid) {
                console.log(
                    `[Work Auth Filter Skipped] ${workAuthCheck.reason}. Skipping post ${postIndex}.`
                );
                continue;
            }
            console.log(`Work authorization check passed.`);
        }

        // 4. Perform Hiring Hashtag Filter Check
        if (!hasHiringHashtag(postText)) {
            console.log(`[Hiring Filter] No hiring hashtag. Skipping post ${postIndex}.`);
            continue;
        }

        const locationCheck = validateLocationMatch(postText);

        if (!locationCheck.valid) {
            console.log(
                `[Location Filter] ${locationCheck.reason}. Skipping post ${postIndex}.`
            );
            continue;
        }

        const candidateResumePath = selectedCandidate.resume.endsWith('.docx')
            ? selectedCandidate.resume
            : selectedCandidate.resume.replace(/\.[^.]+$/, '.docx');
        const highlightedResumePath = candidateResumePath.replace(/\.docx$/i, '_highlighted.docx');
        const highlightedResumeFilename = path.basename(highlightedResumePath);

        const jdData = {
            jobDescription,
            postUrl,
            posterName,
            posterUrl,
            extractedAt: new Date().toISOString(),
            candidate: selectedCandidate.name,
            resumePath: candidateResumePath,
            outputPath: highlightedResumePath
        };
        console.log('\nRunning resume highlighting workflow...');

        execFileSync(
            'node',
            [
                './resume-highlighting-workflow.js',
                JSON.stringify(jdData)
            ],
            { stdio: 'inherit' }
        );

        console.log('Resume highlighting completed.');
        // Save filtered JD for manual processing
/*const manualJdData = {
    jobDescription,
    postUrl,
    posterName,
    posterUrl,
    extractedAt: new Date().toISOString(),
    candidate: selectedCandidate.name
};

const jdFiles = fs.readdirSync(jdFolder)
    .filter(file => file.endsWith('.json'));

const jdNumber = jdFiles.length + 1;

const jdFilePath = path.join(
    jdFolder,
    `job_${String(jdNumber).padStart(3, '0')}.json`
);

fs.writeFileSync(
    jdFilePath,
    JSON.stringify(manualJdData, null, 2),
    'utf8'
);

console.log(`JD saved: ${jdFilePath}`);
*/
/*
execFileSync(
    'node',
    ['./resume-highlighting-workflow.js',jdFilePath],
    { stdio: 'inherit' }
);

console.log('Resume highlighting completed.');*/

// Llama suitability scoring
const llamaResult = await scoreJob(jobDescription);

if (!llamaResult) {
    console.log('[Llama] Failed to score job. Skipping.');
    continue;
}
console.log(`[Llama] Suitability Score: ${llamaResult.score}%`);

const MIN_LLAMA_SCORE = 70;

if (llamaResult.score < MIN_LLAMA_SCORE) {
    console.log(
        `[Llama Filter] Score ${llamaResult.score}% is below ${MIN_LLAMA_SCORE}%. Skipping post ${postIndex}.`
    );
    continue;
}

console.log(
    `[Llama Filter] Score ${llamaResult.score}% passed. Continuing application pipeline.`
);
        // Detect roles & existing skills
        const lowerText = jobDescription.toLowerCase();
        const foundSkills = skills.filter(skill => lowerText.includes(skill.toLowerCase()));
        const foundRoles = roles.filter(role => lowerText.includes(role.toLowerCase()));
        const role = foundRoles.length > 0 ? foundRoles[0] : 'Java Developer';

        // Extract and dynamically add new technical skills found in the job description
        const commonTechKeywords = [
            'Java', 'Spring', 'Spring Boot', 'Microservices', 'AWS', 'Azure', 'Docker',
            'Kubernetes', 'Kafka', 'React', 'Angular', 'Node.js', 'SQL', 'PostgreSQL',
            'MongoDB', 'REST API', 'GraphQL', 'CI/CD', 'Jenkins', 'Git','.NET','Devops','AI','AI/ML','Data Science','Data Scientist','Data Engineer',
        ];

        commonTechKeywords.forEach(keyword => {
            if (lowerText.includes(keyword.toLowerCase())) {
                if (!foundSkills.some(s => s.toLowerCase() === keyword.toLowerCase())) {
                    foundSkills.push(keyword);
                }
            }
        });

        console.log('Detected Role:', role);
        /*console.log('Combined Skills for Resume:', foundSkills.join(', '));*/

        // 4. Fallback: Explorium API if still no email
        if (!email && hasProfile) {
            const profileUrlForExplorium = posterUrl.startsWith('http')
                ? posterUrl
                : `https://www.linkedin.com${posterUrl}`;
            email = await fetchEmailFromExplorium(profileUrlForExplorium);
        }
       // Dispatch Email//
        
        if (email) {
            console.log(`Sending email application to: ${email}`);
            const applicationId = Math.floor(1000 + Math.random() * 9000);
            const emailBody = `Dear ${posterName},

I hope this email finds you well.

I saw your recent hiring post on LinkedIn regarding a ${role} opportunity and would like to submit my application for this role. I have attached my resume to this email for your review.

Here is a summary of my profile for your quick review:
${candidateDetails}

Below are the details of the post I am applying to:
- LinkedIn Post URL: ${postUrl}

-----------------------------------------
Job Post Description:
${jobDescription}
-----------------------------------------

I would appreciate the chance to discuss how my experience aligns with your requirements. Thank you for your time and consideration.

Best regards,
${selectedCandidate.name}`;

            try {
                await transporter.sendMail({
                    from: process.env.EMAIL,
                    to: email,
                    /*cc: process.env.EMAIL_CC || undefined,
                        bcc: process.env.EMAIL_BCC || undefined,*/
                    subject: `${role} C2C Application - ${selectedCandidate.name}`,
                    text: emailBody,
                    attachments: [{
                        filename: highlightedResumeFilename,
                        path: highlightedResumePath
                    }]
                });
                successfulApplications++;
                if (postUrl !== "Not available") {
                    appliedPostUrls.add(postUrl);
                }
                if (fs.existsSync('./jd.json')) {
                    fs.unlinkSync('./jd.json');
                }

                if (fs.existsSync(highlightedResumePath)) {
                    fs.unlinkSync(highlightedResumePath);
                }

                console.log('Temporary JD and highlighted resume deleted.');
                console.log(`Successfully sent email to ${email} (Progress: ${successfulApplications}/${FILTER_CONFIG.targetApplicationsCount})`);
            } catch (err) {
                console.error(`Failed to send email to ${email}:`, err.message);
            }
        } else {
            console.log('No email found for this post. Skipping.');
        }
    }

    console.log(`\n=== Execution Finished: Sent ${successfulApplications} matching application(s) out of ${FILTER_CONFIG.targetApplicationsCount} target goal. ===`);
});
