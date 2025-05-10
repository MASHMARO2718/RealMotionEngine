'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import {
  initializeMediaPipeFaceTracking,
  detectFaceLandmarks,
  disposeMediaPipeFaceTracking
} from '../../lib/face/mediapipe-face-tracking';
import { CYBERPUNK_COLORS } from '../../lib/shared/mediapipe-utils';

interface FaceTrackerProps {
  onFaceDetected?: (result: FaceLandmarkerResult) => void;
  onError?: (error: string) => void;
  showLandmarks?: boolean;
  width?: number;
  height?: number;
  glowSize?: number;
}

export default function FaceTracker({
  onFaceDetected,
  onError,
  showLandmarks = true,
  width = 640,
  height = 480,
  glowSize = 15
}: FaceTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<number | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCameraSetupAttempted, setIsCameraSetupAttempted] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const success = await initializeMediaPipeFaceTracking();
        setIsInitialized(success);
        if (!success) {
          setError('MediaPipe Faceの初期化に失敗しました');
          if (onError) onError('MediaPipe Faceの初期化に失敗しました');
          return;
        }
        await setupCamera();
      } catch (err) {
        setError('初期化エラー: ' + (err instanceof Error ? err.message : String(err)));
        if (onError) onError('初期化エラー: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
    init();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      disposeMediaPipeFaceTracking();
    };
  }, [onError]);

  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setIsCameraSetupAttempted(true);
    try {
      if (videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      const constraints = {
        audio: false,
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: 'user'
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            videoRef.current.play().then(() => setIsRunning(true));
          }
        };
      }
    } catch (err) {
      setError('カメラエラー: ' + (err instanceof Error ? err.message : String(err)));
      if (onError) onError('カメラエラー: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [width, height, onError]);

  const runFaceTracking = useCallback((timestamp: number) => {
    if (!isInitialized || !isRunning || !videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(runFaceTracking);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(runFaceTracking);
      return;
    }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    // 顔ランドマーク検出
    detectFaceLandmarks(video, Math.floor(timestamp)).then(result => {
      if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
        setFaceDetected(true);
        if (showLandmarks) {
          // 顔ランドマークを描画
          const landmarks = result.faceLandmarks[0];
          ctx.save();
          ctx.lineWidth = 2;
          ctx.strokeStyle = CYBERPUNK_COLORS.accent;
          ctx.fillStyle = CYBERPUNK_COLORS.accent;
          for (const point of landmarks) {
            const mirroredX = canvas.width - point.x * canvas.width;
            const y = point.y * canvas.height;
            ctx.beginPath();
            ctx.arc(mirroredX, y, glowSize, 0, 2 * Math.PI);
            ctx.globalAlpha = 0.2;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(mirroredX, y, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
          ctx.restore();
        }
        if (onFaceDetected) onFaceDetected(result);
      } else {
        setFaceDetected(false);
      }
    }).finally(() => {
      requestRef.current = requestAnimationFrame(runFaceTracking);
    });
  }, [isInitialized, isRunning, showLandmarks, glowSize, onFaceDetected]);

  useEffect(() => {
    if (isInitialized && isRunning && !requestRef.current) {
      requestRef.current = requestAnimationFrame(runFaceTracking);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isInitialized, isRunning, runFaceTracking]);

  const handleRetryCamera = useCallback(() => {
    setError(null);
    setupCamera();
  }, [setupCamera]);

  return (
    <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
      <video
        ref={videoRef}
        className="rounded-lg absolute top-0 left-0"
        width={width}
        height={height}
        playsInline
        muted
        style={{ objectFit: 'cover', zIndex: 1 }}
      />
      <canvas
        ref={canvasRef}
        className="rounded-lg absolute top-0 left-0"
        width={width}
        height={height}
        style={{
          boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
          border: '1px solid rgba(0, 255, 136, 0.8)',
          zIndex: 2,
          background: 'transparent'
        }}
      />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-10 p-4">
          <div className="text-red-500 mb-4 max-w-md text-center">
            <p className="text-xl font-bold mb-2">エラーが発生しました</p>
            <p>{error}</p>
          </div>
          <button
            onClick={handleRetryCamera}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            カメラを再試行
          </button>
        </div>
      )}
      <div className="absolute bottom-2 right-2 text-xs text-white bg-black bg-opacity-50 p-1 rounded">
        <p>状態: {isInitialized ? (isRunning ? '実行中' : '初期化済み') : '初期化中'}</p>
        <p>顔検出: {faceDetected ? 'あり' : 'なし'}</p>
      </div>
    </div>
  );
} 