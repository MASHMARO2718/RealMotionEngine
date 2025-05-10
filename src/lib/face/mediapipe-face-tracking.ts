import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;

export async function initializeMediaPipeFaceTracking(): Promise<boolean> {
  if (faceLandmarker) return true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      numFaces: 1,
    });
    return true;
  } catch (e) {
    console.error('FaceLandmarker初期化失敗:', e);
    return false;
  }
}

export async function detectFaceLandmarks(
  video: HTMLVideoElement,
  timestamp: number
): Promise<FaceLandmarkerResult | null> {
  if (!faceLandmarker) return null;
  try {
    const result = await faceLandmarker.detectForVideo(video, timestamp);
    return result;
  } catch (e) {
    console.error('顔ランドマーク検出失敗:', e);
    return null;
  }
}

export function disposeMediaPipeFaceTracking() {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
}

export type { FaceLandmarkerResult }; 