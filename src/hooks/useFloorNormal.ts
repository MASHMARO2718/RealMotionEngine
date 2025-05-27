/**
 * React Hook for floor normal detection
 */

import { useCallback, useRef, useState } from 'react';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import { 
  FloorDetector, 
  FloorDetectionResult, 
  FloorDetectionConfig, 
  DEFAULT_FLOOR_CONFIG 
} from '../lib/floor/FloorDetection';

export interface UseFloorNormalResult {
  floorNormal: { x: number; y: number; z: number };
  floorPoint: { x: number; y: number; z: number };
  confidence: number;
  isValid: boolean;
  stats: {
    frameCount: number;
    validDetectionCount: number;
    successRate: number;
    hasInitialized: boolean;
  };
  updatePose: (result: PoseLandmarkerResult) => void;
  reset: () => void;
  updateConfig: (config: Partial<FloorDetectionConfig>) => void;
}

/**
 * Hook for detecting floor normal from MediaPipe pose landmarks
 */
export function useFloorNormal(
  config: FloorDetectionConfig = DEFAULT_FLOOR_CONFIG
): UseFloorNormalResult {
  const detectorRef = useRef<FloorDetector | null>(null);
  const [floorData, setFloorData] = useState<FloorDetectionResult>({
    floorNormal: { x: 0, y: -1, z: 0 },
    floorPoint: { x: 0, y: 0, z: 0 },
    confidence: 0,
    isValid: false
  });
  const [stats, setStats] = useState({
    frameCount: 0,
    validDetectionCount: 0,
    successRate: 0,
    hasInitialized: false
  });

  // Initialize detector on first use
  if (!detectorRef.current) {
    detectorRef.current = new FloorDetector(config);
  }

  const updatePose = useCallback((result: PoseLandmarkerResult) => {
    if (!detectorRef.current) return;

    try {
      const detection = detectorRef.current.detectFloor(result);
      setFloorData(detection);
      
      // Update stats
      const newStats = detectorRef.current.getStats();
      setStats(newStats);

      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('🏠 Floor Detection:', {
          confidence: detection.confidence.toFixed(3),
          isValid: detection.isValid,
          normal: {
            x: detection.floorNormal.x.toFixed(3),
            y: detection.floorNormal.y.toFixed(3),
            z: detection.floorNormal.z.toFixed(3)
          },
          successRate: (newStats.successRate * 100).toFixed(1) + '%'
        });
      }
    } catch (error) {
      console.error('Floor detection error:', error);
    }
  }, []);

  const reset = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.reset();
      setFloorData({
        floorNormal: { x: 0, y: -1, z: 0 },
        floorPoint: { x: 0, y: 0, z: 0 },
        confidence: 0,
        isValid: false
      });
      setStats({
        frameCount: 0,
        validDetectionCount: 0,
        successRate: 0,
        hasInitialized: false
      });
    }
  }, []);

  const updateConfig = useCallback((newConfig: Partial<FloorDetectionConfig>) => {
    if (detectorRef.current) {
      detectorRef.current.updateConfig(newConfig);
    }
  }, []);

  return {
    floorNormal: floorData.floorNormal,
    floorPoint: floorData.floorPoint,
    confidence: floorData.confidence,
    isValid: floorData.isValid,
    stats,
    updatePose,
    reset,
    updateConfig
  };
} 