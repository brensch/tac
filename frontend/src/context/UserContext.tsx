import React, { createContext, useContext, useState, useEffect } from "react"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { auth } from "../firebaseConfig"
import SignupPage from "../pages/SignupPage"
import { Container, Box } from "@mui/material"
import { Human } from "@shared/types/Game"
import { EmojiCycler } from "../components/EmojiCycler"

export interface UserContextType {
  userID: string
  name: string
  emoji: string
  colour: string
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userID, setUserID] = useState<string>("")
  const [name, setName] = useState<string>("")
  const [colour, setColour] = useState<string>("")
  const [emoji, setEmoji] = useState<string>("")
  const [authLoaded, setAuthLoaded] = useState<boolean>(false) // Auth flag
  const [userDocLoaded, setUserDocLoaded] = useState<boolean>(false) // User doc flag

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user)

      if (!user) {
        try {
          const result = await signInAnonymously(auth)
          console.log("Signed in anonymously:", result.user)
        } catch (error) {
          console.error("Failed to sign in anonymously:", error)
          setAuthLoaded(true)
          return
        }
      }

      const currentUser = auth.currentUser

      if (currentUser) {
        const uid = currentUser.uid
        setUserID(uid)

        const userDocRef = doc(db, "users", uid)

        const unsubscribeUserDoc = onSnapshot(
          userDocRef,
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              const userInfo = docSnapshot.data() as Human
              setName(userInfo.name || "Unknown")
              setEmoji(userInfo.emoji || "")
              setColour(userInfo.colour)
            } else {
              console.log("No user document exists, prompting user for info.")
            }
            setUserDocLoaded(true)
          },
          (error) => {
            console.error("Error in onSnapshot:", error)
            setUserDocLoaded(true) // Set to true even on error to allow the app to proceed
          },
        )

        setAuthLoaded(true)

        return () => {
          unsubscribeUserDoc()
        }
      } else {
        setAuthLoaded(true)
      }
    })

    return () => {
      unsubscribeAuth()
    }
  }, [])

  // Save name and emoji once user submits the form
  const handleSaveNameEmoji = async (
    name: string,
    emoji: string,
    colour: string,
  ) => {
    const uid = auth.currentUser?.uid
    if (uid) {
      const userDocRef = doc(db, "users", uid)
      await setDoc(userDocRef, { name, emoji, colour }, { merge: true })
      setName(name)
      setEmoji(emoji)
      setUserDocLoaded(true)
      setColour(colour)
    }
  }

  // Ensure both auth and user doc are loaded before rendering the app
  if (!authLoaded || !userDocLoaded) {
    return (
      <Container sx={{ mt: 1 }}>
        <Box
          width="100%"
          display="flex"
          flexDirection="column"
          alignItems="center"
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
        </Box>
      </Container>
    )
  }

  // If user doesn't have a name or emoji yet, show the form
  if (!name || !emoji) {
    return <SignupPage onSave={handleSaveNameEmoji} />
  }

  return (
    <UserContext.Provider value={{ userID, name, emoji, colour }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = (): UserContextType => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
