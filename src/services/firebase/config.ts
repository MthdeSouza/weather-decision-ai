import { getAnalytics } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCQKM8dI8cJWHXocUkQAcs3hPeSNpOSNGo",
  authDomain: "weather-decision-ai-dev.firebaseapp.com",
  projectId: "weather-decision-ai-dev",
  storageBucket: "weather-decision-ai-dev.firebasestorage.app",
  messagingSenderId: "103714559297",
  appId: "1:103714559297:web:24f3c498e6b4f182567dc0",
  measurementId: "G-N7QKNMPD6P",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;
