import React, { useEffect, useState } from "react"
import { Box, Stack, Typography } from "@mui/material"
import { useNavigate, useParams } from "react-router-dom"
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { GameState, Session } from "@shared/types/Game"
import GamePage from "./GamePage"

const Sessionpage: React.FC = () => {
  const { sessionName } = useParams<{ sessionName: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const createAndSubscribeToSession = async () => {
      if (!sessionName) {
        setErrorMessage("Invalid session name.")
        return
      }

      const sessionDocRef = doc(db, "sessions", sessionName)

      try {
        // Attempt to create the session document if it doesn't exist
        const newSession: Session = {
          latestGameID: null,
          timeCreated: serverTimestamp(),
        }

        await setDoc(sessionDocRef, newSession, { merge: true })
      } catch (error) {
        // If there's an error creating the session, just log it and continue
        console.log("Error creating session or session already exists: ", error)
      }

      // Listen to real-time updates for the session document
      const unsubscribe = onSnapshot(sessionDocRef, (docSnapshot) => {
        if (!docSnapshot.exists()) return

        console.log("Session data:", docSnapshot.data())
        setSession(docSnapshot.data() as Session)
        // Handle session updates (e.g., update state or navigate)
      })

      // Cleanup the subscription on unmount
      return () => unsubscribe()
    }

    createAndSubscribeToSession()
  }, [navigate, sessionName])

  if (!session || !session.latestGameID || !sessionName) {
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
          <Box sx={{ fontSize: "10rem" }}>😎</Box>
        </Box>
      </Stack>
    )
  }

  return <GamePage gameID={session.latestGameID} sessionName={sessionName} />
}

export default Sessionpage
