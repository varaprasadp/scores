import React, { useEffect, useState } from 'react';

function MessageDisplay({ message }) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);
      setIsVisible(true);
      // Optional: auto-hide message if App.js doesn't clear it
      // const timer = setTimeout(() => setIsVisible(false), 3000);
      // return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [message]);

  const baseClasses = `fixed top-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg shadow-xl z-[150]
    text-center text-sm font-medium transform transition-all duration-300 ease-in-out max-w-[90%] sm:max-w-md`;

  // Improved color for better contrast/visibility - can be themed later
  const displayClasses = ` 
    ${baseClasses}
    ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}
    bg-purple-600 text-white
  `;

  if (!currentMessage && !isVisible) return null; // Render nothing if no message and not trying to animate out

  return (
    <div className={displayClasses} role="alert">
      {currentMessage}
    </div>
  );
}

export default MessageDisplay;