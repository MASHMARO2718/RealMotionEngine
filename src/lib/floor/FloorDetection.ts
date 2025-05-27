/**
 * Floor Detection System
 * Detects floor plane using heel and foot landmarks from MediaPipe pose
 */

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import { Vec3, createVec3, cross, normalize, magnitude } from '../../utils/vec3';
import { KalmanFilter3D, MovingAverage3D } from '../../utils/kalman';

// MediaPipe landmark indices for foot detection
export const FOOT_LANDMARKS = {
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,  // Left foot index
  RIGHT_FOOT_INDEX: 32  // Right foot index
} as const;

export interface FloorDetectionResult {
  floorNormal: Vec3;
  floorPoint: Vec3;     // Reference point on floor (left heel)
  confidence: number;   // 0-1, reliability of detection
  isValid: boolean;     // Whether the detection is usable
}

export interface FloorDetectionConfig {
  visibilityThreshold: number;    // Minimum visibility for landmarks
  stabilityThreshold: number;     // Maximum change between frames to be considered stable
  smoothingWindowSize: number;    // Size of moving average window
  useKalmanFilter: boolean;      // Whether to use Kalman filtering
  kalmanProcessNoise: number;    // Process noise for Kalman filter
  kalmanMeasurementNoise: number; // Measurement noise for Kalman filter
}

export const DEFAULT_FLOOR_CONFIG: FloorDetectionConfig = {
  visibilityThreshold: 0.5,
  stabilityThreshold: 0.1,
  smoothingWindowSize: 5,
  useKalmanFilter: true,
  kalmanProcessNoise: 0.01,
  kalmanMeasurementNoise: 0.1
};

export class FloorDetector {
  private config: FloorDetectionConfig;
  private kalmanFilter: KalmanFilter3D;
  private movingAverage: MovingAverage3D;
  private lastNormal: Vec3 | null = null;
  private frameCount = 0;
  private validDetectionCount = 0;

  constructor(config: FloorDetectionConfig = DEFAULT_FLOOR_CONFIG) {
    this.config = { ...config };
    this.kalmanFilter = new KalmanFilter3D(
      config.kalmanProcessNoise,
      config.kalmanMeasurementNoise
    );
    this.movingAverage = new MovingAverage3D(config.smoothingWindowSize);
  }

  /**
   * Detect floor plane from pose landmarks
   */
  detectFloor(result: PoseLandmarkerResult): FloorDetectionResult {
    this.frameCount++;

    // Check if we have valid landmarks
    if (!result.landmarks || result.landmarks.length === 0) {
      return this.createInvalidResult();
    }

    const landmarks = result.landmarks[0];
    if (landmarks.length < 33) {
      return this.createInvalidResult();
    }

    // Extract foot landmarks
    const leftHeel = landmarks[FOOT_LANDMARKS.LEFT_HEEL];
    const rightHeel = landmarks[FOOT_LANDMARKS.RIGHT_HEEL];
    const leftFootIndex = landmarks[FOOT_LANDMARKS.LEFT_FOOT_INDEX];

    // Check landmark visibility
    const confidence = this.calculateConfidence([leftHeel, rightHeel, leftFootIndex]);
    if (confidence < this.config.visibilityThreshold) {
      return this.createInvalidResult();
    }

    // Convert to Vec3 (MediaPipe coordinates are normalized 0-1)
    const heelL = createVec3(leftHeel.x, leftHeel.y, leftHeel.z || 0);
    const heelR = createVec3(rightHeel.x, rightHeel.y, rightHeel.z || 0);
    const footIndexL = createVec3(leftFootIndex.x, leftFootIndex.y, leftFootIndex.z || 0);

    // Calculate floor normal using cross product
    const rawNormal = this.calculateFloorNormal(heelL, heelR, footIndexL);
    if (!rawNormal) {
      return this.createInvalidResult();
    }

    // Ensure normal points "up" (positive Y in MediaPipe coordinate system)
    const correctedNormal = this.ensureUpwardNormal(rawNormal);

    // Apply smoothing
    let smoothedNormal = correctedNormal;
    
    if (this.config.useKalmanFilter) {
      smoothedNormal = this.kalmanFilter.update(correctedNormal);
    } else {
      smoothedNormal = this.movingAverage.update(correctedNormal);
    }

    // Calculate stability
    const stability = this.calculateStability(smoothedNormal);
    const finalConfidence = confidence * stability;

    // Update statistics
    if (finalConfidence > this.config.visibilityThreshold) {
      this.validDetectionCount++;
    }

    this.lastNormal = smoothedNormal;

    return {
      floorNormal: smoothedNormal,
      floorPoint: heelL, // Use left heel as reference point
      confidence: finalConfidence,
      isValid: finalConfidence > this.config.visibilityThreshold
    };
  }

  /**
   * Calculate floor normal from three foot points
   */
  private calculateFloorNormal(heelL: Vec3, heelR: Vec3, footIndexL: Vec3): Vec3 | null {
    // Create two vectors in the floor plane
    const v1 = {
      x: heelR.x - heelL.x,
      y: heelR.y - heelL.y,
      z: heelR.z - heelL.z
    };
    
    const v2 = {
      x: footIndexL.x - heelL.x,
      y: footIndexL.y - heelL.y,
      z: footIndexL.z - heelL.z
    };

    // Calculate cross product to get normal
    const normal = cross(v1, v2);
    
    // Check if vectors are too parallel (degenerate case)
    if (magnitude(normal) < 1e-6) {
      console.warn('Floor detection: degenerate vectors, cannot calculate normal');
      return null;
    }

    return normalize(normal);
  }

  /**
   * Ensure the normal vector points upward
   */
  private ensureUpwardNormal(normal: Vec3): Vec3 {
    // In MediaPipe coordinate system, Y increases downward
    // For floor normal, we want it to point "up" (negative Y direction)
    if (normal.y > 0) {
      return {
        x: -normal.x,
        y: -normal.y,
        z: -normal.z
      };
    }
    return normal;
  }

  /**
   * Calculate confidence based on landmark visibility
   */
  private calculateConfidence(landmarks: Array<{visibility?: number}>): number {
    let totalVisibility = 0;
    let count = 0;

    landmarks.forEach(landmark => {
      if (landmark.visibility !== undefined) {
        totalVisibility += landmark.visibility;
        count++;
      } else {
        // If visibility is not provided, assume it's visible
        totalVisibility += 1.0;
        count++;
      }
    });

    return count > 0 ? totalVisibility / count : 0;
  }

  /**
   * Calculate stability based on change from previous frame
   */
  private calculateStability(currentNormal: Vec3): number {
    if (!this.lastNormal) {
      return 1.0; // First frame, assume stable
    }

    // Calculate angle between current and previous normal
    const dotProduct = Math.max(-1, Math.min(1, 
      currentNormal.x * this.lastNormal.x + 
      currentNormal.y * this.lastNormal.y + 
      currentNormal.z * this.lastNormal.z
    ));
    
    const angle = Math.acos(Math.abs(dotProduct)); // Use absolute to handle direction flips
    const angleDegrees = angle * (180 / Math.PI);

    // Convert angle change to stability score (0-1)
    const maxChangeAngle = 30; // degrees
    const stability = Math.max(0, 1 - (angleDegrees / maxChangeAngle));
    
    return stability;
  }

  /**
   * Create an invalid detection result
   */
  private createInvalidResult(): FloorDetectionResult {
    return {
      floorNormal: { x: 0, y: -1, z: 0 }, // Default upward normal
      floorPoint: { x: 0, y: 0, z: 0 },
      confidence: 0,
      isValid: false
    };
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.kalmanFilter.reset();
    this.movingAverage.reset();
    this.lastNormal = null;
    this.frameCount = 0;
    this.validDetectionCount = 0;
  }

  /**
   * Get detection statistics
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      validDetectionCount: this.validDetectionCount,
      successRate: this.frameCount > 0 ? this.validDetectionCount / this.frameCount : 0,
      hasInitialized: this.lastNormal !== null
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FloorDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update filters if parameters changed
    if (newConfig.kalmanProcessNoise !== undefined || 
        newConfig.kalmanMeasurementNoise !== undefined) {
      this.kalmanFilter = new KalmanFilter3D(
        this.config.kalmanProcessNoise,
        this.config.kalmanMeasurementNoise
      );
    }
    
    if (newConfig.smoothingWindowSize !== undefined) {
      this.movingAverage = new MovingAverage3D(this.config.smoothingWindowSize);
    }
  }
} 