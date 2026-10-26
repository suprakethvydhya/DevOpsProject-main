const { test, expect } = require('@playwright/test');
const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

require('dotenv').config();

const { roles = [], skills = [] } = require('../resume.json');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
    }
});
// Parse all available SignalHire API keys into an array
const signalHireKeys = (process.env.SIGNALHIRE_KEYS || process.env.API_KEY || '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

let currentKeyIndex = 0;

async function fetchEmailFromSignalHire(profileUrl) {
    while (currentKeyIndex < signalHireKeys.length) {
        const apiKey = signalHireKeys[currentKeyIndex];
        try {
            console.log(`Querying SignalHire API (Key #${currentKeyIndex + 1})...`);
            const response = await axios.post(
                'https://www.signalhire.com/api/v1/candidate/search',
                { items: [profileUrl], withoutWaterfall: true },
                { headers: { apikey: apiKey } }
            );

            return response.data?.email || 
                   response.data?.[0]?.email || 
                   response.data?.candidate?.email || 
                   null;
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
}

const candidate = {
    fullName: 'Vaishak Upadhyaya',
    email: 'testmailauto6096@gmail.com',
    phone: '741 6350328',
    linkedin: 'https://www.linkedin.com/in/vaishak-upadhyaya-771596420/',
    location: 'Hyd, TG 500068',
    relocation: 'Yes',
    workAuthorization: 'STEM OPT',
    availability: 'Immediate',
    experience: '7+ Years',
    expectedSalary: 'C2C only (discuss with employer)'
};

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

    await context.grantPermissions(
        ["clipboard-read", "clipboard-write"],
        { origin: "https://www.linkedin.com" }
    );

    // Open LinkedIn Feed
    await page.goto('https://www.linkedin.com/feed/');
    await expect(page).toHaveURL(/feed/);
// Example: Searching for Senior Java Roles in Healthcare or Fintech, excluding Entry-Level/Internships
    const searchKeywords = encodeURIComponent(
        '("Java Developer" OR "Java Engineer") ' + 
        '("Healthcare" OR "Fintech" OR "Banking") ' + // Domain filters
        '("Senior" OR "Lead" OR "5+ years") ' +        // Experience filters
        'C2C USA -intern -entry -fulltime -w2 -hotlist -bench -sales'
    );

    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${searchKeywords}&origin=FACETED_SEARCH&datePosted=%5B%22past-24h%22%5D`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    // Wait for feed items to load
    const postSelector = 'div.feed-shared-update-v2, [role="listitem"]';
    await page.waitForSelector(postSelector, { timeout: 15000 }).catch(() => {
        console.log('Timeout waiting for initial post list.');
    });

    // Find post containers
    const postContainers = page.locator(postSelector);
    const postCount = await postContainers.count();

    if (postCount === 0) {
        console.log('No posts found on the page.');
        return;
    }

    console.log(`Found ${postCount} posts`);

    // Process each post (limit to first 2)
    for (let i = 0; i < Math.min(postCount, 2); i++) {
        console.log(`\n--- Processing Post ${i + 1} ---`);
        const post = postContainers.nth(i);
        
        let posterName = "";
        let posterUrl = "";
        let email = null;
        let postText = "";

        try {
            postText = await post.innerText({ timeout: 5000 });
        } catch (error) {
            console.log(`Could not get text from post ${i + 1}. Skipping.`);
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
        }

        // 3. Fallback check: look for mailto links in <a> elements if email wasn't in text
        if (!email) {
            const allLinks = post.locator("a");
            const count = await allLinks.count();
            for (let j = 0; j < count; j++) {
                const href = await allLinks.nth(j).getAttribute("href");
                if (href && href.startsWith('mailto:')) {
                    email = href.replace('mailto:', '').split('?')[0].trim();
                    break;
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
        console.log('Combined Skills for Resume:', foundSkills.join(', '));

        // Generate tailored resume docx (using raw Buffer)
        try {
            const resumePath = path.resolve(__dirname, '../Resume.docx');
            if (fs.existsSync(resumePath)) {
                const content = fs.readFileSync(resumePath);
                const zip = new PizZip(content);
                const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
                
                doc.render({
                    roles: foundRoles.join(', '),
                    skills: foundSkills.join(', ')
                });

                const buffer = doc.getZip().generate({ type: 'nodebuffer' });
                fs.writeFileSync('./MyResume.docx', buffer);
                console.log('Tailored resume generated: MyResume.docx');
            }
        } catch (docErr) {
            console.error('Error generating docx:', docErr.message);
        }

        // 4. Fallback: SignalHire API if still no email
    // 4. Fallback: SignalHire API if still no email
       // 4. Fallback: SignalHire API if still no email
        if (!email && hasProfile) {
            const profileUrlForSignal = await profileLink.getAttribute('href');
            email = await fetchEmailFromSignalHire(profileUrlForSignal);
        }
        // Dispatch Email
        if (email) {
            console.log(`Sending email application to: ${email}`);
            const emailBody = `Dear ${posterName},

I hope this email finds you well.

I saw your recent hiring post on LinkedIn regarding a ${role} opportunity and would like to submit my application for this role. I have attached my resume to this email for your review.

Here is a summary of my profile for your quick review:
- Candidate Full Name: ${candidate.fullName}
- Email Address: ${candidate.email}
- Phone Number: ${candidate.phone}
- LinkedIn Profile: ${candidate.linkedin}
- Current Location: ${candidate.location}
- Relocation Status: ${candidate.relocation}
- Work Authorization: ${candidate.workAuthorization}
- Availability: ${candidate.availability}
- Total Experience: ${candidate.experience}
- Expected Salary: ${candidate.expectedSalary}

Below are the details of the post I am applying to:
- LinkedIn Post URL: ${postUrl}

-----------------------------------------
Job Post Description:
${jobDescription}
-----------------------------------------

I would appreciate the chance to discuss how my experience aligns with your requirements. Thank you for your time and consideration.

Best regards,
${candidate.fullName}`;

            try {
                await transporter.sendMail({
                    from: process.env.EMAIL,
                    to: email,
                    subject: `${role} C2C Application - ${candidate.fullName}`,
                    text: emailBody,
                    attachments: [{
                        filename: 'Resume.docx',
                        path: './MyResume.docx'
                    }]
                });
                console.log(`Successfully sent email to ${email}`);
            } catch (err) {
                console.error(`Failed to send email to ${email}:`, err.message);
            }
        } else {
            console.log('No email found for this post. Skipping.');
        }
    }
});