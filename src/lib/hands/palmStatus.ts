/**
 * Hand Orientation and Palm Status Detection
 * Estimates palm/back orientation and roll rotation from MediaPipe hand landmarks
 */

import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';

import { Vec3, createVec3, cross, normalize, magnitude, dot } from '../../utils/vec3';
import { signedAngleAround, toDegrees } from '../../utils/euler';

// MediaPipe hand landmark indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  
  // Thumb
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  
  // Index finger
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  
  // Middle finger
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  
  // Ring finger
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  
  // Pinky
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
} as const;

export type HandSide = 'left' | 'right';
export type PalmOrientation = 'palm' | 'back' | 'uncertain';

export interface HandStatus {
  side: PalmOrientation;
  roll: number;           // Roll angle in degrees
  normal: Vec3 | null;    // Palm normal vector (null if uncertain)
  confidence: number;     // 0-1, reliability of detection
  isValid: boolean;       // Whether the detection is usable
}

export interface HandOrientationResult {
  leftHand: HandStatus | null;
  rightHand: HandStatus | null;
}

/**
 * Get palm normal vector using high-precision method
 */
export function getPalmNormal(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>,
  handSide: HandSide,
  visibilityThreshold: number = 0.5
): Vec3 | null {
  
  if (landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const indexMcp = landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP];
  const pinkyMcp = landmarks[HAND_LANDMARKS.PINKY_MCP];

  // Check visibility
  const avgVisibility = [wrist, indexMcp, pinkyMcp]
    .reduce((sum, landmark) => sum + (landmark.visibility ?? 1.0), 0) / 3;

  if (avgVisibility < visibilityThreshold) {
    return null;
  }

  // Convert to Vec3
  const wristPos = createVec3(wrist.x, wrist.y, wrist.z || 0);
  const indexPos = createVec3(indexMcp.x, indexMcp.y, indexMcp.z || 0);
  const pinkyPos = createVec3(pinkyMcp.x, pinkyMcp.y, pinkyMcp.z || 0);

  // Create two vectors in the palm plane
  const v1 = {
    x: indexPos.x - wristPos.x,
    y: indexPos.y - wristPos.y,
    z: indexPos.z - wristPos.z
  };
  
  const v2 = {
    x: pinkyPos.x - wristPos.x,
    y: pinkyPos.y - wristPos.y,
    z: pinkyPos.z - wristPos.z
  };

  // Calculate cross product to get normal
  // Order matters for determining palm vs back
  let normal = cross(v1, v2);
  
  // Check if vectors are too parallel
  if (magnitude(normal) < 1e-6) {
    return null;
  }

  normal = normalize(normal);

  // Adjust normal direction based on hand side
  // For MediaPipe coordinate system, ensure consistent orientation
  if (handSide === 'right') {
    // For right hand, flip if needed to point towards palm
    if (normal.z < 0) {
      normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    }
  } else {
    // For left hand
    if (normal.z > 0) {
      normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    }
  }

  return normal;
}

/**
 * Simple palm/back determination using fingertip positions
 */
export function getPalmOrBack(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>,
  handSide: HandSide,
  visibilityThreshold: number = 0.5
): PalmOrientation {
  
  if (landmarks.length < 21) {
    return 'uncertain';
  }

  const indexTip = landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];
  const pinkyTip = landmarks[HAND_LANDMARKS.PINKY_TIP];

  // Check visibility
  if ((indexTip.visibility ?? 1.0) < visibilityThreshold || 
      (pinkyTip.visibility ?? 1.0) < visibilityThreshold) {
    return 'uncertain';
  }

  // Simple heuristic: compare finger positions
  // This is a lightweight approximation
  if (handSide === 'right') {
    // For right hand: if index is to the left of pinky, likely palm view
    return indexTip.x < pinkyTip.x ? 'palm' : 'back';
  } else {
    // For left hand: if index is to the right of pinky, likely palm view
    return indexTip.x > pinkyTip.x ? 'palm' : 'back';
  }
}

/**
 * Calculate roll rotation (pronation/supination)
 */
export function calculateHandRoll(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>,
  handSide: HandSide,
  forearmVector: Vec3,
  palmNormal: Vec3 | null,
  visibilityThreshold: number = 0.5
): number {
  
  if (!palmNormal) {
    return 0;
  }

  // Calculate roll as rotation around the forearm axis
  // This is the pronation/supination movement
  const roll = signedAngleAround(
    { x: 0, y: 1, z: 0 }, // Reference up vector
    palmNormal,
    forearmVector
  );

  return toDegrees(roll);
}

/**
 * Analyze hand orientation for a single hand
 */
export function analyzeHandOrientation(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>,
  handSide: HandSide,
  forearmVector?: Vec3,
  visibilityThreshold: number = 0.5
): HandStatus {
  
  if (landmarks.length < 21) {
    return {
      side: 'uncertain',
      roll: 0,
      normal: null,
      confidence: 0,
      isValid: false
    };
  }

  // Calculate overall confidence based on key landmarks
  const keyLandmarks = [
    landmarks[HAND_LANDMARKS.WRIST],
    landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP],
    landmarks[HAND_LANDMARKS.PINKY_MCP],
    landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP],
    landmarks[HAND_LANDMARKS.PINKY_TIP]
  ];

  const confidence = keyLandmarks
    .reduce((sum, landmark) => sum + (landmark.visibility ?? 1.0), 0) / keyLandmarks.length;

  if (confidence < visibilityThreshold) {
    return {
      side: 'uncertain',
      roll: 0,
      normal: null,
      confidence,
      isValid: false
    };
  }

  // Get palm normal (high precision when needed)
  const palmNormal = getPalmNormal(landmarks, handSide, visibilityThreshold);
  
  // Get palm/back orientation (lightweight)
  const palmOrientation = getPalmOrBack(landmarks, handSide, visibilityThreshold);
  
  // Calculate roll if forearm vector is available
  let roll = 0;
  if (forearmVector && palmNormal) {
    roll = calculateHandRoll(landmarks, handSide, forearmVector, palmNormal, visibilityThreshold);
  }

  return {
    side: palmOrientation,
    roll,
    normal: palmNormal,
    confidence,
    isValid: confidence >= visibilityThreshold
  };
}

/**
 * Analyze orientation for both hands
 */
export function analyzeHandsOrientation(
  result: HandLandmarkerResult,
  leftForearmVector?: Vec3,
  rightForearmVector?: Vec3,
  visibilityThreshold: number = 0.5
): HandOrientationResult {
  
  const handResult: HandOrientationResult = {
    leftHand: null,
    rightHand: null
  };

  if (!result.landmarks || !result.handedness) {
    return handResult;
  }

  // Process each detected hand
  for (let i = 0; i < result.landmarks.length; i++) {
    const landmarks = result.landmarks[i];
    const handedness = result.handedness[i];
    
    if (!handedness || handedness.length === 0) {
      continue;
    }

    // MediaPipe returns 'Left' or 'Right' from the person's perspective
    const isLeftHand = handedness[0].categoryName === 'Left';
    const handSide: HandSide = isLeftHand ? 'left' : 'right';
    const forearmVector = isLeftHand ? leftForearmVector : rightForearmVector;

    const handStatus = analyzeHandOrientation(
      landmarks,
      handSide,
      forearmVector,
      visibilityThreshold
    );

    if (isLeftHand) {
      handResult.leftHand = handStatus;
    } else {
      handResult.rightHand = handStatus;
    }
  }

  return handResult;
}

/**
 * Get hand gesture confidence based on finger positions
 */
export function getHandGestureConfidence(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>
): number {
  
  if (landmarks.length < 21) {
    return 0;
  }

  // Check visibility of important landmarks
  const importantLandmarks = [
    HAND_LANDMARKS.WRIST,
    HAND_LANDMARKS.INDEX_FINGER_TIP,
    HAND_LANDMARKS.MIDDLE_FINGER_TIP,
    HAND_LANDMARKS.RING_FINGER_TIP,
    HAND_LANDMARKS.PINKY_TIP,
    HAND_LANDMARKS.THUMB_TIP
  ];

  const totalVisibility = importantLandmarks
    .reduce((sum, index) => {
      const landmark = landmarks[index];
      return sum + (landmark?.visibility ?? 1.0);
    }, 0);

  return totalVisibility / importantLandmarks.length;
}

/**
 * Determine if hand is in a specific gesture (basic detection)
 */
export function detectBasicGestures(
  landmarks: Array<{x: number, y: number, z?: number, visibility?: number}>
): {
  isFist: boolean;
  isOpen: boolean;
  isPointing: boolean;
  confidence: number;
} {
  
  if (landmarks.length < 21) {
    return {
      isFist: false,
      isOpen: false,
      isPointing: false,
      confidence: 0
    };
  }

  const confidence = getHandGestureConfidence(landmarks);
  
  if (confidence < 0.5) {
    return {
      isFist: false,
      isOpen: false,
      isPointing: false,
      confidence
    };
  }

  // Simple gesture detection based on fingertip positions relative to MCP joints
  const fingerExtensions = [
    // Index finger
    landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP].y < landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP].y,
    // Middle finger
    landmarks[HAND_LANDMARKS.MIDDLE_FINGER_TIP].y < landmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP].y,
    // Ring finger
    landmarks[HAND_LANDMARKS.RING_FINGER_TIP].y < landmarks[HAND_LANDMARKS.RING_FINGER_MCP].y,
    // Pinky
    landmarks[HAND_LANDMARKS.PINKY_TIP].y < landmarks[HAND_LANDMARKS.PINKY_MCP].y
  ];

  const extendedFingers = fingerExtensions.filter(Boolean).length;

  return {
    isFist: extendedFingers === 0,
    isOpen: extendedFingers >= 3,
    isPointing: fingerExtensions[0] && extendedFingers === 1, // Only index extended
    confidence
  };
} 