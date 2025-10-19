import React from 'react';

function GameInput({
  currentGamePlayers,
  handleUpdatePlayerScore,
  handleEndGame,
  handleStartNewGame,
  handleCancelGame,
  games,
  masterPlayerList,
  onTogglePlayerForNextGame,
  onToggleRotationForCurrentGame,
  pendingGame,
  activeFirestoreGameId,
  editingGameInfo,
  onInitiateEditLastEndedGame,
  onCancelEdit,
  canEditLastGame,
  boardCharge,
  handleUpdateBoardCharge,
  handleTogglePlayerDropped,
}) {
  const isLocalGameActive = !!pendingGame?.isLocallyActive;
  const isEditingActive = !!editingGameInfo;
  const isGameEffectivelyActive = isLocalGameActive || isEditingActive;

  let gameForUI;
  if (isEditingActive) {
    gameForUI = editingGameInfo;
  } else if (isLocalGameActive) {
    gameForUI = {
      gameNumber: pendingGame.gameNumber,
      isRotationGame: pendingGame.isRotationGame,
    };
  }

  const playersInCurrentInteraction = currentGamePlayers || [];

  // ** START: Corrected Logic **
  // 1. Get only active (not dropped) players
  const activePlayers = playersInCurrentInteraction.filter(p => !p.dropped);
  
  // 2. Base all calculations on active players
  const nonZeroScoreCountInActive = activePlayers.filter(p => p.score !== 0).length;
  const potentialWinnersInActive = activePlayers.filter(p => p.score === 0);

  // Condition to identify the winner among active players and disable their input
  const canIdentifyWinnerForInputDisable = 
    activePlayers.length > 1 && 
    nonZeroScoreCountInActive === activePlayers.length - 1;
  
  // Condition to enable the end/save game button
  const canEndOrSaveChanges =
    isGameEffectivelyActive &&
    activePlayers.length >= 2 &&
    potentialWinnersInActive.length === 1 &&
    nonZeroScoreCountInActive === (activePlayers.length - 1);
  // ** END: Corrected Logic **

  const nextGameNumberDisplay = games.length > 0
    ? games.reduce((max, g) => Math.max(max, g.gameNumber || 0), 0) + 1
    : 1;

  const inputBaseClass = "p-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm";
  const primaryButtonClass = "w-full px-3 py-2.5 text-sm font-semibold rounded-md shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed";

  const title = isEditingActive
    ? `Editing Game ${editingGameInfo.gameNumber}`
    : (isGameEffectivelyActive && gameForUI
      ? `Game ${gameForUI.gameNumber}`
      : `Setup New Game ${nextGameNumberDisplay}`);

  return (
    <div className="bg-gray-800 bg-opacity-70 rounded-lg p-3 sm:p-4 shadow-md mb-4">
      <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">{title}</h3>

      {isGameEffectivelyActive ? (
        <>
          <p className="text-xs sm:text-sm text-gray-300 mb-3">
            Enter points for losers. One active player must have 0. Use 'Drop' for players who left.
          </p>
          <div className="space-y-2 sm:space-y-3 mb-4">
            {playersInCurrentInteraction.map((player) => {
              // A player is the designated winner if they are active, their score is 0, and all other active players have scores.
              const isDesignatedWinnerForInput = 
                !player.dropped && 
                player.score === 0 && 
                canIdentifyWinnerForInputDisable;

              return (
                <div key={player.name} className={`flex flex-col sm:flex-row items-center gap-2 p-2 rounded-lg transition-colors ${player.dropped ? 'bg-gray-900 bg-opacity-50' : 'bg-transparent'}`}>
                  <label htmlFor={`score-${player.name}`} className="w-full sm:w-2/5 text-gray-200 text-sm truncate" title={player.name}>
                    {player.name}
                    {player.dropped && <span className="text-red-400 text-xs ml-2">[DROPPED]</span>}
                  </label>
                  <input
                    id={`score-${player.name}`}
                    type="number"
                    pattern="\d*"
                    inputMode="numeric"
                    value={player.score.toString()}
                    onChange={(e) => handleUpdatePlayerScore(player.name, e.target.value)}
                    disabled={player.dropped || isDesignatedWinnerForInput}
                    className={`flex-grow ${inputBaseClass} ${isDesignatedWinnerForInput ? 'ring-2 ring-green-500' : ''} ${player.dropped || isDesignatedWinnerForInput ? 'cursor-not-allowed opacity-50' : ''}`}
                    placeholder="Points Lost"
                  />
                  <button
                    onClick={() => handleTogglePlayerDropped(player.name)}
                    className={`w-full sm:w-auto px-3 py-1.5 text-xs font-medium rounded-md shadow-sm transition-colors ${player.dropped ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  >
                    {player.dropped ? 'Un-drop' : 'Drop'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <label htmlFor="boardCharge" className="text-gray-200 text-sm whitespace-nowrap font-medium">Board Charge:</label>
            <input
              id="boardCharge"
              type="number"
              value={boardCharge.toString()}
              onChange={(e) => handleUpdateBoardCharge(e.target.value)}
              className={`w-full max-w-[120px] ${inputBaseClass}`}
              placeholder="e.g., 50"
            />
          </div>

          <div className="flex items-center mt-3 mb-4">
            <input
              type="checkbox"
              id="isRotationGame"
              checked={gameForUI?.isRotationGame || false}
              onChange={(e) => onToggleRotationForCurrentGame(e.target.checked)}
              className="form-checkbox h-4 w-4 text-purple-500 rounded bg-gray-600 border-gray-500"
            />
            <label htmlFor="isRotationGame" className="ml-2 text-gray-200 text-sm">Rotation Game</label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3">
            <button
              onClick={handleEndGame}
              className={`${primaryButtonClass} sm:flex-1 bg-yellow-500 hover:bg-yellow-600 text-black focus:ring-yellow-400`}
              disabled={!canEndOrSaveChanges}
            >
              {isEditingActive ? `Save Edited Game ${gameForUI.gameNumber}` : `End Game ${gameForUI.gameNumber}`}
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
        <>
          <p className="text-xs sm:text-sm text-gray-300 mb-3">Select players for Game {nextGameNumberDisplay}:</p>
          <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 mb-3">
            {masterPlayerList.map(masterPlayer => {
              const isSelected = playersInCurrentInteraction.some(p => p.name === masterPlayer.name);
              return (
                <button
                  key={masterPlayer.id}
                  onClick={() => onTogglePlayerForNextGame(masterPlayer.name)}
                  className={`p-2.5 rounded-md shadow-sm text-xs sm:text-sm ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                  title={masterPlayer.name}
                >
                  <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap">{masterPlayer.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:gap-3">
            <button
              onClick={handleStartNewGame}
              className={`${primaryButtonClass} w-full bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`}
              disabled={playersInCurrentInteraction.length < 2 || isGameEffectivelyActive}
            >
              Start New Game
            </button>
            {canEditLastGame && !isGameEffectivelyActive && (
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
