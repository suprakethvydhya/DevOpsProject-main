# LinkedIn Recruiter Outreach Automation

Built with Playwright, Axios, Nodemailer, dotenv, PizZip, and Docxtemplater.

This project automates LinkedIn post searching, candidate filtering, resume tailoring, and email dispatching for recruiter outreach.

## Features

1. **Multi-Domain & Role Search Presets:** Supports JAVA, WEB, QA, PYTHON, DEVOPS, DOTNET, MOBILE, and CUSTOM domains.

2. **Multi-Query LinkedIn Search Engine:** Splits role keywords into smaller search queries and runs them sequentially until the target application count is reached.

3. **Dynamic Role & Skill Extraction:** Detects role titles and extracts technical skills from job posts to generate tailored resumes using `MyResume.docx`.

4. **Email Extraction & API Fallback:** Extracts emails from post text and mailto links, with SignalHire API fallback for profiles.

5. **Smart Filtering:** Supports configurable experience limits, domain filters, and duplicate-post prevention.

6. **Session Persistence:** Uses Playwright `storageState` (`tests/login.json`) to reduce repeated manual logins.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```env
EMAIL=your_email@gmail.com
EMAIL_PASS=your_google_app_password
SIGNALHIRE_KEYS=key1,key2,key3
```

Keep your `.env` file private. Never commit passwords or API keys to GitHub.

### 3. Generate a LinkedIn session

```bash
node tests/login.js
```

Complete the login in the browser.

## Domain Configuration

Open `tests/linkedin-auto.spec.js` and configure `FILTER_CONFIG`:

```javascript
const FILTER_CONFIG = {
    activeDomain: 'WEB',
    targetApplicationsCount: 2,
    maxPostsToInspectPerQuery: 25,
    maxExperienceYears: 3,
    enableExperienceFilter: true,
    enableDomainFilter: false,
    searchModifiers: 'C2C USA -intern -entry -fulltime -w2 -hotlist -bench -sales',
    datePosted: 'past-24h'
};
```

Available domain presets include `JAVA`, `WEB`, `QA`, `PYTHON`, `DEVOPS`, `DOTNET`, `MOBILE`, and `CUSTOM`.

You can also combine presets, for example:

```javascript
activeDomain: ['JAVA', 'QA']
```

## Running the Automation

Run the Playwright test:

```bash
npx playwright test tests/linkedin-auto.spec.js
```

## Docker and Jenkins Setup

### One-time setup

1. Log in to LinkedIn on your own machine:

   ```bash
   node tests/login.js
   ```

   This creates `tests/login.json`. The interactive login step requires a visible browser.

2. Generate the search configuration:

   ```bash
   node search-keyword-builder.js
   ```

   This generates `tests/search-config.json`.

### Local Docker

Build the image:

```bash
docker compose build
```

Run the automation on macOS/Linux:

```bash
CANDIDATE=2 docker compose run --rm linkedin-bot
```

Run it in PowerShell:

```powershell
$env:CANDIDATE=2; docker compose run --rm linkedin-bot
```

### Jenkins

Requirements:

* A Jenkins agent with Docker installed.
* The Jenkins user must have the necessary Docker permissions.
* Configure the required credentials in Jenkins.
* Configure the pipeline to use the repository's `Jenkinsfile`.
* Use **Build with Parameters** to select the candidate.

Review your repository and Jenkins configuration to ensure sensitive credentials and personal data are not committed.

## Disclaimer

This project is intended for demonstration and research purposes. Use responsibly and comply with LinkedIn's Terms of Service and applicable privacy requirements.
