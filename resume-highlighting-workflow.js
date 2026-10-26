const fs = require('fs');
const path = require('path');

const { findMatchingSkills } = require('./jd-skill-matcher');
const { highlightResume } = require('./resume-highlighter');

const rawArg = process.argv[2];

if (!rawArg) {
    throw new Error('No JD data or file path provided.');
}

// Support both direct JSON string or file path
let jdData;
if (fs.existsSync(rawArg)) {
    jdData = JSON.parse(fs.readFileSync(rawArg, 'utf8'));
} else {
    jdData = JSON.parse(rawArg);
}

const jobDescription = jdData.jobDescription || '';
const resumePath = jdData.resumePath || './resumes/Abdul-Safi_Resume.docx';
const outputPath = jdData.outputPath || resumePath.replace(/\.docx$/i, '_highlighted.docx');

console.log('\nFinding skills from JD...\n');

// Match JD skills against resume skill map
const matches = findMatchingSkills(jobDescription);

if (matches.length === 0) {
    console.log('No matching skills found.');
} else {
    for (const match of matches) {
        console.log(
            `${match.matchedText} -> ${match.canonical}`
        );
    }
}

console.log('\nHighlighting resume...\n');

// Highlight matched skills in resume
highlightResume(
    resumePath,
    outputPath,
    matches
);