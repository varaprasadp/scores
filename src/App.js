// App.js
import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useFirebase } from './contexts/FirebaseContext';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';

// Components
import Header from './components/Header';
import AuthButtons from './components/AuthButtons';
import MessageDisplay from './components/MessageDisplay';
import ScoreInput from './components/ScoreInput';
import ScoreList from './components/ScoreList';

function App() {
  const { auth, user, db, appId, userId } = useFirebase();
  const [scores, setScores] = useState([]);
  const [newScoreValue, setNewScoreValue] = useState('');
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [editingScoreValue, setEditingScoreValue] = useState('');
  const [message, setMessage] = useState('');

  // Google Sign-in function
  const handleGoogleSignIn = async () => {
    if (!auth) {
      console.error("Firebase Auth not initialized.");
      setMessage("Firebase authentication service is not available.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setMessage("Signed in successfully!");
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      if (error.code === "auth/unauthorized-domain") {
        setMessage(
          "Sign-in failed: Unauthorized domain. Please add your domain (e.g., 'localhost') " +
          "to the authorized domains list in your Firebase project settings (Authentication > Settings > Authorized domains)."
        );
      } else {
        setMessage(`Sign-in failed: ${error.message}`);
      }
    }
  };

  // Sign-out function
  const handleSignOut = async () => {
    if (!auth) {
      console.error("Firebase Auth not available in context.");
      setMessage("Firebase authentication service is not available.");
      return;
    }
    try {
      await signOut(auth);
      setMessage("Signed out successfully!");
      setScores([]); // Clear scores on sign out
    } catch (error) {
      console.error("Error during sign-out:", error);
      setMessage(`Sign-out failed: ${error.message}`);
    }
  };

  // Effect to fetch scores from Firestore
  useEffect(() => {
    if (!db || !user || !appId || !userId) {
      console.log("Firestore not ready or user not logged in. Skipping score fetch.");
      setScores([]); // Clear scores if not authenticated
      return;
    }

    const userScoresCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/scores`);
    console.log(`Attempting to listen to: artifacts/${appId}/users/${userId}/scores`);

    const q = query(userScoresCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedScores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setScores(fetchedScores);
      console.log("Scores updated:", fetchedScores);
    }, (error) => {
      console.error("Error fetching scores:", error);
      setMessage(`Error fetching scores: ${error.message}`);
    });

    return () => {
      console.log("Unsubscribing from scores listener.");
      unsubscribe();
    };
  }, [db, user, appId, userId]);

  // Add a new score
  const handleAddScore = async () => {
    if (!db || !user || !appId || !userId || !newScoreValue.trim()) {
      setMessage("Please enter a score and ensure you are signed in.");
      return;
    }
    try {
      const userScoresCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/scores`);
      await addDoc(userScoresCollectionRef, {
        score: newScoreValue.trim(),
        createdAt: Date.now(),
        userName: user.displayName || user.email || 'Anonymous',
      });
      setNewScoreValue('');
      setMessage("Score added successfully!");
    } catch (error) {
      console.error("Error adding score:", error);
      setMessage(`Error adding score: ${error.message}`);
    }
  };

  // Start editing a score
  const handleEditScore = (score) => {
    setEditingScoreId(score.id);
    setEditingScoreValue(score.score);
  };

  // Update an existing score
  const handleUpdateScore = async (scoreId) => {
    if (!db || !user || !appId || !userId || !editingScoreValue.trim()) {
      setMessage("Please enter a score value for update.");
      return;
    }
    try {
      const scoreDocRef = doc(db, `artifacts/${appId}/users/${userId}/scores`, scoreId);
      await updateDoc(scoreDocRef, {
        score: editingScoreValue.trim(),
        updatedAt: Date.now(),
      });
      setEditingScoreId(null);
      setEditingScoreValue('');
      setMessage("Score updated successfully!");
    } catch (error) {
      console.error("Error updating score:", error);
      setMessage(`Error updating score: ${error.message}`);
    }
  };

  // Delete a score
  const handleDeleteScore = async (scoreId) => {
    if (!db || !user || !appId || !userId) {
      setMessage("Database not ready or user not signed in.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to delete this score?");
    if (!confirmDelete) {
      return;
    }
    try {
      const scoreDocRef = doc(db, `artifacts/${appId}/users/${userId}/scores`, scoreId);
      await deleteDoc(scoreDocRef);
      setMessage("Score deleted successfully!");
    } catch (error) {
      console.error("Error deleting score:", error);
      setMessage(`Error deleting score: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 text-gray-100 font-inter p-4 sm:p-8">
      <Header>
        <AuthButtons
          user={user}
          handleGoogleSignIn={handleGoogleSignIn}
          handleSignOut={handleSignOut}
        />
      </Header>

      <MessageDisplay message={message} />

      {user ? (
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Your Game Scores</h2>

          <ScoreInput
            newScoreValue={newScoreValue}
            setNewScoreValue={setNewScoreValue}
            handleAddScore={handleAddScore}
          />

          <ScoreList
            scores={scores}
            editingScoreId={editingScoreId}
            editingScoreValue={editingScoreValue}
            setEditingScoreValue={setEditingScoreValue}
            handleEditScore={handleEditScore}
            handleUpdateScore={handleUpdateScore}
            handleDeleteScore={handleDeleteScore}
            setEditingScoreId={setEditingScoreId}
          />
        </div>
      ) : (
        <div className="text-center p-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl shadow-lg">
          <p className="text-xl text-white mb-6">Please sign in with your Google account to manage your game scores.</p>
        </div>
      )}
    </div>
  );
}

export default App;