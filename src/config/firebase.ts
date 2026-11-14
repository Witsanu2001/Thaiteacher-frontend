
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCxxxggh4zcIrH5UUKObGCAom8E5b31gfQ",
  // The auth helper must share the Hosting origin for redirect sign-in on Safari.
  authDomain: typeof window !== "undefined" && window.location.hostname === "thaiteacher-app.web.app" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
    ? "thaiteacher-app.web.app"
    : "thaiteacher-app.firebaseapp.com",
  projectId: "thaiteacher-app",
  storageBucket: "thaiteacher-app.firebasestorage.app",
  messagingSenderId: "582374337837",
  appId: "1:582374337837:web:f95603e4dc10740a1977a4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = import.meta.env.VITE_FIREBASE_DATABASE_URL
  ? getDatabase(app, import.meta.env.VITE_FIREBASE_DATABASE_URL)
  : null;
