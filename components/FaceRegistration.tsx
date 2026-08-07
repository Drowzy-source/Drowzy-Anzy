import React, { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Employee {
  badge_number: string | number;
  name: string;
}

interface FaceRegistrationProps {
  employees: Employee[];
}

export default function FaceRegistration({ employees }: FaceRegistrationProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setIsLoaded(true);
    };
    loadModels();
  }, []);

  // Helper to load a file into an HTML Image element programmatically
  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });
    setLogs([]);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length });

      // Extract badge number from filename (e.g., "491.jpg" -> "491")
      const filename = file.name;
      const badgeNumber = filename.substring(0, filename.lastIndexOf('.')) || filename;

      try {
        setLogs(prev => [`Processing ${filename} (Badge: ${badgeNumber})...`, ...prev.slice(0, 15)]);

        // Convert file to loadable Image element
        const imgElement = await loadImageFromFile(file);

        // Run AI face detection & extraction
        const detection = await faceapi.detectSingleFace(
          imgElement,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
          setLogs(prev => [`❌ Skipped ${filename}: No face detected.`, ...prev.slice(0, 15)]);
          failCount++;
          continue;
        }

        const descriptorArray = Array.from(detection.descriptor);

        // Update Supabase
        const { error } = await supabase
          .from('employees')
          .update({ face_descriptor: JSON.stringify(descriptorArray) })
          .eq('badge_number', badgeNumber);

        if (error) throw error;

        setLogs(prev => [`✅ Successfully saved Badge ${badgeNumber}!`, ...prev.slice(0, 15)]);
        successCount++;

      } catch (err: any) {
        setLogs(prev => [`❌ Error on ${filename}: ${err.message}`, ...prev.slice(0, 15)]);
        failCount++;
      }
    }

    setIsProcessing(false);
    setLogs(prev => [`🎉 Bulk upload complete! Success: ${successCount}, Failed/Skipped: ${failCount}`, ...prev]);
  };

  if (!isLoaded) return <div className="p-6 font-bold text-gray-500">Loading AI Bulk Processor Engine...</div>;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl w-full">
      <h2 className="text-xl font-black mb-2">Bulk Face ID Registration</h2>
      <p className="text-sm text-gray-500 mb-6">
        Select a folder or multiple JPEG/PNG files. Ensure the files are named after the worker's badge number (e.g., <code className="bg-gray-100 p-1 rounded">491.jpg</code>).
      </p>

      <div className="space-y-4">
        {/* Bulk File Input */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition">
          <input 
            type="file" 
            multiple 
            accept="image/jpeg, image/png"
            onChange={handleBulkUpload}
            disabled={isProcessing}
            className="w-full cursor-pointer disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-2">Supports multi-file selection (.jpg, .png)</p>
        </div>

        {/* Progress Tracker */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex justify-between text-sm font-bold text-blue-700 mb-1">
              <span>Processing files...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Live Execution Logs */}
        {logs.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Live Activity Logs</label>
            <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg h-48 overflow-y-auto space-y-1 shadow-inner">
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}