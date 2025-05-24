// src/contexts/firebaseContext.js
import { createContext, useContext } from 'react';

// Define the shape of the context value
const FirebaseContext = createContext({
  auth: null, // Firebase Auth instance
  db: null,   // Firestore DB instance
  user: null, // Current authenticated user
  loading: true, // Loading state for auth initialization
  appId: null, // Application ID from Canvas environment
  userId: null, // Current user ID (Firebase UID or anonymous ID)
});

// Custom hook to easily consume the Firebase context
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === null) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export default FirebaseContext;
