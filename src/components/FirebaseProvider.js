import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import FirebaseContext from '../contexts/FirebaseContext';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

function FirebaseProvider({ children }) {
    const [user, setUser] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentAppId, setCurrentAppId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        let unsubscribeAuth = () => {};

        try {
            // console.log("Attempting Firebase Initialization with Config:", firebaseConfig);
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) { // Added projectId check
                console.error("FATAL ERROR: Missing critical Firebase config values (apiKey, projectId, or appId).");
                setLoading(false);
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            
            setDb(firestoreDb);
            setAuth(firebaseAuth);
            setCurrentAppId(firebaseConfig.appId);
            
            unsubscribeAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
                setUser(currentUser);
                setCurrentUserId(currentUser?.uid || null); // Set to null if no user
                if (loading) {
                    setLoading(false);
                }
            }, (error) => {
                console.error("Error in onAuthStateChanged listener:", error);
                setLoading(false);
            });

        } catch (error) {
            console.error("FATAL ERROR: Failed during Firebase initialization process:", error);
            setLoading(false);
        }

        return () => {
            unsubscribeAuth();
        };
    }, [loading]); // Added loading to dependency array to ensure setLoading(false) from onAuthStateChanged takes effect correctly initially

    const contextValue = {
        auth,
        db,
        user,
        loading,
        appId: currentAppId,
        userId: currentUserId,
    };

    if (loading && !auth && !db) { // Refined loading condition for initial screen
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100 p-4">
                <div className="text-xl font-semibold mb-4">Loading Application...</div>
                {/* Optional: Add a spinner here */}
                <svg className="animate-spin h-8 w-8 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {!firebaseConfig.apiKey && <p className="mt-4 text-red-400 text-sm">Firebase API Key seems to be missing.</p>}
            </div>
        );
    }

    return (
        <FirebaseContext.Provider value={contextValue}>
            {children}
        </FirebaseContext.Provider>
    );
}

export default FirebaseProvider;