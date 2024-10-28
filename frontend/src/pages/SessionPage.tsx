import { Box, Stack } from "@mui/material"
import { Session } from "@shared/types/Game"
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"
import React, { useEffect, useState, useRef } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import { db } from "../firebaseConfig"
import { EmojiCycler } from "../components/EmojiCycler"

const Sessionpage: React.FC = () => {
  const { sessionName } = useParams<{ sessionName: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const hasNavigated = useRef(false)

  useEffect(() => {
    const createAndSubscribeToSession = async () => {
      if (!sessionName) {
        return
      }

      const sessionDocRef = doc(db, "sessions", sessionName)

      try {
        await runTransaction(db, async (transaction) => {
          const sessionSnapshot = await transaction.get(sessionDocRef)

          if (!sessionSnapshot.exists()) {
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

      const unsubscribe = onSnapshot(sessionDocRef, (docSnapshot) => {
        if (!docSnapshot.exists()) return

        const sessionData = docSnapshot.data() as Session
        setSession(sessionData)
      })

      return () => unsubscribe()
    }

    createAndSubscribeToSession()
  }, [sessionName])

  // Modified navigation effect
  useEffect(() => {
    if (session?.latestGameID && !hasNavigated.current) {
      hasNavigated.current = true
      // Replace the current history entry instead of pushing a new one
      navigate(`/session/${sessionName}/${session.latestGameID}`, {
        replace: true,
        state: { from: location.pathname }
      })
    }
  }, [session, sessionName, navigate, location])

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
          height: "100vh",
        }}
      >
        <EmojiCycler />
      </Box>
    </Stack>
  )
}

export default Sessionpage