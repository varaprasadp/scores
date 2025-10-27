// src/App.js

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
import CreateSlotModal from './components/CreateSlotModal';

function App() {
  const { auth, user, db, appId, userId, loading } = useFirebase();
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [games, setGames] = useState([]);
  const [currentGamePlayers, setCurrentGamePlayers] = useState([]);
  const [message, setMessage] = useState('');
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const [masterPlayerList, setMasterPlayerList] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [pendingGame, setPendingGame] = useState(null);
  const [editingGameInfo, setEditingGameInfo] = useState(null);
  const [boardCharge, setBoardCharge] = useState(0);
  const [showCreateSlotModal, setShowCreateSlotModal] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState(null);
  const activeGameIdInUI = useRef(null);
  const prevMasterPlayerListRef = useRef();
  
  const displayMessage = useCallback((msg) => {
    setMessage(msg);
    const timerId = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timerId);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, [auth]);

  const handleSignOut = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
    setSelectedSlot(null);
  }, [auth]);

  useEffect(() => {
    if (!db || !user || !appId || !userId) {
        setSlots([]);
        return;
    }
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/slots`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
        setSlots(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => unsubscribe();
  }, [db, user, appId, userId]);
  
  useEffect(() => {
    if (!db || !user || !appId || !userId) {
        setMasterPlayerList([]);
        return;
    }
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/masterPlayers`), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setMasterPlayerList(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => unsubscribe();
  }, [db, user, appId, userId]);
  
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
    const unsubscribe = onSnapshot(qGames, (snapshot) => {
      const newGamesFromDB = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setGames(newGamesFromDB);
      if (editingGameInfo || pendingGame?.isLocallyActive) {
        if (prevMasterPlayerListRef.current !== masterPlayerList) {
          setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
        }
        activeGameIdInUI.current = null;
        return;
      }
      const latestGameDataFromDB = newGamesFromDB[0] || null;
      if (latestGameDataFromDB && !latestGameDataFromDB.endedAt) {
        activeGameIdInUI.current = latestGameDataFromDB.id;
        const initialPlayers = (latestGameDataFromDB.players || [])
            .map(p_db => ({ name: p_db.name, score: p_db.score === undefined ? 0 : p_db.score, dropped: p_db.dropped || false }))
            .filter(p => masterPlayerNamesSet.has(p.name));
          setCurrentGamePlayers(initialPlayers);
      } else {
        activeGameIdInUI.current = null;
        let playersForSetup = (latestGameDataFromDB?.players || [])
          .map(p => ({ name: p.name, score: 0, dropped: false }))
          .filter(p => masterPlayerNamesSet.has(p.name));
        setCurrentGamePlayers(playersForSetup);
      }
    });
    prevMasterPlayerListRef.current = masterPlayerList;
    return () => unsubscribe();
  }, [db, user, appId, userId, selectedSlot, masterPlayerList, loading, displayMessage, pendingGame, editingGameInfo]);

  const handleSelectSlot = useCallback((slot) => {
    if (slot === null) {
      if (pendingGame?.isLocallyActive) {
        setConfirmation({ type: 'CANCEL_NEW_GAME', title: 'Cancel New Game?', message: `Are you sure you want to cancel the new game? All progress will be lost.`, payload: { andGoBack: true } });
        return;
      }
      if (editingGameInfo) {
        setConfirmation({ type: 'CANCEL_EDIT', title: 'Cancel Edit?', message: `Are you sure you want to cancel editing Game ${editingGameInfo.gameNumber}? Your changes will be lost.`, payload: { andGoBack: true } });
        return;
      }
    }
    setSelectedSlot(slot);
    setPendingGame(null);
    setEditingGameInfo(null);
    setBoardCharge(0);
    setSelectedWinner(null);
    activeGameIdInUI.current = null;
    if (!slot) {
      setCurrentGamePlayers([]);
    }
  }, [pendingGame, editingGameInfo]);

  const handleCreateNewSlot = useCallback((dropValue) => {
    if (!db || !user || !appId || !userId) {
      displayMessage("Database not ready.");
      return;
    }
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const userSlotsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots`);
    const q = query(userSlotsCollectionRef, where('date', '==', dateString), orderBy('slotId', 'desc'), limit(1));
    getDocs(q).then(querySnapshot => {
      let nextSlotId = 1;
      if (!querySnapshot.empty) {
        nextSlotId = querySnapshot.docs[0].data().slotId + 1;
      }
      const newSlotData = { slotId: nextSlotId, date: dateString, createdAt: Date.now(), userName: user.displayName || user.email, dropValue: dropValue };
      addDoc(userSlotsCollectionRef, newSlotData).then(newSlotDoc => {
        displayMessage(`New slot created with drop value: ${dropValue}`);
        setSelectedSlot({ id: newSlotDoc.id, ...newSlotData });
        setShowCreateSlotModal(false);
      });
    });
  }, [db, user, appId, userId, displayMessage]);
  
  const initiateDeleteSlot = useCallback((slot) => {
    if (!slot) return;
    setConfirmation({
        type: 'DELETE_SLOT',
        title: 'Confirm Slot Deletion',
        message: `Are you sure you want to permanently delete Slot ${slot.slotId} (${slot.date})? This action cannot be undone.`,
        payload: slot
    });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmation) return;
    const { type, payload } = confirmation;
    switch (type) {
      case 'CANCEL_NEW_GAME':
        displayMessage("New game cancelled.");
        setPendingGame(null);
        setBoardCharge(0);
        setSelectedWinner(null);
        if (payload?.andGoBack) setSelectedSlot(null);
        break;
      case 'CANCEL_EDIT':
        displayMessage(`Cancelled editing Game ${editingGameInfo.gameNumber}.`);
        setEditingGameInfo(null);
        setBoardCharge(0);
        setSelectedWinner(null);
        if (payload?.andGoBack) setSelectedSlot(null);
        break;
      case 'DELETE_SLOT':
        if (!payload || !db || !user || !appId || !userId) break;
        try {
            const slotDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots`, payload.id);
            await deleteDoc(slotDocRef);
            displayMessage(`Slot ${payload.slotId} (${payload.date}) deleted.`);
            if (selectedSlot && selectedSlot.id === payload.id) {
                setSelectedSlot(null);
            }
        } catch (error) {
            displayMessage(`Error deleting slot: ${error.message}`);
        }
        break;
      default:
        break;
    }
    setConfirmation(null);
  }, [confirmation, db, user, appId, userId, selectedSlot, editingGameInfo, displayMessage]);

  const handleDismissConfirmation = useCallback(() => setConfirmation(null), []);

  const handleCancelGame = useCallback(() => {
    if (!pendingGame) return;
    setConfirmation({ type: 'CANCEL_NEW_GAME', title: 'Confirm Cancellation', message: `Are you sure you want to cancel Game ${pendingGame.gameNumber}?` });
  }, [pendingGame]);

  const handleCancelEdit = useCallback(() => {
    if (!editingGameInfo) return;
    setConfirmation({ type: 'CANCEL_EDIT', title: 'Confirm Cancellation', message: `Are you sure you want to cancel editing Game ${editingGameInfo.gameNumber}?` });
  }, [editingGameInfo]);
  
  // --- Missing functions are now defined here ---
  const handleUpdatePlayerScore = useCallback((playerName, scoreInput) => {
    const newScore = Math.max(0, parseInt(scoreInput, 10) || 0);
    setCurrentGamePlayers(prev => prev.map(p => (p.name === playerName ? { ...p, score: newScore } : p)));
  }, []);

  const handleUpdateBoardCharge = useCallback((charge) => {
    const newCharge = Math.max(0, parseInt(charge, 10) || 0);
    setBoardCharge(newCharge);
  }, []);

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

  const handleToggleRotationForCurrentGame = useCallback((isRotation) => {
    if (editingGameInfo) {
      setEditingGameInfo(prev => prev ? { ...prev, isRotationGame: isRotation } : null);
    } else if (pendingGame?.isLocallyActive) {
      setPendingGame(prev => prev ? { ...prev, isRotationGame: isRotation } : null);
    }
  }, [pendingGame, editingGameInfo]);

  const handleInitiateEditLastEndedGame = useCallback(() => {
    if (!selectedSlot || games.length === 0) {
      displayMessage("No games in this slot to edit.");
      return;
    }
    const endedGames = games.filter(g => g.endedAt).sort((a, b) => b.gameNumber - a.gameNumber);
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
    setSelectedWinner(lastEndedGame.winnerPlayerName);
    setPendingGame(null);
    displayMessage(`Editing Game ${lastEndedGame.gameNumber}. Adjust scores and save.`);
  }, [games, selectedSlot, displayMessage]);

  const handleTogglePlayerDropped = useCallback((playerName) => {
    const dropValue = selectedSlot?.dropValue || 1;
    setCurrentGamePlayers(prev =>
      prev.map(p => {
        if (p.name === playerName) {
          const isNowDropped = !p.dropped;
          if (isNowDropped) {
            if (selectedWinner === playerName) setSelectedWinner(null);
            return { ...p, dropped: true, score: dropValue };
          } else {
            return { ...p, dropped: false, score: 0 };
          }
        }
        return p;
      })
    );
  }, [selectedSlot, selectedWinner]);

  const handleSetWinner = useCallback((playerName) => {
    setSelectedWinner(playerName);
    setCurrentGamePlayers(prev =>
      prev.map(p => {
        if (p.name === playerName) return { ...p, score: 0, dropped: false };
        return p;
      })
    );
  }, []);

  const handleEndGame = useCallback(async () => {
    if (!selectedWinner) {
      displayMessage("Please select a winner.");
      return;
    }
    const isNewGame = pendingGame?.isLocallyActive;
    const isEditing = !!editingGameInfo;
    let totalPointsTransferred = 0;
    const finalPlayerScores = currentGamePlayers.map(player => {
      if (player.name === selectedWinner) return { name: player.name, score: 0, dropped: false };
      totalPointsTransferred += player.score;
      return { name: player.name, score: -player.score, dropped: player.dropped || false };
    });
    const winnerIdx = finalPlayerScores.findIndex(p => p.name === selectedWinner);
    if (winnerIdx !== -1) finalPlayerScores[winnerIdx].score = totalPointsTransferred - boardCharge;
    const commonGameData = { players: finalPlayerScores, winnerPlayerName: selectedWinner, pointsTransferred: totalPointsTransferred, boardCharge, endedAt: serverTimestamp() };
    try {
        if (isEditing) {
            const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, editingGameInfo.id);
            await updateDoc(gameDocRef, { ...commonGameData, isRotationGame: editingGameInfo.isRotationGame });
            displayMessage(`Game ${editingGameInfo.gameNumber} updated!`);
        } else if (isNewGame) {
            const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
            await addDoc(slotGamesCollectionRef, { ...commonGameData, gameNumber: pendingGame.gameNumber, createdAt: serverTimestamp(), isRotationGame: pendingGame.isRotationGame });
            displayMessage(`Game ${pendingGame.gameNumber} ended!`);
        }
        setEditingGameInfo(null);
        setPendingGame(null);
        setSelectedWinner(null);
        setBoardCharge(0);
    } catch (error) {
        displayMessage(`Error saving game: ${error.message}`);
    }
  }, [db, user, appId, userId, selectedSlot, currentGamePlayers, boardCharge, displayMessage, pendingGame, editingGameInfo, selectedWinner]);
  
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
    setPendingGame({ gameNumber: lastGameNumber + 1, isRotationGame: false, isLocallyActive: true });
    setBoardCharge(0);
    setCurrentGamePlayers(players => players.map(p => ({...p, dropped: false, score: 0})));
    setSelectedWinner(null);
    displayMessage(`New Game ${lastGameNumber + 1} started. Enter scores.`);
  }, [selectedSlot, currentGamePlayers, games, pendingGame, editingGameInfo, displayMessage]);

  const renderContent = () => {
    if (loading) return <div className="text-center p-6">Loading...</div>;
    if (!user) return <div className="p-6 text-center">Please sign in.</div>;
    if (selectedSlot) {
      return (
        <div className="p-3 sm:p-4 space-y-4">
             <div className="flex items-center justify-between mb-3">
                 <button onClick={() => handleSelectSlot(null)} className="px-3 py-2 bg-gray-700 text-white rounded-md">
                     Back to Slots
                 </button>
                 <div className="text-right">
                    <h2 className="text-lg font-bold text-white">
                        Slot {selectedSlot.slotId} ({selectedSlot.date})
                    </h2>
                    <p className="text-xs text-yellow-400">Drop Value: {selectedSlot.dropValue || 1}</p>
                 </div>
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
            editingGameInfo={editingGameInfo}
            onInitiateEditLastEndedGame={handleInitiateEditLastEndedGame}
            onCancelEdit={handleCancelEdit}
            canEditLastGame={games.some(g => g.endedAt)}
            boardCharge={boardCharge}
            handleUpdateBoardCharge={handleUpdateBoardCharge}
            handleTogglePlayerDropped={handleTogglePlayerDropped}
            selectedWinner={selectedWinner}
            handleSetWinner={handleSetWinner}
          />
          <GameList games={games} />
        </div>
      );
    }
    return (
        <div className="p-3 sm:p-4 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-2xl font-bold text-white">Your Slots</h2>
                <button onClick={() => setShowPlayerManager(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg">
                    Manage Roster
                </button>
            </div>
            <SlotList
                slots={slots}
                handleCreateNewSlot={() => setShowCreateSlotModal(true)}
                handleSelectSlot={handleSelectSlot}
                handleDeleteSlot={initiateDeleteSlot}
            />
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header>
        <AuthButtons user={user} handleGoogleSignIn={handleGoogleSignIn} handleSignOut={handleSignOut} />
      </Header>
      <MessageDisplay message={message} />
      <main className="p-1">
        {renderContent()}
      </main>
      {showCreateSlotModal && <CreateSlotModal onClose={() => setShowCreateSlotModal(false)} onCreate={handleCreateNewSlot} />}
      {confirmation && <ConfirmationDialog show={!!confirmation} title={confirmation.title} message={confirmation.message} onConfirm={handleConfirmAction} onCancel={handleDismissConfirmation} />}
    </div>
  );
}
export default App;
