# LinkedIn Recruiter Outreach Automation

Built with Playwright, Axios, Nodemailer, dotenv, PizZip, and Docxtemplater.

The current project automates LinkedIn post searching, intelligent candidate filtering, resume tailoring, and email dispatching for recruiter outreach.

## Features
1. **Multi-Domain & Role Search Presets**: Built-in support for multiple domains (`JAVA`, `WEB`, `QA`, `PYTHON`, `DEVOPS`, `DOTNET`, `MOBILE`, `CUSTOM`).
   - E.g. **Web Development** searches across *Web Developer, PHP Developer, Flutter Developer, Frontend Developer, React Developer, Full Stack Developer*, etc.
   - E.g. **Java Ecosystem** searches across *Java Developer, Java Backend, Java Full Stack, Swing Developer, QA Engineer, Software Tester*, etc.
2. **Multi-Query LinkedIn Search Engine**: Overcomes LinkedIn query complexity limits by partitioning role keywords into concise search queries and running them sequentially until target application count is achieved.
3. **Dynamic Role & Skill Extraction**: Automatically detects exact role titles and extracts technical skills from job posts to dynamically generate tailored `MyResume.docx` resumes.
4. **Email Extraction & API Fallback**: Scrapes emails from post text/mailto links, with SignalHire API key-rotation fallback for profiles.
5. **Smart Filtering**: Configurable experience year limits, industry/domain filters, and post deduplication.
6. **Session Persistence**: Uses Playwright `storageState` (`tests/login.json`) to prevent repeated manual logins.

---

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure `.env`**:
   Create a `.env` file containing:
   ```env
   EMAIL=your_email@gmail.com
   EMAIL_PASS=your_google_app_password
   SIGNALHIRE_KEYS=key1,key2,key3
   ```

3. **Generate LinkedIn Session (One-Time Login)**:
   ```bash
   node tests/login.js
   ```

---

## Domain Configuration

Open [linkedin-auto.spec.js](file:///c:/Users/Vaishak/LinkedIn%20Automation/tests/linkedin-auto.spec.js) and configure `FILTER_CONFIG`:

```javascript
const FILTER_CONFIG = {
    // Select domain preset: 'JAVA' | 'WEB' | 'QA' | 'PYTHON' | 'DEVOPS' | 'DOTNET' | 'MOBILE' | 'CUSTOM'
    // Or combine multiple: ['JAVA', 'QA'] or ['WEB', 'MOBILE']
    activeDomain: 'WEB', // Switch to 'JAVA', 'WEB', 'QA', etc.

    // Number of successful matching applications to send
    targetApplicationsCount: 2,

    // Max posts to inspect per query pass
    maxPostsToInspectPerQuery: 25,

    // Max experience years accepted (rejects posts requiring more years)
    maxExperienceYears: 3,
    enableExperienceFilter: true,

    // Industry / Domain filter toggle
    enableDomainFilter: false,

    // Search query modifiers
    searchModifiers: 'C2C USA -intern -entry -fulltime -w2 -hotlist -bench -sales',

    // LinkedIn date filter: 'past-24h' or 'past-week'
    datePosted: 'past-24h'
};
```

---

## Running the Automation

Run the Playwright test:
```bash
npx playwright test tests/linkedin-auto.spec.js
```
# Docker + Jenkins setup

## One-time
1. Log in to LinkedIn on your own machine: `node tests/login.js` (needs a visible browser,
   so this step can NOT run in Docker/Jenkins). It creates `tests/login.json`.
2. Generate the search query: `node search-keyword-builder.js` -> `tests/search-config.json`.
   The query is global, so run it for the candidate you are about to use.

## Local Docker
    docker compose build
    CANDIDATE=2 docker compose run --rm linkedin-bot      # bash/macOS/Linux
    $env:CANDIDATE=2; docker compose run --rm linkedin-bot   # PowerShell

## Jenkins
Requirements: Jenkins agent with Docker installed and the `jenkins` user in the docker group.
Add the credentials listed at the top of the Jenkinsfile, put the repo (PRIVATE) in Git
with resumes/, candidate_details/ and tests/search-config.json committed, then create a
Pipeline job pointing at the Jenkinsfile. Use "Build with Parameters" to pick the candidate.
---
*DISCLAIMER: This project is for demonstration and research purposes. Use responsibly and in accordance with LinkedIn's Terms of Service.*