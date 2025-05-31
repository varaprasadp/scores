import React from 'react';

function GameInput({
  currentGamePlayers,
  handleUpdatePlayerScore,
  handleEndGame,
  handleStartNewGame, // << Renamed from handleStartLocalGame
  handleCancelGame,
  games,
  masterPlayerList,
  onTogglePlayerForNextGame,
  onToggleRotationForCurrentGame,
  pendingGame,
  activeFirestoreGameId,
  // --- New props for Edit Functionality ---
  editingGameInfo, // { id, gameNumber, isRotationGame } | null
  onInitiateEditLastEndedGame,
  onCancelEdit,
  canEditLastGame, // boolean: true if a last ended game exists to be edited
}) {
  const isLocalGameActive = !!pendingGame?.isLocallyActive;
  const firestoreActiveGame = games.find(g => !g.endedAt && g.id === activeFirestoreGameId);
  const isGameEffectivelyActive = isLocalGameActive || !!firestoreActiveGame;
  const isEditingActive = !!editingGameInfo;

  let gameForUI; // For title and game number display during active/editing states
  if (isEditingActive) {
    gameForUI = editingGameInfo;
  } else if (isLocalGameActive) {
    gameForUI = {
      id: 'local',
      gameNumber: pendingGame.gameNumber,
      isRotationGame: pendingGame.isRotationGame,
    };
  } else if (firestoreActiveGame) {
    gameForUI = firestoreActiveGame;
  }

  const isCurrentUIGameRotation = isEditingActive
    ? editingGameInfo.isRotationGame
    : (gameForUI ? !!gameForUI.isRotationGame : false);

  const playersInCurrentInteraction = currentGamePlayers;
  const nonZeroScoreEnteredCount = playersInCurrentInteraction.filter(p => p.score !== 0).length;
  const canIdentifyWinnerForInputDisable = playersInCurrentInteraction.length > 1 && nonZeroScoreEnteredCount === playersInCurrentInteraction.length - 1;
  const potentialWinners = playersInCurrentInteraction.filter(p => p.score === 0);

  const canEndOrSaveChanges = (isGameEffectivelyActive || isEditingActive) &&
    playersInCurrentInteraction.length >= 2 &&
    potentialWinners.length === 1 &&
    nonZeroScoreEnteredCount === (playersInCurrentInteraction.length - 1);

  let nextGameNumberDisplay = 1;
  if (games.length > 0) {
    nextGameNumberDisplay = games.reduce((max, g) => Math.max(max, g.gameNumber || 0), 0) + 1;
  }

  const inputBaseClass = "p-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm";
  const primaryButtonClass = "w-full px-3 py-2.5 text-sm font-semibold rounded-md shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed";

  const title = isEditingActive
    ? `Editing Game ${editingGameInfo.gameNumber}`
    : (isGameEffectivelyActive && gameForUI
      ? `Game ${gameForUI.gameNumber}`
      : `Setup New Game ${nextGameNumberDisplay}`);

  return (
    <div className="bg-gray-800 bg-opacity-70 rounded-lg p-3 sm:p-4 shadow-md mb-4">
      <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">
        {title}
      </h3>

      {(isGameEffectivelyActive || isEditingActive) && gameForUI ? (
        // Active Game UI (New, DB, or Editing)
        <>
          <p className="text-xs sm:text-sm text-gray-300 mb-3">
            Enter points lost by each player. Winner must have 0 points.
          </p>
          <div className="space-y-2 sm:space-y-3 mb-4">
            {playersInCurrentInteraction.map((player) => {
              const isDesignatedWinnerForInput = canIdentifyWinnerForInputDisable && player.score === 0;
              const isLikelyWinnerForHighlight = player.score === 0 && canEndOrSaveChanges && potentialWinners[0]?.name === player.name;
              return (
                <div key={player.name} className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                  <label htmlFor={`score-${player.name}`} className="w-full sm:w-2/5 text-gray-200 text-sm pr-1 truncate" title={player.name}>
                    {player.name}:
                  </label>
                  <input
                    id={`score-${player.name}`}
                    type="number"
                    pattern="\d*"
                    inputMode="numeric"
                    value={player.score.toString()}
                    onChange={(e) => handleUpdatePlayerScore(player.name, e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                    disabled={isDesignatedWinnerForInput}
                    className={`w-full sm:flex-grow ${inputBaseClass}
                                ${isLikelyWinnerForHighlight ? 'ring-2 ring-green-500' : ''}
                                ${isDesignatedWinnerForInput ? 'bg-gray-600 cursor-not-allowed opacity-70' : ''}`}
                    placeholder="Points Lost"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center mt-3 mb-4">
            <input
              type="checkbox"
              id="isRotationGame"
              checked={isCurrentUIGameRotation}
              onChange={(e) => onToggleRotationForCurrentGame(e.target.checked)}
              className="form-checkbox h-4 w-4 text-purple-500 rounded bg-gray-600 border-gray-500 cursor-pointer focus:ring-purple-500 focus:ring-offset-gray-800"
            />
            <label htmlFor="isRotationGame" className="ml-2 text-gray-200 text-sm cursor-pointer select-none">
              Rotation Game
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3">
            <button
              onClick={handleEndGame} // This will handle both ending new game and saving edited game
              className={`${primaryButtonClass} sm:flex-1 bg-yellow-500 hover:bg-yellow-600 text-black focus:ring-yellow-400 disabled:bg-yellow-700 disabled:text-gray-700`}
              disabled={!canEndOrSaveChanges}
            >
              {isEditingActive ? `Save Edited Game ${editingGameInfo.gameNumber}` : `End Game ${gameForUI.gameNumber}`}
            </button>
            <button
              onClick={isEditingActive ? onCancelEdit : handleCancelGame}
              className={`${primaryButtonClass} sm:flex-1 bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`}
            >
              {isEditingActive ? 'Cancel Edit' : 'Cancel Game'}
            </button>
          </div>
        </>
      ) : (
        // Setup New Game UI (or show Edit Last Game button)
        <>
          <p className="text-xs sm:text-sm text-gray-300 mb-3">
            Select players for Game {nextGameNumberDisplay}:
          </p>

          {masterPlayerList.length === 0 ? (
            <div className="bg-gray-700 bg-opacity-50 rounded-md p-3 text-center">
              <p className="text-yellow-400 text-xs sm:text-sm">
                Add players via "Manage Player Roster" first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 mb-3">
              {masterPlayerList.map(masterPlayer => {
                const isSelected = playersInCurrentInteraction.some(p => p.name === masterPlayer.name);
                return (
                  <button
                    key={masterPlayer.id}
                    onClick={() => onTogglePlayerForNextGame(masterPlayer.name)}
                    className={`
                      flex items-center justify-center text-center p-2.5 rounded-md shadow-sm transition-colors duration-150 ease-in-out text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800
                      ${isSelected
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200 focus:ring-indigo-500'}
                    `}
                    title={masterPlayer.name}
                  >
                    <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap">{masterPlayer.name}</span>
                    {isSelected && (
                      <svg className="ml-1 h-3 w-3 sm:h-4 sm:w-4 text-green-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {playersInCurrentInteraction.length > 0 && (
            <div className="text-gray-400 text-xs mb-3 break-words p-2 bg-gray-700 bg-opacity-40 rounded-md">
              <span className="font-semibold text-gray-300">Selected:</span> {playersInCurrentInteraction.map(p => p.name).join(', ')}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:gap-3">
            <button
              onClick={handleStartNewGame} // << Renamed from handleStartLocalGame
              className={`${primaryButtonClass} w-full bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 disabled:bg-gray-500 disabled:text-gray-300`}
              disabled={playersInCurrentInteraction.length < 2 || masterPlayerList.length === 0 || isGameEffectivelyActive || isEditingActive}
            >
              Start New Game
            </button>
            {canEditLastGame && !isGameEffectivelyActive && !isEditingActive && (
              <button
                onClick={onInitiateEditLastEndedGame}
                className={`${primaryButtonClass} w-full bg-cyan-600 hover:bg-cyan-700 text-white focus:ring-cyan-500`}
              >
                Edit Last Ended Game
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
export default GameInput;