// src/context/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import Cookies from "js-cookie"
import { db } from "../firebaseConfig"
import { User } from "../../../shared/types/User"

interface UserContextType {
  userDoc: User | null
  userID: string | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Custom hook to access the UserContext
export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

interface UserProviderProps {
  children: React.ReactNode
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userDoc, setUserDoc] = useState<User | null>(null)
  const [userID, setUserID] = useState<string | null>(null)

  console.log(Cookies.get("userID"))

  useEffect(() => {
    const initializeUser = async () => {
      // Get the user ID from cookies
      let storedUserID = Cookies.get("userID")

      if (!storedUserID) {
        console.log("No user ID found in cookies.")
        return // No userID, nickname prompt should happen elsewhere
      }

      // Set user ID in state
      setUserID(storedUserID)

      // Retrieve the user document from Firestore
      const userRef = doc(db, "users", storedUserID)
      const userSnapshot = await getDoc(userRef)

      if (userSnapshot.exists()) {
        setUserDoc(userSnapshot.data() as User) // Set the user document
      } else {
        console.error("User document does not exist in Firestore.")
      }
    }

    // Only run the user initialization once on component mount
    initializeUser()
  }, []) // No dependency array here, runs once when the component mounts

  return (
    <UserContext.Provider value={{ userDoc, userID }}>
      {children}
    </UserContext.Provider>
  )
}
