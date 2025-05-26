import React, { useEffect, useState } from 'react';

function MessageDisplay({ message }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      // The parent (App.js) already clears the message after 5 seconds,
      // so this component just needs to animate out when message becomes empty.
    } else {
      setIsVisible(false);
    }
  }, [message]);

  // We are animating opacity and transform (for slide-down/up effect).
  // The 'transition-all' class handles the smooth animation.
  const displayClasses = `
    fixed top-0 left-1/2 -translate-x-1/2 mt-4 px-6 py-3 rounded-lg shadow-xl z-50
    text-center text-lg font-semibold transform
    ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}
    transition-all duration-500 ease-in-out
    bg-yellow-400 text-gray-800
  `;

  // We only render the div if it's visible or if a message exists (to allow exit animation)
  if (!message && !isVisible) return null;

  return (
    <div className={displayClasses}>
      {message}
    </div>
  );
}

export default MessageDisplay;