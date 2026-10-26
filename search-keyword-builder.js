#!/usr/bin/env node
/**
 * search-keyword-builder.js
 *
 * Replaces hardcoded OR-chain search strings with a profile map + CLI picker.
 * Select a profile interactively, and the built search string (raw + encoded)
 * is saved to search-config.json for the search tab / scraper to read.
 *
 * Run: node search-keyword-builder.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

console.log("Here the first 12 are for Abdul Safi and next are for Vijay. Select accordingly.");
// ---- 1. Profile definitions (edit/add profiles here, not in code logic) ----
const PROFILES = { 
  1: {
    label: 'Java Full Stack Developer',
    titles: ['Java Full Stack Developer'],
    domainTerms: [],
  },
  2: {
    label: 'Senior Java Developer',
    titles: [ 'Java Developer'],
    domainTerms: [],
  },
  3: {
    label: 'Java Backend / Microservices',
    titles: ['Java Backend Developer'],
    domainTerms: [],
  },
  4: {
    label: 'Java + React Full Stack',
    titles: ['Java React Developer'],
    domainTerms: [],
  },
  5: {
    label: 'Senior Software Engineer',
    titles: ['Software Engineer'],
    domainTerms: [],
  },
  6: {
    label: 'Backend / Microservices',
    titles: ['Backend Microservices Developer'],
    domainTerms: [],
  },
  7:{
    label: 'Cloud Developer',
    titles: ['Cloud Application Developer'],
    domainTerms: [],
  },
  8:{
    label: 'API Developer',
    titles: ['API Developer'],
    domainTerms: [],
  },
  9:{
    label: 'Microservices Developer',
    titles: ['Microservices Developer'],
    domainTerms: [],
  },
  10:{
    label: 'React Developer',
    titles: ['React Developer'],
    domainTerms: [],
  },
  11:{
    label: 'Frontend Developer',
    titles: ['Frontend-React Developer'],
    domainTerms: [],
  },
  12:{
    label: 'Full Stack Developer',
    titles: ['Full Stack Developer'],
    domainTerms: [],
  },
  13:{
    label: 'Senior Network Engineer',
    titles: ['Senior Network Engineer'],
  },
  14:{
    label: 'Cloud Network Engineer',
    titles: ['Cloud Network Engineer'],
  },
  15:{
    label: 'Network Systems Engineer',
    titles: ['Network Systems Engineer'],
  },
  16:{
    label: 'Network Automation Engineer',
    titles: ['Network Automation Engineer'],
  },
  17:{
    label: 'Enterprise Network Engineer',
    titles: ['Enterprise Network Engineer'],
  },
  18:{
    label: 'Network Security Engineer',
    titles: ['Network Security Engineer'],
  },
  19:{
    label: 'Network Engineer',
    titles: ['Network Engineer'],
  },
  20:{
    label: 'Firewall/Security Engineer',
    titles: ['Firewall Engineer'],
  },
  21:{
  label: 'Data Engineer',
    titles: ['Data Engineer'],
  },
  22:{
  label: 'Senior Data Engineer',
    titles: ['Senior Data Engineer'],
  },
  23:{
  label: 'ETL Engineer',
    titles: ['ETL Engineer'],
  },
  24:{
  label: 'ETL Developer',
    titles: ['ETL Developer'],
  },
  25:{
    label: 'Data Analytics',
    titles: ['Analytics'],
  },
  26:{
  label: 'Cloud Data Engineer',
    titles: ['Cloud Data Engineer'],
  },
  27:{
  label: 'Big Data Engineer',
    titles: ['Big Data Engineer'],
  },
  28:{
  label: 'Data Warehouse Engineer',
    titles: ['Data Warehouse Engineer'],
  },
  29:{
  label: 'Data Platform Engineer',
    titles: ['Data Platform Engineer'],
  },
  30:{
  label: 'Snowflake Data Engineer',
    titles: ['Snowflake Data Engineer'],
  },
};

// Terms common to every C2C search — kept separate so they're not duplicated per profile
const COMMON_FILTER = '-intern -entry -fulltime -w2 -hotlist -bench -sales -consultants';

// ---- 2. Build the search string for a chosen profile ----
function buildSearchString(profile) {
  const title = profile.titles?.[0] || '';
  const domain = profile.domainTerms?.[0] || '';

  const raw = [title, domain, COMMON_FILTER]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    raw,
    encoded: encodeURIComponent(raw),
  };
}
// ---- 3. CLI prompt ----
function promptProfile() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\nSelect a search profile:\n');
  Object.entries(PROFILES).forEach(([key, p]) => {
    console.log(`  ${key}) ${p.label}`);
  });

  rl.question('\nEnter number: ', (answer) => {
    const profile = PROFILES[answer.trim()];
    if (!profile) {
      console.error('Invalid selection. Please rerun and pick a listed number.');
      rl.close();
      process.exit(1);
    }

    const { raw, encoded } = buildSearchString(profile);
    const configPath = path.join(__dirname, 'search-config.json');
    const config = {
      profile: profile.label,
      rawQuery: raw,
      encodedQuery: encoded,
      generatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`\nProfile: ${profile.label}`);
    console.log(`Raw query:\n  ${raw}`);
    console.log(`\nSaved to: ${configPath}`);
    console.log('The search tab script can now read searchConfig.encodedQuery from this file.\n');

    rl.close();
  });
}

// ---- 4. How the search tab consumes it ----
// In your search-tab script, instead of rebuilding the string:
//
//   const { encodedQuery } = require('./search-config.json');
//   const searchUrl = `https://www.dice.com/jobs?q=${encodedQuery}`;
//
// This keeps profile selection and query-building in one place, and the
// search tab just consumes the saved result — no duplicated OR logic.

promptProfile();
