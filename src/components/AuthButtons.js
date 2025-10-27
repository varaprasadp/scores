import React, { useMemo } from 'react';

function AuthButtons({ user, handleGoogleSignIn, handleSignOut }) {

  const avatarUrl = useMemo(() => {
    if (!user) return '';
    if (user.photoURL) {
      return user.photoURL;
    }
    const seed = user.uid;
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}`;
  }, [user]);

  // --- Logged-In State ---
  if (user) {
    return (
      <div className="flex items-center gap-3 sm:gap-4">
        {/* --- User Info Container --- */}
        <div className="flex items-center gap-2">
          {/* Avatar (Always Visible) */}
          <img
            src={avatarUrl}
            alt="User avatar"
            className="w-9 h-9 rounded-full border-2 border-gray-600 bg-gray-700"
          />
          {/* Name (Visible on 'sm' screens and larger) */}
          <span className="hidden sm:inline text-sm font-medium text-gray-300">
            {user.displayName || user.email}
          </span>
        </div>
        
        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          title="Sign Out"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // --- Logged-Out State ---
  return (
    <button
      onClick={handleGoogleSignIn}
      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
    >
      Sign In with Google
    </button>
  );
}

export default AuthButtons;
