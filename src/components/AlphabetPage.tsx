import React, { useRef, useState, useEffect } from 'react';

// Import all reference images from assets folder
import imgA from '../assets/A.jpg';
import imgB from '../assets/B.jpg';
import imgC from '../assets/C.jpg';
import imgD from '../assets/D.jpg';
import imgE from '../assets/E.jpg';
import imgF from '../assets/F.jpg';
import imgG from '../assets/G.jpg';
import imgH from '../assets/H.jpg';
import imgI from '../assets/I.jpg';
import imgJ from '../assets/J.jpg';
import imgK from '../assets/K.jpg';
import imgL from '../assets/L.jpg';
import imgM from '../assets/M.jpg';
import imgN from '../assets/N.jpg';
import imgO from '../assets/O.jpg';
import imgP from '../assets/P.jpg';
import imgQ from '../assets/Q.jpg';
import imgR from '../assets/R.jpg';
import imgS from '../assets/S.jpg';
import imgT from '../assets/T.jpg';
import imgU from '../assets/U.jpg';
import imgV from '../assets/V.jpg';
import imgW from '../assets/W.jpg';
import imgX from '../assets/X.jpg';
import imgY from '../assets/Y.jpg';
import imgZ from '../assets/Z.jpg';

// Declare MediaPipe types loaded from CDN
declare const Hands: any;
declare const Camera: any;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Map of letters to their imported images
const imageMap: { [key: string]: string } = {
  'A': imgA,
  'B': imgB,
  'C': imgC,
  'D': imgD,
  'E': imgE,
  'F': imgF,
  'G': imgG,
  'H': imgH,
  'I': imgI,
  'J': imgJ,
  'K': imgK,
  'L': imgL,
  'M': imgM,
  'N': imgN,
  'O': imgO,
  'P': imgP,
  'Q': imgQ,
  'R': imgR,
  'S': imgS,
  'T': imgT,
  'U': imgU,
  'V': imgV,
  'W': imgW,
  'X': imgX,
  'Y': imgY,
  'Z': imgZ,
};

// Simple View type for demo
enum View {
  AI_COACH = 'AI_COACH',
  ALPHABET = 'ALPHABET'
}

const AlphabetPage: React.FC<{ setView?: (v: View) => void }> = ({ setView }) => {
  // Backend API URL
  const API_URL = 'http://localhost:8000';

  const [selected, setSelected] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // MediaPipe / recording refs
  const handsRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const framesRef = useRef<number[][]>([]);
  const recordingResolveRef = useRef<((sequence: number[][]) => void) | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ 
    result: string; 
    confidence: number;
    distance?: number;
    frames_processed?: number;
    threshold_used?: number;
  } | null>(null);
  
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const [backendHealth, setBackendHealth] = useState<{
    status: string;
    model_loaded: boolean;
    reference_data_loaded: boolean;
    available_letters: string[];
  } | null>(null);

  // Check backend health on component mount
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        console.log('🔍 Checking backend at:', API_URL);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`${API_URL}/health`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('✅ Backend response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('✅ Backend health data:', data);
          setBackendHealth(data);
          //setDebugInfo(`✅ Backend connected! ${data.available_letters?.length || 0} letters available`);
        } else {
          setBackendHealth(null);
          setDebugInfo('❌ Backend responded with error');
        }
      } catch (err: any) {
        console.error('❌ Backend health check failed:', err);
        setBackendHealth(null);
        setDebugInfo(`⚠️ Cannot connect to backend: ${err.message}`);
      }
    };

    // Check immediately and every 30 seconds
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Load reference image when letter is selected
  useEffect(() => {
    if (selected) {
      // Get image from pre-imported map
      const image = imageMap[selected];
      if (image) {
        setReferenceImage(image);
        setImageLoadError(false);
        console.log(`🖼️ Loaded reference image for: ${selected}`);
      } else {
        console.error(`❌ No image found for letter: ${selected}`);
        setImageLoadError(true);
        setReferenceImage(null);
      }
    } else {
      setReferenceImage(null);
      setImageLoadError(false);
    }
  }, [selected]);

  // Format MediaPipe results into 126-length array
  const formatLandmarks = (results: any): number[] => {
    const out: number[] = [];
    
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      console.log('⚠️ No hands detected, returning zeros');
      return new Array(126).fill(0);
    }

    const hands = results.multiHandLandmarks;
    console.log(`✋ Detected ${hands.length} hand(s)`);
    
    // Process up to 2 hands
    for (let h = 0; h < 2; h++) {
      if (h < hands.length && Array.isArray(hands[h]) && hands[h].length >= 21) {
        const hand = hands[h];
        for (let i = 0; i < 21; i++) {
          const lm = hand[i];
          if (lm && typeof lm.x === 'number' && typeof lm.y === 'number' && typeof lm.z === 'number') {
            out.push(lm.x, lm.y, lm.z);
          } else {
            out.push(0, 0, 0);
          }
        }
      } else {
        // Pad with zeros for missing hand
        for (let i = 0; i < 21; i++) {
          out.push(0, 0, 0);
        }
      }
    }

    // Ensure exactly 126 values
    while (out.length < 126) out.push(0);
    return out.slice(0, 126);
  };

  // MediaPipe onResults callback
  const onMediaPipeResults = (results: any) => {
    try {
      const landmarks = formatLandmarks(results);
      
      if (isRecordingRef.current) {
        framesRef.current.push(landmarks);
        
        // Update debug info every 5 frames
        if (framesRef.current.length % 5 === 0) {
          setDebugInfo(`🎥 Recording... ${framesRef.current.length}/30 frames`);
        }
        
        // Stop recording when we have enough frames
        if (framesRef.current.length >= 30) {
          console.log('✅ Collected 30 frames, stopping recording');
          isRecordingRef.current = false;
          const seq = framesRef.current.slice();
          framesRef.current = [];
          
          if (recordingResolveRef.current) {
            recordingResolveRef.current(seq);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in MediaPipe results callback:', error);
    }
  };

  // Record frames using MediaPipe
  const recordFrames = async (): Promise<number[][]> => {
    return new Promise<number[][]>((resolve) => {
      framesRef.current = [];
      setIsRecording(true);
      isRecordingRef.current = true;
      setDebugInfo('🎥 Recording started... Make your sign now!');
      
      console.log('📹 Starting frame recording...');
      
      // Safety timeout (4 seconds)
      const timeoutId = setTimeout(() => {
        if (isRecordingRef.current) {
          console.log('⏰ Recording timeout reached');
          isRecordingRef.current = false;
          setIsRecording(false);
          const seq = framesRef.current.slice();
          framesRef.current = [];
          
          if (seq.length > 0) {
            setDebugInfo(`⏰ Timeout: ${seq.length} frames collected`);
            resolve(seq);
          } else {
            setDebugInfo('❌ Timeout: No frames captured');
            resolve([]);
          }
        }
      }, 4000);
      
      // Setup recording completion
      recordingResolveRef.current = (seq: number[][]) => {
        clearTimeout(timeoutId);
        isRecordingRef.current = false;
        setIsRecording(false);
        framesRef.current = [];
        console.log(`✅ Recording complete: ${seq.length} frames`);
        resolve(seq.length > 0 ? seq : []);
      };
    });
  };

  // Send recorded sequence to backend
  const checkSign = async (signName: string | null) => {
    if (!signName) {
      setDebugInfo('❌ Please select a letter first');
      return;
    }
    
    // Check if backend has reference
    if (backendHealth && !backendHealth.available_letters?.includes(signName.toUpperCase())) {
      setDebugInfo(`❌ No reference for "${signName}". Try another letter.`);
      return;
    }
    
    setIsChecking(true);
    setResult(null);
    setDebugInfo('🔄 Starting sign check...');
    
    try {
      // Record frames
      const seq = await recordFrames();
      
      console.log('📊 Recording completed:', {
        frames: seq.length,
        firstFrameLength: seq[0]?.length,
        sample: seq[0]?.slice(0, 6)
      });
      
      if (seq.length === 0) {
        setDebugInfo('❌ No frames captured. Make sure hands are visible!');
        setIsChecking(false);
        return;
      }
      
      if (seq[0]?.every(val => val === 0)) {
        setDebugInfo('❌ No hand landmarks detected. Show your hands clearly!');
        setIsChecking(false);
        return;
      }
      
      // Normalize to 126 values per frame
      const normalized = seq.map((frame) => {
        const arr = frame.slice(0, 126);
        while (arr.length < 126) arr.push(0);
        return arr.slice(0, 126);
      });
      
      setDebugInfo(`📤 Sending ${normalized.length} frames to backend...`);
      
      console.log('📤 Sending request to /tutor-check:', {
        sign: signName,
        sequenceLength: normalized.length,
        frameLength: normalized[0]?.length,
        sampleData: normalized[0]?.slice(0, 12)
      });
      
      // Prepare request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const requestBody = { 
        sign: signName, 
        sequence: normalized 
      };
      
      // Send to backend
      const res = await fetch(`${API_URL}/tutor-check`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('📥 Response status:', res.status);
      
      if (!res.ok) {
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorText = await res.text();
          console.error('❌ Error response:', errorText);
          
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.detail || errorJson.message || errorText;
          } catch {
            errorMessage = errorText;
          }
        } catch (e) {
          errorMessage = `Failed to read error: ${e}`;
        }
        
        setDebugInfo(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
      }
      
      // Parse success response
      const data = await res.json();
      console.log('✅ Response data:', data);
      
      setResult({ 
        result: data.result, 
        confidence: data.confidence ?? 0,
        distance: data.distance,
        frames_processed: data.frames_processed,
        threshold_used: data.threshold_used
      });
      
      const confidencePercent = ((data.confidence || 0) * 100).toFixed(1);
      setDebugInfo(`✅ Check completed: ${data.result} (${confidencePercent}% confidence)`);
      
    } catch (err: any) {
      console.error('❌ checkSign error:', err);
      
      let errorMsg = err.message || 'Unknown error occurred';
      
      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout: Server took too long';
      } else if (err.message.includes('fetch') || err.message.includes('network')) {
        errorMsg = 'Cannot connect to backend. Is it running on localhost:8000?';
      }
      
      setResult({ result: 'ERROR', confidence: 0 });
      setDebugInfo(`❌ ${errorMsg}`);
      
    } finally {
      setIsChecking(false);
    }
  };

  const tryAgain = () => {
    setResult(null);
    setIsRecording(false);
    isRecordingRef.current = false;
    framesRef.current = [];
    setDebugInfo('🔄 Reset - ready to try again');
    console.log('🔄 Reset triggered');
  };

  // Initialize MediaPipe Hands
  const initializeMediaPipe = async () => {
    if (!videoRef.current || handsRef.current) return;
    
    try {
      setDebugInfo('🔄 Initializing MediaPipe...');
      console.log('🔄 Initializing MediaPipe Hands...');
      
      // Check if MediaPipe is loaded
      if (typeof Hands === 'undefined') {
        const errorMsg = '❌ MediaPipe not loaded! Add scripts to index.html';
        setDebugInfo(errorMsg);
        console.error(errorMsg);
        console.error('Add these to index.html:');
        console.error('<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>');
        return;
      }
      
      // Create Hands instance
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });
      
      await hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });
      
      hands.onResults(onMediaPipeResults);
      handsRef.current = hands;
      
      console.log('✅ MediaPipe initialized successfully');
      setDebugInfo('✅ MediaPipe ready! Camera active.');
      
      // Start processing frames
      const processFrame = async () => {
        if (handsRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          try {
            await handsRef.current.send({ image: videoRef.current });
          } catch (e) {
            console.error('Frame processing error:', e);
          }
          requestAnimationFrame(processFrame);
        }
      };
      
      setTimeout(() => {
        if (videoRef.current) {
          processFrame();
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ MediaPipe initialization failed:', error);
      setDebugInfo('❌ MediaPipe failed. Check internet connection.');
    }
  };

  // Start camera when letter is selected
  useEffect(() => {
    const startCamera = async () => {
      if (!selected) return;
      
      try {
        setDebugInfo('🎥 Starting camera...');
        console.log('🎥 Requesting camera access...');
        
        // Stop existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Reset MediaPipe
        handsRef.current = null;
        
        // Get new stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
          }, 
          audio: false 
        });
        
        streamRef.current = stream;
        console.log('✅ Camera stream obtained');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          try {
            await videoRef.current.play();
            console.log('✅ Video playing');
            setDebugInfo('✅ Camera started successfully');
            
            // Initialize MediaPipe after video plays
            setTimeout(() => {
              initializeMediaPipe();
            }, 1000);
            
          } catch (playError) {
            console.error('Video play error:', playError);
            setDebugInfo('⚠️ Camera play issue, trying anyway...');
            
            setTimeout(() => {
              initializeMediaPipe();
            }, 500);
          }
        }
        
      } catch (err: any) {
        console.error('❌ Camera access error:', err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setDebugInfo('❌ Camera permission denied. Check browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setDebugInfo('❌ No camera found. Please connect a camera.');
        } else {
          setDebugInfo(`❌ Camera error: ${err.message}`);
        }
      }
    };
    
    startCamera();
    
    // Cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      handsRef.current = null;
      framesRef.current = [];
      isRecordingRef.current = false;
    };
  }, [selected]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Alphabet Practice</h2>
        {setView && (
          <button 
            onClick={() => setView(View.AI_COACH)} 
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Backend Status Banner */}
      {/* {backendHealth && (
        <div className={`mb-4 p-3 rounded ${backendHealth.status === 'healthy' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span className="font-medium">Backend Connected</span>
            </div>
            <div className="text-sm text-gray-600">
              Model: {backendHealth.model_loaded ? '✅' : '❌'} | 
              References: {backendHealth.available_letters?.length || 0} letters
            </div>
          </div>
        </div>
      )} */}

      {!backendHealth && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200">
          <div className="flex items-center gap-2">
            <span className="text-red-600">❌</span>
            <span className="font-medium">Backend Disconnected - Start the server!</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Letter Selection */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Select Letter</h3>
            <div className="grid grid-cols-5 gap-2">
              {LETTERS.map((L) => (
                <button
                  key={L}
                  onClick={() => { 
                    setSelected(L); 
                    setResult(null);
                    setDebugInfo(`Selected: ${L}`);
                    console.log(`📝 Selected letter: ${L}`);
                  }}
                  className={`p-3 rounded border text-center font-semibold transition-all ${
                    selected === L 
                      ? 'bg-blue-100 border-blue-500 text-blue-700 scale-105' 
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  {L}
                </button>
              ))}
            </div>
          </div>

          {/* Debug Panel */}
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <h4 className="font-semibold mb-2 flex items-center justify-between">
              <span>Status</span>
              <button 
                onClick={tryAgain}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Reset
              </button>
            </h4>
            <div className="text-sm">
              <div className="mb-2 p-2 bg-gray-50 rounded">
                <div className="text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {debugInfo}
                </div>
              </div>
              
              {result && (
                <div className="mt-2 p-2 bg-blue-50 rounded">
                  <div className="font-medium">Last Result:</div>
                  <div className="text-gray-600">
                    <div>Result: <strong>{result.result}</strong></div>
                    <div>Confidence: <strong>{(result.confidence * 100).toFixed(1)}%</strong></div>
                    {result.distance && <div>Distance: <strong>{result.distance.toFixed(4)}</strong></div>}
                    {result.frames_processed && <div>Frames: <strong>{result.frames_processed}</strong></div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Camera & Reference */}
        <div className="md:col-span-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera Panel */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h4 className="font-semibold">Live Camera</h4>
                <p className="text-sm text-gray-500">
                  {selected ? `Practice: "${selected}"` : 'Select a letter'}
                </p>
              </div>
              
              <div className="p-4">
                {selected ? (
                  <>
                    <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        className="w-full h-64 object-cover"
                      />
                      {isRecording && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium">REC</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => checkSign(selected)}
                          disabled={isChecking || isRecording}
                          className={`flex-1 px-4 py-2 rounded font-medium transition-all ${
                            isChecking || isRecording
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isChecking ? 'Checking...' : isRecording ? 'Recording...' : 'Check My Sign'}
                        </button>
                        
                        <button 
                          onClick={() => {
                            setSelected(null);
                            console.log('🛑 Stopped camera');
                          }}
                          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                        >
                          Stop
                        </button>
                      </div>
                      
                      {result && (
                        <div className={`p-4 rounded-lg border ${
                          result.result === 'CORRECT' 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`text-2xl ${result.result === 'CORRECT' ? 'text-green-600' : 'text-red-600'}`}>
                              {result.result === 'CORRECT' ? '✅' : '❌'}
                            </div>
                            <div>
                              <div className={`font-semibold ${result.result === 'CORRECT' ? 'text-green-800' : 'text-red-800'}`}>
                                {result.result === 'CORRECT' ? 'Correct!' : 'Incorrect'}
                              </div>
                              <div className="text-sm text-gray-600">
                                Confidence: {(result.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center">
                    <div className="text-5xl mb-4">📷</div>
                    <p className="text-gray-500">Select a letter to start</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reference Panel */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h4 className="font-semibold">Reference</h4>
                <p className="text-sm text-gray-500">
                  {selected ? `How to sign "${selected}"` : 'Reference here'}
                </p>
              </div>
              
              <div className="p-6 flex flex-col items-center justify-center min-h-64">
                {selected ? (
                  <div className="text-center w-full">
                    {referenceImage && !imageLoadError ? (
                      <div className="space-y-4">
                        <img 
                          src={referenceImage}
                          alt={`ASL sign for ${selected}`}
                          className="w-full max-w-sm mx-auto rounded-lg shadow-md object-contain"
                          onError={() => {
                            console.error(`❌ Failed to load image: ${selected}.jpg`);
                            setImageLoadError(true);
                          }}
                        />
                        <div className="text-2xl font-bold text-gray-700">
                          Letter: {selected}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-6xl font-black text-gray-800">{selected}</div>
                        <p className="text-gray-600">Reference sign for "{selected}"</p>
                        {imageLoadError && (
                          <p className="text-xs text-red-500 mt-2">
                            ⚠️ Image not found: ../assets/{selected}.jpg
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-5xl mb-4 text-gray-300">👆</div>
                    <p className="text-gray-500">No letter selected</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t bg-gray-50">
                <div className="text-xs text-gray-600">
                  <div className="flex justify-between mb-1">
                    <span>Backend:</span>
                    <span className="font-medium">
                      {backendHealth?.status === 'healthy' ? '✅ Connected' : '❌ Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MediaPipe:</span>
                    <span className="font-medium">
                      {handsRef.current ? '✅ Ready' : '⏳ Initializing'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlphabetPage;