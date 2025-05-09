// Re-export types and interfaces from the declaration file
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Hand gesture types
export enum GestureType {
  UNKNOWN = -1,
  FIST = 0,
  ONE_FINGER = 1,
  TWO_FINGERS = 2,
  THREE_FINGERS = 3,
  FOUR_FINGERS = 4,
  FIVE_FINGERS = 5,
  OK_GESTURE = 6,
  THUMB_UP = 7
}

export interface HandLandmark {
  points: Point3D[];
  gesture?: GestureType;
}

export interface HandTrackingResult {
  hands: HandLandmark[];
  score: number;
}

export interface HandTrackerModule {
  // Initialize function
  initialize_hand_tracker(): number;
  
  // Detect hand landmarks from image data
  detect_hand_landmarks(imageData: Uint8Array | Uint8ClampedArray, width: number, height: number): number;
  
  // Get finger tip coordinates
  get_finger_tips(resultPtr: number): number;
  
  // Recognize hand gesture
  recognize_gesture(resultPtr: number, handIndex: number): number;
  
  // Memory management functions
  free_tracking_result(resultPtr: number): void;
  free_points(pointsPtr: number): void;
  
  // Helper functions
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
}

// Helper function to parse Point3D array from C++ pointer
export function parsePoint3DArray(module: HandTrackerModule, ptr: number, count: number): Point3D[] {
  if (ptr === 0) return [];
  
  const points: Point3D[] = [];
  const floatSize = 4; // Size of float (bytes)
  const pointSize = 3 * floatSize; // x, y, z (4 bytes each)
  
  for (let i = 0; i < count; i++) {
    const offset = ptr + i * pointSize;
    const x = module.HEAPF32[(offset >> 2)];
    const y = module.HEAPF32[(offset >> 2) + 1];
    const z = module.HEAPF32[(offset >> 2) + 2];
    points.push({ x, y, z });
  }
  
  return points;
}

// Default interface for the hand tracker instance
export default interface HandTrackerInstance {
  // Initialize
  initialize(): Promise<boolean>;
  
  // Detect hand landmarks from image data
  detectHandLandmarks(imageData: ImageData | Uint8ClampedArray, width?: number, height?: number): Promise<HandTrackingResult | null>;
  
  // Get finger tip coordinates
  getFingerTips(result: HandTrackingResult): Promise<Point3D[]>;
  
  // Recognize hand gesture
  recognizeGesture(result: HandTrackingResult, handIndex: number): Promise<GestureType>;
  
  // Release resources
  dispose(): void;
  
  // Check if module is loaded
  isLoaded: boolean;
} 