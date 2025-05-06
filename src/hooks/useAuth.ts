'use client'; // This hook uses client-side state and effects

import { useState, useEffect, useCallback } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword, // Import email/password sign in
  User,
  AuthError,
  initializeAuth,
  // Import persistence if needed, e.g., indexedDBLocalPersistence for web
  // indexedDBLocalPersistence
} from 'firebase/auth';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

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
  console.log('useAuth: Firebase App initialized.');
} else {
  app = getApps()[0];
  console.log('useAuth: Using existing Firebase App instance.');
}

// Initialize Firebase Auth specifically for the client
// Adjust persistence as needed for web (e.g., indexedDBLocalPersistence)
// const auth = initializeAuth(app, {
//     persistence: indexedDBLocalPersistence // Example for web
// });
const auth = getAuth(app); // Standard web initialization

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<User | null>; // Add login function type
}

export default function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading until first auth state check completes
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('useAuth: Setting up onAuthStateChanged listener.');
    setLoading(true); // Ensure loading is true when listener setup starts
    setError(null); // Clear previous errors

    // Listener for authentication state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        console.log(
          'useAuth: onAuthStateChanged triggered. User:',
          currentUser?.uid
        );
        setUser(currentUser);
        setLoading(false); // Auth state confirmed, stop loading
        setError(null); // Clear error on successful auth state check
      },
      (authError: AuthError) => {
        // Handle errors during initial listener setup or subsequent changes
        console.error(
          'useAuth: Error in onAuthStateChanged listener:',
          authError
        );
        setError(
          authError.message || 'Erro ao verificar o estado de autenticação.'
        );
        setUser(null); // Ensure user is null on error
        setLoading(false); // Stop loading even on error
      }
    );

    // Cleanup listener on component unmount
    return () => {
      console.log('useAuth: Cleaning up onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  const logout = useCallback(async () => {
    console.log('useAuth: Attempting logout...');
    setLoading(true); // Indicate loading during logout
    setError(null);
    try {
      await signOut(auth);
      console.log('useAuth: Logout successful.');
      setUser(null); // Explicitly set user to null
    } catch (err: any) {
      console.error('useAuth: Error during logout:', err);
      setError(err.message || 'Erro ao fazer logout.');
      setUser(null); // Ensure user is null on error
    } finally {
      setLoading(false); // Stop loading after logout attempt
    }
  }, []);

  // Function to handle email/password login
  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<User | null> => {
      console.log('useAuth: Attempting login with email:', email);
      setLoading(true);
      setError(null);
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        console.log(
          'useAuth: Email/Password login successful. User:',
          userCredential.user.uid
        );
        // No need to setUser here, onAuthStateChanged will handle it
        return userCredential.user;
      } catch (err: any) {
        console.error('useAuth: Error during email/password login:', err);
        // Set specific error messages based on Firebase error codes
        let errorMessage =
          'Falha no login. Verifique suas credenciais ou tente novamente.';
        if (
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/user-not-found'
        ) {
          errorMessage = 'E-mail ou senha inválidos.';
        } else if (err.code === 'auth/invalid-email') {
          errorMessage = 'Formato de e-mail inválido.';
        } else if (err.code === 'auth/too-many-requests') {
          errorMessage =
            'Muitas tentativas de login. Tente novamente mais tarde.';
        }
        setError(errorMessage);
        setUser(null); // Ensure user is null on login failure
        throw err; // Re-throw the error so the calling component knows it failed
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { user, loading, error, logout, loginWithEmail };
}
