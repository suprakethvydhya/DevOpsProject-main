const { skills } = require('./resume.json');

function findMatchingSkills(jobDescription) {
    const matches = [];

    for (const [canonicalSkill, aliases] of Object.entries(skills)) {

        for (const alias of aliases) {

            const regex = new RegExp(
                `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
                'i'
            );

            if (regex.test(jobDescription)) {
                matches.push({
                    canonical: canonicalSkill,
                    matchedText: alias
                });

                break;
            }
        }
    }

    return matches;
}

module.exports = { findMatchingSkills };