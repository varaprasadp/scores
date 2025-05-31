import React from 'react';

function Header({ children }) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-center bg-gray-800 shadow-lg p-3 sm:p-4 sticky top-0 z-30">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-0 text-center sm:text-left">
        Score Tracker 🎯
      </h1>
      <div className="w-full sm:w-auto flex justify-center sm:justify-end">
        {children}
      </div>
    </header>
  );
}

export default Header;