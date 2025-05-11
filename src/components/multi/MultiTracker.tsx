import { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { blue, cyan } from '@mui/material/colors';
import { SportsHandball, DirectionsRun, Face } from '@mui/icons-material';
import { initializeMediaPipePoseTracking, detectPoseLandmarks, disposeMediaPipePoseTracking } from '../../lib/pose/mediapipe-pose-tracking';
import { initializeMediaPipeHandTracking, detectHandLandmarks, disposeMediaPipeHandTracking } from '../../lib/hand/mediapipe-hand-tracking';
import { initializeMediaPipeFaceTracking, detectFaceLandmarks, disposeMediaPipeFaceTracking } from '../../lib/face/mediapipe-face-tracking';
import { drawPoseLandmarks, drawHandLandmarks, CYBERPUNK_COLORS } from '../../lib/shared/mediapipe-utils';

type TrackerState = {
  enabled: boolean;
  detecting: boolean;
};

type TrackerStates = {
  pose: TrackerState;
  hand: TrackerState;
  face: TrackerState;
};

type TrackerInfo = {
  label: string;
  icon: React.ReactNode;
  color: string;
  muiColor: string;
  description: string;
};

const TRACKER_INFOS: Record<keyof TrackerStates, TrackerInfo> = {
  pose: {
    label: 'Pose',
    icon: <DirectionsRun fontSize="small" />,
    color: '#1976d2',
    muiColor: blue[700],
    description: 'Detect body pose landmarks',
  },
  hand: {
    label: 'Hand',
    icon: <SportsHandball fontSize="small" />,
    color: '#0288d1',
    muiColor: cyan[700],
    description: 'Detect hand landmarks',
  },
  face: {
    label: 'Face',
    icon: <Face fontSize="small" />,
    color: '#00bcd4',
    muiColor: cyan[400],
    description: 'Detect face landmarks',
  },
};

export default function MultiTracker({ width = 560, height = 420, glowSize = 15 }) {
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

  useEffect(() => {
    async function init() {
      try {
        await initializeMediaPipePoseTracking();
        await initializeMediaPipeHandTracking();
        await initializeMediaPipeFaceTracking();
        setIsInitialized(true);
        await setupCamera();
      } catch (err) {
        setError('Initialization error: ' + (err instanceof Error ? err.message : String(err)));
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
      setError('Camera error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [width, height]);

  const runTracking = useCallback((timestamp: number) => {
    if (!isInitialized || !isRunning || !videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(runTracking);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (
      canvas.width === 0 ||
      canvas.height === 0 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      requestRef.current = requestAnimationFrame(runTracking);
      return;
    }
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

    if (trackerStates.pose.detecting) {
      detectPoseLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.landmarks && result.landmarks.length > 0) {
          if (trackerStates.pose.enabled) {
            drawPoseLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
          }
        }
      });
    }
    if (trackerStates.hand.detecting) {
      detectHandLandmarks(video, Math.floor(timestamp)).then(result => {
        if (result && result.landmarks && result.landmarks.length > 0) {
          if (trackerStates.hand.enabled) {
            drawHandLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize);
          }
        }
      });
    }
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
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4 }}>
      {/* 右側：カメラとトグル */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Card sx={{ background: '#fff', border: '1.5px solid #e3e3e3', boxShadow: '0 0 24px #e3e3e3', borderRadius: 3, maxWidth: width, width: width, p: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box sx={{ position: 'relative', width, height, borderRadius: 2, boxShadow: '0 0 16px #1976d222, 0 0 0 2px #1976d2' }}>
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
                style={{ borderRadius: 8, border: '2px solid #1976d2', background: '#f5f7fa' }}
              />
            </Box>
          </Box>
        </Card>
        {/* トグルを横一列で並べる */}
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, width: width }}>
          {Object.entries(trackerStates).map(([name, state]) => {
            const info = TRACKER_INFOS[name as keyof TrackerStates];
            return (
              <Card key={name} sx={{ background: '#f5f7fa', border: `1.5px solid ${info.color}`, boxShadow: `0 0 8px ${info.color}22`, borderRadius: 2, p: 2, flex: 1, minWidth: 220, maxWidth: 260 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {info.icon}
                  <Typography variant="subtitle1" sx={{ color: info.color, fontWeight: 700, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1 }}>{info.label}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#555', mb: 1 }}>{info.description}</Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={state.detecting ? (state.enabled ? 'detect_draw' : 'detect_only') : 'stop'}
                  onChange={(_, value: string | null) => {
                    const v = value ?? 'stop';
                    switch (v) {
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
                  sx={{ mt: 1 }}
                >
                  <ToggleButton value="detect_draw">Detect & Draw</ToggleButton>
                  <ToggleButton value="detect_only">Detect Only</ToggleButton>
                  <ToggleButton value="stop">Off</ToggleButton>
                </ToggleButtonGroup>
              </Card>
            );
          })}
        </Box>
        {error && <Typography color="error" mt={2}>{error}</Typography>}
      </Box>
      {/* 左側は空白 or 今後の拡張用 */}
      <Box sx={{ flex: 1 }} />
    </Box>
  );
} 