import React, { createContext, useContext, useState, useEffect } from "react"
import { doc, onSnapshot, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { getAuth, onAuthStateChanged } from "firebase/auth"

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
  const auth = getAuth()

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      const uid = user.uid
      setUserID(uid)

      const userDocRef = doc(db, "users", uid)
      const userDocSnap = await getDoc(userDocRef)

      // Early return if Firestore doc doesn't exist, create a new one with default values
      if (!userDocSnap.exists()) {
        const defaultUserInfo = { nickname: "Unknown", emoji: "" }
        await setDoc(userDocRef, defaultUserInfo)
        setNickname(defaultUserInfo.nickname)
        setEmoji(defaultUserInfo.emoji)
      }

      // Set initial user info from Firestore document
      const userInfo = userDocSnap.data() as { nickname: string; emoji: string }
      setNickname(userInfo.nickname || "Unknown")
      setEmoji(userInfo.emoji || "")

      // Subscribe to real-time updates from Firestore
      const unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
        if (!doc.exists()) return // Early return if the document doesn't exist in Firestore
        const userInfo = doc.data() as { nickname: string; emoji: string }
        setNickname(userInfo.nickname || "Unknown")
        setEmoji(userInfo.emoji || "")
      })

      // Cleanup Firestore listener when component unmounts
      return () => unsubscribeSnapshot()
    })

    // Cleanup auth listener when component unmounts
    return () => unsubscribeAuth()
  }, [auth])

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

// Fetches the user's nickname and emoji from Firestore (if needed for manual fetches elsewhere)
export const getUserInfo = async (
  userID: string,
): Promise<{ nickname: string; emoji: string }> => {
  const userDocRef = doc(db, "users", userID)
  const userDocSnap = await getDoc(userDocRef)

  if (!userDocSnap.exists()) {
    return { nickname: "Unknown", emoji: "" }
  }

  const userData = userDocSnap.data() as { nickname: string; emoji: string }
  return {
    nickname: userData.nickname || "Unknown",
    emoji: userData.emoji || "",
  }
}
