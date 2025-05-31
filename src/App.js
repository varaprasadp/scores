// src/App.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
    const [games, setGames] = useState([]); // Games from Firestore
    const [currentGamePlayers, setCurrentGamePlayers] = useState([]); // Players for the game being interacted with
    const [message, setMessage] = useState('');
    const [showPlayerManager, setShowPlayerManager] = useState(false);
    const [masterPlayerList, setMasterPlayerList] = useState([]);

    const [showCancelGameConfirm, setShowCancelGameConfirm] = useState(false);
    const [gameToCancelId, setGameToCancelId] = useState(null); // Can be Firestore ID or 'local'
    const [gameToCancelNumber, setGameToCancelNumber] = useState(null);

    const [pendingGame, setPendingGame] = useState(null); // { gameNumber, createdAt, isRotationGame, isLocallyActive: true }

    const activeGameIdInUI = useRef(null); // Primarily for games loaded from Firestore
    const prevMasterPlayerListRef = useRef(); // To track changes in masterPlayerList for the useEffect

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
            setPendingGame(null); // Reset pending game
            activeGameIdInUI.current = null;
        } catch (error) {
            console.error("Error during sign-out:", error);
            displayMessage(`Sign-out failed: ${error.message}`);
        }
    }, [auth, displayMessage]);

    useEffect(() => { // Fetch Slots
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

    useEffect(() => { // Fetch Master Player List
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

    // Fetch Games for Selected Slot & Prepare UI state
    useEffect(() => {
        if (loading || !db || !user || !appId || !userId || !selectedSlot) {
            setGames([]);
            if (!pendingGame) { // Only clear if no local game is in progress
                setCurrentGamePlayers([]);
                activeGameIdInUI.current = null;
            }
            // Initialize ref if masterPlayerList is available, or on first run
            prevMasterPlayerListRef.current = masterPlayerList;
            return;
        }

        const masterPlayerNamesSet = new Set(masterPlayerList.map(p => p.name));
        const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
        const qGames = query(slotGamesCollectionRef, orderBy('gameNumber', 'desc'));

        const unsubscribe = onSnapshot(qGames, async (snapshot) => {
            const newGamesFromDB = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            setGames(newGamesFromDB); // Update the list of DB games

            if (pendingGame?.isLocallyActive) {
                // A local game is active. UI is driven by pendingGame and currentGamePlayers.
                // Only filter currentGamePlayers if masterPlayerList reference itself has changed.
                // This prevents score resets if the effect was triggered by pendingGame.isRotationGame changing.
                if (prevMasterPlayerListRef.current !== masterPlayerList) {
                    setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
                }
                activeGameIdInUI.current = null; // No DB game is the focus of input UI
                return; // Stop further processing for active UI if local game is on.
            }

            // No local game is active, determine UI state based on Firestore games.
            const latestGameDataFromDB = newGamesFromDB.length > 0 ? newGamesFromDB[0] : null;

            if (latestGameDataFromDB && !latestGameDataFromDB.endedAt) {
                activeGameIdInUI.current = latestGameDataFromDB.id;
                // If UI's active game ID doesn't match, or player structure changed, reset from DB
                // Also, ensure we filter by master list if it changed.
                const uiScoresShouldBePreserved =
                    activeGameIdInUI.current === latestGameDataFromDB.id &&
                    currentGamePlayers.length === latestGameDataFromDB.players.length &&
                    currentGamePlayers.every(p => latestGameDataFromDB.players.some(dbP => dbP.name === p.name));

                if (uiScoresShouldBePreserved) {
                     // Player structure matches, keep UI scores, just filter by master list if it changed
                    if (prevMasterPlayerListRef.current !== masterPlayerList) {
                        setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
                    }
                    // If master list is same, and player structure is same, currentGamePlayers (with scores) is fine.
                } else {
                    // Load players from this active DB game
                    const initialPlayers = latestGameDataFromDB.players
                        .map(p_db => ({ name: p_db.name, score: p_db.score === undefined ? 0 : p_db.score }))
                        .filter(p => masterPlayerNamesSet.has(p.name));
                    setCurrentGamePlayers(initialPlayers);
                }
            } else {
                activeGameIdInUI.current = null;
                let playersForSetup = [];
                if (latestGameDataFromDB && latestGameDataFromDB.endedAt) {
                    playersForSetup = latestGameDataFromDB.players
                        .map(p => ({ name: p.name, score: 0 }))
                        .filter(p => masterPlayerNamesSet.has(p.name));
                } else if (newGamesFromDB.length === 0) {
                    const userSlotsCollectionRefInner = collection(db, `artifacts/${appId}/users/${userId}/slots`);
                    const slotsQueryInner = query(userSlotsCollectionRefInner, orderBy('createdAt', 'desc'));
                    const slotsSnapshotInner = await getDocs(slotsQueryInner);
                    const currentSlotIndexInner = slotsSnapshotInner.docs.findIndex(docSnap => docSnap.id === selectedSlot.id);
                    if (currentSlotIndexInner > 0) {
                        const previousSlotIdInner = slotsSnapshotInner.docs[currentSlotIndexInner - 1].id;
                        if (previousSlotIdInner && previousSlotIdInner !== selectedSlot.id) {
                            const prevSlotGamesRefInner = collection(db, `artifacts/${appId}/users/${userId}/slots/${previousSlotIdInner}/games`);
                            const prevGamesQueryInner = query(prevSlotGamesRefInner, orderBy('gameNumber', 'desc'), limit(1));
                            const prevGamesSnapInner = await getDocs(prevGamesQueryInner);
                            if (!prevGamesSnapInner.empty) {
                                const lastGamePrevSlotInner = prevGamesSnapInner.docs[0].data();
                                if (lastGamePrevSlotInner.endedAt) {
                                    playersForSetup = lastGamePrevSlotInner.players
                                        .map(p => ({ name: p.name, score: 0 }))
                                        .filter(p => masterPlayerNamesSet.has(p.name));
                                }
                            }
                        }
                    }
                }
                setCurrentGamePlayers(playersForSetup);
            }
        }, (error) => {
            console.error("Error fetching games:", error);
            displayMessage(`Error fetching games details: ${error.message}`);
            activeGameIdInUI.current = null;
            if (!pendingGame) setCurrentGamePlayers([]);
        });
        
        // Update the ref *after* the onSnapshot callback is defined and potentially run,
        // so for the *next* execution of this effect, it has the masterPlayerList from *this* execution.
        prevMasterPlayerListRef.current = masterPlayerList;

        return () => {
            unsubscribe();
        };
    }, [db, user, appId, userId, selectedSlot, masterPlayerList, loading, displayMessage, pendingGame]);

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
            setPendingGame(null); // Reset pending game
            setCurrentGamePlayers([]); // Reset players for the new slot
        } catch (error) {
            console.error("Error creating new slot:", error);
            displayMessage(`Error creating slot: ${error.message}`);
        }
    }, [db, user, appId, userId, displayMessage]);

    const handleSelectSlot = useCallback((slot) => {
        setSelectedSlot(slot);
        setPendingGame(null); // Reset pending game
        activeGameIdInUI.current = null;
        // currentGamePlayers will be set by useEffect
        if (slot) {
            displayMessage(`Slot ${slot.slotId} (${slot.date}) selected.`);
        } else {
            setCurrentGamePlayers([]); // Clear players if deselecting to main slot list
        }
    }, [displayMessage]);

    const handleStartLocalGame = useCallback(() => {
        if (!selectedSlot) {
            displayMessage("Please select a slot first."); return;
        }
        if (currentGamePlayers.length < 2) {
            displayMessage("A game needs at least two players. Select them for the new game."); return;
        }
        const isFirestoreGameActive = games.some(g => !g.endedAt);
        if (isFirestoreGameActive) {
            displayMessage("An existing game is active. End it before starting a new one."); return;
        }
        if (pendingGame?.isLocallyActive) {
            displayMessage("A local game is already in progress. End or cancel it first."); return;
        }

        const lastGameNumberFromDB = games.length > 0 ? games.reduce((max, g) => Math.max(max, g.gameNumber), 0) : 0;
        const nextGameNumber = lastGameNumberFromDB + 1;

        setPendingGame({
            gameNumber: nextGameNumber,
            createdAt: Date.now(),
            isRotationGame: false, // Default for a new local game
            isLocallyActive: true,
        });
        // currentGamePlayers are already set up (with scores 0) by onTogglePlayerForNextGame or useEffect
        displayMessage(`Local Game ${nextGameNumber} started. Enter scores.`);
        activeGameIdInUI.current = null;
    }, [selectedSlot, currentGamePlayers, games, pendingGame, displayMessage]);

    const handleUpdatePlayerScore = useCallback((playerName, scoreInput) => {
        const newScore = Math.max(0, parseInt(scoreInput, 10) || 0);
        setCurrentGamePlayers(prev => prev.map(p => (p.name === playerName ? { ...p, score: newScore } : p)));
    }, []);

    const handleToggleRotationForCurrentGame = useCallback((isRotation) => {
        if (pendingGame?.isLocallyActive) {
            setPendingGame(prev => ({ ...prev, isRotationGame: isRotation }));
            // displayMessage(`Rotation for local game ${isRotation ? 'enabled' : 'disabled'}.`); // Optional message
            return;
        }

        const activeGameFromState = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);
        if (!selectedSlot || !activeGameFromState || !db || !user || !appId || !userId) {
            displayMessage("Cannot update rotation: No active game from DB or not signed in."); return;
        }
        try {
            const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeGameFromState.id);
            updateDoc(gameDocRef, { isRotationGame: isRotation }); // Async, but no await needed if just fire and forget
        } catch (error) {
            displayMessage(`Error updating rotation: ${error.message}`);
        }
    }, [games, selectedSlot, db, user, appId, userId, displayMessage, pendingGame]);

    const handleEndGame = useCallback(async () => {
        const isLocalGameActive = pendingGame?.isLocallyActive;
        const activeFirestoreGame = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);

        if (!isLocalGameActive && !activeFirestoreGame) {
            displayMessage("No active game to end."); return;
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

        if (isLocalGameActive) { // Ending a local game
            if (!db || !user || !appId || !userId || !selectedSlot) {
                displayMessage("Cannot save game: Not signed in or database not ready."); return;
            }
            try {
                const slotGamesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`);
                await addDoc(slotGamesCollectionRef, {
                    gameNumber: pendingGame.gameNumber,
                    createdAt: pendingGame.createdAt,
                    players: finalPlayerScores,
                    winnerPlayerName: winner.name,
                    pointsTransferred: totalPointsTransferred,
                    endedAt: Date.now(),
                    isRotationGame: pendingGame.isRotationGame, // Save the rotation status from pendingGame
                });
                displayMessage(`Game ${pendingGame.gameNumber} ended and saved! ${winner.name} won ${totalPointsTransferred} points.`);
                setPendingGame(null);
            } catch (error) {
                console.error("Error saving new game:", error);
                displayMessage(`Error saving game: ${error.message}`);
            }
        } else if (activeFirestoreGame) { // Ending a game that was active in Firestore
             if (!db || !user || !appId || !userId || !selectedSlot) {
                displayMessage("Cannot end game: Not signed in or database not ready."); return;
            }
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeFirestoreGame.id);
                await updateDoc(gameDocRef, {
                    players: finalPlayerScores,
                    winnerPlayerName: winner.name,
                    pointsTransferred: totalPointsTransferred,
                    endedAt: Date.now(),
                    // isRotationGame would have been updated by its own handler if changed
                });
                displayMessage(`Game ${activeFirestoreGame.gameNumber} ended! ${winner.name} won ${totalPointsTransferred} points.`);
                activeGameIdInUI.current = null;
            } catch (error) {
                console.error("Error ending DB game:", error);
                displayMessage(`Error ending game: ${error.message}`);
            }
        }
    }, [db, user, appId, userId, selectedSlot, games, pendingGame, currentGamePlayers, displayMessage]);

    const handleCancelGame = useCallback(() => {
        if (pendingGame?.isLocallyActive) {
            setGameToCancelId('local');
            setGameToCancelNumber(pendingGame.gameNumber);
            setShowCancelGameConfirm(true);
        } else {
            const activeGameFromState = games.find(game => !game.endedAt && game.id === activeGameIdInUI.current);
            if (!activeGameFromState) {
                displayMessage("No active game from DB to cancel."); return;
            }
            setGameToCancelId(activeGameFromState.id);
            setGameToCancelNumber(activeGameFromState.gameNumber);
            setShowCancelGameConfirm(true);
        }
    }, [games, displayMessage, pendingGame]);

    const confirmCancelGame = useCallback(async () => {
        if (gameToCancelId === 'local' && pendingGame) { // Check pendingGame exists
            displayMessage(`Local Game ${pendingGame.gameNumber} cancelled.`);
            setPendingGame(null);
        } else if (gameToCancelId !== 'local' && gameToCancelId) { // Ensure it's a DB game ID
            if (!db || !user || !appId || !userId || !selectedSlot) return;
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, gameToCancelId);
                await deleteDoc(gameDocRef);
                displayMessage(`Game ${gameToCancelNumber} cancelled.`);
                activeGameIdInUI.current = null;
            } catch (error) {
                console.error("Error cancelling game:", error);
                displayMessage(`Error cancelling game: ${error.message}`);
            }
        }
        setShowCancelGameConfirm(false);
        setGameToCancelId(null);
        setGameToCancelNumber(null);
    }, [db, user, appId, userId, selectedSlot, gameToCancelId, gameToCancelNumber, displayMessage, pendingGame]);

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

        const isPlayerInLocalGame = pendingGame?.isLocallyActive && currentGamePlayers.some(p => p.name === playerName);
        const firestoreActiveGame = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);
        const isPlayerInDBActiveGame = firestoreActiveGame?.players.some(p => p.name === playerName);

        if (isPlayerInLocalGame) {
            displayMessage(`Cannot remove "${playerName}"; player is in the current local game. Cancel it first.`);
            return;
        }
        if (isPlayerInDBActiveGame) {
            displayMessage(`Cannot remove "${playerName}"; player is in an active DB game. End or cancel that game first.`);
            return;
        }

        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
            const playerDocRef = doc(collection(userDocRef, 'masterPlayers'), playerId);
            await deleteDoc(playerDocRef);
            displayMessage(`Player ${playerName} removed from roster.`);
            setCurrentGamePlayers(prev => prev.filter(p => p.name !== playerName));
        } catch (error) {
            displayMessage(`Error removing player: ${error.message}`);
        }
    }, [db, user, appId, userId, games, pendingGame, currentGamePlayers, displayMessage]);

    const onTogglePlayerForNextGame = useCallback((playerName) => {
        const isGameActiveDB = games.some(g => !g.endedAt && g.id === activeGameIdInUI.current);
        if (isGameActiveDB || pendingGame?.isLocallyActive) {
            displayMessage("Cannot change player selection while a game is active.");
            return;
        }
        setCurrentGamePlayers(prev => {
            const isSelected = prev.some(p => p.name === playerName);
            if (isSelected) {
                return prev.filter(p => p.name !== playerName);
            } else {
                const playerToAdd = masterPlayerList.find(p => p.name === playerName);
                if (playerToAdd) {
                    return [...prev, { name: playerToAdd.name, score: 0 }]; // Initialize score to 0
                }
                return prev;
            }
        });
    }, [games, masterPlayerList, displayMessage, pendingGame]);

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
                            onClick={() => {
                                if (pendingGame?.isLocallyActive) {
                                    displayMessage("Cancel or end the local game before changing slots.");
                                    return;
                                }
                                handleSelectSlot(null);
                            }}
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
                        handleStartLocalGame={handleStartLocalGame}
                        handleCancelGame={handleCancelGame}
                        games={games}
                        masterPlayerList={masterPlayerList}
                        onTogglePlayerForNextGame={onTogglePlayerForNextGame}
                        onToggleRotationForCurrentGame={handleToggleRotationForCurrentGame}
                        pendingGame={pendingGame}
                        activeFirestoreGameId={activeGameIdInUI.current}
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
                        > Manage Player Roster
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
                    message={`Are you sure you want to cancel Game ${gameToCancelNumber}${gameToCancelId === 'local' ? ' (this local game)' : ''}? This action cannot be undone.`}
                    onConfirm={confirmCancelGame}
                    onCancel={dismissCancelGame}
                />
            )}
        </div>
    );
}
export default App;