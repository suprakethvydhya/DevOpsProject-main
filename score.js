const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function scoreJob(extractedJobDescription, candidateCoverLetterPath) {
    try {
        const { default: ollama } = await import('ollama');

        // Read the cover letter used for LLM scoring
        console.log('__dirname:', __dirname);
        const coverLetterPath = path.resolve(
            __dirname,
            candidateCoverLetterPath || './resumes/safi-cover-letter.docx'
        );
        console.log('Cover letter path:', coverLetterPath);

        const docxBuffer = fs.readFileSync(coverLetterPath);

        const docxResult = await mammoth.extractRawText({
            buffer: docxBuffer
        });

        const candidateProfile = docxResult.value.trim();

        console.log(
            `[Resume] ${candidateProfile.length} characters`
        );

        console.log(
            `[JD] ${extractedJobDescription.length} characters`
        );

        const prompt = `
You are an expert technical recruiter.

Evaluate how well the candidate matches the job description.

CANDIDATE PROFILE:
${candidateProfile}

JOB DESCRIPTION:
${extractedJobDescription}

Scoring criteria:
- Core technical skills match: 50 points
- Relevant experience match: 30 points
- Role/title match: 10 points
- Other relevant requirements: 10 points

Calculate a final score from 0 to 100.

Important:
- Do not invent candidate experience.
- Do not assume a skill exists unless supported by the candidate profile.
- Penalize missing mandatory requirements.
- A different role should receive a low score even if some technical skills overlap.
- Return ONLY valid JSON.

Required format:
{
    "score": 0
}
`;

        console.log(
            `[Total prompt estimate] ${
                candidateProfile.length +
                extractedJobDescription.length
            } characters`
        );

        console.log(
            `[Llama] Prompt size: ${prompt.length} characters`
        );

        console.log('[Llama] Scoring...');

        console.time('[Llama] Request');

        const response = await ollama.chat({
            model: 'llama3.2',

            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],

            format: {
                type: 'object',
                properties: {
                    score: {
                        type: 'number'
                    }
                },
                required: ['score']
            },

            options: {
                temperature: 0,
                num_predict: 10
            }
        });

        console.timeEnd('[Llama] Request');

        console.log('\n===== LLAMA RESPONSE =====');
        console.log(response.message.content);

        const result = JSON.parse(response.message.content);

        if (typeof result.score !== 'number') {
            throw new Error(
                'Llama returned an invalid score.'
            );
        }

        const score = Math.max(
            0,
            Math.min(100, result.score)
        );

        console.log('\n===== RESULT =====');
        console.log(`Score: ${score}`);

        // Performance diagnostics
        if (response.prompt_eval_count !== undefined) {
            console.log({
                promptTokens: response.prompt_eval_count,
                promptEvalSeconds:
                    response.prompt_eval_duration / 1e9,
                outputTokens: response.eval_count,
                outputEvalSeconds:
                    response.eval_duration / 1e9
            });
        }

        return {
            score
        };

    } catch (error) {
        console.error(
            'Llama scoring error:',
            error.message
        );

        return null;
    }
}

module.exports = {
    scoreJob
};