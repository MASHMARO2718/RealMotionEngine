import { useState, useRef, useEffect, useCallback } from 'react';
import { Checkbox, Group, Stack, SegmentedControl } from '@mantine/core';
import { initializeMediaPipePoseTracking, detectPoseLandmarks, disposeMediaPipePoseTracking } from '../../lib/pose/mediapipe-pose-tracking';
import { initializeMediaPipeHandTracking, detectHandLandmarks, disposeMediaPipeHandTracking } from '../../lib/hand/mediapipe-hand-tracking';
import { initializeMediaPipeFaceTracking, detectFaceLandmarks, disposeMediaPipeFaceTracking } from '../../lib/face/mediapipe-face-tracking';
import { drawPoseLandmarks, drawHandLandmarks, CYBERPUNK_COLORS } from '../../lib/shared/mediapipe-utils';

type TrackerState = {
  enabled: boolean;  // 描画の有効/無効
  detecting: boolean;  // 検出の有効/無効
};

type TrackerStates = {
  pose: TrackerState;
  hand: TrackerState;
  face: TrackerState;
};

export default function MultiTracker({ width = 640, height = 480, glowSize = 15 }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackerStates, setTrackerStates] = useState<TrackerStates>({
    pose: { enabled: true, detecting: true },
    hand: { enabled: true, detecting: true },
    face: { enabled: true, detecting: true }
  });
  const requestRef = useRef<number | null>(null);

  // 初期化
  useEffect(() => {
    async function init() {
      try {
        await initializeMediaPipePoseTracking();
        await initializeMediaPipeHandTracking();
        await initializeMediaPipeFaceTracking();
        setIsInitialized(true);
        await setupCamera();
      } catch (err) {
        setError('初期化エラー: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
    init();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      disposeMediaPipePoseTracking();
      disposeMediaPipeHandTracking();
      disposeMediaPipeFaceTracking();
    };
  }, []);

  // カメラセットアップ
  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const constraints = {
        audio: false,
        video: { width: { ideal: width }, height: { ideal: height }, facingMode: 'user' }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current && canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          videoRef.current.play().then(() => setIsRunning(true));
        }
      };
    } catch (err) {
      setError('カメラエラー: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [width, height]);

  // トラッキング＆描画
  const runTracking = useCallback((timestamp: number) => {
    if (!isInitialized || !isRunning || !videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(runTracking);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      requestRef.current = requestAnimationFrame(runTracking);
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

    // pose
    if (trackerStates.pose.detecting) {
      detectPoseLandmarks(video, Math.floor(timestamp)).then(result => {
        // 検出+描画モードのみ描画
        if (result && result.landmarks && result.landmarks.length > 0) {
          if (trackerStates.pose.enabled) {
            drawPoseLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
          }
        }
      });
    }

    // hand
    if (trackerStates.hand.detecting) {
      detectHandLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.landmarks && result.landmarks.length > 0) {
          if (trackerStates.hand.enabled) {
            drawHandLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
          }
        }
      });
    }

    // face
    if (trackerStates.face.detecting) {
      detectFaceLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
          if (trackerStates.face.enabled) {
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
        }
      });
    }

    requestRef.current = requestAnimationFrame(runTracking);
  }, [isInitialized, isRunning, trackerStates, glowSize]);

  useEffect(() => {
    if (isInitialized && isRunning && !requestRef.current) {
      requestRef.current = requestAnimationFrame(runTracking);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isInitialized, isRunning, runTracking]);

  // トラッカーの状態を更新
  const handleTrackerChange = (name: keyof TrackerStates, type: 'enabled' | 'detecting', value: boolean) => {
    setTrackerStates(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [type]: value
      }
    }));
  };

  return (
    <Stack align="center" gap="md">
      <div style={{ position: 'relative', width, height }}>
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          width={width}
          height={height}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ borderRadius: 12, border: '2px solid #0ff', background: 'transparent' }}
        />
      </div>
      <Stack gap="xs">
        {Object.entries(trackerStates).map(([name, state]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ width: '80px', textTransform: 'capitalize' }}>{name}</span>
            <SegmentedControl
              data={[
                { label: '検出+描画', value: 'detect_draw' },
                { label: '検出のみ', value: 'detect_only' },
                { label: '停止', value: 'stop' }
              ]}
              value={state.detecting ? (state.enabled ? 'detect_draw' : 'detect_only') : 'stop'}
              onChange={(value) => {
                switch (value) {
                  case 'detect_draw':
                    handleTrackerChange(name as keyof TrackerStates, 'detecting', true);
                    handleTrackerChange(name as keyof TrackerStates, 'enabled', true);
                    break;
                  case 'detect_only':
                    handleTrackerChange(name as keyof TrackerStates, 'detecting', true);
                    handleTrackerChange(name as keyof TrackerStates, 'enabled', false);
                    break;
                  case 'stop':
                    handleTrackerChange(name as keyof TrackerStates, 'detecting', false);
                    handleTrackerChange(name as keyof TrackerStates, 'enabled', false);
                    break;
                }
              }}
            />
          </div>
        ))}
      </Stack>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </Stack>
  );
} 