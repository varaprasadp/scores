// src/App.js
import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useFirebase } from './contexts/FirebaseContext';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, where, getDocs, limit, updateDoc } from 'firebase/firestore';

// Components
import Header from './components/Header';
import AuthButtons from './components/AuthButtons';
import MessageDisplay from './components/MessageDisplay';
import SlotList from './components/SlotList';
import GameInput from './components/GameInput';
import GameList from './components/GameList';
import PlayerManager from './components/PlayerManager';

function App() {
  const { auth, user, db, appId, userId } = useFirebase();
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [games, setGames] = useState([]);
  const [currentGamePlayers, setCurrentGamePlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const [masterPlayerList, setMasterPlayerList] = useState([]);

  // Helper function to display temporary messages to the user
  const displayMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  // Handles Google Sign-In using Firebase Authentication
  const handleGoogleSignIn = async () => {
    if (!auth) {
      console.error("Firebase Auth not initialized.");
      displayMessage("Firebase authentication service is not available.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      displayMessage("Signed in successfully!");
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      if (error.code === "auth/unauthorized-domain") {
        displayMessage(
          "Sign-in failed: Unauthorized domain. Please add your domain (e.g., 'localhost') " +
          "to the authorized domains list in your Firebase project settings (Authentication > Settings > Authorized domains)."
        );
      } else {
        displayMessage(`Sign-in failed: ${error.message}`);
      }
    }
  };

  // Handles user sign-out from Firebase Authentication
  const handleSignOut = async () => {
    if (!auth) {
      console.error("Firebase Auth not available in context.");
      displayMessage("Firebase authentication service is not available.");
      return;
    }
    try {
      await signOut(auth);
      displayMessage("Signed out successfully!");
      // Clear all slot-related states on sign out
      setSlots([]);
      setSelectedSlot(null);
      setGames([]);
      setCurrentGamePlayers([]);
      setMasterPlayerList([]);
    } catch (error) {
      console.error("Error during sign-out:", error);
      displayMessage(`Sign-out failed: ${error.message}`);
    }
  };

  // Effect hook to fetch user's slots from Firestore
  useEffect(() => {
    // Ensure Firebase is ready and user is logged in before attempting to fetch
    if (!db || !user || !appId || !userId) {
      console.log("Firestore not ready or user not logged in. Skipping slot fetch.");
      setSlots([]);
      return;
    }

    // Reference to the user's slots collection
    const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
    // Create a query to order slots by creation time in descending order
    const q = query(userSlotsCollectionRef, orderBy('createdAt', 'desc'));

    // Set up a real-time listener for slots
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSlots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSlots(fetchedSlots);
    }, (error) => {
      console.error("Error fetching slots:", error);
      displayMessage(`Error fetching slots: ${error.message}`);
    });

    // Clean up the listener when the component unmounts or dependencies change
    return () => unsubscribe();
  }, [db, user, appId, userId]); // Dependencies for this effect

  // Effect hook to fetch master player list from Firestore
  useEffect(() => {
    // Ensure Firebase is ready and user is logged in
    if (!db || !user || !appId || !userId) {
      setMasterPlayerList([]);
      return;
    }

    // Construct the document reference for the specific user
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    // Construct the collection reference for 'masterPlayers' as a subcollection of the user's document
    const masterPlayersRef = collection(userDocRef, 'masterPlayers');

    // Create a query to order master players by creation time
    const q = query(masterPlayersRef, orderBy('createdAt', 'asc'));

    // Set up a real-time listener for the master player list
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPlayers = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        createdAt: doc.data().createdAt // Include createdAt for ordering
      }));
      setMasterPlayerList(fetchedPlayers);
    }, (error) => {
      console.error("Error fetching master player list:", error);
      displayMessage(`Error fetching master players: ${error.message}`);
    });

    // Clean up the listener
    return () => unsubscribe();
  }, [db, user, appId, userId]); // Dependencies for this effect

  // Effect hook to fetch games for the selected slot and manage current game players
  useEffect(() => {
    // Clear games and current players if Firebase not ready or no slot selected
    if (!db || !user || !appId || !userId || !selectedSlot) {
      setCurrentGamePlayers([]);
      setGames([]);
      return;
    }

    // Reference to the games subcollection for the selected slot
    const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
    // Query to get games ordered by game number in descending order
    const q = query(slotGamesCollectionRef, orderBy('gameNumber', 'desc'));

    // Set up a real-time listener for games
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedGames = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGames(fetchedGames);

      let playersForNextGame = [];

      if (fetchedGames.length > 0) {
        // Case 1: Active game exists for the current slot
        if (!fetchedGames[0].endedAt) {
          playersForNextGame = fetchedGames[0].players.map(p => ({ ...p, score: p.score || 0 }));
        } else {
          // Case 2: Last game ended in the current slot, so default to players from that last completed game
          const lastCompletedGame = fetchedGames.find(game => game.endedAt);
          if (lastCompletedGame) {
            playersForNextGame = lastCompletedGame.players.map(p => ({ name: p.name, score: 0 }));
          } else {
            // Fallback: If no completed games in current slot (unlikely if fetchedGames > 0 and not active)
            console.warn("Unexpected state: fetchedGames exist but no active or completed games.");
          }
        }
      } else {
        // Case 3: No games exist for the current slot.
        // Try to get players from the last completed game of the most recent *previous* slot.
        let defaultPlayersFromPreviousSlot = [];

        const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
        // Get slots ordered by creation time, limiting to 2.
        // This will give us the selected slot and potentially the one before it.
        const slotsQuery = query(userSlotsCollectionRef, orderBy('createdAt', 'desc'), limit(2));
        const slotsSnapshot = await getDocs(slotsQuery);

        let previousSlotId = null;
        // Iterate to find the slot that is NOT the currently selected slot.
        slotsSnapshot.docs.forEach(doc => {
            if (doc.id !== selectedSlot.id) {
                previousSlotId = doc.id;
            }
        });

        if (previousSlotId) {
          const previousSlotGamesRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${previousSlotId}/games`);
          // Query the games of the previous slot, order by game number descending, limit to 1 to get the last game
          const prevGamesQuery = query(previousSlotGamesRef, orderBy('gameNumber', 'desc'), limit(1));
          const prevGamesSnapshot = await getDocs(prevGamesQuery);

          if (!prevGamesSnapshot.empty) {
            const lastGameOfPrevSlot = prevGamesSnapshot.docs[0].data();
            // Only use players from a game that was actually completed
            if (lastGameOfPrevSlot.endedAt) {
              defaultPlayersFromPreviousSlot = lastGameOfPrevSlot.players.map(p => ({ name: p.name, score: 0 }));
              console.log(`Defaulting players from last game of previous slot (${previousSlotId}).`);
            }
          }
        }

        // If players were found from a previous slot's last game, use them.
        if (defaultPlayersFromPreviousSlot.length > 0) {
            playersForNextGame = defaultPlayersFromPreviousSlot;
        } else {
          // Fallback: If no previous slot's last game, or no completed games there,
          // then no players are pre-selected by default.
          playersForNextGame = []; // Explicitly set to empty if no defaults found
          console.log("No previous game players found to default. Starting with empty selection.");
        }
      }

      // IMPORTANT: Filter the `playersForNextGame` against the `masterPlayerList`
      // This ensures that only players currently existing in the master list are pre-selected.
      const masterPlayerNames = new Set(masterPlayerList.map(p => p.name));
      const filteredPlayersForNextGame = playersForNextGame.filter(player =>
        masterPlayerNames.has(player.name)
      );

      setCurrentGamePlayers(filteredPlayersForNextGame);

    }, (error) => {
      console.error("Error fetching games:", error);
      displayMessage(`Error fetching games: ${error.message}`);
    });

    // Clean up the listener
    return () => unsubscribe();
  }, [db, user, appId, userId, selectedSlot, masterPlayerList]);

  // Handles creation of a new slot
  const handleCreateNewSlot = async () => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready or user not signed in.");
      return;
    }

    try {
      const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      // Query to find existing slots for today to determine the next slot ID
      const q = query(
        userSlotsCollectionRef,
        where('date', '==', dateString),
        orderBy('slotId', 'desc')
      );

      const querySnapshot = await getDocs(q);
      let nextSlotId = 1;

      if (!querySnapshot.empty) {
        const latestSlot = querySnapshot.docs[0].data();
        nextSlotId = latestSlot.slotId + 1;
      }

      // Add the new slot document to Firestore
      const newSlotDoc = await addDoc(userSlotsCollectionRef, {
        slotId: nextSlotId,
        date: dateString,
        createdAt: Date.now(),
        userName: user.displayName || user.email || 'Anonymous',
      });
      displayMessage(`New slot created successfully with ID: ${nextSlotId} for ${dateString}!`);
      // Select the newly created slot
      setSelectedSlot({ id: newSlotDoc.id, slotId: nextSlotId, date: dateString, createdAt: Date.now(), userName: user.displayName || user.email || 'Anonymous' });
    } catch (error) {
      console.error("Error creating new slot:", error);
      displayMessage(`Error creating new slot: ${error.message}`);
    }
  };

  // Handles selection of an existing slot
  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
    setGames([]); // Clear games when a new slot is selected
    displayMessage(`Slot ${slot.slotId} (${slot.date}) selected.`);
  };

  // Handles creation of a new game for the selected slot
  const handleCreateNewGame = async () => {
    if (!db || !user || !appId || !userId || !selectedSlot) {
      displayMessage("Please select a slot to create a new game.");
      return;
    }
    // Ensure players are selected for the new game
    if (currentGamePlayers.length === 0) {
      displayMessage("Please select players for the game before creating it.");
      return;
    }
    if (currentGamePlayers.length < 2) {
      displayMessage("A game requires at least two players.");
      return;
    }
    // Prevent creating a new game if an existing one is active
    const isGameActive = games.length > 0 && !games[0].endedAt;
    if (isGameActive) {
      displayMessage("The current game is not yet ended. Please end it before creating a new one.");
      return;
    }

    try {
      const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
      let nextGameNumber = 1;
      if (games.length > 0) {
        nextGameNumber = games[0].gameNumber + 1;
      }

      // Prepare players for the new game, initializing their scores to 0
      const playersForNewGame = currentGamePlayers.map(player => ({
        name: player.name,
        score: 0
      }));

      // Add the new game document to Firestore
      await addDoc(slotGamesCollectionRef, {
        gameNumber: nextGameNumber,
        createdAt: Date.now(),
        players: playersForNewGame,
        winnerPlayerName: null,
        pointsTransferred: 0,
        endedAt: null,
        isRotationGame: false, // NEW: Default to false when creating a new game
      });

      displayMessage(`New game ${nextGameNumber} created for Slot ${selectedSlot.slotId}.`);
    } catch (error) {
      console.error("Error creating new game:", error);
      displayMessage(`Error creating new game: ${error.message}`);
    }
  };

  // New function to handle cancelling/deleting the active game
  const handleCancelGame = async () => {
    if (!db || !user || !appId || !userId || !selectedSlot) {
      displayMessage("Database not ready, user not signed in, or no slot selected.");
      return;
    }
    // Check if there's an active game to cancel
    if (games.length === 0 || games[0].endedAt) {
      displayMessage("No active game to cancel.");
      return;
    }

    const activeGameId = games[0].id;
    const activeGameNumber = games[0].gameNumber;

    if (window.confirm(`Are you sure you want to cancel Game ${activeGameNumber}? This action cannot be undone.`)) {
      try {
        const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeGameId);
        await deleteDoc(gameDocRef);
        displayMessage(`Game ${activeGameNumber} cancelled successfully.`);
        // After cancellation, the useEffect for games will re-run and update the state
        // currentGamePlayers will then default to empty or previous slot's players.
      } catch (error) {
        console.error("Error cancelling game:", error);
        displayMessage(`Error cancelling game: ${error.message}`);
      }
    }
  };

  // Handles adding a player to the master player list in Firestore
  const handleAddPlayerToMasterList = async (playerName) => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready or user not signed in.");
      return;
    }
    if (!playerName.trim()) {
      displayMessage("Player name cannot be empty.");
      return;
    }
    if (masterPlayerList.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      displayMessage("Player with this name already exists in your master list.");
      return;
    }

    try {
      // Get the document reference for the specific user
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
      // Get the collection reference for 'masterPlayers' as a subcollection
      const masterPlayersRef = collection(userDocRef, 'masterPlayers');

      // Add the new player document to the masterPlayers collection
      await addDoc(masterPlayersRef, {
        name: playerName.trim(),
        createdAt: Date.now(),
      });
      displayMessage(`Player ${playerName} added to your master list.`);
    } catch (error) {
      console.error("Error adding player to master list:", error);
      displayMessage(`Error adding player: ${error.message}`);
    }
  };

  // Handles removing a player from the master player list in Firestore
  const handleRemovePlayerFromMasterList = async (playerId, playerName) => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready or user not signed in.");
      return;
    }
    // Prevent removal if the player is part of an active game
    const isGameActive = games.length > 0 && !games[0].endedAt;
    if (isGameActive && currentGamePlayers.some(p => p.name === playerName)) {
      displayMessage("Cannot remove a player from the master list if they are part of the active game. End the game first.");
      return;
    }

    try {
      // Get the document reference for the specific user
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
      // Get the document reference for the player to be removed within the masterPlayers subcollection
      const playerDocRef = doc(collection(userDocRef, 'masterPlayers'), playerId);
      await deleteDoc(playerDocRef);
      displayMessage(`Player ${playerName} removed from your master list.`);
    } catch (error) {
      console.error("Error removing player from master list:", error);
      displayMessage(`Error removing player: ${error.message}`);
    }
  };

  // Toggles a player's selection for the *next* game to be created
  const onTogglePlayerForNextGame = (playerName) => {
    const isPlayerSelected = currentGamePlayers.some(p => p.name === playerName);

    if (isPlayerSelected) {
      // Remove player if already selected for the next game
      setCurrentGamePlayers(currentGamePlayers.filter(p => p.name !== playerName));
      displayMessage(`${playerName} removed from next game selection.`);
    } else {
      // Add player if not selected for the next game
      const playerToAdd = masterPlayerList.find(p => p.name === playerName);
      if (playerToAdd) {
        setCurrentGamePlayers([...currentGamePlayers, { name: playerToAdd.name, score: 0 }]);
        displayMessage(`${playerName} added to next game selection.`);
      }
    }
  };

  // Handles updating a player's score within the active game
  const handleUpdatePlayerScore = (playerName, scoreValue) => {
    const updatedPlayers = currentGamePlayers.map(player =>
      player.name === playerName ? { ...player, score: parseInt(scoreValue) || 0 } : player
    );
    setCurrentGamePlayers(updatedPlayers);
  };

  // NEW: Handles toggling the 'isRotationGame' field for the current active game
  const handleToggleRotationForCurrentGame = async (isRotation) => {
    if (!db || !user || !appId || !userId || !selectedSlot || games.length === 0 || games[0].endedAt) {
      displayMessage("Cannot update rotation status: No active game.");
      return;
    }

    const activeGameId = games[0].id;
    const activeGameNumber = games[0].gameNumber;

    try {
      const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeGameId);
      await updateDoc(gameDocRef, {
        isRotationGame: isRotation,
      });
      displayMessage(`Game ${activeGameNumber} rotation status updated to: ${isRotation ? 'Yes' : 'No'}.`);
    } catch (error) {
      console.error("Error updating rotation status:", error);
      displayMessage(`Error updating rotation status: ${error.message}`);
    }
  };


  // Handles ending the current active game
  const handleEndGame = async () => {
    if (!selectedSlot || games.length === 0 || games[0].endedAt) {
      displayMessage("No active game to end. Create a new game first.");
      return;
    }
    if (currentGamePlayers.length < 2) {
      displayMessage("Need at least two players to end a game.");
      return;
    }

    const zeroScorePlayers = currentGamePlayers.filter(p => p.score === 0);
    let winnerPlayer = null;

    if (zeroScorePlayers.length === 0) {
      displayMessage("Please set one player's score to 0 to designate them as the winner.");
      return;
    } else if (zeroScorePlayers.length > 1) {
      displayMessage(
        "Multiple players have 0 points. Only one player can be the winner. " +
        "Please adjust scores or remove players to ensure a single winner."
      );
      return;
    } else {
      winnerPlayer = zeroScorePlayers[0];
    }

    let totalPointsFromLosers = 0;
    const finalPlayersScores = currentGamePlayers.map(player => {
      if (player.name === winnerPlayer.name) {
        return { name: player.name, score: 0 }; // Winner's score is 0 initially, will be updated to totalPointsFromLosers
      } else {
        const pointsLost = Math.abs(player.score); // Ensure points lost are positive
        totalPointsFromLosers += pointsLost;
        return { name: player.name, score: -pointsLost }; // Losers have negative scores
      }
    });

    // Assign the total points from losers to the winner
    const winnerIndex = finalPlayersScores.findIndex(p => p.name === winnerPlayer.name);
    if (winnerIndex !== -1) {
      finalPlayersScores[winnerIndex].score = totalPointsFromLosers;
    }

    // Final validation: sum of all scores in the game should be zero
    const finalSum = finalPlayersScores.reduce((sum, p) => sum + p.score, 0);
    if (finalSum !== 0) {
      console.error("Validation failed: Calculated total points for the game is not zero.", finalPlayersScores);
      displayMessage("Error: Calculated total points for the game is not zero. Please check scores.");
      return;
    }

    const currentGameDocId = games[0].id;

    try {
      // Update the active game document in Firestore
      const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, currentGameDocId);
      await updateDoc(gameDocRef, {
        players: finalPlayersScores,
        winnerPlayerName: winnerPlayer.name,
        pointsTransferred: totalPointsFromLosers,
        endedAt: Date.now(), // Mark the game as ended
        // isRotationGame: games[0].isRotationGame, // Keep the existing value
      });

      displayMessage(`Game ${games[0].gameNumber} ended! ${winnerPlayer.name} won ${totalPointsFromLosers} points!`);
    } catch (error) {
      console.error("Error ending game:", error);
      displayMessage(`Error ending game: ${error.message}`);
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
        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg space-y-8">
          {/* Global Player Management Button - available when user is logged in */}
          <button
            onClick={() => setShowPlayerManager(true)}
            // MODIFIED: Reduced scale and added translate-y
            className="w-full px-6 py-3 mb-6 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-102 hover:-translate-y-0.5"
            // Disable if a game is active in a selected slot, as player roster for active game is fixed
            disabled={selectedSlot && games.length > 0 && !games[0].endedAt}
          >
            {selectedSlot && games.length > 0 && !games[0].endedAt ? "End Current Game to Manage Players" : "Manage Your Player Roster"}
          </button>

          {/* Slot Management Section */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Your Slots</h2>
            {selectedSlot && (
            <div className="mt-8 pt-8 border-t border-gray-400">
              <h2 className="text-2xl font-bold text-white mb-4">
                Active Slot: {selectedSlot.slotId} ({selectedSlot.date})
              </h2>

              <GameInput
                currentGamePlayers={currentGamePlayers} // Players for active game or selected for next
                handleUpdatePlayerScore={handleUpdatePlayerScore}
                handleEndGame={handleEndGame}
                handleCreateNewGame={handleCreateNewGame}
                handleCancelGame={handleCancelGame}
                games={games}
                masterPlayerList={masterPlayerList}
                onTogglePlayerForNextGame={onTogglePlayerForNextGame} // Function to select/deselect players for next game
                onToggleRotationForCurrentGame={handleToggleRotationForCurrentGame} // NEW PROP
              />

              <GameList games={games} />
            </div>
          )}
            <SlotList
              slots={slots}
              selectedSlot={selectedSlot}
              handleCreateNewSlot={handleCreateNewSlot}
              handleSelectSlot={handleSelectSlot}
            />
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl shadow-lg">
          <p className="text-xl text-white mb-6">Please sign in with your Google account to manage your slot scores.</p>
        </div>
      )}

      {/* Player Manager Modal */}
      {showPlayerManager && (
        <PlayerManager
          masterPlayerList={masterPlayerList} // Pass the master player list to the manager
          onAddPlayer={handleAddPlayerToMasterList} // Function to add to master list in Firestore
          onRemovePlayer={handleRemovePlayerFromMasterList} // Function to remove from master list in Firestore
          onClose={() => setShowPlayerManager(false)}
        />
      )}
    </div>
  );
}

export default App;