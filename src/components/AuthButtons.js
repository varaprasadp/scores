// src/components/AuthButtons.js
import React from 'react';

function AuthButtons({ user, handleGoogleSignIn, handleSignOut }) {
  return (
    <>
      {user ? (
        <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-3">
          <span className="text-xs sm:text-sm text-gray-300 order-2 sm:order-1 text-center sm:text-left" title={user.email || ''}>
            Hi, {user.displayName ? user.displayName.split(' ')[0] : 'User'}!
          </span>
          <button
            onClick={handleSignOut}
            className="order-1 sm:order-2 w-full sm:w-auto px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-md transition-colors"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <button
          onClick={handleGoogleSignIn}
          className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.24 10.285V11.85h2.95c-.15 1.05-.72 1.88-1.78 2.53v2.09h2.69c1.58-1.46 2.5-3.6 2.5-6.15 0-.7-.07-1.37-.2-2.02H12.24z" />
            <path d="M12.24 22c3.24 0 5.95-1.08 7.93-2.93l-2.69-2.09c-1.07.72-2.45 1.15-3.84 1.15-2.95 0-5.46-1.98-6.37-4.66H3.85v2.09C5.46 19.92 8.52 22 12.24 22z" />
            <path d="M5.87 14.15c-.2-.58-.33-1.2-.33-1.85s.13-1.27.33-1.85V8.36H3.85c-.65 1.3-.98 2.74-.98 4.29s.33 2.99.98 4.29L5.87 14.15z" />
            <path d="M12.24 4.01c1.77 0 3.32.6 4.56 1.79l2.39-2.39C18.19 1.45 15.48 0 12.24 0 8.52 0 5.46 2.08 3.85 5.14l2.02 1.57C6.78 4.99 9.3 4.01 12.24 4.01z" />
          </svg>
          <span>Sign in with Google</span>
        </button>
      )}
    </>
  );
}

export default AuthButtons;