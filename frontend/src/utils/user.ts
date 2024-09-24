import { addDoc, collection, doc, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { getAuth, signInAnonymously } from "firebase/auth"

// Function to create or retrieve a user with the given nickname and emoji
export const getOrCreateUserWithNickname = async (
  nickname: string,
  emoji: string,
) => {
  const auth = getAuth()

  // Sign in anonymously if not already signed in
  if (!auth.currentUser) {
    await signInAnonymously(auth)
  }

  const userID = auth.currentUser?.uid

  if (userID) {
    // User exists, update nickname and emoji
    const userDocRef = doc(db, "users", userID)
    await setDoc(userDocRef, { nickname, emoji }, { merge: true })
  } else {
    // Create a new user (This case is redundant as Firebase always provides a UID)
    const userCollRef = collection(db, "users")
    await addDoc(userCollRef, { nickname, emoji })
  }
}
