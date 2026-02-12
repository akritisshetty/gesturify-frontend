import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View } from '../types';

// We'll classify a messy input string into Alphabets, Numbers, and Words.
const RAW_INPUT = `1
 2
 3
 4
 5
 6
 8
9
 A
 B
C
D
 E
F
G
H
HELLO
,I,
 J,K,L,,M,N
,NAMASTE,O,P,Q,R,S,T,,U,V,X,Y,Z`;

type Category = 'Alphabet' | 'Number' | 'Word';

const classifyTokens = (raw: string) => {
  // Normalize: replace commas with spaces, split on whitespace, trim
  const tokens = raw
    .replace(/[.,\/]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const alphabets: string[] = [];
  const numbers: string[] = [];
  const words: string[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      numbers.push(token);
    } else if (/^[A-Za-z]$/.test(token)) {
      alphabets.push(token.toUpperCase());
    } else {
      // anything longer than 1 char -> word
      words.push(token.toUpperCase());
    }
  }

  return { Alphabet: alphabets, Number: numbers, Word: words } as Record<Category, string[]>;
};

const Card: React.FC<{
  title: Category;
  items: string[];
  onOpenCamera: (category: Category) => void;
}> = ({ title, items, onOpenCamera }) => (
  <button
    onClick={() => onOpenCamera(title)}
    className="p-4 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 text-left border-2 bg-white"
  >
    <div className="flex justify-between items-center">
      <div>
        <h3 className="font-semibold text-lg text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="text-2xl">🔍</div>
    </div>
    <div className="mt-3 text-sm text-text-secondary max-h-20 overflow-auto">
      {items.length ? (
        items.map((it, i) => (
          <span key={i} className="inline-block mr-2 mb-1 px-2 py-1 bg-gray-100 rounded text-xs">{it}</span>
        ))
      ) : (
        <span className="text-xs italic">No items</span>
      )}
    </div>
  </button>
);

const CameraModal: React.FC<{
  open: boolean;
  onClose: () => void;
  category?: Category | null;
}> = ({ open, onClose, category }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const start = async () => {
      if (!open) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Camera error', err);
      }
    };

    start();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-bold">{category} Camera</h4>
          <button onClick={onClose} className="text-sm px-3 py-1 rounded bg-gray-100">Close</button>
        </div>
        <div className="p-4">
          <video ref={videoRef} autoPlay playsInline className="w-full h-64 bg-black rounded" />
          <p className="mt-3 text-sm text-text-secondary">Point the camera to practice {category?.toLowerCase()} signs.</p>
        </div>
      </div>
    </div>
  );
};

const AICoach: React.FC<{ setView: (v: View) => void }> = ({ setView }) => {
  const classified = classifyTokens(RAW_INPUT);

  const [cameraOpenFor, setCameraOpenFor] = useState<Category | null>(null);

  const handleOpenCamera = (cat: Category) => {
    setCameraOpenFor(cat);
  };

  const handleCloseCamera = () => setCameraOpenFor(null);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-text-primary">AI-Powered ISL Coach</h2>
        <p className="text-text-secondary mt-2">Click a card to open the camera and practise.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1">
        <div>
          <button
            onClick={() => setView(View.ALPHABET_PAGE)}
            className="w-full h-full"
            aria-label="Open Alphabet page"
          >
            <Card title="Alphabet" items={classified.Alphabet} onOpenCamera={() => {}} />
          </button>
        </div>

        
      </div>

      <CameraModal open={!!cameraOpenFor} onClose={handleCloseCamera} category={cameraOpenFor} />
    </div>
  );
};

export default AICoach;