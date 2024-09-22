import React, { createContext, useContext, useState, useEffect } from "react"
import Cookies from "js-cookie"
import { doc, onSnapshot, getDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"

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

  useEffect(() => {
    const storedUserID = Cookies.get("userID")
    if (storedUserID) {
      setUserID(storedUserID)

      // Subscribe to Firestore updates
      const unsubscribe = onSnapshot(getUserDocRef(storedUserID), (doc) => {
        if (doc.exists()) {
          const userInfo = doc.data() as { nickname: string; emoji: string }
          setNickname(userInfo.nickname || "Unknown")
          setEmoji(userInfo.emoji || "")
        }
      })

      // Cleanup the listener when the component unmounts
      return () => unsubscribe()
    }
  }, [])

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

// Fetches the Firestore document reference for a given user ID
const getUserDocRef = (userID: string) => {
  return doc(db, "users", userID)
}

// Fetches the user's nickname and emoji from Firestore (if needed for manual fetches elsewhere)
export const getUserInfo = async (
  userID: string,
): Promise<{ nickname: string; emoji: string }> => {
  const userDocRef = getUserDocRef(userID)
  const userDocSnap = await getDoc(userDocRef)
  if (userDocSnap.exists()) {
    const userData = userDocSnap.data() as { nickname: string; emoji: string }
    return {
      nickname: userData.nickname || "Unknown",
      emoji: userData.emoji || "",
    }
  }
  return { nickname: "Unknown", emoji: "" }
}
