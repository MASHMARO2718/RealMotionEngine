/**
 * Lock-On System Hook
 * Coordinates person detection, tracking, and pose analysis for lock-on functionality
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

type LockState = 'SEARCHING' | 'LOCKING' | 'LOCKED' | 'LOST';

interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TrackResult {
  id: number;
  bbox: ROI;
  confidence: number;
}

interface LockOnState {
  lockState: LockState;
  roi: ROI | null;
  trackId: number | null;
  landmarks: PoseLandmarkerResult | null;
  tracks: TrackResult[];
}

interface UseLockOnSystemOptions {
  enabled?: boolean;
  onStateChange?: (state: LockOnState) => void;
  onPoseDetected?: (result: PoseLandmarkerResult) => void;
}

export function useLockOnSystem({
  enabled = true,
  onStateChange,
  onPoseDetected
}: UseLockOnSystemOptions = {}) {
  const [lockState, setLockState] = useState<LockOnState>({
    lockState: 'SEARCHING',
    roi: null,
    trackId: null,
    landmarks: null,
    tracks: []
  });

  const detectorWorkerRef = useRef<Worker | null>(null);
  const poseWorkerRef = useRef<Worker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isInitializedRef = useRef(false);
  const frameRequestRef = useRef<number | null>(null);

  // Initialize workers
  useEffect(() => {
    if (!enabled) return;

    const initializeWorkers = async () => {
      try {
        // For now, disable workers due to MediaPipe compatibility issues
        // TODO: Implement proper worker support later
        console.log('Lock-on system: Workers disabled for MediaPipe compatibility');
        
        isInitializedRef.current = true;
      } catch (error) {
        console.error('Failed to initialize lock-on workers:', error);
      }
    };

    initializeWorkers();

    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
      
      if (detectorWorkerRef.current) {
        detectorWorkerRef.current.terminate();
        detectorWorkerRef.current = null;
      }
      
      if (poseWorkerRef.current) {
        poseWorkerRef.current.terminate();
        poseWorkerRef.current = null;
      }
      
      isInitializedRef.current = false;
    };
  }, [enabled, onPoseDetected]);

  // Notify state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(lockState);
    }
  }, [lockState, onStateChange]);

  const processFrame = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    if (!isInitializedRef.current || !detectorWorkerRef.current || !poseWorkerRef.current) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas matches video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Draw current frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const timestamp = Date.now();

    // Send frame to detector worker
    detectorWorkerRef.current.postMessage({
      type: 'detect',
      frame: imageData,
      timestamp
    });

    // Send frame to pose worker
    poseWorkerRef.current.postMessage({
      type: 'detect',
      frame: imageData,
      timestamp
    });
  }, []);

  const startTracking = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    videoRef.current = video;
    canvasRef.current = canvas;

    const processLoop = () => {
      if (enabled && videoRef.current && canvasRef.current && 
          videoRef.current.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
        processFrame(videoRef.current, canvasRef.current);
      }
      
      if (enabled) {
        frameRequestRef.current = requestAnimationFrame(processLoop);
      }
    };

    processLoop();
  }, [enabled, processFrame]);

  const stopTracking = useCallback(() => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }
    
    videoRef.current = null;
    canvasRef.current = null;
  }, []);

  const reacquireTarget = useCallback(() => {
    // Reset to searching state
    setLockState(prev => ({
      ...prev,
      lockState: 'SEARCHING',
      roi: null,
      trackId: null,
      landmarks: null
    }));

    // Notify pose worker to reset
    if (poseWorkerRef.current) {
      poseWorkerRef.current.postMessage({
        type: 'setROI',
        roi: null,
        trackId: null
      });
    }
  }, []);

  return {
    lockState,
    startTracking,
    stopTracking,
    reacquireTarget,
    isInitialized: isInitializedRef.current
  };
} 