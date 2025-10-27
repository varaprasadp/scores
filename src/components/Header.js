import React from 'react';

function Header({ children }) {
  return (
    <header className="bg-gray-800 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Side: Logo and Title */}
          <div className="flex items-center">
            <div className="ml-3">
              <h1 className="text-xl font-bold text-white">Score Tracker 🎯</h1>
            </div>
          </div>

          {/* Right Side: Auth buttons and other children */}
          <div className="flex items-center">
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
