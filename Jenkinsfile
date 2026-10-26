pipeline {
    agent any   // needs Docker on the agent

    options {
        disableConcurrentBuilds()          // never run two outreach jobs at once
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    // Optional schedule (weekdays ~9am). Remove if you only want manual runs.
    triggers { cron('H 9 * * 1-5') }

    parameters {
        choice(name: 'CANDIDATE', choices: ['1', '2', '3'],
               description: '1 = Abdul Safi, 2 = Vijay Kumar, 3 = Reju Karkee')
        booleanParam(name: 'REBUILD_IMAGE', defaultValue: false,
                     description: 'Force rebuild of the Docker image')
    }

    environment {
        IMAGE = 'linkedin-automation:latest'
        STATE_VOLUME = 'linkedin-state'    // holds contacted.json between builds
    }

    stages {
        stage('Build image') {
            steps {
                sh '''
                    if [ "$REBUILD_IMAGE" = "true" ] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
                        docker build -t "$IMAGE" .
                    fi
                '''
            }
        }

        stage('Run outreach') {
            steps {
                // Credentials to create in Jenkins (Manage Jenkins > Credentials):
                //   linkedin-login-json  (Secret file)  -> tests/login.json
                //   gmail-address        (Secret text)
                //   gmail-app-password   (Secret text)
                //   explorium-api-key    (Secret text)
                withCredentials([
                    file(credentialsId: 'linkedin-login-json', variable: 'LOGIN_JSON'),
                    string(credentialsId: 'gmail-address',      variable: 'EMAIL'),
                    string(credentialsId: 'gmail-app-password', variable: 'EMAIL_PASS'),
                    string(credentialsId: 'explorium-api-key',  variable: 'EXPLORIUM_API_KEY')
                ]) {
                    // Single-quoted so Groovy never interpolates secrets into the log
                    sh '''
                        docker run --rm --init --ipc=host \
                          -e CANDIDATE="$CANDIDATE" \
                          -e EMAIL -e EMAIL_PASS -e EXPLORIUM_API_KEY \
                          -v "$LOGIN_JSON":/app/tests/login.json:ro \
                          -v "$WORKSPACE/tests/search-config.json":/app/tests/search-config.json:ro \
                          -v "$WORKSPACE/candidate_details":/app/candidate_details:ro \
                          -v "$WORKSPACE/resumes":/app/resumes \
                          -v "$STATE_VOLUME":/state \
                          "$IMAGE"
                    '''
                }
            }
        }
    }

    post {
        always {
            // Remove any highlighted resumes left behind by failed sends
            sh 'rm -f resumes/*_highlighted.docx || true'
            archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
        }
    }
}
