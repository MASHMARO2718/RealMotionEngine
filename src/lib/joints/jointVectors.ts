/**
 * Joint Vector Calculation System
 * Calculates orientation vectors for body joints from MediaPipe pose landmarks
 */

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import { Vec3, createVec3, vectorFromPoints, normalize, magnitude } from '../../utils/vec3';
import { EulerAngles, calculateEulerAngles, angleToFloor } from '../../utils/euler';

// MediaPipe landmark indices for joint calculations
export const JOINT_LANDMARKS = {
  // Upper body
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  
  // Lower body
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  
  // Torso
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2
} as const;

export interface JointVector {
  vector: Vec3;
  confidence: number;
  isValid: boolean;
}

export interface JointOrientation {
  vector: Vec3;
  euler: EulerAngles;
  angleToFloor: number;
  confidence: number;
  isValid: boolean;
}

export interface AllJointVectors {
  // Upper limbs
  leftUpperArm: JointVector;
  rightUpperArm: JointVector;
  leftForearm: JointVector;
  rightForearm: JointVector;
  
  // Lower limbs
  leftThigh: JointVector;
  rightThigh: JointVector;
  leftShin: JointVector;
  rightShin: JointVector;
  
  // Torso
  spine: JointVector;
  leftTorso: JointVector;   // Left shoulder to left hip
  rightTorso: JointVector;  // Right shoulder to right hip
}

export interface AllJointOrientations {
  // Upper limbs
  leftUpperArm: JointOrientation;
  rightUpperArm: JointOrientation;
  leftForearm: JointOrientation;
  rightForearm: JointOrientation;
  
  // Lower limbs
  leftThigh: JointOrientation;
  rightThigh: JointOrientation;
  leftShin: JointOrientation;
  rightShin: JointOrientation;
  
  // Torso
  spine: JointOrientation;
  leftTorso: JointOrientation;
  rightTorso: JointOrientation;
}

/**
 * Calculate a single joint vector from start and end landmarks
 */
export function getJointVector(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>,
  startIndex: number,
  endIndex: number,
  visibilityThreshold: number = 0.5
): JointVector {
  
  // Validate indices
  if (startIndex >= landmarks.length || endIndex >= landmarks.length) {
    return {
      vector: { x: 0, y: 0, z: 0 },
      confidence: 0,
      isValid: false
    };
  }

  const startLandmark = landmarks[startIndex];
  const endLandmark = landmarks[endIndex];

  // Check visibility
  const startVisibility = startLandmark.visibility ?? 1.0;
  const endVisibility = endLandmark.visibility ?? 1.0;
  const confidence = Math.min(startVisibility, endVisibility);

  if (confidence < visibilityThreshold) {
    return {
      vector: { x: 0, y: 0, z: 0 },
      confidence,
      isValid: false
    };
  }

  // Convert to Vec3
  const start = createVec3(
    startLandmark.x, 
    startLandmark.y, 
    startLandmark.z || 0
  );
  const end = createVec3(
    endLandmark.x, 
    endLandmark.y, 
    endLandmark.z || 0
  );

  // Calculate vector
  const vector = vectorFromPoints(start, end);
  
  // Validate vector length
  if (magnitude(vector) < 1e-6) {
    return {
      vector: { x: 0, y: 0, z: 0 },
      confidence,
      isValid: false
    };
  }

  const normalizedVector = normalize(vector);

  return {
    vector: normalizedVector,
    confidence,
    isValid: true
  };
}

/**
 * Calculate all joint vectors from pose landmarks
 */
export function getAllJointVectors(
  result: PoseLandmarkerResult,
  visibilityThreshold: number = 0.5
): AllJointVectors {
  
  if (!result.landmarks || result.landmarks.length === 0) {
    return createEmptyJointVectors();
  }

  const landmarks = result.landmarks[0];
  if (landmarks.length < 33) {
    return createEmptyJointVectors();
  }

  return {
    // Upper limbs
    leftUpperArm: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.LEFT_SHOULDER, 
      JOINT_LANDMARKS.LEFT_ELBOW, 
      visibilityThreshold
    ),
    rightUpperArm: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.RIGHT_SHOULDER, 
      JOINT_LANDMARKS.RIGHT_ELBOW, 
      visibilityThreshold
    ),
    leftForearm: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.LEFT_ELBOW, 
      JOINT_LANDMARKS.LEFT_WRIST, 
      visibilityThreshold
    ),
    rightForearm: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.RIGHT_ELBOW, 
      JOINT_LANDMARKS.RIGHT_WRIST, 
      visibilityThreshold
    ),
    
    // Lower limbs
    leftThigh: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.LEFT_HIP, 
      JOINT_LANDMARKS.LEFT_KNEE, 
      visibilityThreshold
    ),
    rightThigh: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.RIGHT_HIP, 
      JOINT_LANDMARKS.RIGHT_KNEE, 
      visibilityThreshold
    ),
    leftShin: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.LEFT_KNEE, 
      JOINT_LANDMARKS.LEFT_ANKLE, 
      visibilityThreshold
    ),
    rightShin: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.RIGHT_KNEE, 
      JOINT_LANDMARKS.RIGHT_ANKLE, 
      visibilityThreshold
    ),
    
    // Torso - calculate center points for spine
    spine: calculateSpineVector(landmarks, visibilityThreshold),
    leftTorso: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.LEFT_SHOULDER, 
      JOINT_LANDMARKS.LEFT_HIP, 
      visibilityThreshold
    ),
    rightTorso: getJointVector(
      landmarks, 
      JOINT_LANDMARKS.RIGHT_SHOULDER, 
      JOINT_LANDMARKS.RIGHT_HIP, 
      visibilityThreshold
    )
  };
}

/**
 * Calculate joint orientations with Euler angles
 */
export function getJointOrientation(
  jointVector: JointVector,
  floorNormal: Vec3,
  referenceVector?: Vec3
): JointOrientation {
  
  if (!jointVector.isValid) {
    return {
      vector: jointVector.vector,
      euler: { yaw: 0, pitch: 0, roll: 0 },
      angleToFloor: 0,
      confidence: jointVector.confidence,
      isValid: false
    };
  }

  const euler = calculateEulerAngles(jointVector.vector, floorNormal, referenceVector);
  const floorAngle = angleToFloor(jointVector.vector, floorNormal);

  return {
    vector: jointVector.vector,
    euler,
    angleToFloor: floorAngle,
    confidence: jointVector.confidence,
    isValid: true
  };
}

/**
 * Calculate all joint orientations
 */
export function getAllJointOrientations(
  jointVectors: AllJointVectors,
  floorNormal: Vec3
): AllJointOrientations {
  
  return {
    leftUpperArm: getJointOrientation(jointVectors.leftUpperArm, floorNormal),
    rightUpperArm: getJointOrientation(jointVectors.rightUpperArm, floorNormal),
    leftForearm: getJointOrientation(jointVectors.leftForearm, floorNormal),
    rightForearm: getJointOrientation(jointVectors.rightForearm, floorNormal),
    
    leftThigh: getJointOrientation(jointVectors.leftThigh, floorNormal),
    rightThigh: getJointOrientation(jointVectors.rightThigh, floorNormal),
    leftShin: getJointOrientation(jointVectors.leftShin, floorNormal),
    rightShin: getJointOrientation(jointVectors.rightShin, floorNormal),
    
    spine: getJointOrientation(jointVectors.spine, floorNormal),
    leftTorso: getJointOrientation(jointVectors.leftTorso, floorNormal),
    rightTorso: getJointOrientation(jointVectors.rightTorso, floorNormal)
  };
}

/**
 * Calculate spine vector from hip and shoulder centers
 */
function calculateSpineVector(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>,
  visibilityThreshold: number
): JointVector {
  
  const leftShoulder = landmarks[JOINT_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[JOINT_LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[JOINT_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[JOINT_LANDMARKS.RIGHT_HIP];

  // Check visibility
  const avgVisibility = [leftShoulder, rightShoulder, leftHip, rightHip]
    .reduce((sum, landmark) => sum + (landmark.visibility ?? 1.0), 0) / 4;

  if (avgVisibility < visibilityThreshold) {
    return {
      vector: { x: 0, y: 0, z: 0 },
      confidence: avgVisibility,
      isValid: false
    };
  }

  // Calculate center points
  const shoulderCenter = createVec3(
    (leftShoulder.x + rightShoulder.x) / 2,
    (leftShoulder.y + rightShoulder.y) / 2,
    ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2
  );

  const hipCenter = createVec3(
    (leftHip.x + rightHip.x) / 2,
    (leftHip.y + rightHip.y) / 2,
    ((leftHip.z || 0) + (rightHip.z || 0)) / 2
  );

  // Calculate spine vector (hip to shoulder)
  const spineVector = vectorFromPoints(hipCenter, shoulderCenter);
  
  if (magnitude(spineVector) < 1e-6) {
    return {
      vector: { x: 0, y: 0, z: 0 },
      confidence: avgVisibility,
      isValid: false
    };
  }

  return {
    vector: normalize(spineVector),
    confidence: avgVisibility,
    isValid: true
  };
}

/**
 * Create empty joint vectors for error cases
 */
function createEmptyJointVectors(): AllJointVectors {
  const emptyVector: JointVector = {
    vector: { x: 0, y: 0, z: 0 },
    confidence: 0,
    isValid: false
  };

  return {
    leftUpperArm: emptyVector,
    rightUpperArm: emptyVector,
    leftForearm: emptyVector,
    rightForearm: emptyVector,
    leftThigh: emptyVector,
    rightThigh: emptyVector,
    leftShin: emptyVector,
    rightShin: emptyVector,
    spine: emptyVector,
    leftTorso: emptyVector,
    rightTorso: emptyVector
  };
}

/**
 * Get joint angles between connected segments
 */
export function getJointAngle(
  proximalVector: JointVector,
  distalVector: JointVector
): { angle: number; isValid: boolean } {
  
  if (!proximalVector.isValid || !distalVector.isValid) {
    return { angle: 0, isValid: false };
  }

  // Calculate angle between vectors
  const dotProduct = Math.max(-1, Math.min(1,
    proximalVector.vector.x * distalVector.vector.x +
    proximalVector.vector.y * distalVector.vector.y +
    proximalVector.vector.z * distalVector.vector.z
  ));

  const angle = Math.acos(Math.abs(dotProduct)) * (180 / Math.PI);
  
  return { angle, isValid: true };
}

/**
 * Calculate common joint angles
 */
export function getCommonJointAngles(jointVectors: AllJointVectors) {
  return {
    leftElbow: getJointAngle(jointVectors.leftUpperArm, jointVectors.leftForearm),
    rightElbow: getJointAngle(jointVectors.rightUpperArm, jointVectors.rightForearm),
    leftKnee: getJointAngle(jointVectors.leftThigh, jointVectors.leftShin),
    rightKnee: getJointAngle(jointVectors.rightThigh, jointVectors.rightShin)
  };
} 