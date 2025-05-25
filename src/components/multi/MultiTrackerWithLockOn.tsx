/**
 * Enhanced MultiTracker with Lock-On System
 * Combines MediaPipe tracking with person detection and lock-on functionality
 */

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { DirectionsRun, Face, GpsFixed, SportsHandball } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import { blue, cyan, green } from '@mui/material/colors';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';

import { detectFaceLandmarks, disposeMediaPipeFaceTracking, initializeMediaPipeFaceTracking } from '../../lib/face/mediapipe-face-tracking';
import { detectHandLandmarks, disposeMediaPipeHandTracking, initializeMediaPipeHandTracking } from '../../lib/hand/mediapipe-hand-tracking';
import { detectPoseLandmarks, disposeMediaPipePoseTracking, initializeMediaPipePoseTracking } from '../../lib/pose/mediapipe-pose-tracking';
import { CYBERPUNK_COLORS, drawHandLandmarks, drawPoseLandmarks } from '../../lib/shared/mediapipe-utils';
import LockOnOverlay from '../lockOn/LockOnOverlay';

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
    description: 'Detect hand\nlandmarks',
  },
  face: {
    label: 'Face',
    icon: <Face fontSize="small" />,
    color: '#00bcd4',
    muiColor: cyan[400],
    description: 'Detect face\nlandmarks',
  },
};

interface MultiTrackerWithLockOnProps {
  width?: number;
  height?: number;
  glowSize?: number;
  onPoseDetected?: (result: PoseLandmarkerResult) => void;
  lockOnEnabled?: boolean;
}

export default function MultiTrackerWithLockOn({ 
  width = 560, 
  height = 420, 
  glowSize = 15,
  onPoseDetected,
  lockOnEnabled = true
}: MultiTrackerWithLockOnProps) {
  
  // 🔍 デバッグ：props状態を詳しく確認
  console.log('🚀 MultiTrackerWithLockOn初期化:', {
    width,
    height,
    glowSize,
    lockOnEnabled,
    onPoseDetected: !!onPoseDetected
  });
  
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

  // Simple pose validation for lock-on
  const validatePoseForLock = (result: PoseLandmarkerResult): boolean => {
    if (!result.landmarks || result.landmarks.length === 0) return false;
    
    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length < 33) return false;
    
    // Check key landmarks: shoulders(11,12), hips(23,24) - more reliable than nose
    const keyIndices = [11, 12, 23, 24];
    const visibleCount = keyIndices.filter(i => {
      if (i >= landmarks.length) return false;
      const landmark = landmarks[i];
      return landmark.visibility !== undefined && landmark.visibility > 0.1; // Very lenient threshold
    }).length;
    
    return visibleCount >= 2; // Only need 2 of 4 key landmarks visible (shoulders or hips)
  };

  // Simplified lock-on state (without workers for now)
  const [simpleLockState, setSimpleLockState] = useState<'SEARCHING' | 'LOCKING' | 'LOCKED' | 'LOST'>('SEARCHING');
  const [goodFrameCount, setGoodFrameCount] = useState(0);
  const [lostFrameCount, setLostFrameCount] = useState(0);
  const [currentROI, setCurrentROI] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  
  // 🔧 強制再レンダリング用のカウンター
  const [forceRenderCounter, setForceRenderCounter] = useState(0);

  // Simple rectangle tracking using shoulder and foot landmarks
  const createSimpleTrackingROI = (result: PoseLandmarkerResult, canvasWidth: number, canvasHeight: number) => {
    console.log('🔧 createSimpleTrackingROI called:', {
      hasResult: !!result,
      hasLandmarks: !!(result && result.landmarks),
      landmarkCount: result?.landmarks?.length || 0,
      canvasSize: { width: canvasWidth, height: canvasHeight }
    });
    
    if (!result.landmarks || result.landmarks.length === 0) {
      console.log('❌ No landmarks found');
      return null;
    }
    
    const landmarks = result.landmarks[0];
    console.log('📍 Landmarks found:', landmarks.length);
    
    // MediaPipe landmark indices
    const LEFT_SHOULDER = 11;
    const RIGHT_SHOULDER = 12;
    const LEFT_HIP = 23;
    const RIGHT_HIP = 24;
    const LEFT_FOOT = 31;  // left foot index
    const RIGHT_FOOT = 32; // right foot index
    const NOSE = 0; // for head reference
    
    // 🔧 更に緩い条件：肩、腰、足のいずれかが見えればOK
    const allLandmarks = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_FOOT, RIGHT_FOOT];
    const visibleLandmarks = allLandmarks.filter(index => {
      const landmark = landmarks[index];
      const isVisible = landmark && (landmark.visibility === undefined || landmark.visibility > 0.1);
      console.log(`💡 Landmark ${index} visibility:`, {
        exists: !!landmark,
        visibility: landmark?.visibility,
        isVisible
      });
      return isVisible;
    });
    
    console.log('👁️ Visible landmarks:', {
      count: visibleLandmarks.length,
      indices: visibleLandmarks,
      required: 1
    });
    
    if (visibleLandmarks.length < 1) {
      console.log('❌ Not enough visible landmarks');
      return null;
    }
    
    // Get landmark coordinates (normalized 0-1)
    const leftShoulder = landmarks[LEFT_SHOULDER];
    const rightShoulder = landmarks[RIGHT_SHOULDER];
    const leftHip = landmarks[LEFT_HIP];
    const rightHip = landmarks[RIGHT_HIP];
    const leftFoot = landmarks[LEFT_FOOT];
    const rightFoot = landmarks[RIGHT_FOOT];
    const nose = landmarks[NOSE];
    
    // Dynamic padding based on canvas size (scales with distance)
    const horizontalPadding = Math.max(30, canvasWidth * 0.06);
    const verticalPadding = Math.max(20, canvasHeight * 0.04);
    const headPadding = Math.max(40, canvasHeight * 0.08);
    
    // Convert to canvas coordinates - mirror X coordinates to match canvas transformation
    // Collect all valid points
    const points = [];
    
    // 肩
    if (leftShoulder && (leftShoulder.visibility === undefined || leftShoulder.visibility > 0.1)) {
      const point = {
        x: canvasWidth - (leftShoulder.x * canvasWidth), // Mirror X coordinate
        y: leftShoulder.y * canvasHeight
      };
      console.log('👍 Left shoulder point:', point);
      points.push(point);
    }
    
    if (rightShoulder && (rightShoulder.visibility === undefined || rightShoulder.visibility > 0.1)) {
      const point = {
        x: canvasWidth - (rightShoulder.x * canvasWidth), // Mirror X coordinate
        y: rightShoulder.y * canvasHeight
      };
      console.log('👍 Right shoulder point:', point);
      points.push(point);
    }
    
    // 腰
    if (leftHip && (leftHip.visibility === undefined || leftHip.visibility > 0.1)) {
      const point = {
        x: canvasWidth - (leftHip.x * canvasWidth), // Mirror X coordinate
        y: leftHip.y * canvasHeight
      };
      console.log('👍 Left hip point:', point);
      points.push(point);
    }
    
    if (rightHip && (rightHip.visibility === undefined || rightHip.visibility > 0.1)) {
      const point = {
        x: canvasWidth - (rightHip.x * canvasWidth), // Mirror X coordinate
        y: rightHip.y * canvasHeight
      };
      console.log('👍 Right hip point:', point);
      points.push(point);
    }
    
    // 足
    if (leftFoot && (leftFoot.visibility === undefined || leftFoot.visibility > 0.1)) {
      const point = {
        x: canvasWidth - (leftFoot.x * canvasWidth), // Mirror X coordinate
        y: leftFoot.y * canvasHeight
      };
      console.log('👍 Left foot point:', point);
      points.push(point);
    }
    
    if (rightFoot && (rightFoot.visibility === undefined || rightFoot.visibility > 0.1)) {
      const point = {
        x: canvasWidth - (rightFoot.x * canvasWidth), // Mirror X coordinate
        y: rightFoot.y * canvasHeight
      };
      console.log('👍 Right foot point:', point);
      points.push(point);
    }
    
    console.log('📊 Valid points collected:', {
      count: points.length,
      points: points
    });
    
    // 🔧 1つのポイントでもROIを生成（デフォルトサイズ使用）
    if (points.length === 0) {
      console.log('❌ No valid points found');
      return null;
    }
    
    let minX, maxX, minY, maxY;
    
    if (points.length === 1) {
      console.log('🎯 Single point ROI generation');
      // 1つのポイントのみの場合、デフォルトサイズのROIを生成
      const point = points[0];
      const defaultWidth = canvasWidth * 0.3; // キャンバス幅の30%
      const defaultHeight = canvasHeight * 0.4; // キャンバス高さの40%
      
      minX = point.x - defaultWidth / 2;
      maxX = point.x + defaultWidth / 2;
      minY = point.y - defaultHeight / 3; // 上に余裕を持たせる
      maxY = point.y + defaultHeight * 2 / 3; // 下に多めに
      
      console.log('📦 Single point bounds:', { minX, maxX, minY, maxY });
    } else {
      console.log('🎯 Multi-point ROI generation');
      // 複数のポイントの場合、通常の境界ボックス計算
      minX = Math.min(...points.map(p => p.x)) - horizontalPadding;
      maxX = Math.max(...points.map(p => p.x)) + horizontalPadding;
      minY = Math.min(...points.map(p => p.y)) - (nose && (nose.visibility === undefined || nose.visibility > 0.1) ? headPadding : verticalPadding);
      maxY = Math.max(...points.map(p => p.y)) + verticalPadding;
      
      console.log('📦 Multi-point bounds:', { minX, maxX, minY, maxY });
    }
    
    // Ensure bounds are within canvas
    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(canvasWidth, maxX);
    const clampedMinY = Math.max(0, minY);
    const clampedMaxY = Math.min(canvasHeight, maxY);
    
    const finalROI = {
      x: clampedMinX,
      y: clampedMinY,
      width: clampedMaxX - clampedMinX,
      height: clampedMaxY - clampedMinY
    };
    
    console.log('🎯 Final ROI:', finalROI);
    return finalROI;
  };

  // Audio feedback functions
  const playLockBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Failed to play lock beep:', error);
    }
  };

  const playLostBoops = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBoop = (frequency: number, delay: number) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        }, delay);
      };
      
      playBoop(220, 0);
      playBoop(220, 200);
    } catch (error) {
      console.warn('Failed to play lost boops:', error);
    }
  };

  // Lock-on system integration
  // Now using simplified logic directly in component instead of hook
  // const lockState = { lockState: simpleLockState, roi: currentROI };

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
          videoRef.current.play().then(() => {
            setIsRunning(true);
          });
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
    
    // 🔍 デバッグ：トラッカー状態をログ出力
    console.log('🎥 Frame processing:', {
      timestamp: Math.floor(timestamp),
      trackerStates: trackerStates,
      canvasSize: { width: canvas.width, height: canvas.height },
      videoSize: { width: video.videoWidth, height: video.videoHeight }
    });
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Only run MediaPipe tracking if lock-on is not active or not enabled
    // Always run MediaPipe for visual feedback
    console.log('🔍 Checking pose detection state:', {
      detecting: trackerStates.pose.detecting,
      enabled: trackerStates.pose.enabled
    });
    
    if (trackerStates.pose.detecting) {
      detectPoseLandmarks(video, Math.floor(timestamp)).then(result => {
        // 🔍 詳細デバッグ：検出結果をログ出力
        console.log('🔍 Pose Detection Result:', {
          hasResult: !!result,
          hasLandmarks: !!(result && result.landmarks && result.landmarks.length > 0),
          landmarkCount: result?.landmarks?.length || 0,
          timestamp: Math.floor(timestamp)
        });
        
        if (result && result.landmarks && result.landmarks.length > 0) {
          console.log('✅ ポーズ検出成功 - ランドマーク数:', result.landmarks[0].length);
          
          if (trackerStates.pose.enabled) {
            // Use white color for pose landmarks when locked
            const useWhiteColor = lockOnEnabled && simpleLockState === 'LOCKED';
            drawPoseLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize, useWhiteColor);
          }
          
          // 🔧 ROI自動追従：ポーズが検出されたら常にROIを更新
          const roi = createSimpleTrackingROI(result, canvas.width, canvas.height);
          console.log('🎯 ROI計算結果:', {
            hasROI: !!roi,
            roi: roi,
            canvasSize: { width: canvas.width, height: canvas.height },
            previousROI: currentROI
          });
          
          if (roi) {
            console.log('📦 ROI更新前:', { 
              old: currentROI, 
              new: roi,
              changed: JSON.stringify(currentROI) !== JSON.stringify(roi)
            });
            setCurrentROI({...roi});
            setForceRenderCounter(prev => prev + 1);
            console.log('📦 ROI更新後: setCurrentROI呼び出し完了');
          } else {
            console.log('❌ ROI生成失敗');
          }
          
          // Simple lock-on logic (ROIとは独立)
          if (lockOnEnabled) {
            const isPoseValid = validatePoseForLock(result);
            console.log('🔒 Lock-on判定:', {
              isPoseValid,
              simpleLockState,
              goodFrameCount,
              lostFrameCount
            });
            
            if (isPoseValid) {
              setGoodFrameCount(prev => {
                const newCount = prev + 1;
                console.log('✅ Good frame count:', newCount);
                // Reduced from 2 to 1 frame for faster locking
                if (newCount >= 1 && simpleLockState === 'SEARCHING') {
                  console.log('🔄 状態変更: SEARCHING → LOCKING');
                  setSimpleLockState('LOCKING');
                  setTimeout(() => {
                    console.log('🔒 状態変更: LOCKING → LOCKED');
                    setSimpleLockState('LOCKED');
                    // Play lock beep
                    playLockBeep();
                  }, 100); // Reduced delay from 150ms to 100ms
                }
                return newCount;
              });
              setLostFrameCount(0);
            } else {
              // Lock-on条件に満たないが、ROIは継続表示
              setGoodFrameCount(0);
              setLostFrameCount(prev => {
                const newCount = prev + 1;
                console.log('❌ Lost frame count:', newCount);
                // Reduced from 10 to 5 frames for faster lost detection
                if (newCount >= 5 && simpleLockState === 'LOCKED') {
                  console.log('🔄 状態変更: LOCKED → LOST');
                  setSimpleLockState('LOST');
                  // Play lost boops
                  playLostBoops();
                  setTimeout(() => {
                    console.log('🔄 状態変更: LOST → SEARCHING');
                    setSimpleLockState('SEARCHING');
                    // ROIはクリアしない - 継続表示
                  }, 2000); // Reduced from 3000ms
                }
                return newCount;
              });
            }
          }
          
          // Always forward pose data (lock-on doesn't interfere with pose detection)
          if (onPoseDetected) {
            onPoseDetected(result);
          }
        } else {
          console.log('❌ ポーズ検出失敗またはランドマークなし');
          
          if (lockOnEnabled) {
            // No pose detected - ROIをクリア
            console.log('🗑️ ROIをクリア (ポーズ検出失敗)');
            setCurrentROI(null);
            setGoodFrameCount(0);
            setLostFrameCount(prev => {
              const newCount = prev + 1;
              if (newCount >= 10 && simpleLockState === 'LOCKED') {
                setSimpleLockState('LOST');
                playLostBoops();
                setTimeout(() => setSimpleLockState('SEARCHING'), 3000);
              }
              return newCount;
            });
          }
        }
      }).catch(error => {
        console.error('💥 Pose detection error:', error);
      });
    } else {
      console.log('⏸️ Pose detection disabled');
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
  }, [isInitialized, isRunning, trackerStates, glowSize, onPoseDetected, lockOnEnabled, simpleLockState]);

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

  // 🔍 デバッグ：ROI状態の監視
  useEffect(() => {
    console.log('🖼️ currentROI state changed:', {
      currentROI,
      simpleLockState,
      lockOnEnabled
    });
  }, [currentROI, simpleLockState, lockOnEnabled]);

  const handleTrackerChange = (name: keyof TrackerStates, type: 'enabled' | 'detecting', value: boolean) => {
    setTrackerStates(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [type]: value
      }
    }));
  };

  const handleReacquireTarget = () => {
    setSimpleLockState('SEARCHING');
    setGoodFrameCount(0);
    setLostFrameCount(0);
    // Don't clear ROI - keep it visible for continuous tracking
    // setCurrentROI(null);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4 }}>
      {/* Right side: Camera and controls */}
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
              
              {/* Lock-on overlay */}
              {(() => {
                console.log('🔍 LockOnOverlay条件チェック:', {
                  lockOnEnabled,
                  currentROI,
                  simpleLockState,
                  shouldRender: lockOnEnabled
                });
                
                if (lockOnEnabled) {
                  console.log('✅ LockOnOverlayをレンダリング予定');
                  return (
                    <LockOnOverlay
                      roi={currentROI}
                      state={simpleLockState}
                      width={width}
                      height={height}
                      className="absolute top-0 left-0"
                      key={forceRenderCounter}
                    />
                  );
                } else {
                  console.log('❌ lockOnEnabled=false のためLockOnOverlayをスキップ');
                  return null;
                }
              })()}
            </Box>
          </Box>
        </Card>

        {/* Lock-on controls */}
        {lockOnEnabled && (
          <Card sx={{
            background: '#f5f7fa',
            border: `1.5px solid ${green[500]}`,
            boxShadow: `0 0 8px ${green[500]}22`,
            borderRadius: 2,
            p: 1.5,
            width: width,
            mb: 1
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GpsFixed sx={{ color: green[500] }} />
                <Typography variant="subtitle2" sx={{ color: green[500], fontWeight: 700, fontFamily: 'Orbitron, sans-serif' }}>
                  Lock-On System
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ 
                color: simpleLockState === 'LOCKED' ? green[600] : 
                       simpleLockState === 'LOST' ? 'red' : 
                       simpleLockState === 'LOCKING' ? 'orange' : 'gray',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                {simpleLockState}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={handleReacquireTarget}
              sx={{ 
                borderColor: green[500], 
                color: green[500],
                '&:hover': { borderColor: green[600], backgroundColor: green[50] }
              }}
            >
              Reacquire Target
            </Button>
          </Card>
        )}

        {/* MediaPipe tracker controls */}
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, width: width }}>
          {Object.entries(trackerStates).map(([name, state]) => {
            const info = TRACKER_INFOS[name as keyof TrackerStates];
            return (
              <Card key={name} sx={{
                background: '#f5f7fa',
                border: `1.5px solid ${info.color}`,
                boxShadow: `0 0 8px ${info.color}22`,
                borderRadius: 2,
                p: 1.2,
                flex: 1,
                minWidth: 0,
                maxWidth: `${width / 3 - 8}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  {info.icon}
                  <Typography variant="subtitle2" sx={{ color: info.color, fontWeight: 700, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1, fontSize: '1.05rem' }}>{info.label}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#555', mb: 0.5, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{info.description}</Typography>
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
                  sx={{ mt: 0.5 }}
                >
                  <ToggleButton value="detect_draw" sx={{ fontSize: '0.68rem', minWidth: 0, px: 0.5, py: 0.4 }}>Detect & Draw</ToggleButton>
                  <ToggleButton value="detect_only" sx={{ fontSize: '0.68rem', minWidth: 0, px: 0.5, py: 0.4 }}>Detect Only</ToggleButton>
                  <ToggleButton value="stop" sx={{ fontSize: '0.68rem', minWidth: 0, px: 0.5, py: 0.4 }}>Off</ToggleButton>
                </ToggleButtonGroup>
              </Card>
            );
          })}
        </Box>
        {error && <Typography color="error" mt={2}>{error}</Typography>}
      </Box>
      
      {/* Audio feedback */}
      {/* Audio is now handled directly in the component */}
      
      {/* Left side is empty or for future expansion */}
      <Box sx={{ flex: 1 }} />
    </Box>
  );
} 