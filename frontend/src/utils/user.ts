import { doc, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import Cookies from "js-cookie"

// Function to create or retrieve a user with the given nickname and emoji
export const getOrCreateUserWithNickname = async (
  nickname: string,
  emoji: string,
) => {
  let userID = Cookies.get("userID")

  if (userID) {
    // User exists, update nickname and emoji
    const userDocRef = doc(db, "users", userID)
    await setDoc(userDocRef, { nickname, emoji }, { merge: true })
  } else {
    // Create a new user
    const userDocRef = doc(db, "users", generateUniqueUserID())
    await setDoc(userDocRef, { nickname, emoji })
    userID = userDocRef.id
    Cookies.set("userID", userID)
  }
}

// Helper function to generate a unique user ID (implement as needed)
const generateUniqueUserID = () => {
  // Generate a unique ID logic here
  return "unique-user-id"
}
