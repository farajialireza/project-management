import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9WMhdlB1ATrl0aceOGjDIbqNB7y7jhDA",
  authDomain: "studio-3904302079-c42ed.firebaseapp.com",
  projectId: "studio-3904302079-c42ed",
  storageBucket: "",
  messagingSenderId: "412642043822",
  appId: "1:412642043822:web:1f540c6393a0a379a14a3f",
  measurementId: ""
};

// Initialize only if not already initialized (prevent hot-reload issues)
const app = firebase.apps.length > 0 ? firebase.app() : firebase.initializeApp(firebaseConfig);
export const auth = app.auth();
export const db = getFirestore(app);