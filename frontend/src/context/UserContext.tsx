import React, { createContext, useContext, useState, useEffect } from "react"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { auth } from "../firebaseConfig"
import SignupPage from "../pages/SignupPage"
import { Container, Box, Typography } from "@mui/material"

interface UserContextType {
  userID: string
  nickname: string
  emoji: string
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userID, setUserID] = useState<string>("")
  const [nickname, setNickname] = useState<string>("")
  const [emoji, setEmoji] = useState<string>("")
  const [isUserDocLoaded, setIsUserDocLoaded] = useState<boolean>(false) // Flag to check if user doc is loaded

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Automatically log in anonymously if not authenticated
      if (!user) {
        await signInAnonymously(auth)
      }

      const currentUser = auth.currentUser
      if (currentUser) {
        const uid = currentUser.uid
        setUserID(uid)

        const userDocRef = doc(db, "users", uid)

        // Real-time listener for user document updates
        const unsubscribeUserDoc = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userInfo = docSnapshot.data() as {
              nickname: string
              emoji: string
            }
            setNickname(userInfo.nickname || "Unknown")
            setEmoji(userInfo.emoji || "")
          } else {
            setIsUserDocLoaded(true) // Show signup page if no user doc
          }
        })

        setIsUserDocLoaded(true) // Continue after loading user data

        return () => {
          unsubscribeUserDoc() // Unsubscribe from the listener when component unmounts
        }
      } else {
        setIsUserDocLoaded(true) // Edge case where auth state is not set
      }
    })

    return () => unsubscribeAuth()
  }, [])

  // Save nickname and emoji once user submits the form
  const handleSaveNicknameEmoji = async (nickname: string, emoji: string) => {
    const uid = auth.currentUser?.uid
    if (uid) {
      const userDocRef = doc(db, "users", uid)
      await setDoc(userDocRef, { nickname, emoji }, { merge: true })
      setNickname(nickname)
      setEmoji(emoji)
      setIsUserDocLoaded(true) // Continue with the app after saving
    }
  }

  if (!isUserDocLoaded) {
    // Show loading screen while auth is still loading
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
    <UserContext.Provider value={{ userID, nickname, emoji }}>
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
