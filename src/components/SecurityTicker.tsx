import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES = [
  'YOUR FILES ARE ENCRYPTED IN YOUR BROWSER BEFORE SENDING',
  'FILES ARE SENT BROWSER TO BROWSER',
  'NO UNENCRYPTED CONTENT EVER HITS OUR SERVERS',
  'NONE OF YOUR FILES ARE EVER STORED ON OUR SERVERS',
  'WE DO NOT TRACK YOU',
  'WE DO NOT STORE METADATA FOR MORE THAN 24HR'
];

export const SecurityTicker: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap overflow-hidden py-4 flex items-center justify-center min-w-[500px]">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="text-xs font-bold uppercase tracking-[0.3em] text-white/70 text-center"
        >
          {MESSAGES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};
