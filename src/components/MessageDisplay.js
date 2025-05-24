// src/components/MessageDisplay.js
import React from 'react';

function MessageDisplay({ message }) {
  if (!message) return null;
  return (
    <div className="bg-yellow-400 text-gray-800 p-3 rounded-lg mb-4 shadow-md text-center">
      {message}
    </div>
  );
}

export default MessageDisplay;