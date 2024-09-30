import { onGameStarted } from "./onGameStarted"
import { onMoveCreated } from "./onMoveCreated"
import { onTurnExpirationRequest } from "./onTurnExpirationRequest"
import { onReadyExpirationRequest } from "./onReadyExpirationRequest"
import * as admin from "firebase-admin"

admin.initializeApp()

if (process.env.FIRESTORE_EMULATOR_HOST) {
  const firestore = admin.firestore()
  firestore.settings({
    host: process.env.FIRESTORE_EMULATOR_HOST,
    ssl: false,
  })
}

// Export your functions
export {
  onMoveCreated,
  onGameStarted,
  onTurnExpirationRequest,
  onReadyExpirationRequest,
}
