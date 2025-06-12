import { CloudTasksClient } from "@google-cloud/tasks"

const client = new CloudTasksClient()

// Get the Project ID from the FIREBASE_CONFIG env var, which is automatically
// populated by the Cloud Functions runtime.
const PROJECT = JSON.parse(process.env.FIREBASE_CONFIG!).projectId

const LOCATION = "us-central1"       // same region as your queue
const QUEUE_ID = "turn-expirations"  // your Cloud Tasks queue

// When running in the emulator, the SERVICE_ACCOUNT_EMAIL is not set.
// We'll fall back to the default App Engine service account email,
// which is what the emulator uses for identity by default.
const SA_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL || `${PROJECT}@appspot.gserviceaccount.com`


// Firestore REST endpoint to create a document with an explicit ID
// (we'll append /sessions/.../expirationRequests?documentId={turnNumber})
const FIRESTORE_BASE =
    `https://firestore.googleapis.com/v1/projects/${PROJECT}` +
    `/databases/(default)/documents`

export async function scheduleTurnExpiration(
    sessionID: string,
    gameID: string,
    turnNumber: number,
    scheduleTime: Date
) {
    // Add a runtime check to ensure environment variables are set.
    // This provides a clearer error message than a downstream crash.
    if (!SA_EMAIL) {
        // This will now only trigger if the fallback also fails, which is unlikely.
        throw new Error("SERVICE_ACCOUNT_EMAIL could not be determined.")
    }

    const parent = client.queuePath(PROJECT, LOCATION, QUEUE_ID)

    console.log("firing expiration request for project:", PROJECT)
    console.log("Using service account:", SA_EMAIL) // Added for easier debugging

    // Build the REST URL:
    // POST https://firestore.googleapis.com/v1/projects/…/documents/sessions/{sessionID}/games/{gameID}/expirationRequests?documentId={turnNumber}
    const url =
        `${FIRESTORE_BASE}/sessions/${sessionID}` +
        `/games/${gameID}/expirationRequests?documentId=${turnNumber}`

    const task = {
        httpRequest: {
            httpMethod: "POST" as const,
            url,
            headers: { "Content-Type": "application/json" },
            // empty body is fine — existence of the doc will fire your onCreate
            body: Buffer.from(JSON.stringify({})).toString("base64"),

            // Tell Cloud Tasks to mint an OAuth2 token from your service account
            oauthToken: {
                serviceAccountEmail: SA_EMAIL,
                scope: "https://www.googleapis.com/auth/datastore", // allows Firestore writes
            },
        },
        scheduleTime: {
            seconds: Math.floor(scheduleTime.getTime() / 1000),
        },
    }

    await client.createTask({ parent, task })
}
