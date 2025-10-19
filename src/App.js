import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useFirebase } from './contexts/FirebaseContext';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, where, getDocs, limit, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  const [pendingGame, setPendingGame] = useState(null);
  const [editingGameInfo, setEditingGameInfo] = useState(null);
  const [boardCharge, setBoardCharge] = useState(0);
  const activeGameIdInUI = useRef(null);
  const prevMasterPlayerListRef = useRef();

  const displayMessage = useCallback((msg) => {
    setMessage(msg);
    const timerId = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timerId);
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
      setPendingGame(null);
      setEditingGameInfo(null);
      setBoardCharge(0);
      activeGameIdInUI.current = null;
    } catch (error) {
      console.error("Error during sign-out:", error);
      displayMessage(`Sign-out failed: ${error.message}`);
    }
  }, [auth, displayMessage]);

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

  useEffect(() => {
    if (loading || !db || !user || !appId || !userId) {
      setMasterPlayerList([]);
      return;
    }
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
    const masterPlayersRef = collection(userDocRef, 'masterPlayers');
    const q = query(masterPlayersRef, orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMasterPlayerList(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => {
      console.error("Error fetching master player list:", error);
      displayMessage(`Error fetching master players: ${error.message}`);
    });
    return () => unsubscribe();
  }, [db, user, appId, userId, loading, displayMessage]);

  useEffect(() => {
    if (editingGameInfo || loading || !db || !user || !appId || !userId || !selectedSlot) {
      if (!editingGameInfo && !pendingGame && !selectedSlot) {
        setGames([]);
        setCurrentGamePlayers([]);
        activeGameIdInUI.current = null;
      }
      prevMasterPlayerListRef.current = masterPlayerList;
      return;
    }

    const masterPlayerNamesSet = new Set(masterPlayerList.map(p => p.name));
    const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
    const qGames = query(slotGamesCollectionRef, orderBy('gameNumber', 'desc'));

    const unsubscribe = onSnapshot(qGames, async (snapshot) => {
      const newGamesFromDB = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setGames(newGamesFromDB);

      if (editingGameInfo || pendingGame?.isLocallyActive) {
        if (prevMasterPlayerListRef.current !== masterPlayerList) {
          setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
        }
        activeGameIdInUI.current = null;
        return;
      }

      const latestGameDataFromDB = newGamesFromDB.length > 0 ? newGamesFromDB[0] : null;

      if (latestGameDataFromDB && !latestGameDataFromDB.endedAt) {
        activeGameIdInUI.current = latestGameDataFromDB.id;
        const uiScoresShouldBePreserved = activeGameIdInUI.current === latestGameDataFromDB.id &&
          currentGamePlayers.length === (latestGameDataFromDB.players?.length || 0) &&
          currentGamePlayers.every(p => latestGameDataFromDB.players.some(dbP => dbP.name === p.name));

        if (!uiScoresShouldBePreserved) {
          const initialPlayers = (latestGameDataFromDB.players || [])
            .map(p_db => ({
              name: p_db.name,
              score: p_db.score === undefined ? 0 : p_db.score,
              dropped: p_db.dropped || false
            }))
            .filter(p => masterPlayerNamesSet.has(p.name));
          setCurrentGamePlayers(initialPlayers);
        }
      } else {
        activeGameIdInUI.current = null;
        let playersForSetup = [];
        if (latestGameDataFromDB && latestGameDataFromDB.endedAt) {
           playersForSetup = (latestGameDataFromDB.players || [])
             .map(p => ({ name: p.name, score: 0, dropped: false }))
             .filter(p => masterPlayerNamesSet.has(p.name));
        }
        setCurrentGamePlayers(playersForSetup);
      }
    }, (error) => {
      console.error("Error fetching games:", error);
      displayMessage(`Error fetching games details: ${error.message}`);
      if (!pendingGame && !editingGameInfo) setCurrentGamePlayers([]);
    });

    prevMasterPlayerListRef.current = masterPlayerList;
    return () => unsubscribe();
  }, [db, user, appId, userId, selectedSlot, masterPlayerList, loading, displayMessage, pendingGame, editingGameInfo]);

  const handleCreateNewSlot = useCallback(async () => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready or user not signed in.");
      return;
    }
    try {
      const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
      const today = new Date();
      const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const q = query(userSlotsCollectionRef, where('date', '==', dateString), orderBy('slotId', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let nextSlotId = 1;
      if (!querySnapshot.empty) {
        nextSlotId = querySnapshot.docs[0].data().slotId + 1;
      }
      const newSlotData = {
        slotId: nextSlotId,
        date: dateString,
        createdAt: Date.now(),
        userName: user.displayName || user.email || 'AnonymousUser',
      };
      const newSlotDoc = await addDoc(userSlotsCollectionRef, newSlotData);
      displayMessage(`New slot created: ${dateString} (ID: ${nextSlotId})`);
      setSelectedSlot({ id: newSlotDoc.id, ...newSlotData });
      setPendingGame(null);
      setEditingGameInfo(null);
      setBoardCharge(0);
      setCurrentGamePlayers([]);
    } catch (error) {
      console.error("Error creating new slot:", error);
      displayMessage(`Error creating slot: ${error.message}`);
    }
  }, [db, user, appId, userId, displayMessage]);

  const handleSelectSlot = useCallback((slot) => {
    if (pendingGame?.isLocallyActive || editingGameInfo) {
      displayMessage("Finish, save, or cancel the current game interaction before changing slots.");
      return;
    }
    setSelectedSlot(slot);
    setPendingGame(null);
    setEditingGameInfo(null);
    setBoardCharge(0);
    activeGameIdInUI.current = null;
    if (!slot) {
      setCurrentGamePlayers([]);
    }
  }, [pendingGame, editingGameInfo, displayMessage]);

  const handleStartNewGame = useCallback(() => {
    if (!selectedSlot) {
      displayMessage("Please select a slot first.");
      return;
    }
    if (editingGameInfo || games.some(g => !g.endedAt) || pendingGame?.isLocallyActive) {
      displayMessage("A game is already active. Finish it before starting a new one.");
      return;
    }
    if (currentGamePlayers.length < 2) {
      displayMessage("A new game needs at least two players.");
      return;
    }

    const lastGameNumber = games.length > 0 ? games.reduce((max, g) => Math.max(max, g.gameNumber || 0), 0) : 0;
    setPendingGame({
      gameNumber: lastGameNumber + 1,
      isRotationGame: false,
      isLocallyActive: true,
    });
    setBoardCharge(0);
    setCurrentGamePlayers(players => players.map(p => ({...p, dropped: false, score: 0})));
    displayMessage(`New Game ${lastGameNumber + 1} started. Enter scores.`);
  }, [selectedSlot, currentGamePlayers, games, pendingGame, editingGameInfo, displayMessage]);

  const handleUpdatePlayerScore = useCallback((playerName, scoreInput) => {
    const newScore = Math.max(0, parseInt(scoreInput, 10) || 0);
    setCurrentGamePlayers(prev => prev.map(p => (p.name === playerName ? { ...p, score: newScore } : p)));
  }, []);
    
  // ** START: Corrected Logic **
  const handleTogglePlayerDropped = useCallback((playerName) => {
    const player = currentGamePlayers.find(p => p.name === playerName);
    if (!player) return;

    // These checks only apply when trying to DROP a player, not un-drop.
    if (!player.dropped) {
        // --- Get current state of active players ---
        const activePlayers = currentGamePlayers.filter(p => !p.dropped);
        const nonZeroScoreCountInActive = activePlayers.filter(p => p.score > 0).length;

        // --- Rule 1: Prevent dropping a player with a non-zero score ---
        if (player.score > 0) {
            displayMessage(`Cannot drop ${playerName}. Please clear their score first.`);
            return;
        }

        // --- Rule 2: Prevent dropping the designated winner ---
        // This is true if this player is the *only* active player with a score of 0,
        // and all other active players have scores.
        if (
            activePlayers.length > 1 &&
            nonZeroScoreCountInActive === activePlayers.length - 1 &&
            player.score === 0
        ) {
            displayMessage(`Cannot drop ${playerName} as they are the designated winner.`);
            return;
        }

        // --- Rule 3: Prevent dropping if it leaves fewer than 2 active players ---
        if (activePlayers.length <= 2) {
            displayMessage(`Cannot drop ${playerName}. At least two players must remain active.`);
            return;
        }
    }

    // If all checks pass, proceed with toggling the state.
    setCurrentGamePlayers(prev =>
      prev.map(p => {
        if (p.name === playerName) {
          const isNowDropped = !p.dropped;
          // When dropping or un-dropping, always reset the score to 0.
          return { ...p, dropped: isNowDropped, score: 0 };
        }
        return p;
      })
    );
  }, [currentGamePlayers, displayMessage]);
  // ** END: Corrected Logic **

  const handleUpdateBoardCharge = useCallback((charge) => {
    const newCharge = Math.max(0, parseInt(charge, 10) || 0);
    setBoardCharge(newCharge);
  }, []);

  const handleToggleRotationForCurrentGame = useCallback((isRotation) => {
    if (editingGameInfo) {
      setEditingGameInfo(prev => prev ? { ...prev, isRotationGame: isRotation } : null);
    } else if (pendingGame?.isLocallyActive) {
      setPendingGame(prev => prev ? { ...prev, isRotationGame: isRotation } : null);
    }
  }, [pendingGame, editingGameInfo]);

  const handleEndGame = useCallback(async () => {
    const isNewGame = pendingGame?.isLocallyActive;
    const isEditing = !!editingGameInfo;
    
    if (!isNewGame && !isEditing) {
      displayMessage("No active game to end or save.");
      return;
    }

    const activePlayers = currentGamePlayers.filter(p => !p.dropped);
    if (activePlayers.length < 2) {
      displayMessage("At least two players must be active (not dropped) to end the game.");
      return;
    }

    const winners = activePlayers.filter(p => p.score === 0);
    if (winners.length !== 1) {
      displayMessage("Exactly one active (non-dropped) player must have a score of 0 to be the winner.");
      return;
    }

    const winner = winners[0];
    let totalPointsTransferred = 0;

    const finalPlayerScores = currentGamePlayers.map(player => {
      if (player.dropped) {
        return { name: player.name, score: 0, dropped: true };
      }
      if (player.name === winner.name) {
        return { name: player.name, score: 0 }; // Placeholder score
      }
      totalPointsTransferred += player.score;
      return { name: player.name, score: -player.score };
    });
    
    const winnerIdx = finalPlayerScores.findIndex(p => p.name === winner.name);
    if (winnerIdx !== -1) {
      finalPlayerScores[winnerIdx].score = totalPointsTransferred - boardCharge;
    }

    const commonGameData = {
      players: finalPlayerScores,
      winnerPlayerName: winner.name,
      pointsTransferred: totalPointsTransferred,
      boardCharge: boardCharge,
      endedAt: serverTimestamp(),
    };

    if (!db || !user || !appId || !userId || !selectedSlot) {
      displayMessage("Cannot save game: Not signed in or database not ready.");
      return;
    }

    try {
      if (isEditing) {
        const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, editingGameInfo.id);
        await updateDoc(gameDocRef, {
          ...commonGameData,
          isRotationGame: editingGameInfo.isRotationGame,
        });
        displayMessage(`Game ${editingGameInfo.gameNumber} updated! ${winner.name} won.`);
        setEditingGameInfo(null);
      } else if (isNewGame) {
        const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
        await addDoc(slotGamesCollectionRef, {
          ...commonGameData,
          gameNumber: pendingGame.gameNumber,
          createdAt: serverTimestamp(),
          isRotationGame: pendingGame.isRotationGame,
        });
        displayMessage(`Game ${pendingGame.gameNumber} ended! ${winner.name} won.`);
        setPendingGame(null);
      }
      setBoardCharge(0);
    } catch (error) {
      console.error("Error saving/ending game:", error);
      displayMessage(`Error saving game: ${error.message}`);
    }
  }, [db, user, appId, userId, selectedSlot, games, pendingGame, editingGameInfo, currentGamePlayers, boardCharge, displayMessage]);

  const handleCancelGame = useCallback(() => {
    if (pendingGame?.isLocallyActive) {
      setGameToCancelId('local');
      setGameToCancelNumber(pendingGame.gameNumber);
      setShowCancelGameConfirm(true);
    } else {
        displayMessage("No active game to cancel.");
    }
  }, [pendingGame]);

  const confirmCancelGame = useCallback(async () => {
    if (gameToCancelId === 'local' && pendingGame) {
      displayMessage(`New Game ${pendingGame.gameNumber} cancelled.`);
      setPendingGame(null);
      setBoardCharge(0);
    }
    setShowCancelGameConfirm(false);
    setGameToCancelId(null);
    setGameToCancelNumber(null);
  }, [gameToCancelId, pendingGame, displayMessage]);
    
  const dismissCancelGame = useCallback(() => {
    setShowCancelGameConfirm(false);
    setGameToCancelId(null);
    setGameToCancelNumber(null);
  }, []);

  const handleInitiateEditLastEndedGame = useCallback(() => {
    if (!selectedSlot || games.length === 0) {
      displayMessage("No games in this slot to edit.");
      return;
    }
    const endedGames = games.filter(g => g.endedAt).sort((a, b) => b.endedAt.seconds - a.endedAt.seconds);
    if (endedGames.length === 0) {
      displayMessage("No ended games in this slot to edit.");
      return;
    }
    
    const lastEndedGame = endedGames[0];
    
    const reconstructedPlayers = lastEndedGame.players.map(p => ({
        name: p.name,
        score: p.name === lastEndedGame.winnerPlayerName ? 0 : Math.abs(p.score),
        dropped: p.dropped || false
    }));

    setEditingGameInfo({
      id: lastEndedGame.id,
      gameNumber: lastEndedGame.gameNumber,
      isRotationGame: !!lastEndedGame.isRotationGame,
    });
    setCurrentGamePlayers(reconstructedPlayers);
    setBoardCharge(lastEndedGame.boardCharge || 0);
    setPendingGame(null);
    displayMessage(`Editing Game ${lastEndedGame.gameNumber}. Adjust scores and save.`);
  }, [games, selectedSlot, displayMessage]);

  const handleCancelEdit = useCallback(() => {
    if (!editingGameInfo) return;
    displayMessage(`Cancelled editing Game ${editingGameInfo.gameNumber}.`);
    setEditingGameInfo(null);
    setBoardCharge(0);
    setCurrentGamePlayers([]);
  }, [editingGameInfo, displayMessage]);

  const handleAddPlayerToMasterList = useCallback(async (playerName) => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Not signed in.");
      return;
    }
    const trimmedName = playerName.trim();
    if (!trimmedName || masterPlayerList.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      displayMessage(`Player "${trimmedName}" is invalid or already exists.`);
      return;
    }
    try {
      const masterPlayersRef = collection(db, `artifacts/${appId}/users/${userId}/masterPlayers`);
      await addDoc(masterPlayersRef, { name: trimmedName, createdAt: serverTimestamp() });
      displayMessage(`Player ${trimmedName} added to roster.`);
    } catch (error) {
      displayMessage(`Error adding player: ${error.message}`);
    }
  }, [db, user, appId, userId, masterPlayerList, displayMessage]);

  const handleRemovePlayerFromMasterList = useCallback(async (playerId, playerName) => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Not signed in.");
      return;
    }
    if (pendingGame?.isLocallyActive && currentGamePlayers.some(p => p.name === playerName) || editingGameInfo && currentGamePlayers.some(p => p.name === playerName)) {
      displayMessage(`Cannot remove "${playerName}" while they are in an active or edited game.`);
      return;
    }
    try {
      const playerDocRef = doc(db, `artifacts/${appId}/users/${userId}/masterPlayers`, playerId);
      await deleteDoc(playerDocRef);
      displayMessage(`Player ${playerName} removed from roster.`);
    } catch (error) {
      displayMessage(`Error removing player: ${error.message}`);
    }
  }, [db, user, appId, userId, pendingGame, editingGameInfo, currentGamePlayers, displayMessage]);
  
  const onTogglePlayerForNextGame = useCallback((playerName) => {
    if (pendingGame?.isLocallyActive || editingGameInfo) {
      displayMessage("Cannot change player selection while a game is active or being edited.");
      return;
    }
    setCurrentGamePlayers(prev => {
      const isSelected = prev.some(p => p.name === playerName);
      if (isSelected) {
        return prev.filter(p => p.name !== playerName);
      } else {
        const playerToAdd = masterPlayerList.find(p => p.name === playerName);
        return playerToAdd ? [...prev, { name: playerToAdd.name, score: 0, dropped: false }] : prev;
      }
    });
  }, [masterPlayerList, displayMessage, pendingGame, editingGameInfo]);

  const renderContent = () => {
    if (loading) {
      return <div className="text-center p-6">Loading...</div>;
    }
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center flex-grow p-6 text-center bg-gray-800 rounded-xl shadow-lg m-4 max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-white mb-4">Welcome!</h2>
                <p className="text-base text-gray-300 mb-6">Please sign in with Google to manage your game scores.</p>
                <div/>
            </div>
        );
    }
    if (selectedSlot) {
      return (
        <div className="p-3 sm:p-4 space-y-4">
             <div className="flex items-center justify-between mb-3">
                 <button onClick={() => handleSelectSlot(null)} className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md shadow-sm text-sm">
                     Back to Slots
                 </button>
                 <h2 className="text-lg sm:text-xl font-bold text-white text-right truncate">
                     Slot {selectedSlot.slotId} <span className="font-normal text-sm sm:text-base">({selectedSlot.date})</span>
                 </h2>
             </div>

          <GameInput
            currentGamePlayers={currentGamePlayers}
            handleUpdatePlayerScore={handleUpdatePlayerScore}
            handleEndGame={handleEndGame}
            handleStartNewGame={handleStartNewGame}
            handleCancelGame={handleCancelGame}
            games={games}
            masterPlayerList={masterPlayerList}
            onTogglePlayerForNextGame={onTogglePlayerForNextGame}
            onToggleRotationForCurrentGame={handleToggleRotationForCurrentGame}
            pendingGame={pendingGame}
            activeFirestoreGameId={activeGameIdInUI.current}
            editingGameInfo={editingGameInfo}
            onInitiateEditLastEndedGame={handleInitiateEditLastEndedGame}
            onCancelEdit={handleCancelEdit}
            canEditLastGame={games.some(g => g.endedAt)}
            boardCharge={boardCharge}
            handleUpdateBoardCharge={handleUpdateBoardCharge}
            handleTogglePlayerDropped={handleTogglePlayerDropped}
          />
          <GameList games={games} />
        </div>
      );
    }
    return (
        <div className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-3 sm:gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Your Gaming Slots</h2>
                <button onClick={() => setShowPlayerManager(true)} className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md text-xs sm:text-sm">
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
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header>
        <AuthButtons user={user} handleGoogleSignIn={handleGoogleSignIn} handleSignOut={handleSignOut} />
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
