// src/components/RoundInput.jsx
import React from 'react';

function RoundInput({
  currentRoundPlayers, // These are the players for the *active* round, or the *selected* players for the next round
  handleUpdatePlayerScore,
  handleEndRound,
  handleCreateNewRound,
  handleCancelRound, // New prop
  rounds,
  masterPlayerList, // Master list of all available players
  onTogglePlayerForNextRound // Function to add/remove players for the *next* round's selection
}) {
  // Determine if there's an active round (first round in the array and not ended)
  const isRoundActive = rounds.length > 0 && !rounds[0].endedAt;

  // Handler for ending the current round
  const handleEndRoundClick = () => {
    handleEndRound();
  };

  // Handler for cancelling the current round
  const handleCancelRoundClick = () => {
    handleCancelRound();
  };

  return (
    <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-8">
      <h3 className="text-xl font-bold text-white mb-4">Round Management</h3>

      {isRoundActive ? (
        // --- UI for Active Round (Enter Scores, End Round, Cancel Round) ---
        <>
          <p className="text-white text-lg font-medium mb-3">
            Current Round: {rounds[0].roundNumber}. Enter points lost by each player.
          </p>
          <h4 className="text-lg font-semibold text-white mb-3">Points Lost by Each Player (0 for winner):</h4>
          <div className="space-y-3">
            {/* Map through players in the current active round to display score inputs */}
            {currentRoundPlayers.map((player) => (
              <div key={player.name} className="flex items-center gap-3">
                <label className="w-1/3 text-white">{player.name}:</label>
                <input
                  type="number"
                  value={player.score}
                  onChange={(e) => handleUpdatePlayerScore(player.name, e.target.value)}
                  className="flex-grow p-2 rounded-lg bg-white bg-opacity-20 text-white focus:outline-none focus:ring-2 focus:ring-purple-300 transition duration-200"
                  placeholder="Points"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={handleEndRoundClick}
              className="flex-1 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              disabled={currentRoundPlayers.length < 2} // Disable if not enough players for a valid round
            >
              End Round {rounds[0].roundNumber}
            </button>
            <button
              onClick={handleCancelRoundClick}
              className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            >
              Cancel Round {rounds[0].roundNumber}
            </button>
          </div>
        </>
      ) : (
        // --- UI for Creating New Round (Select Players from Master List) ---
        <>
          <p className="text-white text-lg font-medium mb-3">
            Select players for New Round {rounds.length > 0 ? `(Round ${rounds[0].roundNumber + 1})` : '(First Round)'}:
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
                const isSelected = currentRoundPlayers.some(p => p.name === masterPlayer.name);
                return (
                  <button
                    key={masterPlayer.id}
                    onClick={() => onTogglePlayerForNextRound(masterPlayer.name)}
                    className={`
                      flex items-center justify-center p-3 rounded-lg shadow-md transition duration-200 ease-in-out
                      ${isSelected
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform scale-105'
                        : 'bg-white bg-opacity-15 hover:bg-opacity-25 text-white'}
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

          {currentRoundPlayers.length > 0 && (
            // Display currently selected players for the next round
            <p className="text-gray-300 text-sm mb-4">
              Players selected for next round:{' '}
              <span className="font-semibold text-white">{currentRoundPlayers.map(p => p.name).join(', ')}</span>
              <br /> <span className="text-xxs text-yellow-300">Minimum 2 players required for a round.</span>
            </p>
          )}

          <button
            onClick={handleCreateNewRound}
            className="w-full px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            // Disable if no players are selected for the next round or master list is empty, or less than 2 players selected
            disabled={currentRoundPlayers.length < 2 || masterPlayerList.length === 0}
          >
            Create New Round {rounds.length > 0 ? `(Round ${rounds[0].roundNumber + 1})` : '(First Round)'}
          </button>
        </>
      )}
    </div>
  );
}

export default RoundInput;