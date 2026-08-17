"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Configuração pública do app Firebase (não é segredo — a segurança vem das
// regras do Firestore e do Firebase Authentication, não de esconder isso).
const firebaseConfig = {
  apiKey: "AIzaSyA4zozf4WwoboyXOlVoiizxlPBqrkTS9bw",
  authDomain: "sistema-montagem-92126.firebaseapp.com",
  projectId: "sistema-montagem-92126",
  storageBucket: "sistema-montagem-92126.firebasestorage.app",
  messagingSenderId: "244189368082",
  appId: "1:244189368082:web:e19391a83a1af8b097adcb",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
