const fs = require('fs');
const AdmZip = require('adm-zip');
const { skills } = require('./resume.json');


function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function highlightResume(inputPath, outputPath, matchedSkills) {

    const zip = new AdmZip(inputPath);

    const documentEntry = zip.getEntry('word/document.xml');

    if (!documentEntry) {
        throw new Error('Could not find word/document.xml inside DOCX');
    }

    let xml = documentEntry.getData().toString('utf8');

    let highlightedCount = 0;


    /*
     * matchedSkills comes from jd-skill-matcher.js.
     *
     * Example:
     * {
     *   canonical: "Spring Boot",
     *   matchedText: "SpringBoot"
     * }
     *
     * We then get ALL aliases for "Spring Boot"
     * and search for those aliases in the resume.
     */

    for (const match of matchedSkills) {

        const aliases = skills[match.canonical];

        if (!aliases) {
            continue;
        }

        for (const alias of aliases) {

            const escapedAlias = escapeRegex(alias);

            /*
             * Find a <w:r> containing a <w:t> with the skill.
             */
            const runRegex = new RegExp(
                `<w:r(\\s[^>]*)?>([\\s\\S]*?)</w:r>`,
                'gi'
            );

            xml = xml.replace(runRegex, (fullRun, runAttributes = '', runContent) => {

                const textRegex = new RegExp(
                    `(<w:t(?:\\s[^>]*)?>)([\\s\\S]*?)(${escapedAlias})([\\s\\S]*?)(</w:t>)`,
                    'i'
                );

                if (!textRegex.test(runContent)) {
                    return fullRun;
                }

                /*
                 * Only process the first matching text node
                 * in this run.
                 */
                return splitAndHighlightRun(
                    runAttributes || '',
                    runContent,
                    alias,
                    textRegex,
                    () => highlightedCount++
                );
            });
        }
    }


    zip.updateFile(
        'word/document.xml',
        Buffer.from(xml, 'utf8')
    );

    zip.writeZip(outputPath);

    console.log(`Highlighted ${highlightedCount} occurrence(s).`);
    console.log(`Saved to:\n${outputPath}`);
}


function splitAndHighlightRun(
    runAttributes,
    runContent,
    alias,
    textRegex,
    incrementCount
) {

    const match = runContent.match(textRegex);

    if (!match) {
        return `<w:r${runAttributes}>${runContent}</w:r>`;
    }

    const textOpen = match[1];
    const before = match[2];
    const matched = match[3];
    const after = match[4];
    const textClose = match[5];


    /*
     * Preserve the original run properties.
     *
     * Example:
     *
     * <w:r>
     *   <w:rPr>...</w:rPr>
     *   <w:t>Java</w:t>
     * </w:r>
     *
     * becomes three runs:
     *
     * normal text
     * highlighted text
     * normal text
     */

    const rPrMatch = runContent.match(
        /<w:rPr[\s\S]*?<\/w:rPr>/i
    );

    const rPr = rPrMatch ? rPrMatch[0] : '';


    let result = '';


    if (before) {
        result +=
            `<w:r${runAttributes}>` +
            rPr +
            textOpen +
            before +
            textClose +
            `</w:r>`;
    }
        result +=
    `<w:r${runAttributes}>` +
    createHighlightedRPr(rPr) +
    textOpen +
    matched +
    textClose +
    `</w:r>`;


    if (after) {
        result +=
            `<w:r${runAttributes}>` +
            rPr +
            textOpen +
            after +
            textClose +
            `</w:r>`;
    }


    incrementCount();

    return result;
}
function createHighlightedRPr(originalRPr) {

    if (!originalRPr) {
        return `<w:rPr><w:highlight w:val="yellow"/></w:rPr>`;
    }

    return originalRPr.replace(
        /<\/w:rPr>/i,
        `<w:highlight w:val="yellow"/></w:rPr>`
    );
}

module.exports = { highlightResume };