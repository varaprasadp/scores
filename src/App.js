// src/App.js
import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useFirebase } from './contexts/FirebaseContext';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where, getDocs, limit } from 'firebase/firestore';

// Components
import Header from './components/Header';
import AuthButtons from './components/AuthButtons';
import MessageDisplay from './components/MessageDisplay';
import GameList from './components/GameList';
import RoundInput from './components/RoundInput';
import RoundList from './components/RoundList';
import PlayerManager from './components/PlayerManager';

function App() {
  const { auth, user, db, appId, userId } = useFirebase();
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [rounds, setRounds] = useState([]);
  // currentRoundPlayers holds players for the active round OR selected players for the next round
  const [currentRoundPlayers, setCurrentRoundPlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  // masterPlayerList holds all players managed by the user, fetched from Firestore
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
      // Clear all game-related states on sign out
      setGames([]);
      setSelectedGame(null);
      setRounds([]);
      setCurrentRoundPlayers([]);
      setMasterPlayerList([]); // Clear master player list as well
    } catch (error) {
      console.error("Error during sign-out:", error);
      displayMessage(`Sign-out failed: ${error.message}`);
    }
  };

  // Effect hook to fetch user's games from Firestore
  useEffect(() => {
    // Ensure Firebase is ready and user is logged in before attempting to fetch
    if (!db || !user || !appId || !userId) {
      console.log("Firestore not ready or user not logged in. Skipping game fetch.");
      setGames([]);
      return;
    }

    // Reference to the user's games collection
    const userGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/games`);
    // Create a query to order games by creation time in descending order
    const q = query(userGamesCollectionRef, orderBy('createdAt', 'desc'));

    // Set up a real-time listener for games
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedGames = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGames(fetchedGames);
    }, (error) => {
      console.error("Error fetching games:", error);
      displayMessage(`Error fetching games: ${error.message}`);
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

  // Effect hook to fetch rounds for the selected game and manage current round players
  useEffect(() => {
    // Clear rounds and current players if Firebase not ready or no game selected
    if (!db || !user || !appId || !userId || !selectedGame) {
      setCurrentRoundPlayers([]);
      setRounds([]);
      return;
    }

    // Reference to the rounds subcollection for the selected game
    const gameRoundsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/games/${selectedGame.id}/rounds`);
    // Query to get rounds ordered by round number in descending order
    const q = query(gameRoundsCollectionRef, orderBy('roundNumber', 'desc'));

    // Set up a real-time listener for rounds
    const unsubscribe = onSnapshot(q, async (snapshot) => { // Made async to allow fetching previous game's rounds
      const fetchedRounds = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRounds(fetchedRounds);

      let playersForNextRound = [];

      if (fetchedRounds.length > 0) {
        // Case 1: Active round exists for the current game
        if (!fetchedRounds[0].endedAt) {
          playersForNextRound = fetchedRounds[0].players.map(p => ({ ...p, score: p.score || 0 }));
        } else {
          // Case 2: Last round ended in the current game, so default to players from that last completed round
          const lastCompletedRound = fetchedRounds.find(round => round.endedAt);
          if (lastCompletedRound) {
            playersForNextRound = lastCompletedRound.players.map(p => ({ name: p.name, score: 0 }));
          } else {
            // Fallback: If no completed rounds in current game (unlikely if fetchedRounds > 0 and not active)
            // This scenario should ideally be covered by the next "else" block.
            console.warn("Unexpected state: fetchedRounds exist but no active or completed rounds.");
          }
        }
      } else {
        // Case 3: No rounds exist for the current game.
        // Try to get players from the last completed round of the most recent *previous* game.
        let defaultPlayersFromPreviousGame = [];

        const userGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/games`);
        // Get games ordered by creation time, limiting to 2.
        // This will give us the selected game and potentially the one before it.
        const gamesQuery = query(userGamesCollectionRef, orderBy('createdAt', 'desc'), limit(2));
        const gamesSnapshot = await getDocs(gamesQuery);

        let previousGameId = null;
        // Iterate to find the game that is NOT the currently selected game.
        gamesSnapshot.docs.forEach(doc => {
            if (doc.id !== selectedGame.id) {
                previousGameId = doc.id;
            }
        });

        if (previousGameId) {
          const previousGameRoundsRef = collection(db, `artifacts/${appId}/users/${userId}/games/${previousGameId}/rounds`);
          // Query the rounds of the previous game, order by round number descending, limit to 1 to get the last round
          const prevRoundsQuery = query(previousGameRoundsRef, orderBy('roundNumber', 'desc'), limit(1));
          const prevRoundsSnapshot = await getDocs(prevRoundsQuery);

          if (!prevRoundsSnapshot.empty) {
            const lastRoundOfPrevGame = prevRoundsSnapshot.docs[0].data();
            // Only use players from a round that was actually completed
            if (lastRoundOfPrevGame.endedAt) {
              defaultPlayersFromPreviousGame = lastRoundOfPrevGame.players.map(p => ({ name: p.name, score: 0 }));
              console.log(`Defaulting players from last round of previous game (${previousGameId}).`);
            }
          }
        }
        
        // If players were found from a previous game's last round, use them.
        if (defaultPlayersFromPreviousGame.length > 0) {
            playersForNextRound = defaultPlayersFromPreviousGame;
        } else {
            // Fallback: If no previous game's last round, or no completed rounds there,
            // then no players are pre-selected by default.
            playersForNextRound = []; // Explicitly set to empty if no defaults found
            console.log("No previous round players found to default. Starting with empty selection.");
        }
      }

      // IMPORTANT: Filter the `playersForNextRound` against the `masterPlayerList`
      // This ensures that only players currently existing in the master list are pre-selected.
      const masterPlayerNames = new Set(masterPlayerList.map(p => p.name));
      const filteredPlayersForNextRound = playersForNextRound.filter(player => 
        masterPlayerNames.has(player.name)
      );

      setCurrentRoundPlayers(filteredPlayersForNextRound);

    }, (error) => {
      console.error("Error fetching rounds:", error);
      displayMessage(`Error fetching rounds: ${error.message}`);
    });

    // Clean up the listener
    return () => unsubscribe();
  }, [db, user, appId, userId, selectedGame, masterPlayerList]); // masterPlayerList is a dependency now

  // Handles creation of a new game
  const handleCreateNewGame = async () => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready or user not signed in.");
      return;
    }

    try {
      const userGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/games`);

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      // Query to find existing games for today to determine the next game ID
      const q = query(
        userGamesCollectionRef,
        where('date', '==', dateString),
        orderBy('gameId', 'desc')
      );

      const querySnapshot = await getDocs(q);
      let nextGameId = 1;

      if (!querySnapshot.empty) {
        const latestGame = querySnapshot.docs[0].data();
        nextGameId = latestGame.gameId + 1;
      }

      // Add the new game document to Firestore
      const newGameDoc = await addDoc(userGamesCollectionRef, {
        gameId: nextGameId,
        date: dateString,
        createdAt: Date.now(),
        userName: user.displayName || user.email || 'Anonymous',
      });
      displayMessage(`New game created successfully with ID: ${nextGameId} for ${dateString}!`);
      // Select the newly created game
      setSelectedGame({ id: newGameDoc.id, gameId: nextGameId, date: dateString, createdAt: Date.now(), userName: user.displayName || user.email || 'Anonymous' });
    } catch (error) {
      console.error("Error creating new game:", error);
      displayMessage(`Error creating new game: ${error.message}`);
    }
  };

  // Handles selection of an existing game
  const handleSelectGame = (game) => {
    setSelectedGame(game);
    setRounds([]); // Clear rounds when a new game is selected
    displayMessage(`Game ${game.gameId} (${game.date}) selected.`);
  };

  // Handles creation of a new round for the selected game
  const handleCreateNewRound = async () => {
    if (!db || !user || !appId || !userId || !selectedGame) {
      displayMessage("Please select a game to create a new round.");
      return;
    }
    // Ensure players are selected for the new round
    if (currentRoundPlayers.length === 0) {
      displayMessage("Please select players for the round before creating it.");
      return;
    }
    if (currentRoundPlayers.length < 2) {
      displayMessage("A round requires at least two players.");
      return;
    }
    // Prevent creating a new round if an existing one is active
    const isRoundActive = rounds.length > 0 && !rounds[0].endedAt;
    if (isRoundActive) {
      displayMessage("The current round is not yet ended. Please end it before creating a new one.");
      return;
    }

    try {
      const gameRoundsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/games/${selectedGame.id}/rounds`);

      let nextRoundNumber = 1;
      if (rounds.length > 0) {
        nextRoundNumber = rounds[0].roundNumber + 1;
      }

      // Prepare players for the new round, initializing their scores to 0
      const playersForNewRound = currentRoundPlayers.map(player => ({
        name: player.name,
        score: 0
      }));

      // Add the new round document to Firestore
      await addDoc(gameRoundsCollectionRef, {
        roundNumber: nextRoundNumber,
        createdAt: Date.now(),
        players: playersForNewRound,
        winnerPlayerName: null,
        pointsTransferred: 0,
        endedAt: null,
      });

      displayMessage(`New round ${nextRoundNumber} created for Game ${selectedGame.gameId}.`);
    } catch (error) {
      console.error("Error creating new round:", error);
      displayMessage(`Error creating new round: ${error.message}`);
    }
  };

  // New function to handle cancelling/deleting the active round
  const handleCancelRound = async () => {
    if (!db || !user || !appId || !userId || !selectedGame) {
      displayMessage("Database not ready, user not signed in, or no game selected.");
      return;
    }
    // Check if there's an active round to cancel
    if (rounds.length === 0 || rounds[0].endedAt) {
      displayMessage("No active round to cancel.");
      return;
    }

    const activeRoundId = rounds[0].id;
    const activeRoundNumber = rounds[0].roundNumber;

    if (window.confirm(`Are you sure you want to cancel Round ${activeRoundNumber}? This action cannot be undone.`)) {
      try {
        const roundDocRef = doc(db, `artifacts/${appId}/users/${userId}/games/${selectedGame.id}/rounds`, activeRoundId);
        await deleteDoc(roundDocRef);
        displayMessage(`Round ${activeRoundNumber} cancelled successfully.`);
        // After cancellation, the useEffect for rounds will re-run and update the state
        // currentRoundPlayers will then default to empty or previous game's players.
      } catch (error) {
        console.error("Error cancelling round:", error);
        displayMessage(`Error cancelling round: ${error.message}`);
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
    // Prevent removal if the player is part of an active round
    const isRoundActive = rounds.length > 0 && !rounds[0].endedAt;
    if (isRoundActive && currentRoundPlayers.some(p => p.name === playerName)) {
      displayMessage("Cannot remove a player from the master list if they are part of the active round. End the round first.");
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

  // Toggles a player's selection for the *next* round to be created
  const onTogglePlayerForNextRound = (playerName) => {
    const isPlayerSelected = currentRoundPlayers.some(p => p.name === playerName);

    if (isPlayerSelected) {
      // Remove player if already selected for the next round
      setCurrentRoundPlayers(currentRoundPlayers.filter(p => p.name !== playerName));
      displayMessage(`${playerName} removed from next round selection.`);
    } else {
      // Add player if not selected for the next round
      const playerToAdd = masterPlayerList.find(p => p.name === playerName);
      if (playerToAdd) {
        setCurrentRoundPlayers([...currentRoundPlayers, { name: playerToAdd.name, score: 0 }]);
        displayMessage(`${playerName} added to next round selection.`);
      }
    }
  };

  // Handles updating a player's score within the active round
  const handleUpdatePlayerScore = (playerName, scoreValue) => {
    const updatedPlayers = currentRoundPlayers.map(player =>
      player.name === playerName ? { ...player, score: parseInt(scoreValue) || 0 } : player
    );
    setCurrentRoundPlayers(updatedPlayers);
  };

  // Handles ending the current active round
  const handleEndRound = async () => {
    if (!selectedGame || rounds.length === 0 || rounds[0].endedAt) {
      displayMessage("No active round to end. Create a new round first.");
      return;
    }
    if (currentRoundPlayers.length < 2) {
      displayMessage("Need at least two players to end a round.");
      return;
    }

    const zeroScorePlayers = currentRoundPlayers.filter(p => p.score === 0);
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
    const finalPlayersScores = currentRoundPlayers.map(player => {
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

    // Final validation: sum of all scores in the round should be zero
    const finalSum = finalPlayersScores.reduce((sum, p) => sum + p.score, 0);
    if (finalSum !== 0) {
      console.error("Validation failed: Calculated total points for the round is not zero.", finalPlayersScores);
      displayMessage("Error: Calculated total points for the round is not zero. Please check scores.");
      return;
    }

    const currentRoundDocId = rounds[0].id;

    try {
      // Update the active round document in Firestore
      const roundDocRef = doc(db, `artifacts/${appId}/users/${userId}/games/${selectedGame.id}/rounds`, currentRoundDocId);
      await updateDoc(roundDocRef, {
        players: finalPlayersScores,
        winnerPlayerName: winnerPlayer.name,
        pointsTransferred: totalPointsFromLosers,
        endedAt: Date.now(), // Mark the round as ended
      });

      displayMessage(`Round ${rounds[0].roundNumber} ended! ${winnerPlayer.name} won ${totalPointsFromLosers} points!`);
    } catch (error) {
      console.error("Error ending round:", error);
      displayMessage(`Error ending round: ${error.message}`);
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
            className="w-full px-6 py-3 mb-6 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            // Disable if a round is active in a selected game, as player roster for active round is fixed
            disabled={selectedGame && rounds.length > 0 && !rounds[0].endedAt}
          >
            {selectedGame && rounds.length > 0 && !rounds[0].endedAt ? "End Current Round to Manage Players" : "Manage Your Player Roster"}
          </button>

          {/* Game Management Section */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Your Games</h2>
            {selectedGame && (
            <div className="mt-8 pt-8 border-t border-gray-400">
              <h2 className="text-2xl font-bold text-white mb-4">
                Active Game: {selectedGame.gameId} ({selectedGame.date})
              </h2>

              <RoundInput
                currentRoundPlayers={currentRoundPlayers} // Players for active round or selected for next
                handleUpdatePlayerScore={handleUpdatePlayerScore}
                handleEndRound={handleEndRound}
                handleCreateNewRound={handleCreateNewRound}
                handleCancelRound={handleCancelRound} 
                rounds={rounds}
                masterPlayerList={masterPlayerList} // Pass the full master list for selection
                onTogglePlayerForNextRound={onTogglePlayerForNextRound} // Function to select/deselect players for next round
              />

              <RoundList rounds={rounds} />
            </div>
          )}
            <GameList
              games={games}
              selectedGame={selectedGame}
              handleCreateNewGame={handleCreateNewGame}
              handleSelectGame={handleSelectGame}
            />
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl shadow-lg">
          <p className="text-xl text-white mb-6">Please sign in with your Google account to manage your game scores.</p>
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