"use client";

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as faceapi from 'face-api.js';

interface FaceDetectorProps {
  employees: any[];
  onRecognize: (badgeNumber: string) => void;
}

export default function FaceDetector({ employees, onRecognize }: FaceDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // State to control the scanner
  const [status, setStatus] = useState("Loading AI models...");
  
  const lastRecognizedRef = useRef<{ [badge: string]: number }>({});
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Prepare Biometric Data
  const faceMatcher = useMemo(() => {
    if (!employees || employees.length === 0) return null;
    
    const labeledDescriptors = employees
      .filter(emp => emp.face_descriptor)
      .map(emp => {
        const arr = new Float32Array(JSON.parse(emp.face_descriptor));
        return new faceapi.LabeledFaceDescriptors(String(emp.badge_number), [arr]);
      });
      
    if (labeledDescriptors.length === 0) return null;
    
    // Strict 0.45 distance threshold to prevent false positives
    return new faceapi.FaceMatcher(labeledDescriptors, 0.45);
  }, [employees]);

  // 2. Load AI Models on Mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsModelsLoaded(true);
        setStatus("AI Ready. Press Start to begin.");
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("Error: Failed to load AI models.");
      }
    };
    loadModels();
  }, []);

  // 3. Handle Camera Hardware based on 'isScanning' state
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("Scanner Active 🟢");
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera access denied.");
        setIsScanning(false);
      }
    };

    const stopCamera = () => {
      // Physically cut power to the camera hardware
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Stop the AI loop
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };

    if (isScanning && isModelsLoaded) {
      startCamera();
    } else {
      stopCamera();
      if (isModelsLoaded) setStatus("Scanner Paused ⏸️");
    }

    // Cleanup when component unmounts
    return () => stopCamera();
  }, [isScanning, isModelsLoaded]);

  // 4. AI Detection Loop
  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current || !faceMatcher || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    
    faceapi.matchDimensions(canvas, displaySize);

    // Throttle scan to 300ms to save CPU and reduce heat
    scanIntervalRef.current = setInterval(async () => {
      if (!isScanning) return;

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      resizedDetections.forEach(detection => {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        
        // Draw UI Box
        const box = detection.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { 
          label: bestMatch.label === 'unknown' ? 'Unknown Face' : `ID: ${bestMatch.label}`,
          boxColor: bestMatch.label === 'unknown' ? 'red' : '#10b981' // emerald-500
        });
        drawBox.draw(canvas);

        // Process successful recognition
        if (bestMatch.label !== 'unknown') {
          const now = Date.now();
          const lastSeen = lastRecognizedRef.current[bestMatch.label] || 0;
          
          // 3-second debounce to stop rapid-fire clock-ins
          if (now - lastSeen > 3000) {
            lastRecognizedRef.current[bestMatch.label] = now;
            onRecognize(bestMatch.label);
          }
        }
      });
    }, 300); 
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className={`px-4 py-2 rounded-lg font-mono text-sm font-bold border shadow-inner w-full text-center ${isScanning ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
        {status}
      </div>

      {/* Camera Window */}
      <div className={`relative bg-black rounded-2xl overflow-hidden shadow-lg border-4 transition-colors ${isScanning ? 'border-green-500' : 'border-gray-800'} w-full max-w-sm aspect-[3/4] flex items-center justify-center`}>
        {isScanning ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onPlay={handleVideoPlay}
              className="absolute top-0 left-0 w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full object-cover z-10"
            />
          </>
        ) : (
          <div className="text-gray-500 flex flex-col items-center">
            <span className="text-5xl mb-2">📷</span>
            <span className="font-bold">Camera Offline</span>
          </div>
        )}
      </div>

      {/* Control Button */}
      <button
        onClick={() => setIsScanning(!isScanning)}
        disabled={!isModelsLoaded}
        className={`w-full max-w-sm py-4 rounded-xl font-black text-lg shadow-md transition-all ${
          !isModelsLoaded 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : isScanning 
              ? 'bg-red-500 hover:bg-red-600 text-white border-b-4 border-red-700 active:border-b-0 active:mt-1' 
              : 'bg-gray-900 hover:bg-gray-800 text-white border-b-4 border-black active:border-b-0 active:mt-1'
        }`}
      >
        {isScanning ? '🛑 STOP SCANNER' : '▶️ START SCANNER'}
      </button>
    </div>
  );
}