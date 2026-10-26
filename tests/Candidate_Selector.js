const candidates = {
    '1': {
        name: 'Mohammad Abdul Safi',
        resume: './resumes/Abdul-Safi_Resume.docx',
        details: './candidate_details/Abdul-Safi.txt',
        filters: {
            targetApplicationsCount: 5,
            maxPostsToInspect: 30,

            maxExperienceYears: 10,
            enableExperienceFilter: true,

            targetDomains: [
                'IT',
                'Software',
                'Technology',
                'Engineering',
                'Developer',
                'Development',
                'Cloud',
                'DevOps',
                'Backend',
                'Full Stack',
                'Application',
                'Solutions',
                'Java',
                
            ],
            enableDomainFilter: true,

            targetWorkAuth: 'H1B',
            enableWorkAuthFilter: false
        }
    },
    '2': {
        name: 'Vijay Kumar',
        resume: './resumes/Vijay_Resume.docx',
        details: './candidate_details/Vijay.txt',
        filters: {
            targetApplicationsCount: 5,
            maxPostsToInspect: 30,

            maxExperienceYears: 5,
            enableExperienceFilter: true,

            targetDomains: [
                'Networks',
                'AWS',
                'Azure',
                'Security', 
            ],
            enableDomainFilter: true,

            targetWorkAuth: 'F-1 STEM OPT',
            enableWorkAuthFilter: true
        }
        
    },
    '3': {
        name: 'Reju Karkee',
        resume: './resumes/Reju-Karkee_Resume.docx',
        details: './candidate_details/Reju.txt',
        filters: {
            targetApplicationsCount: 5,
            maxPostsToInspect: 30,

            maxExperienceYears: 5,
            enableExperienceFilter: true,

            targetDomains: [
                'Data Engineer',
                'Senior Data Engineer',
                'Analytics',
                'ETL Developer',
                'ETL Engineer',
                'Cloud Data Engineer',
                'Big Data Engineer',
                'Data Platform Engineer',
                'Data Warehouse Engineer',
                'Snowflake Data Engineer',
            ],
            enableDomainFilter: true,

            targetWorkAuth: 'F-1 STEM OPT',
            enableWorkAuthFilter: false
        }
        
    }
};
function selectCandidate() {
    const choice = process.env.CANDIDATE?.trim() || '1';

    console.log('Selected candidate choice:', choice);

    const candidate = candidates[choice];

    if (!candidate) {
        throw new Error(
            `Invalid candidate "${choice}". Use CANDIDATE=1, CANDIDATE=2, or CANDIDATE=3.`
        );
    }

    console.log(`Using candidate: ${candidate.name}`);

    return candidate;
}
module.exports = { selectCandidate };