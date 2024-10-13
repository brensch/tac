import { Box, Stack } from "@mui/material"
import { Session } from "@shared/types/Game"
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"
import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import EmojiCycler from "../components/EmojiCycler"
import { db } from "../firebaseConfig"

const Sessionpage: React.FC = () => {
  const { sessionName } = useParams<{ sessionName: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    console.log("Setting up session subscription")
    const createAndSubscribeToSession = async () => {
      if (!sessionName) {
        return
      }

      const sessionDocRef = doc(db, "sessions", sessionName)

      try {
        // Perform a transaction to ensure atomicity
        await runTransaction(db, async (transaction) => {
          const sessionSnapshot = await transaction.get(sessionDocRef)

          if (!sessionSnapshot.exists()) {
            // If the session does not exist, create a new one
            const newSession: Session = {
              latestGameID: null,
              timeCreated: serverTimestamp(),
            }

            transaction.set(sessionDocRef, newSession)
          } else {
            console.log("Session already exists.")
          }
        })
      } catch (error) {
        console.log("Error creating session or transaction failed: ", error)
      }

      // Listen to real-time updates for the session document
      const unsubscribe = onSnapshot(sessionDocRef, (docSnapshot) => {
        if (!docSnapshot.exists()) return

        const sessionData = docSnapshot.data() as Session
        setSession(sessionData)
      })

      // Cleanup the subscription on unmount
      return () => unsubscribe()
    }

    createAndSubscribeToSession()
  }, [sessionName]) // Removed currentGameID from dependencies

  if (session?.latestGameID) {
    navigate(`/session/${sessionName}/${session.latestGameID}`)
  }

  if (!session || !sessionName) {
    return (
      <Stack
        spacing={2}
        direction="column"
        alignItems="center"
        justifyContent="center"
        sx={{ height: "100vh" }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh", // Full viewport height
          }}
        >
          <EmojiCycler />
        </Box>
      </Stack>
    )
  }

  return null
}

export default Sessionpage
