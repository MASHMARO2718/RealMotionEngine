/**
 * Integrated Pose Analytics System
 * Combines floor detection, joint vectors, and hand orientation for comprehensive pose analysis
 */

import type { PoseLandmarkerResult, HandLandmarkerResult } from '@mediapipe/tasks-vision';

import { Vec3, projectToPlane, distance } from '../../utils/vec3';
import { calculateAbsoluteDirection, averageAngles } from '../../utils/euler';
import { FloorDetector, FloorDetectionResult, DEFAULT_FLOOR_CONFIG } from '../floor/FloorDetection';
import { 
  getAllJointVectors, 
  getAllJointOrientations, 
  getCommonJointAngles,
  AllJointVectors, 
  AllJointOrientations 
} from '../joints/jointVectors';
import { 
  analyzeHandsOrientation, 
  HandOrientationResult 
} from '../hands/palmStatus';

export interface BodyDirection {
  angle: number;          // 0-360 degrees
  vector: Vec3;          // Projected direction vector
  confidence: number;    // 0-1 reliability
}

export interface CenterOfMass {
  position: Vec3;        // 3D position
  projectedPosition: Vec3; // Projected to floor plane
  velocity: Vec3;        // Rate of change
  confidence: number;    // 0-1 reliability
}

export interface FootworkAnalysis {
  leftFootPosition: Vec3;
  rightFootPosition: Vec3;
  stance: 'neutral' | 'left' | 'right' | 'wide' | 'narrow';
  stepDetected: boolean;
  stepSide: 'left' | 'right' | 'none';
  balance: number;       // -1 (left) to 1 (right)
}

export interface PostureStability {
  score: number;         // 0-1, higher is more stable
  sway: number;          // Amount of body sway
  alignment: number;     // How well aligned the body is
  riskFactors: string[]; // List of potential balance issues
}

export interface FullPoseAnalysis {
  // Core data
  floorDetection: FloorDetectionResult;
  jointVectors: AllJointVectors;
  jointOrientations: AllJointOrientations;
  handOrientation: HandOrientationResult;
  
  // Derived analysis
  bodyDirection: BodyDirection;
  centerOfMass: CenterOfMass;
  footwork: FootworkAnalysis;
  postureStability: PostureStability;
  
  // Joint angles
  jointAngles: {
    leftElbow: { angle: number; isValid: boolean };
    rightElbow: { angle: number; isValid: boolean };
    leftKnee: { angle: number; isValid: boolean };
    rightKnee: { angle: number; isValid: boolean };
  };
  
  // Meta information
  timestamp: number;
  confidence: number;    // Overall analysis confidence
  isValid: boolean;      // Whether this frame is usable
}

export class PoseAnalyticsEngine {
  private floorDetector: FloorDetector;
  private previousAnalysis: FullPoseAnalysis | null = null;
  private comHistory: Vec3[] = [];
  private frameCount = 0;
  
  constructor(floorConfig = DEFAULT_FLOOR_CONFIG) {
    this.floorDetector = new FloorDetector(floorConfig);
  }

  /**
   * Analyze a complete frame with pose and hand data
   */
  analyzeFrame(
    poseResult: PoseLandmarkerResult,
    handResult?: HandLandmarkerResult,
    timestamp: number = Date.now()
  ): FullPoseAnalysis {
    
    this.frameCount++;
    
    // 1. Floor detection
    const floorDetection = this.floorDetector.detectFloor(poseResult);
    
    // 2. Joint vector analysis
    const jointVectors = getAllJointVectors(poseResult);
    const jointOrientations = getAllJointOrientations(jointVectors, floorDetection.floorNormal);
    
    // 3. Hand orientation analysis
    const handOrientation = handResult ? 
      analyzeHandsOrientation(
        handResult,
        jointVectors.leftForearm.isValid ? jointVectors.leftForearm.vector : undefined,
        jointVectors.rightForearm.isValid ? jointVectors.rightForearm.vector : undefined
      ) : { leftHand: null, rightHand: null };
    
    // 4. Derived analysis
    const bodyDirection = this.calculateBodyDirection(jointVectors, floorDetection);
    const centerOfMass = this.calculateCenterOfMass(poseResult, floorDetection);
    const footwork = this.analyzeFootwork(poseResult, floorDetection);
    const postureStability = this.calculatePostureStability(jointVectors, floorDetection);
    
    // 5. Joint angles
    const jointAngles = getCommonJointAngles(jointVectors);
    
    // 6. Overall confidence
    const confidence = this.calculateOverallConfidence(
      floorDetection,
      jointVectors,
      handOrientation
    );
    
    const analysis: FullPoseAnalysis = {
      floorDetection,
      jointVectors,
      jointOrientations,
      handOrientation,
      bodyDirection,
      centerOfMass,
      footwork,
      postureStability,
      jointAngles,
      timestamp,
      confidence,
      isValid: confidence > 0.5 && floorDetection.isValid
    };
    
    // Update history
    this.updateHistory(analysis);
    this.previousAnalysis = analysis;
    
    return analysis;
  }

  /**
   * Calculate body direction from spine and hip orientation
   */
  private calculateBodyDirection(
    jointVectors: AllJointVectors,
    floorDetection: FloorDetectionResult
  ): BodyDirection {
    
    if (!jointVectors.spine.isValid || !floorDetection.isValid) {
      return {
        angle: 0,
        vector: { x: 0, y: 0, z: 1 },
        confidence: 0
      };
    }
    
    // Project spine vector onto floor plane
    const projectedSpine = projectToPlane(jointVectors.spine.vector, floorDetection.floorNormal);
    const angle = calculateAbsoluteDirection(projectedSpine, floorDetection.floorNormal);
    
    return {
      angle,
      vector: projectedSpine,
      confidence: jointVectors.spine.confidence * floorDetection.confidence
    };
  }

  /**
   * Calculate center of mass from key body landmarks
   */
  private calculateCenterOfMass(
    poseResult: PoseLandmarkerResult,
    floorDetection: FloorDetectionResult
  ): CenterOfMass {
    
    if (!poseResult.landmarks || poseResult.landmarks.length === 0) {
      return {
        position: { x: 0, y: 0, z: 0 },
        projectedPosition: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        confidence: 0
      };
    }
    
    const landmarks = poseResult.landmarks[0];
    
    // Key body points for COM calculation
    const comLandmarks = [
      { index: 11, weight: 1 }, // Left shoulder
      { index: 12, weight: 1 }, // Right shoulder
      { index: 23, weight: 2 }, // Left hip (more weight as it's central)
      { index: 24, weight: 2 }, // Right hip
    ];
    
    let totalWeight = 0;
    let weightedSum = { x: 0, y: 0, z: 0 };
    let totalVisibility = 0;
    
    comLandmarks.forEach(({ index, weight }) => {
      if (index < landmarks.length) {
        const landmark = landmarks[index];
        const visibility = landmark.visibility ?? 1.0;
        
        weightedSum.x += landmark.x * weight * visibility;
        weightedSum.y += landmark.y * weight * visibility;
        weightedSum.z += (landmark.z || 0) * weight * visibility;
        
        totalWeight += weight * visibility;
        totalVisibility += visibility;
      }
    });
    
    const confidence = totalVisibility / comLandmarks.length;
    
    if (totalWeight === 0) {
      return {
        position: { x: 0, y: 0, z: 0 },
        projectedPosition: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        confidence: 0
      };
    }
    
    const position: Vec3 = {
      x: weightedSum.x / totalWeight,
      y: weightedSum.y / totalWeight,
      z: weightedSum.z / totalWeight
    };
    
    // Project onto floor plane
    const projectedPosition = floorDetection.isValid ?
      projectToPlane(position, floorDetection.floorNormal) : position;
    
    // Calculate velocity if we have previous data
    let velocity: Vec3 = { x: 0, y: 0, z: 0 };
    if (this.comHistory.length > 0) {
      const previous = this.comHistory[this.comHistory.length - 1];
      velocity = {
        x: position.x - previous.x,
        y: position.y - previous.y,
        z: position.z - previous.z
      };
    }
    
    return {
      position,
      projectedPosition,
      velocity,
      confidence
    };
  }

  /**
   * Analyze footwork and stance
   */
  private analyzeFootwork(
    poseResult: PoseLandmarkerResult,
    floorDetection: FloorDetectionResult
  ): FootworkAnalysis {
    
    if (!poseResult.landmarks || poseResult.landmarks.length === 0) {
      return {
        leftFootPosition: { x: 0, y: 0, z: 0 },
        rightFootPosition: { x: 0, y: 0, z: 0 },
        stance: 'neutral',
        stepDetected: false,
        stepSide: 'none',
        balance: 0
      };
    }
    
    const landmarks = poseResult.landmarks[0];
    const leftAnkle = landmarks[27];  // Left ankle
    const rightAnkle = landmarks[28]; // Right ankle
    
    const leftFootPosition: Vec3 = {
      x: leftAnkle.x,
      y: leftAnkle.y,
      z: leftAnkle.z || 0
    };
    
    const rightFootPosition: Vec3 = {
      x: rightAnkle.x,
      y: rightAnkle.y,
      z: rightAnkle.z || 0
    };
    
    // Calculate stance width
    const stanceWidth = distance(leftFootPosition, rightFootPosition);
    
    // Determine stance type
    let stance: FootworkAnalysis['stance'] = 'neutral';
    if (stanceWidth > 0.3) {
      stance = 'wide';
    } else if (stanceWidth < 0.1) {
      stance = 'narrow';
    }
    
    // Simple step detection (would need more sophisticated analysis for real use)
    const stepDetected = false; // Placeholder
    const stepSide: FootworkAnalysis['stepSide'] = 'none';
    
    // Balance calculation (based on foot position relative to COM)
    const balance = (rightFootPosition.x - leftFootPosition.x) * 2; // Simplified
    
    return {
      leftFootPosition,
      rightFootPosition,
      stance,
      stepDetected,
      stepSide,
      balance: Math.max(-1, Math.min(1, balance))
    };
  }

  /**
   * Calculate posture stability score
   */
  private calculatePostureStability(
    jointVectors: AllJointVectors,
    floorDetection: FloorDetectionResult
  ): PostureStability {
    
    if (!floorDetection.isValid) {
      return {
        score: 0,
        sway: 0,
        alignment: 0,
        riskFactors: ['Floor detection failed']
      };
    }
    
    const riskFactors: string[] = [];
    let stabilityScore = 1.0;
    
    // Check spine alignment
    let spineAlignment = 0;
    if (jointVectors.spine.isValid) {
      const spineAngle = Math.abs(jointVectors.spine.vector.x);
      spineAlignment = Math.max(0, 1 - spineAngle * 2);
      
      if (spineAlignment < 0.7) {
        riskFactors.push('Poor spine alignment');
        stabilityScore *= 0.8;
      }
    }
    
    // Check limb symmetry
    if (jointVectors.leftTorso.isValid && jointVectors.rightTorso.isValid) {
      const asymmetry = Math.abs(
        jointVectors.leftTorso.vector.y - jointVectors.rightTorso.vector.y
      );
      
      if (asymmetry > 0.1) {
        riskFactors.push('Torso asymmetry detected');
        stabilityScore *= 0.9;
      }
    }
    
    // Simple sway calculation (would need temporal analysis for real implementation)
    const sway = this.comHistory.length > 1 ? 
      distance(this.comHistory[this.comHistory.length - 1], this.comHistory[this.comHistory.length - 2]) : 0;
    
    return {
      score: stabilityScore,
      sway,
      alignment: spineAlignment,
      riskFactors
    };
  }

  /**
   * Calculate overall confidence for the analysis
   */
  private calculateOverallConfidence(
    floorDetection: FloorDetectionResult,
    jointVectors: AllJointVectors,
    handOrientation: HandOrientationResult
  ): number {
    
    // Weight different components
    const floorWeight = 0.3;
    const poseWeight = 0.6;
    const handWeight = 0.1;
    
    let totalConfidence = 0;
    
    // Floor detection confidence
    totalConfidence += floorDetection.confidence * floorWeight;
    
    // Pose confidence (average of key joints)
    const keyJointConfidences = [
      jointVectors.spine.confidence,
      jointVectors.leftUpperArm.confidence,
      jointVectors.rightUpperArm.confidence,
      jointVectors.leftThigh.confidence,
      jointVectors.rightThigh.confidence
    ].filter(c => c > 0);
    
    const avgPoseConfidence = keyJointConfidences.length > 0 ? 
      keyJointConfidences.reduce((sum, c) => sum + c, 0) / keyJointConfidences.length : 0;
    
    totalConfidence += avgPoseConfidence * poseWeight;
    
    // Hand confidence
    const handConfidences = [
      handOrientation.leftHand?.confidence || 0,
      handOrientation.rightHand?.confidence || 0
    ];
    const avgHandConfidence = handConfidences.reduce((sum, c) => sum + c, 0) / 2;
    
    totalConfidence += avgHandConfidence * handWeight;
    
    return Math.max(0, Math.min(1, totalConfidence));
  }

  /**
   * Update historical data
   */
  private updateHistory(analysis: FullPoseAnalysis): void {
    // Keep COM history for velocity calculation
    this.comHistory.push(analysis.centerOfMass.position);
    if (this.comHistory.length > 10) {
      this.comHistory.shift();
    }
  }

  /**
   * Reset the analytics engine
   */
  reset(): void {
    this.floorDetector.reset();
    this.previousAnalysis = null;
    this.comHistory = [];
    this.frameCount = 0;
  }

  /**
   * Get analytics statistics
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      floorStats: this.floorDetector.getStats(),
      comHistoryLength: this.comHistory.length
    };
  }
} 