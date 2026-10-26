# Playwright image version must match @playwright/test in package.json (1.61.1)
FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Code only. Secrets and personal data (resumes, candidate_details, login.json,
# search-config.json, contacted.json) are mounted at runtime, never baked in.
COPY playwright.config.js resume.json score.js jd-skill-matcher.js \
     resume-highlighter.js resume-highlighting-workflow.js ./
COPY tests/linkedin-auto.spec.js tests/Candidate_Selector.js ./tests/

ENV CI=true \
    CONTACTED_FILE=/state/contacted.json

# Chromium only, single worker: avoids the 3x duplicate-email problem
ENTRYPOINT ["npx", "playwright", "test", "tests/linkedin-auto.spec.js", "--project=chromium", "--workers=1"]
