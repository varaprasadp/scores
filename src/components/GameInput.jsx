// src/components/GameInput.jsx
import React from 'react';

function GameInput({
  currentGamePlayers, // These are the players for the *active* game, or the *selected* players for the *next* game
  handleUpdatePlayerScore,
  handleEndGame,
  handleCreateNewGame,
  handleCancelGame,
  games,
  masterPlayerList,
  onTogglePlayerForNextGame,
  // NEW PROP: Function to update the rotation status of the current game
  onToggleRotationForCurrentGame
}) {
  // Determine if there's an active game (first game in the array and not ended)
  const isGameActive = games.length > 0 && !games[0].endedAt;
  // NEW: Get the rotation status of the active game
  const isCurrentGameRotation = isGameActive ? games[0].isRotationGame : false;

  // Handler for ending the current game
  const handleEndGameClick = () => {
    handleEndGame();
  };

  // Handler for cancelling the current game
  const handleCancelGameClick = () => {
    handleCancelGame();
  };

  // NEW: Handler for toggling rotation status
  const handleToggleRotationClick = () => {
    // Only call if a game is active
    if (isGameActive) {
      onToggleRotationForCurrentGame(!isCurrentGameRotation);
    }
  };

  // --- LOGIC FOR DISABLING WINNER INPUT ---
  // Ensure currentGamePlayers is an array before filtering (defensive check)
  const playersInActiveGame = isGameActive ? currentGamePlayers : [];

  const numPlayersWithScores = playersInActiveGame.filter(player => player.score !== 0).length;
  const totalPlayersInGame = playersInActiveGame.length;

  const canDisableWinnerInput = totalPlayersInGame > 1 && numPlayersWithScores === totalPlayersInGame - 1;
  // --- END LOGIC ---

  return (
    <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-8">
      <h3 className="text-xl font-bold text-white mb-4">Game Management</h3>

      {isGameActive ? (
        // --- UI for Active Game (Enter Scores, End Game, Cancel Game) ---
        <>
          <p className="text-white text-lg font-medium mb-3">
            Current Game: {games[0].gameNumber}. Enter points lost by each player.
          </p>
          <h4 className="text-lg font-semibold text-white mb-3">Points Lost by Each Player (0 for winner):</h4>
          <div className="space-y-3">
            {/* Map through players in the current active game to display score inputs */}
            {/* Map over playersInActiveGame to ensure it's an array for rendering */}
            {playersInActiveGame.map((player) => {
              // Determine if this specific player's input should be disabled
              const shouldDisableThisPlayerInput =
                canDisableWinnerInput && // Only if we're in the state where N-1 players have scores
                player.score === 0; // And this player currently has a 0 score (potential winner)

              return (
                <div key={player.name} className="flex items-center gap-3">
                  <label className="w-1/3 text-white">{player.name}:</label>
                  <input
                    type="text" // Keep as type="text"
                    // Display player.score as string for type="text" input
                    // Show empty string if 0 on new game setup or if score is 0 and game not active (before winner is set)
                    value={
                      // If no game is active (selecting players for next game) and score is 0, show empty
                      // OR if a game is active, but the current score is 0 AND the field is not disabled (meaning not the final winner yet), show empty
                      // Otherwise, show the actual score
                      !isGameActive && player.score === 0
                        ? ''
                        : player.score.toString()
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string or valid integer (positive or negative)
                      if (value === '' || /^-?\d*$/.test(value)) { // Regex to allow empty string, '-' or digits
                        // Convert to number for internal state, default to 0 for empty string
                        handleUpdatePlayerScore(player.name, value === '' ? 0 : parseInt(value, 10));
                      }
                    }}
                    className={`flex-grow p-2 rounded-lg bg-white bg-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-purple-300 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed`} // <--- Applied using styles object
                    placeholder="Enter points lost" // Correct placeholder
                    disabled={shouldDisableThisPlayerInput}
                  />
                </div>
              );
            })}
          </div>

          {/* NEW: Rotation Checkbox */}
          <div className="flex items-center mt-4 mb-6">
            <input
              type="checkbox"
              id="isRotationGame"
              checked={isCurrentGameRotation}
              onChange={handleToggleRotationClick}
              className="form-checkbox h-5 w-5 text-purple-600 rounded"
            />
            <label htmlFor="isRotationGame" className="ml-2 text-white text-md cursor-pointer">
              This was a Rotation Game
            </label>
          </div>


          <div className="flex gap-4 mt-6">
            <button
              onClick={handleEndGameClick}
              // MODIFIED: Reduced scale and added translate-y
              className="flex-1 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-102 hover:-translate-y-0.5"
              disabled={playersInActiveGame.length < 2}
            >
              End Game {games[0].gameNumber}
            </button>
            <button
              onClick={handleCancelGameClick}
              // MODIFIED: Reduced scale and added translate-y
              className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-102 hover:-translate-y-0.5"
              disabled={playersInActiveGame.length < 2} // Disable if less than 2 players, similar to end game
            >
              Cancel Game {games[0].gameNumber}
            </button>
          </div>
        </>
      ) : (
        // --- UI for Creating New Game (Select Players from Master List) ---
        <>
          <p className="text-white text-lg font-medium mb-3">
            Select players for New Game {games.length > 0 ? `(Game ${games[0].gameNumber + 1})` : '(First Game)'}:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {masterPlayerList.length === 0 ? (
              // Message if no players in the master list
              <p className="col-span-full text-yellow-300 text-sm text-center">
                No players in your master list. Use "Manage Your Player Roster" to add players.
              </p>
            ) : (
              // Display master player list with clickable player cards
              masterPlayerList.map(masterPlayer => {
                const isSelected = currentGamePlayers.some(p => p.name === masterPlayer.name);
                return (
                  <button
                    key={masterPlayer.id}
                    onClick={() => onTogglePlayerForNextGame(masterPlayer.name)}
                    // MODIFIED: Reduced scale and added translate-y
                    className={`
                      relative flex items-center justify-center p-3 rounded-lg shadow-md transition duration-200 ease-in-out
                      ${isSelected
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-102 hover:-translate-y-0.5'
                        : 'bg-white bg-opacity-15 hover:bg-opacity-25 text-white transform hover:scale-102 hover:-translate-y-0.5'}
                    `}
                  >
                    <span className="font-medium text-center truncate">{masterPlayer.name}</span>
                    {isSelected && (
                      <svg className="ml-2 h-5 w-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {currentGamePlayers.length > 0 && (
            // Display currently selected players for the next game
            <p className="text-gray-300 text-sm mb-4">
              Players selected for next game:{' '}
              <span className="font-semibold text-white">{currentGamePlayers.map(p => p.name).join(', ')}</span>
              <br /> <span className="text-xxs text-yellow-300">Minimum 2 players required for a game.</span>
            </p>
          )}

          <button
            onClick={handleCreateNewGame}
            // MODIFIED: Reduced scale and added translate-y
            className="w-full px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-102 hover:-translate-y-0.5"
            // Disable if no players are selected for the next game or master list is empty, or less than 2 players selected
            disabled={currentGamePlayers.length < 2 || masterPlayerList.length === 0}
          >
            Create New Game {games.length > 0 ? `(Game ${games[0].gameNumber + 1})` : '(First Game)'}
          </button>
        </>
      )}
    </div>
  );
}

export default GameInput;