// src/App.js
import React, { useEffect, useState, useCallback, useRef } from 'react'; // Added useRef
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useFirebase } from './contexts/FirebaseContext'; 
import { 
    addDoc, collection, deleteDoc, doc, onSnapshot, 
    orderBy, query, where, getDocs, limit, updateDoc 
} from 'firebase/firestore';

import Header from './components/Header';
import AuthButtons from './components/AuthButtons';
import MessageDisplay from './components/MessageDisplay';
import SlotList from './components/SlotList';
import GameInput from './components/GameInput';
import GameList from './components/GameList';
import PlayerManager from './components/PlayerManager';
import ConfirmationDialog from './components/ConfirmationDialog';

function App() {
  const { auth, user, db, appId, userId, loading } = useFirebase(); 
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [games, setGames] = useState([]);
  const [currentGamePlayers, setCurrentGamePlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const [masterPlayerList, setMasterPlayerList] = useState([]);

  const [showCancelGameConfirm, setShowCancelGameConfirm] = useState(false);
  const [gameToCancelId, setGameToCancelId] = useState(null);
  const [gameToCancelNumber, setGameToCancelNumber] = useState(null);

  // To store the ID of the game currently being managed by GameInput if active
  const activeGameIdInUI = useRef(null);


  const displayMessage = useCallback((msg) => {
    setMessage(msg);
    const timerId = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timerId); // Cleanup timer on unmount or if called again
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (!auth) {
      displayMessage("Authentication service is not available.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      displayMessage("Signed in successfully!");
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      displayMessage(`Sign-in failed: ${error.message}`);
    }
  }, [auth, displayMessage]);

  const handleSignOut = useCallback(async () => {
    if (!auth) {
      displayMessage("Authentication service is not available.");
      return;
    }
    try {
      await signOut(auth);
      displayMessage("Signed out successfully!");
      setSlots([]);
      setSelectedSlot(null);
      setGames([]);
      setCurrentGamePlayers([]);
      setShowPlayerManager(false);
      activeGameIdInUI.current = null; // Reset active game UI ref
    } catch (error) {
      console.error("Error during sign-out:", error);
      displayMessage(`Sign-out failed: ${error.message}`);
    }
  }, [auth, displayMessage]);

  // Fetch Slots
  useEffect(() => {
    if (loading || !db || !user || !appId || !userId) {
      setSlots([]);
      return;
    }
    const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
    const q = query(userSlotsCollectionRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSlots(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => {
      console.error("Error fetching slots:", error);
      displayMessage(`Error fetching slots: ${error.message}`);
    });
    return () => unsubscribe();
  }, [db, user, appId, userId, loading, displayMessage]);

  // Fetch Master Player List
  useEffect(() => {
    if (loading || !db || !user || !appId || !userId) {
      setMasterPlayerList([]);
      return;
    }
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    const masterPlayersRef = collection(userDocRef, 'masterPlayers');
    const q = query(masterPlayersRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMasterPlayerList(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => {
      console.error("Error fetching master player list:", error);
      displayMessage(`Error fetching master players: ${error.message}`);
    });
    return () => unsubscribe();
  }, [db, user, appId, userId, loading, displayMessage]);

  // Fetch Games for Selected Slot & Prepare Next Game Players
  useEffect(() => {
    if (loading || !db || !user || !appId || !userId || !selectedSlot) {
      setCurrentGamePlayers([]);
      setGames([]);
      activeGameIdInUI.current = null;
      return;
    }

    const masterPlayerNamesSet = new Set(masterPlayerList.map(p => p.name));
    const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
    const qGames = query(slotGamesCollectionRef, orderBy('gameNumber', 'desc'));

    const unsubscribe = onSnapshot(qGames, async (snapshot) => {
      const newGamesFromDB = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setGames(newGamesFromDB); // Update games state for GameList and GameInput's game metadata

      const latestGameDataFromDB = newGamesFromDB.length > 0 ? newGamesFromDB[0] : null;

      if (latestGameDataFromDB && !latestGameDataFromDB.endedAt) {
        // An active game exists in the database.
        activeGameIdInUI.current = latestGameDataFromDB.id; // Track the DB active game ID

        // If `currentGamePlayers` is already populated and corresponds to this active game,
        // we need to be careful not to overwrite UI scores with stale DB scores.
        // This typically happens if only metadata like 'isRotationGame' changed.
        // We'll assume `currentGamePlayers` holds the latest scores for the inputs if `activeGameIdInUI.current` matches.
        // However, if the player list *structurally* changed in the DB for the active game, we might need to reconcile.
        // For now, if the active game ID in UI ref matches, we trust currentGamePlayers' scores.
        // If player list in DB has changed for the active game, or this is a new active game.
        if (currentGamePlayers.length === 0 || 
            !currentGamePlayers.every(p => latestGameDataFromDB.players.some(dbP => dbP.name === p.name)) ||
            currentGamePlayers.length !== latestGameDataFromDB.players.length ||
            !newGamesFromDB.find(g => g.id === activeGameIdInUI.current && !g.endedAt) // If the UI's active game is no longer active in DB
            ) {
                const initialPlayers = latestGameDataFromDB.players
                    .map(p_db => ({ name: p_db.name, score: p_db.score === undefined ? 0 : p_db.score }))
                    .filter(p => masterPlayerNamesSet.has(p.name));
                setCurrentGamePlayers(initialPlayers);
        } else {
             // Active game ID matches and player structure seems the same or already handled by UI.
             // Make sure to filter current players if master list changed.
             setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
        }

      } else if (latestGameDataFromDB && latestGameDataFromDB.endedAt) {
        // Latest game in DB is ended. Set up `currentGamePlayers` for a *new* game.
        activeGameIdInUI.current = null;
        const playersForSetup = latestGameDataFromDB.players
          .map(p => ({ name: p.name, score: 0 }))
          .filter(p => masterPlayerNamesSet.has(p.name));
        setCurrentGamePlayers(playersForSetup);
      } else { 
        // No games in this slot.
        activeGameIdInUI.current = null;
        let playersToSet = [];
        // (Logic for loading from previous slot - simplified here for clarity)
        const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
        const slotsQuery = query(userSlotsCollectionRef, orderBy('createdAt', 'desc'));
        const slotsSnapshot = await getDocs(slotsQuery);
        const currentSlotIndex = slotsSnapshot.docs.findIndex(docSnap => docSnap.id === selectedSlot.id);
        if (currentSlotIndex > 0) { // currentSlotIndex + 1 < length means prev exists if 0 is first
            const previousSlotId = slotsSnapshot.docs[currentSlotIndex -1].id; // Corrected index for previous
             if (previousSlotId && previousSlotId !== selectedSlot.id) { // Ensure it's actually a previous slot
                const prevSlotGamesRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${previousSlotId}/games`);
                const prevGamesQuery = query(prevSlotGamesRef, orderBy('gameNumber', 'desc'), limit(1));
                const prevGamesSnap = await getDocs(prevGamesQuery);
                if (!prevGamesSnap.empty) {
                    const lastGamePrevSlot = prevGamesSnap.docs[0].data();
                    if (lastGamePrevSlot.endedAt) {
                    playersToSet = lastGamePrevSlot.players
                        .map(p => ({ name: p.name, score: 0 }))
                        .filter(p => masterPlayerNamesSet.has(p.name));
                    }
                }
            }
        }
        setCurrentGamePlayers(playersToSet);
      }
    }, (error) => {
      console.error("Error fetching games:", error);
      displayMessage(`Error fetching games details: ${error.message}`);
      activeGameIdInUI.current = null;
    });
    return () => {
        unsubscribe();
        activeGameIdInUI.current = null; // Clear on unmount or slot change
    };
  }, [db, user, appId, userId, selectedSlot, masterPlayerList, loading, displayMessage]);
  // Removed 'games' from dependency array to prevent loop. Logic now uses activeGameIdInUI.current
  // and checks currentGamePlayers state to preserve UI scores for active game metadata updates.

  const handleCreateNewSlot = useCallback(async () => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready or user not signed in."); return;
    }
    try {
      const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
      const today = new Date();
      const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const q = query(userSlotsCollectionRef, where('date', '==', dateString), orderBy('slotId', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let nextSlotId = 1;
      if (!querySnapshot.empty) nextSlotId = querySnapshot.docs[0].data().slotId + 1;
      
      const newSlotData = {
        slotId: nextSlotId, date: dateString, createdAt: Date.now(), userName: user.displayName || user.email || 'AnonymousUser',
      };
      const newSlotDoc = await addDoc(userSlotsCollectionRef, newSlotData);
      displayMessage(`New slot created: ${dateString} (ID: ${nextSlotId})`);
      setSelectedSlot({ id: newSlotDoc.id, ...newSlotData });
    } catch (error) {
      console.error("Error creating new slot:", error);
      displayMessage(`Error creating slot: ${error.message}`);
    }
  }, [db, user, appId, userId, displayMessage]);

  const handleSelectSlot = useCallback((slot) => {
    setSelectedSlot(slot);
    activeGameIdInUI.current = null; // Reset when slot changes
    // setCurrentGamePlayers([]); // Let useEffect handle this based on new slot
    // setGames([]); // Let useEffect handle this
    displayMessage(`Slot ${slot.slotId} (${slot.date}) selected.`);
  }, [displayMessage]);

  const handleCreateNewGame = useCallback(async () => {
    if (!db || !user || !appId || !userId || !selectedSlot) {
      displayMessage("Please select a slot first."); return;
    }
    if (currentGamePlayers.length < 2) {
      displayMessage("A game needs at least two players. Select them for the new game."); return;
    }
    const isGameActiveDB = games.some(g => !g.endedAt); // Check DB state of games
    if (isGameActiveDB) {
      displayMessage("Current game is active. End it before starting a new one."); return;
    }
    try {
      const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
      const lastGameNumber = games.length > 0 ? games.reduce((max, g) => Math.max(max, g.gameNumber), 0) : 0;
      const nextGameNumber = lastGameNumber + 1;
      
      const playersForNewGame = currentGamePlayers.map(player => ({ name: player.name, score: 0 }));
      await addDoc(slotGamesCollectionRef, {
        gameNumber: nextGameNumber, createdAt: Date.now(), players: playersForNewGame,
        winnerPlayerName: null, pointsTransferred: 0, endedAt: null, isRotationGame: false,
      });
      // Don't display message here, let onSnapshot update UI and confirm
      // displayMessage(`New game ${nextGameNumber} started in Slot ${selectedSlot.slotId}.`);
    } catch (error) {
      console.error("Error creating new game:", error);
      displayMessage(`Error creating game: ${error.message}`);
    }
  }, [db, user, appId, userId, selectedSlot, currentGamePlayers, games, displayMessage]);


  const handleUpdatePlayerScore = useCallback((playerName, scoreInput) => {
    const newScore = Math.max(0, parseInt(scoreInput, 10) || 0); 
    setCurrentGamePlayers(prev => prev.map(p => (p.name === playerName ? { ...p, score: newScore } : p)));
  }, []);

  const handleToggleRotationForCurrentGame = useCallback(async (isRotation) => {
    const activeGameFromState = games.find(g => !g.endedAt); // Use games from state
    if (!selectedSlot || !activeGameFromState || !db || !user || !appId || !userId) {
      displayMessage("Cannot update rotation: No active game or not signed in."); return;
    }
    try {
      const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeGameFromState.id);
      await updateDoc(gameDocRef, { isRotationGame: isRotation });
      // Message is optional, UI will update via onSnapshot
    } catch (error) {
      displayMessage(`Error updating rotation: ${error.message}`);
    }
  }, [games, selectedSlot, db, user, appId, userId, displayMessage]);
  
  const handleEndGame = useCallback(async () => {
    const activeGameFromState = games.find(g => !g.endedAt);
    if (!selectedSlot || !activeGameFromState || !db || !user || !appId || !userId) { 
        displayMessage("No active game to end or not signed in."); return; 
    }
    if (currentGamePlayers.length < 2) { 
        displayMessage("A game needs at least two players to end."); return; 
    }

    const zeroScorePlayers = currentGamePlayers.filter(p => p.score === 0);
    if (zeroScorePlayers.length !== 1) {
      displayMessage("Exactly one player must have 0 points (the winner)."); return;
    }
    const winner = zeroScorePlayers[0];
    let totalPointsTransferred = 0;
    const finalPlayerScores = currentGamePlayers.map(player => {
      if (player.name === winner.name) return { name: player.name, score: 0 };
      totalPointsTransferred += player.score; 
      return { name: player.name, score: -player.score };
    });

    const winnerIdx = finalPlayerScores.findIndex(p => p.name === winner.name);
    if (winnerIdx !== -1) finalPlayerScores[winnerIdx].score = totalPointsTransferred;

    if (finalPlayerScores.reduce((sum, p) => sum + p.score, 0) !== 0) {
      displayMessage("Error: Game scores do not balance. Check entries."); return;
    }

    try {
      const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeGameFromState.id);
      await updateDoc(gameDocRef, {
        players: finalPlayerScores, winnerPlayerName: winner.name,
        pointsTransferred: totalPointsTransferred, endedAt: Date.now(),
      });
      displayMessage(`Game ${activeGameFromState.gameNumber} ended! ${winner.name} won ${totalPointsTransferred} points.`);
      activeGameIdInUI.current = null; // Game ended
    } catch (error) {
      displayMessage(`Error ending game: ${error.message}`);
    }
  }, [games, selectedSlot, db, user, appId, userId, currentGamePlayers, displayMessage]);

  const handleCancelGame = useCallback(() => {
    const activeGameFromState = games.find(game => !game.endedAt);
    if (!activeGameFromState) {
      displayMessage("No active game to cancel."); return;
    }
    setGameToCancelId(activeGameFromState.id);
    setGameToCancelNumber(activeGameFromState.gameNumber);
    setShowCancelGameConfirm(true);
  }, [games, displayMessage]);

  const confirmCancelGame = useCallback(async () => {
    if (!db || !user || !appId || !userId || !selectedSlot || !gameToCancelId) return;
    try {
      const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, gameToCancelId);
      await deleteDoc(gameDocRef);
      displayMessage(`Game ${gameToCancelNumber} cancelled.`);
      activeGameIdInUI.current = null; // Game cancelled
    } catch (error) {
      console.error("Error cancelling game:", error);
      displayMessage(`Error cancelling game: ${error.message}`);
    } finally {
      setShowCancelGameConfirm(false); setGameToCancelId(null); setGameToCancelNumber(null);
    }
  }, [db, user, appId, userId, selectedSlot, gameToCancelId, gameToCancelNumber, displayMessage]);

  const dismissCancelGame = useCallback(() => {
    setShowCancelGameConfirm(false); setGameToCancelId(null); setGameToCancelNumber(null);
  }, []);
  
  const handleAddPlayerToMasterList = useCallback(async (playerName) => {
    if (!db || !user || !appId || !userId) { displayMessage("Not signed in."); return; }
    const trimmedName = playerName.trim();
    if (!trimmedName) { displayMessage("Player name cannot be empty."); return; }
    if (masterPlayerList.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      displayMessage(`Player "${trimmedName}" already exists.`); return;
    }
    try {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
      const masterPlayersRef = collection(userDocRef, 'masterPlayers');
      await addDoc(masterPlayersRef, { name: trimmedName, createdAt: Date.now() });
      displayMessage(`Player ${trimmedName} added to roster.`);
    } catch (error) {
      displayMessage(`Error adding player: ${error.message}`);
    }
  }, [db, user, appId, userId, masterPlayerList, displayMessage]);

  const handleRemovePlayerFromMasterList = useCallback(async (playerId, playerName) => {
    if (!db || !user || !appId || !userId) { displayMessage("Not signed in."); return; }
    const activeGameFromState = games.find(g => !g.endedAt);
    if (activeGameFromState && activeGameFromState.players.some(p => p.name === playerName)) {
      displayMessage(`Cannot remove "${playerName}" from roster; player is in the active game. End or cancel game first.`);
      return;
    }
    try {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
      const playerDocRef = doc(collection(userDocRef, 'masterPlayers'), playerId);
      await deleteDoc(playerDocRef);
      displayMessage(`Player ${playerName} removed from roster.`);
    } catch (error)
    {
      displayMessage(`Error removing player: ${error.message}`);
    }
  }, [db, user, appId, userId, games, displayMessage]);

  const onTogglePlayerForNextGame = useCallback((playerName) => {
    const isGameActiveDB = games.some(g => !g.endedAt);
    if (isGameActiveDB) {
        displayMessage("Cannot change player selection while a game is active.");
        return;
    }
    setCurrentGamePlayers(prev => {
      const isSelected = prev.some(p => p.name === playerName);
      if (isSelected) {
        displayMessage(`${playerName} removed from next game setup.`);
        return prev.filter(p => p.name !== playerName);
      } else {
        const playerToAdd = masterPlayerList.find(p => p.name === playerName);
        if (playerToAdd) {
          displayMessage(`${playerName} added to next game setup.`);
          return [...prev, { name: playerToAdd.name, score: 0 }];
        }
        return prev;
      }
    });
  }, [games, masterPlayerList, displayMessage]);

  const renderContent = () => {
    if (loading) { 
      return (
        <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
          <p className="text-lg text-gray-300">Loading user data...</p>
        </div>
      );
    }
    if (!user) {
      return (
        <div className="flex flex-col items-center justify-center flex-grow p-6 text-center bg-gray-800 rounded-xl shadow-lg m-4">
          <p className="text-lg text-white mb-6">Please sign in with Google to manage your scores.</p>
        </div>
      );
    }
    if (selectedSlot) {
      return (
        <div className="p-3 sm:p-4 space-y-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => handleSelectSlot(null)} // handleSelectSlot is already useCallback
              className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md shadow-sm text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Back to Slots
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-white text-right">
              Slot {selectedSlot.slotId} <span className="font-normal text-sm sm:text-base">({selectedSlot.date})</span>
            </h2>
          </div>
          <GameInput
            currentGamePlayers={currentGamePlayers}
            handleUpdatePlayerScore={handleUpdatePlayerScore}
            handleEndGame={handleEndGame}
            handleCreateNewGame={handleCreateNewGame}
            handleCancelGame={handleCancelGame}
            games={games}
            masterPlayerList={masterPlayerList}
            onTogglePlayerForNextGame={onTogglePlayerForNextGame}
            onToggleRotationForCurrentGame={handleToggleRotationForCurrentGame}
          />
          <GameList games={games} />
        </div>
      );
    } else {
      return (
        <div className="p-3 sm:p-4 space-y-4">
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Your Gaming Slots</h2>
            <button
              onClick={() => setShowPlayerManager(true)}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md text-xs sm:text-sm"
            >
              Manage Player Roster
            </button>
          </div>
          <SlotList
            slots={slots}
            handleCreateNewSlot={handleCreateNewSlot}
            handleSelectSlot={handleSelectSlot}
          />
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <Header>
        <AuthButtons
          user={user}
          handleGoogleSignIn={handleGoogleSignIn}
          handleSignOut={handleSignOut}
        />
      </Header>
      <MessageDisplay message={message} />
      <main className="flex-grow overflow-y-auto p-0 sm:p-1">
        {renderContent()}
      </main>
      {showPlayerManager && (
        <PlayerManager
          masterPlayerList={masterPlayerList}
          onAddPlayer={handleAddPlayerToMasterList}
          onRemovePlayer={handleRemovePlayerFromMasterList}
          onClose={() => setShowPlayerManager(false)}
        />
      )}
      {showCancelGameConfirm && (
        <ConfirmationDialog
          show={showCancelGameConfirm}
          title="Confirm Game Cancellation"
          message={`Are you sure you want to cancel Game ${gameToCancelNumber}? This action cannot be undone.`}
          onConfirm={confirmCancelGame}
          onCancel={dismissCancelGame}
        />
      )}
    </div>
  );
}

export default App;