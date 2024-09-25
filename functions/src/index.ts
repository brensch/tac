import { onGameStarted } from "./onGameStarted"
import { onMoveCreated } from "./onMoveCreated"
import { onTurnExpirationRequest } from "./onTurnExpirationRequest"
import { onReadyExpirationRequest } from "./onReadyExpirationRequest"
import * as admin from "firebase-admin"

admin.initializeApp()

// Export your functions
export {
  onMoveCreated,
  onGameStarted,
  onTurnExpirationRequest,
  onReadyExpirationRequest,
}
