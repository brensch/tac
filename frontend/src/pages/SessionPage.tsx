import React, { useEffect, useState } from "react"
import { Stack, Typography } from "@mui/material"
import { useNavigate, useParams } from "react-router-dom"
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore"
import { db } from "../firebaseConfig"

const Sessionpage: React.FC = () => {
  const { sessionName } = useParams<{ sessionName: string }>()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const fetchGame = async () => {
      try {
        // Query Firestore for the latest GameState with the provided sessionName
        const gamesRef = collection(db, "games")
        const q = query(
          gamesRef,
          where("sessionName", "==", sessionName),
          orderBy("sessionIndex", "desc"),
          limit(1),
        )

        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          const gameDoc = querySnapshot.docs[0]
          const gameID = gameDoc.id
          navigate(`/game/${gameID}`)
        } else {
          setErrorMessage("Session does not exist.")
        }
      } catch (error) {
        console.error("Error fetching game:", error)
        setErrorMessage("Error fetching session data.")
      }
    }

    fetchGame()
  }, [navigate, sessionName])

  return (
    <Stack
      spacing={2}
      direction="column"
      alignItems="center"
      justifyContent="center"
      sx={{ height: "100vh" }}
    >
      {errorMessage ? (
        <Typography>{errorMessage}</Typography>
      ) : (
        <Typography>Loading...</Typography>
      )}
    </Stack>
  )
}

export default Sessionpage
