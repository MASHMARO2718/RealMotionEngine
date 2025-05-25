/**
 * WebWorker #2 - Pose + Lock Logic
 * Handles MediaPipe pose detection and lock state management
 */

import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

type LockState = 'SEARCHING' | 'LOCKING' | 'LOCKED' | 'LOST';

interface PoseMessage {
  type: 'init' | 'detect' | 'setROI';
  frame?: ImageData;
  timestamp?: number;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  trackId?: number | null;
}

interface PoseResponse {
  type: 'lockOn' | 'pose' | 'initialized' | 'error';
  locked?: boolean;
  lockState?: LockState;
  landmarks?: PoseLandmarkerResult;
  timestamp?: number;
  trackId?: number | null;
  error?: string;
}

class PoseLockTracker {
  private poseLandmarker: PoseLandmarker | null = null;
  private lockState: LockState = 'SEARCHING';
  private goodCount = 0;
  private lostCount = 0;
  private currentROI: { x: number; y: number; width: number; height: number } | null = null;
  private currentTrackId: number | null = null;
  
  // Configuration parameters
  private readonly VIS_TH = 0.3;      // landmark visibility threshold (reduced from 0.5)
  private readonly CONS_FRAMES = 3;   // consecutive frames to lock (reduced from 5)
  private readonly LOST_TIMEOUT = 15; // frames grace before LOST (reduced from 20)
  
  // Key landmark indices for lock validation (simplified set)
  private readonly KEY_IDX = [0, 11, 12, 23, 24]; // nose, shoulders, hips only

  public async initialize(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks('/models');
      
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3
      });
    } catch (error) {
      throw new Error(`Failed to initialize pose landmarker: ${error}`);
    }
  }

  public setROI(roi: { x: number; y: number; width: number; height: number } | null, trackId: number | null): void {
    this.currentROI = roi;
    this.currentTrackId = trackId;
    
    // Reset state machine when ROI changes
    if (!roi) {
      this.transitionToState('SEARCHING');
    }
  }

  public detectPose(frame: ImageData, timestamp: number): PoseResponse {
    if (!this.poseLandmarker) {
      return { 
        type: 'error', 
        error: 'Pose landmarker not initialized',
        timestamp 
      };
    }

    try {
      // Create a cropped canvas if we have an ROI
      let processFrame = frame;
      if (this.currentROI && this.lockState !== 'SEARCHING') {
        processFrame = this.cropFrame(frame, this.currentROI);
      }

      // Detect pose landmarks
      const result = this.poseLandmarker.detectForVideo(
        this.imageDataToHTMLCanvasElement(processFrame),
        timestamp
      );

      // Update lock state based on detection results
      this.updateLockState(result);

      const response: PoseResponse = {
        type: 'lockOn',
        locked: this.lockState === 'LOCKED',
        lockState: this.lockState,
        timestamp,
        trackId: this.currentTrackId
      };

      // Only send landmarks when locked to save bandwidth
      if (this.lockState === 'LOCKED' && result.landmarks.length > 0) {
        response.landmarks = result;
        response.type = 'pose';
      }

      return response;
    } catch (error) {
      return {
        type: 'error',
        error: `Pose detection failed: ${error}`,
        timestamp
      };
    }
  }

  private updateLockState(result: PoseLandmarkerResult): void {
    const hasValidLandmarks = this.validateLandmarks(result);
    
    switch (this.lockState) {
      case 'SEARCHING':
        if (hasValidLandmarks && this.currentROI) {
          this.goodCount++;
          if (this.goodCount >= this.CONS_FRAMES) {
            this.transitionToState('LOCKING');
          }
        } else {
          this.goodCount = 0;
        }
        break;

      case 'LOCKING':
        if (hasValidLandmarks) {
          this.transitionToState('LOCKED');
        } else {
          this.transitionToState('SEARCHING');
        }
        break;

      case 'LOCKED':
        if (hasValidLandmarks) {
          this.lostCount = 0;
        } else {
          this.lostCount++;
          if (this.lostCount >= this.LOST_TIMEOUT) {
            this.transitionToState('LOST');
          }
        }
        break;

      case 'LOST':
        if (hasValidLandmarks) {
          this.transitionToState('SEARCHING');
        }
        // Auto-transition back to SEARCHING after a timeout
        setTimeout(() => {
          if (this.lockState === 'LOST') {
            this.transitionToState('SEARCHING');
          }
        }, 3000);
        break;
    }
  }

  private validateLandmarks(result: PoseLandmarkerResult): boolean {
    if (!result.landmarks || result.landmarks.length === 0) {
      return false;
    }

    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length < 33) {
      return false;
    }

    // Check if key landmarks are visible
    return this.KEY_IDX.every(i => {
      if (i >= landmarks.length) return false;
      const landmark = landmarks[i];
      return landmark.visibility !== undefined && landmark.visibility > this.VIS_TH;
    });
  }

  private transitionToState(newState: LockState): void {
    if (this.lockState !== newState) {
      this.lockState = newState;
      this.goodCount = 0;
      this.lostCount = 0;
      
      // Send state change notification
      self.postMessage({
        type: 'lockOn',
        locked: newState === 'LOCKED',
        lockState: newState,
        timestamp: Date.now(),
        trackId: this.currentTrackId
      });
    }
  }

  private cropFrame(
    frame: ImageData, 
    roi: { x: number; y: number; width: number; height: number }
  ): ImageData {
    const canvas = new OffscreenCanvas(roi.width, roi.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return frame; // Fallback to original frame
    }

    // Create temporary canvas for source frame
    const sourceCanvas = new OffscreenCanvas(frame.width, frame.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    
    if (!sourceCtx) {
      return frame; // Fallback to original frame
    }

    // Draw source frame
    sourceCtx.putImageData(frame, 0, 0);
    
    // Crop the ROI
    ctx.drawImage(
      sourceCanvas,
      roi.x, roi.y, roi.width, roi.height,
      0, 0, roi.width, roi.height
    );

    return ctx.getImageData(0, 0, roi.width, roi.height);
  }

  private imageDataToHTMLCanvasElement(imageData: ImageData): HTMLCanvasElement {
    // Since we're in a WebWorker, we need to create a virtual canvas
    // This is a simplified approach for MediaPipe compatibility
    const canvas = {
      width: imageData.width,
      height: imageData.height,
      getContext: () => null,
      // Add minimal HTMLCanvasElement interface
      tagName: 'CANVAS',
      nodeType: 1
    } as any;
    
    // Attach image data directly for MediaPipe processing
    (canvas as any)._imageData = imageData;
    
    return canvas as HTMLCanvasElement;
  }
}

// Worker initialization
let poseTracker: PoseLockTracker;

self.onmessage = async function(e: MessageEvent<PoseMessage>) {
  const { type, frame, timestamp = Date.now(), roi, trackId } = e.data;
  
  try {
    switch (type) {
      case 'init':
        poseTracker = new PoseLockTracker();
        await poseTracker.initialize();
        self.postMessage({ type: 'initialized' });
        break;
        
      case 'setROI':
        if (poseTracker) {
          poseTracker.setROI(roi || null, trackId || null);
        }
        break;
        
      case 'detect':
        if (poseTracker && frame) {
          const result = poseTracker.detectPose(frame, timestamp);
          self.postMessage(result);
        }
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: `Worker error: ${error}`,
      timestamp
    });
  }
};

export {}; 