import { useState, useRef, useEffect, useCallback } from 'react';
import { Checkbox, Group, Stack } from '@mantine/core';
import { initializeMediaPipePoseTracking, detectPoseLandmarks, disposeMediaPipePoseTracking } from '../../lib/pose/mediapipe-pose-tracking';
import { initializeMediaPipeHandTracking, detectHandLandmarks, disposeMediaPipeHandTracking } from '../../lib/hand/mediapipe-hand-tracking';
import { initializeMediaPipeFaceTracking, detectFaceLandmarks, disposeMediaPipeFaceTracking } from '../../lib/face/mediapipe-face-tracking';
import { drawPoseLandmarks, drawHandLandmarks, CYBERPUNK_COLORS } from '../../lib/shared/mediapipe-utils';

export default function MultiTracker({ width = 640, height = 480, glowSize = 15 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [activeTrackers, setActiveTrackers] = useState(['pose', 'hand', 'face']);
  const requestRef = useRef(null);

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
        const stream = videoRef.current.srcObject;
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
  const runTracking = useCallback((timestamp) => {
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
    if (activeTrackers.includes('pose')) {
      detectPoseLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.landmarks && result.landmarks.length > 0) {
          drawPoseLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
        }
      });
    }
    // hand
    if (activeTrackers.includes('hand')) {
      detectHandLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.landmarks && result.landmarks.length > 0) {
          drawHandLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
        }
      });
    }
    // face
    if (activeTrackers.includes('face')) {
      detectFaceLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
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
      });
    }
    requestRef.current = requestAnimationFrame(runTracking);
  }, [isInitialized, isRunning, activeTrackers, glowSize]);

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

  // チェックボックスのON/OFF管理
  const handleToggle = (name) => {
    setActiveTrackers(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <Stack align="center" spacing="md">
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
      <Group>
        <Checkbox
          label="Pose"
          checked={activeTrackers.includes('pose')}
          onChange={() => handleToggle('pose')}
        />
        <Checkbox
          label="Hand"
          checked={activeTrackers.includes('hand')}
          onChange={() => handleToggle('hand')}
        />
        <Checkbox
          label="Face"
          checked={activeTrackers.includes('face')}
          onChange={() => handleToggle('face')}
        />
      </Group>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </Stack>
  );
} 