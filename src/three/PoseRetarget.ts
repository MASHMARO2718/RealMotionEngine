/**
 * Pose Retargeting System
 * Converts MediaPipe pose data to Three.js avatar animation
 */

import * as THREE from 'three';
import type { FullPoseAnalysis } from '../lib/analytics/PoseAnalytics';
import type { AvatarData } from './AvatarLoader';
import { Vec3 } from '../utils/vec3';

// T-pose reference directions for each bone
export const T_POSE_REFERENCES = {
  leftUpperArm: new THREE.Vector3(1, 0, 0),    // Right (positive X)
  rightUpperArm: new THREE.Vector3(-1, 0, 0),  // Left (negative X)
  leftForearm: new THREE.Vector3(1, 0, 0),     // Right
  rightForearm: new THREE.Vector3(-1, 0, 0),   // Left
  leftHand: new THREE.Vector3(1, 0, 0),        // Right
  rightHand: new THREE.Vector3(-1, 0, 0),      // Left
  
  leftThigh: new THREE.Vector3(0, -1, 0),      // Down (negative Y)
  rightThigh: new THREE.Vector3(0, -1, 0),     // Down
  leftShin: new THREE.Vector3(0, -1, 0),       // Down
  rightShin: new THREE.Vector3(0, -1, 0),      // Down
  leftFoot: new THREE.Vector3(0, -1, 0),       // Down
  rightFoot: new THREE.Vector3(0, -1, 0),      // Down
  
  spine: new THREE.Vector3(0, 1, 0),           // Up (positive Y)
  chest: new THREE.Vector3(0, 1, 0),           // Up
  neck: new THREE.Vector3(0, 1, 0),            // Up
  head: new THREE.Vector3(0, 1, 0),            // Up
  hips: new THREE.Vector3(0, 1, 0)             // Up
};

export interface PoseRetargetConfig {
  smoothingFactor: number;     // 0.0 - 1.0, higher = more smoothing
  enableFloorAlignment: boolean;
  enableBodyDirection: boolean;
  coordinateScale: number;     // Scale factor for coordinate conversion
  confidenceThreshold: number; // Minimum confidence to apply pose
}

export const DEFAULT_RETARGET_CONFIG: PoseRetargetConfig = {
  smoothingFactor: 0.3,
  enableFloorAlignment: true,
  enableBodyDirection: true,
  coordinateScale: 1.0,
  confidenceThreshold: 0.5
};

export class PoseRetargeter {
  private config: PoseRetargetConfig;
  private previousQuaternions: Map<string, THREE.Quaternion> = new Map();
  private isInitialized = false;

  constructor(config: PoseRetargetConfig = DEFAULT_RETARGET_CONFIG) {
    this.config = { ...config };
  }

  /**
   * Convert MediaPipe Vec3 to Three.js coordinate system
   */
  mpVecToThree(v: Vec3): THREE.Vector3 {
    return new THREE.Vector3(
      v.x * this.config.coordinateScale,
      -v.y * this.config.coordinateScale,  // Flip Y axis
      -v.z * this.config.coordinateScale   // Flip Z axis
    );
  }

  /**
   * Create quaternion from vector direction relative to T-pose reference
   */
  vecToQuat(vec: THREE.Vector3, reference: THREE.Vector3): THREE.Quaternion {
    // Normalize input vectors
    const normalizedVec = vec.clone().normalize();
    const normalizedRef = reference.clone().normalize();
    
    // Handle degenerate cases
    if (normalizedVec.length() < 0.001 || normalizedRef.length() < 0.001) {
      return new THREE.Quaternion(); // Identity quaternion
    }
    
    // Calculate rotation quaternion
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(normalizedRef, normalizedVec);
    
    return quaternion;
  }

  /**
   * Apply smoothing to quaternion using SLERP
   */
  smoothQuaternion(
    boneName: string, 
    newQuaternion: THREE.Quaternion, 
    smoothingFactor: number = this.config.smoothingFactor
  ): THREE.Quaternion {
    const previous = this.previousQuaternions.get(boneName);
    
    if (!previous) {
      // First frame - store and return as-is
      this.previousQuaternions.set(boneName, newQuaternion.clone());
      return newQuaternion;
    }
    
    // Slerp between previous and new quaternion
    const smoothed = previous.clone().slerp(newQuaternion, smoothingFactor);
    this.previousQuaternions.set(boneName, smoothed.clone());
    
    return smoothed;
  }

  /**
   * Apply pose analysis to avatar
   */
  applyPoseToAvatar(avatar: AvatarData, analysis: FullPoseAnalysis): void {
    if (!analysis.isValid || analysis.confidence < this.config.confidenceThreshold) {
      console.log('⚠️ Pose analysis invalid or low confidence, skipping update');
      return;
    }

    console.log('🎭 Applying pose to avatar, confidence:', analysis.confidence);

    // 1. Apply joint rotations
    this.applyJointRotations(avatar, analysis);
    
    // 2. Apply floor alignment (optional)
    if (this.config.enableFloorAlignment && analysis.floorDetection.isValid) {
      this.applyFloorAlignment(avatar, analysis);
    }
    
    // 3. Apply body direction (optional)
    if (this.config.enableBodyDirection) {
      this.applyBodyDirection(avatar, analysis);
    }
    
    // 4. Update skeleton
    if (avatar.skeleton) {
      avatar.skeleton.update();
    }
    
    if (!this.isInitialized) {
      console.log('✅ Pose retargeting initialized');
      this.isInitialized = true;
    }
  }

  /**
   * Apply joint rotations from pose analysis
   */
  private applyJointRotations(avatar: AvatarData, analysis: FullPoseAnalysis): void {
    const { jointVectors } = analysis;
    
    // Upper body joints
    this.applyJointRotation(avatar, 'leftUpperArm', jointVectors.leftUpperArm);
    this.applyJointRotation(avatar, 'rightUpperArm', jointVectors.rightUpperArm);
    this.applyJointRotation(avatar, 'leftForearm', jointVectors.leftForearm);
    this.applyJointRotation(avatar, 'rightForearm', jointVectors.rightForearm);
    
    // Lower body joints
    this.applyJointRotation(avatar, 'leftThigh', jointVectors.leftThigh);
    this.applyJointRotation(avatar, 'rightThigh', jointVectors.rightThigh);
    this.applyJointRotation(avatar, 'leftShin', jointVectors.leftShin);
    this.applyJointRotation(avatar, 'rightShin', jointVectors.rightShin);
    
    // Torso
    this.applyJointRotation(avatar, 'spine', jointVectors.spine);
  }

  /**
   * Apply rotation to a specific joint
   */
  private applyJointRotation(
    avatar: AvatarData, 
    jointName: string, 
    jointVector: { vector: Vec3; isValid: boolean; confidence: number }
  ): void {
    if (!jointVector.isValid || jointVector.confidence < this.config.confidenceThreshold) {
      return;
    }

    // Get the bone
    const boneName = avatar.boneMapping[jointName];
    if (!boneName) {
      return;
    }
    
    const bone = avatar.bones.get(boneName);
    if (!bone) {
      return;
    }

    // Get T-pose reference
    const reference = T_POSE_REFERENCES[jointName as keyof typeof T_POSE_REFERENCES];
    if (!reference) {
      console.warn(`⚠️ No T-pose reference for joint: ${jointName}`);
      return;
    }

    // Convert to Three.js coordinates
    const threeVec = this.mpVecToThree(jointVector.vector);
    
    // Calculate quaternion
    const quaternion = this.vecToQuat(threeVec, reference);
    
    // Apply smoothing
    const smoothedQuaternion = this.smoothQuaternion(boneName, quaternion);
    
    // Apply to bone
    bone.quaternion.copy(smoothedQuaternion);
    
    console.log(`🦴 Updated ${jointName} (${boneName}) with confidence: ${jointVector.confidence.toFixed(3)}`);
  }

  /**
   * Apply floor alignment to avatar position
   */
  private applyFloorAlignment(avatar: AvatarData, analysis: FullPoseAnalysis): void {
    if (!analysis.floorDetection.isValid) {
      return;
    }

    // Get hips bone (root bone for positioning)
    const hipsBone = avatar.bones.get(avatar.boneMapping['hips']);
    if (!hipsBone) {
      return;
    }

    // Project center of mass to floor and adjust hip position
    const floorProjection = this.mpVecToThree(analysis.centerOfMass.projectedPosition);
    
    // Apply floor alignment (adjust Y position to keep feet on ground)
    // This is a simplified approach - in practice you'd want more sophisticated IK
    hipsBone.position.y = -floorProjection.y;
    
    console.log('🏠 Applied floor alignment');
  }

  /**
   * Apply body direction to avatar rotation
   */
  private applyBodyDirection(avatar: AvatarData, analysis: FullPoseAnalysis): void {
    if (analysis.bodyDirection.confidence < this.config.confidenceThreshold) {
      return;
    }

    // Get hips bone for overall body rotation
    const hipsBone = avatar.bones.get(avatar.boneMapping['hips']);
    if (!hipsBone) {
      return;
    }

    // Convert body direction angle to Y-axis rotation
    const bodyAngleRad = (analysis.bodyDirection.angle * Math.PI) / 180;
    const bodyRotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), 
      bodyAngleRad
    );

    // Apply smoothing to body rotation
    const smoothedBodyRotation = this.smoothQuaternion('hips_yaw', bodyRotation);
    
    // Combine with existing hip rotation
    hipsBone.quaternion.multiplyQuaternions(smoothedBodyRotation, hipsBone.quaternion);
    
    console.log(`🧭 Applied body direction: ${analysis.bodyDirection.angle.toFixed(1)}°`);
  }

  /**
   * Reset retargeter state
   */
  reset(): void {
    this.previousQuaternions.clear();
    this.isInitialized = false;
    console.log('🔄 Pose retargeter reset');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PoseRetargetConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Pose retargeter config updated:', this.config);
  }

  /**
   * Get current smoothing factors for debugging
   */
  getDebugInfo() {
    return {
      config: this.config,
      isInitialized: this.isInitialized,
      cachedQuaternions: this.previousQuaternions.size
    };
  }
} 