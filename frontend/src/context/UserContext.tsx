import React, { createContext, useContext, useState, useEffect } from "react"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { auth } from "../firebaseConfig"
import SignupPage from "../pages/SignupPage"
import { Container, Box, Typography } from "@mui/material"
import { PlayerInfo } from "@shared/types/Game"

interface UserContextType {
  userID: string
  nickname: string
  emoji: string
  colour: string
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userID, setUserID] = useState<string>("")
  const [nickname, setNickname] = useState<string>("")
  const [colour, setColour] = useState<string>("")
  const [emoji, setEmoji] = useState<string>("")
  const [authLoaded, setAuthLoaded] = useState<boolean>(false) // Auth flag
  const [userDocLoaded, setUserDocLoaded] = useState<boolean>(false) // User doc flag

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth)
        } catch (error) {
          console.error("Failed to sign in anonymously:", error)
          setAuthLoaded(true) // Ensure authLoaded is set even if sign-in fails
          return
        }
      }

      const currentUser = auth.currentUser
      if (currentUser) {
        const uid = currentUser.uid
        setUserID(uid)

        const userDocRef = doc(db, "users", uid)

        // Real-time listener for user document updates
        const unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userInfo = docSnapshot.data() as PlayerInfo
            setNickname(userInfo.nickname || "Unknown")
            setEmoji(userInfo.emoji || "")
            setColour(userInfo.colour)
          } else {
            console.log("No user document exists, prompting user for info.")
          }
          setUserDocLoaded(true) // Set user doc loaded after trying to fetch data
        })

        setAuthLoaded(true) // Auth is now loaded since we have a user

        return () => {
          unsubscribeUserDoc() // Unsubscribe from Firestore listener on unmount
        }
      } else {
        setAuthLoaded(true) // Auth is now loaded even if no currentUser
      }
    })

    return () => unsubscribeAuth()
  }, [])

  // Save nickname and emoji once user submits the form
  const handleSaveNicknameEmoji = async (
    nickname: string,
    emoji: string,
    colour: string,
  ) => {
    const uid = auth.currentUser?.uid
    if (uid) {
      const userDocRef = doc(db, "users", uid)
      await setDoc(userDocRef, { nickname, emoji, colour }, { merge: true })
      setNickname(nickname)
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
          <Typography variant="h4" sx={{ my: 4 }}>
            Hi 👋
          </Typography>
        </Box>
      </Container>
    )
  }

  // If user doesn't have a nickname or emoji yet, show the form
  if (!nickname || !emoji) {
    return <SignupPage onSave={handleSaveNicknameEmoji} />
  }

  return (
    <UserContext.Provider value={{ userID, nickname, emoji, colour }}>
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
