// src/components/Header.js
import React from 'react';

function Header({ children }) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 sm:mb-0">Game Score Tracker</h1>
      {children} {/* This is where AuthButtons will be rendered */}
    </header>
  );
}

export default Header;