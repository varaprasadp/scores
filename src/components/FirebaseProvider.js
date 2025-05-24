// src/components/FirebaseProvider.js
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import FirebaseContext from '../contexts/FirebaseContext'; // Import the context

// Define your Firebase config
// IMPORTANT: Make sure these environment variables are correctly loaded in your build process
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
    const [loading, setLoading] = useState(true); // Start in loading state
    const [currentAppId, setCurrentAppId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        let unsubscribeAuth = () => { }; // Placeholder for the auth listener unsubscribe function

        try {
            console.log("Attempting Firebase Initialization with Config:", firebaseConfig);

            // Check if crucial config values are present
            if (!firebaseConfig.apiKey) {
                console.error("FATAL ERROR: REACT_APP_FIREBASE_API_KEY is not defined!");
                setLoading(false); // Stop loading if config is missing
                return; // Stop initialization
            }
            if (!firebaseConfig.appId) {
                console.error("FATAL ERROR: REACT_APP_FIREBASE_APP_ID is not defined!");
                setLoading(false); // Stop loading if config is missing
                return; // Stop initialization
            }

            // Initialize Firebase app
            const app = initializeApp(firebaseConfig);
            console.log("Firebase App initialized successfully:", app);

            const firestoreDb = getFirestore(app);
            console.log("Firestore initialized:", firestoreDb);

            const firebaseAuth = getAuth(app);
            console.log("Firebase Auth initialized:", firebaseAuth);
            
            // Set the initialized instances to state
            setDb(firestoreDb);
            setAuth(firebaseAuth);
            console.log("Firebase DB and Auth state variables updated.");
            setCurrentAppId(firebaseConfig.appId);
            // Set up the auth state listener
            console.log("Setting up onAuthStateChanged listener...");
            unsubscribeAuth = onAuthStateChanged(firebaseAuth, (currentUser) => {
                console.log("onAuthStateChanged fired. Current user:", currentUser ? currentUser.uid : "null (signed out)");
                // Check the loading state value right before potentially setting it to false
                console.log("Current loading state BEFORE check:", loading);

                setUser(currentUser); // Update user state
                console.log("User state updated.");
                setCurrentUserId(currentUser?.uid); 

                // Only set loading to false after the *initial* auth state is determined
                // This prevents rendering the app before knowing if the user is logged in
                if (loading) { // Only set false the first time the listener fires
                    console.log("Setting loading to false NOW."); // Add this log
                    setLoading(false);
                    console.log("Loading state should now be false."); // Add this log
                } else {
                    console.log("Loading was already false, not setting again."); // Add this log
                }
            }, (error) => { // Add error handler for onAuthStateChanged
                console.error("Error in onAuthStateChanged listener:", error);
                // Ensure loading is set to false even if the listener errors out
                setLoading(false); // Setting false even on error
                console.log("Error in listener, setting loading to false."); // Add this log
            });



        } catch (error) {
            console.error("FATAL ERROR: Failed during Firebase initialization process:", error);
            // Ensure loading is set to false even on initialization failure
            setLoading(false);
            // Optionally, set an error state here that the provider makes available
        }

        // Cleanup function
        return () => {
            console.log("FirebaseProvider unmounting, cleaning up auth listener.");
            unsubscribeAuth(); // Unsubscribe the auth listener
            // Note: There's typically no need to manually "cleanup" Firebase instances
            // initialized with initializeApp unless you are explicitly trying to manage
            // multiple Firebase apps or complex scenarios. Let them live for the app's lifespan.
        };
    }, []); // Empty dependency array: runs only once on mount

    // The value provided to the context
    const contextValue = {
        auth,
        db,
        user,
        loading,
        appId: currentAppId, // Provide appId from state
        userId: currentUserId, // Provide userId from state
    };

    // While loading, you might return a specific loading indicator
    if (loading) {
        // You can customize this loading state rendering
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-lg font-semibold text-gray-700">Loading application...</div>
            </div>
        );
    }


    // Once initialized and auth state is known, provide the context to children
    return (
        <FirebaseContext.Provider value={contextValue}>
            {children}
        </FirebaseContext.Provider>
    );
}

export default FirebaseProvider;
