
"use client"; // This hook uses client-side state and effects

import { useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged, signOut, User, AuthError, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeApp, getApps, FirebaseApp } from "firebase/app";

// Import db only if needed for other operations, app is initialized locally
// import { db } from '@/firebase/config';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

// Firebase config - needed here to initialize app if not already done
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
  };

// Initialize Firebase App if it doesn't exist
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("useAuth: Firebase App initialized.");
} else {
  app = getApps()[0];
   console.log("useAuth: Using existing Firebase App instance.");
}

// Initialize Firebase Auth specifically for the client
// Use initializeAuth for client-side persistence handling if needed, otherwise getAuth is fine
// const auth = initializeAuth(app, {
//     persistence: getReactNativePersistence(AsyncStorage) // Example for React Native, adjust for web if necessary (indexedDBLocalPersistence)
// });
const auth = getAuth(app); // Standard web initialization

export default function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading until first auth state check completes
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("useAuth: Setting up onAuthStateChanged listener.");
    setLoading(true); // Ensure loading is true when listener setup starts
    setError(null); // Clear previous errors

    // Listener for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("useAuth: onAuthStateChanged triggered. User:", currentUser?.uid);
      setUser(currentUser);
      setLoading(false); // Auth state confirmed, stop loading
      setError(null); // Clear error on successful auth state check
    }, (authError: AuthError) => {
        // Handle errors during initial listener setup or subsequent changes
        console.error("useAuth: Error in onAuthStateChanged listener:", authError);
        setError(authError.message || "Erro ao verificar o estado de autenticação.");
        setUser(null); // Ensure user is null on error
        setLoading(false); // Stop loading even on error
    });

    // Cleanup listener on component unmount
    return () => {
        console.log("useAuth: Cleaning up onAuthStateChanged listener.");
        unsubscribe();
    }
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  const logout = useCallback(async () => {
    console.log("useAuth: Attempting logout...");
    setLoading(true); // Indicate loading during logout
    setError(null);
    try {
      await signOut(auth);
      console.log("useAuth: Logout successful.");
      setUser(null); // Explicitly set user to null
    } catch (err: any) {
      console.error("useAuth: Error during logout:", err);
      setError(err.message || "Erro ao fazer logout.");
      // Keep user state as is? Or set to null anyway? Setting to null is safer.
      setUser(null);
    } finally {
        setLoading(false); // Stop loading after logout attempt
    }
  }, []);

  return { user, loading, error, logout };
}
