// src/App.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useFirebase } from './contexts/FirebaseContext';
import {
    addDoc, collection, deleteDoc, doc, onSnapshot,
    orderBy, query, where, getDocs, limit, updateDoc, serverTimestamp
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

    const [pendingGame, setPendingGame] = useState(null); // For a new game not yet saved
    const [editingGameInfo, setEditingGameInfo] = useState(null); // { id, gameNumber, isRotationGame } for editing
    const [boardCharge, setBoardCharge] = useState(0); // State for board charge on a game

    const activeGameIdInUI = useRef(null); // Firestore ID of an *active* game being shown in UI
    const prevMasterPlayerListRef = useRef();

    const displayMessage = useCallback((msg) => {
        setMessage(msg);
        const timerId = setTimeout(() => setMessage(''), 3000);
        return () => clearTimeout(timerId);
    }, []);

    const handleGoogleSignIn = useCallback(async () => {/* ... same ... */
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

    const handleSignOut = useCallback(async () => { /* ... same ... */
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
            setEditingGameInfo(null); // Reset editing state
            setBoardCharge(0);
            activeGameIdInUI.current = null;
        } catch (error) {
            console.error("Error during sign-out:", error);
            displayMessage(`Sign-out failed: ${error.message}`);
        }
    }, [auth, displayMessage]);

    // Fetch Slots
    useEffect(() => { /* ... same ... */
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
    useEffect(() => { /* ... same ... */
        if (loading || !db || !user || !appId || !userId) {
            setMasterPlayerList([]);
            return;
        }
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
        const masterPlayersRef = collection(userDocRef, 'masterPlayers');
        const q = query(masterPlayersRef, orderBy('name', 'asc')); // Sort by name
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
        // If editing, pending game, or no slot selected, UI is driven by those states, not this effect primarily.
        if (editingGameInfo || loading || !db || !user || !appId || !userId || !selectedSlot) {
            if (!editingGameInfo && !pendingGame && !selectedSlot) { // Clear games only if truly nothing is active
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

            // If editing, pending game is active, or master player list changed, these states take precedence or modify current players.
            if (editingGameInfo || pendingGame?.isLocallyActive) {
                if (prevMasterPlayerListRef.current !== masterPlayerList && (editingGameInfo || pendingGame?.isLocallyActive)) {
                     setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
                }
                activeGameIdInUI.current = null; // No DB game is the focus of input UI
                return;
            }

            const latestGameDataFromDB = newGamesFromDB.length > 0 ? newGamesFromDB[0] : null;

            if (latestGameDataFromDB && !latestGameDataFromDB.endedAt) { // An active game exists in Firestore
                activeGameIdInUI.current = latestGameDataFromDB.id;
                const uiScoresShouldBePreserved =
                    activeGameIdInUI.current === latestGameDataFromDB.id &&
                    currentGamePlayers.length === (latestGameDataFromDB.players?.length || 0) &&
                    currentGamePlayers.every(p => latestGameDataFromDB.players.some(dbP => dbP.name === p.name));

                if (uiScoresShouldBePreserved) {
                    if (prevMasterPlayerListRef.current !== masterPlayerList) {
                        setCurrentGamePlayers(prev => prev.filter(p => masterPlayerNamesSet.has(p.name)));
                    }
                } else {
                    const initialPlayers = (latestGameDataFromDB.players || [])
                        .map(p_db => ({ name: p_db.name, score: p_db.score === undefined ? 0 : p_db.score }))
                        .filter(p => masterPlayerNamesSet.has(p.name));
                    setCurrentGamePlayers(initialPlayers);
                }
            } else { // No active game in DB for this slot, or DB games list is empty
                activeGameIdInUI.current = null;
                let playersForSetup = [];
                if (latestGameDataFromDB && latestGameDataFromDB.endedAt) { // Last game in current slot ended
                    playersForSetup = (latestGameDataFromDB.players || [])
                        .map(p => ({ name: p.name, score: 0 }))
                        .filter(p => masterPlayerNamesSet.has(p.name));
                } else if (newGamesFromDB.length === 0) { // No games in current slot, try previous slot
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
                                    playersForSetup = (lastGamePrevSlotInner.players || [])
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
            if (!pendingGame && !editingGameInfo) setCurrentGamePlayers([]);
        });
        
        prevMasterPlayerListRef.current = masterPlayerList;
        return () => unsubscribe();
    }, [db, user, appId, userId, selectedSlot, masterPlayerList, loading, displayMessage, pendingGame, editingGameInfo]);


    const handleCreateNewSlot = useCallback(async () => { /* ... same ... */
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
            setPendingGame(null);
            setEditingGameInfo(null); // Reset editing state
            setBoardCharge(0);
            setCurrentGamePlayers([]);
        } catch (error) {
            console.error("Error creating new slot:", error);
            displayMessage(`Error creating slot: ${error.message}`);
        }
    }, [db, user, appId, userId, displayMessage]);

    const handleSelectSlot = useCallback((slot) => { /* ... same, added editingGameInfo reset ... */
        // Prevent changing slot if a game interaction is active
        if (pendingGame?.isLocallyActive) {
            displayMessage("Finish or cancel the current new game before changing slots.");
            return;
        }
        if (editingGameInfo) {
            displayMessage("Save or cancel editing the game before changing slots.");
            return;
        }
        const activeDBGame = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);
        if (activeDBGame) {
            displayMessage(`Game ${activeDBGame.gameNumber} is active. End or cancel it before changing slots.`);
            return;
        }

        setSelectedSlot(slot);
        setPendingGame(null);
        setEditingGameInfo(null); // Reset editing state
        setBoardCharge(0);
        activeGameIdInUI.current = null;
        if (!slot) { // If deselecting slot (going back to slot list)
            setCurrentGamePlayers([]);
        }
        // currentGamePlayers will be set by useEffect when slot is selected
    }, [pendingGame, editingGameInfo, games, activeGameIdInUI, displayMessage]);

    // Renamed from handleStartLocalGame
    const handleStartNewGame = useCallback(() => {
        if (!selectedSlot) {
            displayMessage("Please select a slot first."); return;
        }
        if (editingGameInfo) {
            displayMessage("Currently editing a game. Cancel or save first."); return;
        }
        if (currentGamePlayers.length < 2) {
            displayMessage("A new game needs at least two players."); return;
        }
        const isFirestoreGameActive = games.some(g => !g.endedAt);
        if (isFirestoreGameActive) {
            displayMessage("An existing game is active. End it before starting a new one."); return;
        }
        if (pendingGame?.isLocallyActive) {
            displayMessage("A new game is already in progress. End or cancel it first."); return;
        }

        const lastGameNumberFromDB = games.length > 0 ? games.reduce((max, g) => Math.max(max, g.gameNumber || 0), 0) : 0;
        const nextGameNumber = lastGameNumberFromDB + 1;

        setPendingGame({
            gameNumber: nextGameNumber,
            createdAt: Date.now(), // Will be serverTimestamp on save for addDoc
            isRotationGame: false,
            isLocallyActive: true,
        });
        setBoardCharge(0); // Reset board charge for new game
        displayMessage(`New Game ${nextGameNumber} started. Enter scores.`);
        activeGameIdInUI.current = null;
        setEditingGameInfo(null);
    }, [selectedSlot, currentGamePlayers, games, pendingGame, displayMessage, editingGameInfo]);

    const handleUpdatePlayerScore = useCallback((playerName, scoreInput) => { /* ... same ... */
        const newScore = Math.max(0, parseInt(scoreInput, 10) || 0);
        setCurrentGamePlayers(prev => prev.map(p => (p.name === playerName ? { ...p, score: newScore } : p)));
    }, []);

    const handleUpdateBoardCharge = useCallback((charge) => {
        const newCharge = Math.max(0, parseInt(charge, 10) || 0);
        setBoardCharge(newCharge);
    }, []);

    const handleToggleRotationForCurrentGame = useCallback((isRotation) => {
        if (editingGameInfo) {
            setEditingGameInfo(prev => prev ? { ...prev, isRotationGame: isRotation } : null);
            return;
        }
        if (pendingGame?.isLocallyActive) {
            setPendingGame(prev => prev ? { ...prev, isRotationGame: isRotation } : null);
            return;
        }
        const activeGameFromState = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);
        if (!selectedSlot || !activeGameFromState || !db || !user || !appId || !userId) {
            displayMessage("Cannot update rotation: No active game or not signed in."); return;
        }
        const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeGameFromState.id);
        updateDoc(gameDocRef, { isRotationGame: isRotation })
          .catch(error => displayMessage(`Error updating rotation: ${error.message}`));
    }, [games, selectedSlot, db, user, appId, userId, displayMessage, pendingGame, editingGameInfo]);

    const handleEndGame = useCallback(async () => { // Handles ending new game AND saving edited game
        const isNewGame = pendingGame?.isLocallyActive;
        const isEditing = !!editingGameInfo;
        const activeFirestoreGame = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);

        if (!isNewGame && !isEditing && !activeFirestoreGame) {
            displayMessage("No active game to end or save."); return;
        }
        if (currentGamePlayers.length < 2) {
            displayMessage("A game needs at least two players."); return;
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
        if (winnerIdx !== -1) {
            finalPlayerScores[winnerIdx].score = totalPointsTransferred - boardCharge;
        }
        
        if (finalPlayerScores.reduce((sum, p) => sum + p.score, 0) !== -boardCharge) {
            displayMessage("Error: Game scores do not balance after board charge. Check entries.");
            return;
        }
        
        const commonGameData = {
            players: finalPlayerScores,
            winnerPlayerName: winner.name,
            pointsTransferred: totalPointsTransferred,
            boardCharge: boardCharge,
            endedAt: serverTimestamp(), // Use serverTimestamp for consistency
        };

        if (!db || !user || !appId || !userId || !selectedSlot) {
            displayMessage("Cannot save game: Not signed in or database not ready."); return;
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
            } else if (activeFirestoreGame) {
                const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, activeFirestoreGame.id);
                await updateDoc(gameDocRef, {
                    ...commonGameData,
                    isRotationGame: activeFirestoreGame.isRotationGame,
                });
                displayMessage(`Game ${activeFirestoreGame.gameNumber} ended! ${winner.name} won.`);
                activeGameIdInUI.current = null;
            }
            setBoardCharge(0); // Reset board charge on successful save/end
        } catch (error) {
            console.error("Error saving/ending game:", error);
            displayMessage(`Error saving game: ${error.message}`);
        }
    }, [db, user, appId, userId, selectedSlot, games, pendingGame, editingGameInfo, currentGamePlayers, boardCharge, displayMessage]);


    const handleCancelGame = useCallback(() => { // Cancels a new game or an active DB game
        if (pendingGame?.isLocallyActive) {
            setGameToCancelId('local'); // 'local' indicates it's the pendingGame
            setGameToCancelNumber(pendingGame.gameNumber);
            setShowCancelGameConfirm(true);
        } else { // Cancelling an active game from Firestore
            const activeGameFromState = games.find(game => !game.endedAt && game.id === activeGameIdInUI.current);
            if (!activeGameFromState) {
                displayMessage("No active game from DB to cancel."); return;
            }
            setGameToCancelId(activeGameFromState.id);
            setGameToCancelNumber(activeGameFromState.gameNumber);
            setShowCancelGameConfirm(true);
        }
    }, [games, displayMessage, pendingGame]);
    
    const confirmCancelGame = useCallback(async () => { // Confirms cancellation of new or active DB game
        if (gameToCancelId === 'local' && pendingGame) {
            displayMessage(`New Game ${pendingGame.gameNumber} cancelled.`);
            setPendingGame(null);
            setBoardCharge(0);
            // Player list reset handled by useEffect
        } else if (gameToCancelId && gameToCancelId !== 'local') { // DB game ID
            if (!db || !user || !appId || !userId || !selectedSlot) {
                displayMessage("Cannot cancel DB game: System not ready.");
                setShowCancelGameConfirm(false); return;
            }
            try {
                const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/slots/${selectedSlot.id}/games`, gameToCancelId);
                await deleteDoc(gameDocRef); // Deleting an active (but un-ended) game
                displayMessage(`Game ${gameToCancelNumber} cancelled from database.`);
                activeGameIdInUI.current = null;
                // Player list reset handled by useEffect
            } catch (error) {
                console.error("Error cancelling game from DB:", error);
                displayMessage(`Error cancelling game: ${error.message}`);
            }
        }
        setShowCancelGameConfirm(false);
        setGameToCancelId(null);
        setGameToCancelNumber(null);
    }, [db, user, appId, userId, selectedSlot, gameToCancelId, gameToCancelNumber, displayMessage, pendingGame]);

    const dismissCancelGame = useCallback(() => { /* ... same ... */
        setShowCancelGameConfirm(false); setGameToCancelId(null); setGameToCancelNumber(null);
    }, []);

    // --- New Edit Game Functions ---
    const handleInitiateEditLastEndedGame = useCallback(() => {
        if (!selectedSlot || games.length === 0) {
            displayMessage("No games in this slot to edit.");
            return;
        }
        const endedGames = games.filter(g => g.endedAt).sort((a, b) => b.endedAt.seconds - a.endedAt.seconds); // Sort by actual ended time
        if (endedGames.length === 0) {
            displayMessage("No ended games in this slot to edit.");
            return;
        }
        const lastEndedGame = endedGames[0];

        if (!lastEndedGame || !lastEndedGame.players || !lastEndedGame.winnerPlayerName) {
            displayMessage("Last ended game data is incomplete.");
            return;
        }

        const reconstructedPlayers = lastEndedGame.players.map(p => {
            if (p.name === lastEndedGame.winnerPlayerName) {
                return { name: p.name, score: 0 };
            }
            return { name: p.name, score: Math.abs(p.score) };
        });

        setEditingGameInfo({
            id: lastEndedGame.id,
            gameNumber: lastEndedGame.gameNumber,
            isRotationGame: !!lastEndedGame.isRotationGame,
        });
        setCurrentGamePlayers(reconstructedPlayers);
        setBoardCharge(lastEndedGame.boardCharge || 0); // Load board charge for editing
        setPendingGame(null);
        activeGameIdInUI.current = null;
        displayMessage(`Editing Game ${lastEndedGame.gameNumber}. Adjust scores and save.`);
    }, [games, selectedSlot, displayMessage]);

    const handleCancelEdit = useCallback(() => {
        if (!editingGameInfo) return;
        displayMessage(`Cancelled editing Game ${editingGameInfo.gameNumber}.`);
        setEditingGameInfo(null);
        setBoardCharge(0); // Reset board charge on cancel
        setCurrentGamePlayers([]); // Or trigger useEffect to reset based on slot
    }, [editingGameInfo, displayMessage]);


    const handleAddPlayerToMasterList = useCallback(async (playerName) => { /* ... same ... */
        if (!db || !user || !appId || !userId) { displayMessage("Not signed in."); return; }
        const trimmedName = playerName.trim();
        if (!trimmedName) { displayMessage("Player name cannot be empty."); return; }
        if (masterPlayerList.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
            displayMessage(`Player "${trimmedName}" already exists.`); return;
        }
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
            const masterPlayersRef = collection(userDocRef, 'masterPlayers');
            await addDoc(masterPlayersRef, { name: trimmedName, createdAt: serverTimestamp() });
            displayMessage(`Player ${trimmedName} added to roster.`);
        } catch (error) {
            displayMessage(`Error adding player: ${error.message}`);
        }
    }, [db, user, appId, userId, masterPlayerList, displayMessage]);

    const handleRemovePlayerFromMasterList = useCallback(async (playerId, playerName) => { /* ... same ... */
        if (!db || !user || !appId || !userId) { displayMessage("Not signed in."); return; }

        const isPlayerInLocalGame = pendingGame?.isLocallyActive && currentGamePlayers.some(p => p.name === playerName);
        const firestoreActiveGame = games.find(g => !g.endedAt && g.id === activeGameIdInUI.current);
        const isPlayerInDBActiveGame = firestoreActiveGame?.players.some(p => p.name === playerName);
        const isPlayerInEditingGame = editingGameInfo && currentGamePlayers.some(p => p.name === playerName);


        if (isPlayerInLocalGame) {
            displayMessage(`Cannot remove "${playerName}"; player is in the current new game. Cancel it first.`); return;
        }
        if (isPlayerInDBActiveGame) {
            displayMessage(`Cannot remove "${playerName}"; player is in an active DB game. End or cancel that game first.`); return;
        }
        if (isPlayerInEditingGame) {
            displayMessage(`Cannot remove "${playerName}"; player is in the game being edited. Cancel edit first.`); return;
        }


        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}`);
            const playerDocRef = doc(collection(userDocRef, 'masterPlayers'), playerId);
            await deleteDoc(playerDocRef);
            displayMessage(`Player ${playerName} removed from roster.`);
        } catch (error) {
            displayMessage(`Error removing player: ${error.message}`);
        }
    }, [db, user, appId, userId, games, pendingGame, editingGameInfo, currentGamePlayers, displayMessage]);

    const onTogglePlayerForNextGame = useCallback((playerName) => { /* ... same ... */
        const isGameActiveDB = games.some(g => !g.endedAt && g.id === activeGameIdInUI.current);
        if (isGameActiveDB || pendingGame?.isLocallyActive || editingGameInfo) { // Also check editingGameInfo
            displayMessage("Cannot change player selection while a game is active or being edited.");
            return;
        }
        setCurrentGamePlayers(prev => {
            const isSelected = prev.some(p => p.name === playerName);
            if (isSelected) {
                return prev.filter(p => p.name !== playerName);
            } else {
                const playerToAdd = masterPlayerList.find(p => p.name === playerName);
                if (playerToAdd) {
                    return [...prev, { name: playerToAdd.name, score: 0 }];
                }
                return prev;
            }
        });
    }, [games, masterPlayerList, displayMessage, pendingGame, editingGameInfo]);


    const renderContent = () => {
        if (loading && !auth) { /* ... same ... */
            return (
                <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
                </div>
            );
        }
        if (!user) { /* ... same ... */
            return (
                <div className="flex flex-col items-center justify-center flex-grow p-6 text-center bg-gray-800 rounded-xl shadow-lg m-4 max-w-md mx-auto">
                    <h2 className="text-xl font-semibold text-white mb-4">Welcome!</h2>
                    <p className="text-base text-gray-300 mb-6">Please sign in with Google to manage your game scores.</p>
                </div>
            );
        }

        if (selectedSlot) {
            return (
                <div className="p-3 sm:p-4 space-y-4">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => {
                                if (pendingGame?.isLocallyActive || editingGameInfo || games.some(g => !g.endedAt && g.id === activeGameIdInUI.current)) {
                                    displayMessage("Finish, save, or cancel current game interaction before changing slots.");
                                    return;
                                }
                                handleSelectSlot(null);
                            }}
                            className="flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-900"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
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
                    />
                    <GameList games={games} />
                </div>
            );
        } else { // Slot selection view
             return ( /* ... same ... */
                <div className="p-3 sm:p-4 space-y-4 max-w-2xl mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-3 sm:gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-white">Your Gaming Slots</h2>
                        <button
                            onClick={() => setShowPlayerManager(true)}
                            className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:ring-offset-gray-900"
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

    return ( /* ... same wrapper ... */
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100 font-sans">
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
                    message={`Are you sure you want to cancel Game ${gameToCancelNumber}${gameToCancelId === 'local' ? ' (this new game)' : ''}? This action cannot be undone.`}
                    onConfirm={confirmCancelGame}
                    onCancel={dismissCancelGame}
                />
            )}
        </div>
    );
}
export default App;