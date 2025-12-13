import React from 'react';

interface AlphabetFilterProps {
  selectedLetter: string | null;
  onLetterSelect: (letter: string | null) => void;
}

const HEBREW_ALPHABET = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
  'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
];

const AlphabetFilter: React.FC<AlphabetFilterProps> = ({ selectedLetter, onLetterSelect }) => {
  return (
    <div className="bg-white border-b border-slate-200 py-3 px-4 shadow-sm z-10 flex items-center gap-2">
      <button
        onClick={() => onLetterSelect(null)}
        className={`
          flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${selectedLetter === null 
            ? 'bg-slate-800 text-white' 
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }
        `}
      >
        All
      </button>
      
      <div className="h-6 w-px bg-slate-200 mx-1"></div>
      
      <div className="flex-1 overflow-x-auto hide-scrollbar flex items-center gap-1" dir="rtl">
        {HEBREW_ALPHABET.map((letter) => (
          <button
            key={letter}
            onClick={() => onLetterSelect(letter === selectedLetter ? null : letter)}
            className={`
              w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-lg font-bold hebrew-text transition-all
              ${selectedLetter === letter 
                ? 'bg-indigo-600 text-white shadow-md scale-105' 
                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
              }
            `}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AlphabetFilter;