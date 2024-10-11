// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore" // Import correct methods for Firestore
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8_kTX7I3_VlMhfTvhsCvkFKZFQH8wySg",
  authDomain: "tactic-toes.firebaseapp.com",
  projectId: "tactic-toes",
  storageBucket: "tactic-toes.appspot.com",
  messagingSenderId: "609730573184",
  appId: "1:609730573184:web:93cc2deb12fa0e22a34765",
  measurementId: "G-WYJM1LMD06",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
// Connect to Firestore emulator in development
export const analytics = getAnalytics(app)
export const auth = getAuth(app)

export const provider = new GoogleAuthProvider()
provider.addScope("profile")
provider.addScope("email")

if (window.location.hostname === "localhost") {
  connectFirestoreEmulator(db, "localhost", 8080) // Use connectFirestoreEmulator for local Firestore
  connectAuthEmulator(auth, "http://localhost:9099") // Authentication emulator
}
