import React, { useState, useRef, useEffect } from 'react';

const ISLToSpeech = () => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bufferSize, setBufferSize] = useState(0);
  const [handsDetected, setHandsDetected] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionIntervalRef = useRef(null);

  // Backend API URL - Change this to your backend URL
  const API_URL = 'http://localhost:8000';

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setError(null);
      } else {
        setError("Your browser does not support camera access.");
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      setError("Camera access was denied. Please allow camera permissions.");
    }
  };
  
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Return only base64 part
  };

  const sendFrameToBackend = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    const frameData = captureFrame();
    
    if (!frameData) {
      setIsProcessing(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          frame: frameData 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setBufferSize(data.buffer_size);
      setHandsDetected(data.hands_detected);
      setConfidence(data.confidence);
      
      if (data.prediction && data.prediction !== "Collecting frames...") {
        setRecognizedText(prev => {
          const newText = prev ? `${prev} ${data.prediction}` : data.prediction;
          return newText;
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error sending frame to backend:', err);
      setError(`Failed to connect to backend: ${err.message}. Make sure the server is running on ${API_URL}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetBuffer = async () => {
    try {
      await fetch(`${API_URL}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
      setRecognizedText('');
      setBufferSize(0);
      setConfidence(0);
    } catch (err) {
      console.error('Error resetting buffer:', err);
    }
  };

  const handleRecognitionToggle = () => {
    if (isRecognizing) {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
        recognitionIntervalRef.current = null;
      }
      stopCamera();
      resetBuffer();
    } else {
      startCamera();
      recognitionIntervalRef.current = setInterval(() => {
        sendFrameToBackend();
      }, 100); // Send frame every 100ms for real-time detection
    }
    setIsRecognizing(!isRecognizing);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
        ISL to Text Translator
      </h2>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="relative w-full aspect-video bg-gray-800 rounded-md overflow-hidden mb-4">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover transform -scale-x-100"
        />
        {!isRecognizing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-12 w-12 text-white/50 mb-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M15 10l4.55a2.5 2.5 0 010 4.1L15 18M3 8a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" 
              />
            </svg>
            <p className="text-white font-medium">Camera is off</p>
          </div>
        )}
        
        {isRecognizing && (
          <div className="absolute top-2 right-2 space-y-2">
            <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${handsDetected > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span>Hands: {handsDetected}</span>
            </div>
            <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs">
              Buffer: {bufferSize}/50
            </div>
            {confidence > 0 && (
              <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs">
                Confidence: {(confidence * 100).toFixed(1)}%
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="text-center text-red-600 mb-4 bg-red-50 p-3 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={handleRecognitionToggle}
          className={`flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-md text-white transition-all ${
            isRecognizing 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isRecognizing ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              <span>Stop Recognition</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start Recognition</span>
            </>
          )}
        </button>
        
        {recognizedText && (
          <button
            onClick={resetBuffer}
            className="flex items-center gap-2 px-4 py-3 font-semibold rounded-md bg-gray-500 hover:bg-gray-600 text-white transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Clear
          </button>
        )}
      </div>

      <div className="w-full bg-gray-50 p-4 rounded-md min-h-[6rem] flex items-center justify-center text-center border border-gray-200">
        {recognizedText ? (
          <p className="text-gray-700 text-lg font-medium">{recognizedText}</p>
        ) : (
          <div className="text-gray-400">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 mx-auto text-gray-300 mb-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={1}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            <p>Recognized text will appear here...</p>
            <p className="text-xs mt-2">Show ISL signs to the camera to start recognition</p>
          </div>
        )}
      </div>
      
      {bufferSize > 0 && bufferSize < 50 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Collecting frames...</span>
            <span>{bufferSize}/50</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(bufferSize / 50) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ISLToSpeech;