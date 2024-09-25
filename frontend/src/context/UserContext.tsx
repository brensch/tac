import React, { createContext, useContext, useState, useEffect } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
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
    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      console.log("hi")
    })

    const checkAuth = async () => {
      // Automatically log in anonymously if not authenticated
      if (!auth.currentUser) {
        console.log("logging")
        await signInAnonymously(auth)
        console.log("k")
      }

      const user = auth.currentUser
      console.log(user)
      if (user) {
        const uid = user.uid
        setUserID(uid)

        const userDocRef = doc(db, "users", uid)
        const userDocSnap = await getDoc(userDocRef)

        // If no user document exists, prompt for nickname/emoji
        if (!userDocSnap.exists()) {
          setIsUserDocLoaded(true) // Show signup page
        } else {
          // Set user info from the document if it exists
          const userInfo = userDocSnap.data() as {
            nickname: string
            emoji: string
          }
          setNickname(userInfo.nickname || "Unknown")
          setEmoji(userInfo.emoji || "")
          setIsUserDocLoaded(true) // Continue after loading user data
        }
      } else {
        setIsUserDocLoaded(true) // Edge case where auth state is not set
      }
    }

    checkAuth()

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
