/**
 * Enhanced MultiTracker with Lock-On System
 * Combines MediaPipe tracking with person detection and lock-on functionality
 */

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { DirectionsRun, Face, GpsFixed, RadioButtonChecked, SportsHandball, Videocam } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import { blue, cyan, green, orange, purple } from '@mui/material/colors';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWorldCoordinates } from '../../hooks/useWorldCoordinates';
import { FullPoseAnalysis,PoseAnalyticsEngine } from '../../lib/analytics/PoseAnalytics';
import { detectFaceLandmarks, disposeMediaPipeFaceTracking, initializeMediaPipeFaceTracking } from '../../lib/face/mediapipe-face-tracking';
import { detectHandLandmarks, disposeMediaPipeHandTracking, initializeMediaPipeHandTracking } from '../../lib/hand/mediapipe-hand-tracking';
import { detectPoseLandmarks, disposeMediaPipePoseTracking, initializeMediaPipePoseTracking } from '../../lib/pose/mediapipe-pose-tracking';
import { CYBERPUNK_COLORS, drawHandLandmarks, drawPoseLandmarks } from '../../lib/shared/mediapipe-utils';
import type { PolarCoordinate, SphericalCoordinate,Vec3 } from '../../utils/coordinateTransform';
import CoordinateAxesOverlay from '../analytics/CoordinateAxesOverlay';
import OrientationOverlay from '../analytics/OrientationOverlay';
import WorldCoordinateOverlay from '../analytics/WorldCoordinateOverlay';
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
  onPoseResult?: (result: PoseLandmarkerResult | null) => void;
  onError?: (errorMessage: string) => void;
  lockOnEnabled?: boolean;
  showAnalytics?: boolean;
}

export default function MultiTrackerWithLockOn({ 
  width = 560, 
  height = 420, 
  glowSize = 15,
  onPoseDetected,
  onPoseResult,
  onError,
  lockOnEnabled = true,
  showAnalytics = true
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

  // 🎥 カメラ関連のstate
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // 🎯 関節角弧表示のstate
  const [showJointAngles, setShowJointAngles] = useState<boolean>(true);

  // 🔧 強制再レンダリング用のカウンター
  const [forceRenderCounter, setForceRenderCounter] = useState(0);
  
  // 🟡 全身検出状態
  const [isFullBodyVisible, setIsFullBodyVisible] = useState(false);

  // 🔊 前回の全身検出状態を記録（状態変化検出用）
  const [previousFullBodyVisible, setPreviousFullBodyVisible] = useState(false);

  // 🎯 Lock-onシステムの動的制御
  const [lockOnSystemEnabled, setLockOnSystemEnabled] = useState(lockOnEnabled);

  // 🤖 人物検出システム
  const [personDetector, setPersonDetector] = useState<any>(null);
  const [personDetectionEnabled, setPersonDetectionEnabled] = useState(false);
  const [lastPersonDetection, setLastPersonDetection] = useState<any>(null);
  const personDetectionIntervalRef = useRef<number>(0);

  // 📊 ポーズ解析システム
  const [poseAnalyticsEngine] = useState(() => new PoseAnalyticsEngine());
  const [currentAnalysis, setCurrentAnalysis] = useState<FullPoseAnalysis | null>(null);
  const [showAnalyticsOverlay, setShowAnalyticsOverlay] = useState(false);

  // 🌍 NEW: World Coordinate System
  const worldCoordinates = useWorldCoordinates();
  const [showWorldCoordinates, setShowWorldCoordinates] = useState(false);
  const [currentWorldPose, setCurrentWorldPose] = useState<{ [key: string]: Vec3 } | null>(null);
  const [showPolarCoordinates, setShowPolarCoordinates] = useState(false);
  const [currentPolarPose, setCurrentPolarPose] = useState<{ [key: string]: PolarCoordinate } | null>(null);
  const [currentSphericalPose, setCurrentSphericalPose] = useState<{ [key: string]: SphericalCoordinate } | null>(null);

  // 🎯 NEW: Coordinate Axes Display
  const [showCoordinateAxes, setShowCoordinateAxes] = useState(true);

  // Enhanced pose validation for lock-on with stricter conditions
  const validatePoseForLock = (result: PoseLandmarkerResult): boolean => {
    if (!result.landmarks || result.landmarks.length === 0) return false;
    
    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length < 33) return false;
    
    // Expanded key landmarks for more reliable detection
    const keyIndices = [
      0,   // nose
      11, 12, // shoulders
      23, 24, // hips
      25, 26, // knees
      27, 28  // ankles
    ];
    
    const VISIBILITY_THRESHOLD = 0.5; // Stricter threshold (was 0.1)
    const REQUIRED_LANDMARKS = 6; // Need more landmarks (was 2)
    
    const visibleCount = keyIndices.filter(i => {
      if (i >= landmarks.length) return false;
      const landmark = landmarks[i];
      return landmark.visibility !== undefined && landmark.visibility > VISIBILITY_THRESHOLD;
    }).length;
    
    console.log('🔒 Enhanced lock validation:', {
      visibleCount,
      required: REQUIRED_LANDMARKS,
      threshold: VISIBILITY_THRESHOLD,
      isValid: visibleCount >= REQUIRED_LANDMARKS
    });
    
    return visibleCount >= REQUIRED_LANDMARKS;
  };

  // Simplified lock-on state (without workers for now)
  const [simpleLockState, setSimpleLockState] = useState<'SEARCHING' | 'LOCKING' | 'LOCKED' | 'LOST'>('SEARCHING');
  const [goodFrameCount, setGoodFrameCount] = useState(0);
  const [lostFrameCount, setLostFrameCount] = useState(0);
  const [currentROI, setCurrentROI] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  
  // 全身が映っているかを判定する関数
  const checkFullBodyVisibility = (result: PoseLandmarkerResult): boolean => {
    if (!result.landmarks || result.landmarks.length === 0) return false;
    
    const landmarks = result.landmarks[0];
    
    // 肩のランドマーク
    const LEFT_SHOULDER = 11;
    const RIGHT_SHOULDER = 12;
    // 足のランドマーク  
    const LEFT_FOOT = 31;
    const RIGHT_FOOT = 32;
    
    // 肩と足の可視性をチェック
    const leftShoulder = landmarks[LEFT_SHOULDER];
    const rightShoulder = landmarks[RIGHT_SHOULDER];
    const leftFoot = landmarks[LEFT_FOOT];
    const rightFoot = landmarks[RIGHT_FOOT];
    
    // 肩が両方見えているか
    const shouldersVisible = (
      leftShoulder && (leftShoulder.visibility === undefined || leftShoulder.visibility > 0.3) &&
      rightShoulder && (rightShoulder.visibility === undefined || rightShoulder.visibility > 0.3)
    );
    
    // 足が少なくとも一方見えているか（足は見えにくいので緩い条件）
    const feetVisible = (
      (leftFoot && (leftFoot.visibility === undefined || leftFoot.visibility > 0.1)) ||
      (rightFoot && (rightFoot.visibility === undefined || rightFoot.visibility > 0.1))
    );
    
    const isFullBody = shouldersVisible && feetVisible;
    
    console.log('🟡 全身判定:', {
      shouldersVisible,
      feetVisible,
      isFullBody,
      leftShoulder: leftShoulder?.visibility,
      rightShoulder: rightShoulder?.visibility,
      leftFoot: leftFoot?.visibility,
      rightFoot: rightFoot?.visibility
    });
    
    return isFullBody;
  };

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
    
    // Enhanced ROI generation with stricter requirements
    const allLandmarks = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_FOOT, RIGHT_FOOT];
    const ROI_VISIBILITY_THRESHOLD = 0.3; // Stricter threshold for ROI generation
    const MIN_REQUIRED_LANDMARKS = 3; // Need at least 3 landmarks for reliable ROI
    
    const visibleLandmarks = allLandmarks.filter(index => {
      const landmark = landmarks[index];
      const isVisible = landmark && (landmark.visibility === undefined || landmark.visibility > ROI_VISIBILITY_THRESHOLD);
      console.log(`💡 Landmark ${index} visibility:`, {
        exists: !!landmark,
        visibility: landmark?.visibility,
        isVisible,
        threshold: ROI_VISIBILITY_THRESHOLD
      });
      return isVisible;
    });
    
    console.log('👁️ Visible landmarks for ROI:', {
      count: visibleLandmarks.length,
      indices: visibleLandmarks,
      required: MIN_REQUIRED_LANDMARKS,
      threshold: ROI_VISIBILITY_THRESHOLD
    });
    
    if (visibleLandmarks.length < MIN_REQUIRED_LANDMARKS) {
      console.log('❌ Not enough visible landmarks for reliable ROI');
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
    
    const roiWidth = clampedMaxX - clampedMinX;
    const roiHeight = clampedMaxY - clampedMinY;
    
    // Enhanced ROI validation with size constraints
    const MIN_ROI_WIDTH = canvasWidth * 0.1;   // At least 10% of canvas width
    const MAX_ROI_WIDTH = canvasWidth * 0.8;   // At most 80% of canvas width
    const MIN_ROI_HEIGHT = canvasHeight * 0.15; // At least 15% of canvas height
    const MAX_ROI_HEIGHT = canvasHeight * 0.9;  // At most 90% of canvas height
    const MIN_ASPECT_RATIO = 0.3; // Minimum height/width ratio
    const MAX_ASPECT_RATIO = 3.0; // Maximum height/width ratio
    
    const aspectRatio = roiHeight / roiWidth;
    
    console.log('🔍 ROI validation:', {
      width: roiWidth,
      height: roiHeight,
      aspectRatio,
      constraints: {
        minWidth: MIN_ROI_WIDTH,
        maxWidth: MAX_ROI_WIDTH,
        minHeight: MIN_ROI_HEIGHT,
        maxHeight: MAX_ROI_HEIGHT,
        minAspect: MIN_ASPECT_RATIO,
        maxAspect: MAX_ASPECT_RATIO
      }
    });
    
    // Validate ROI dimensions
    if (roiWidth < MIN_ROI_WIDTH || roiWidth > MAX_ROI_WIDTH ||
        roiHeight < MIN_ROI_HEIGHT || roiHeight > MAX_ROI_HEIGHT ||
        aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) {
      console.log('❌ ROI failed validation checks');
      return null;
    }
    
    const finalROI = {
      x: clampedMinX,
      y: clampedMinY,
      width: roiWidth,
      height: roiHeight
    };
    
    console.log('🎯 Enhanced Final ROI:', finalROI);
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

  // 🔊 全身検出時の音声再生
  const playFullBodyDetectedMessage = () => {
    try {
      // Web Speech API を使用してテキストを音声に変換
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Full-body detection is working.');
        
        // 音声設定
        utterance.lang = 'en-US'; // 英語
        utterance.rate = 1.0; // 話速（通常速度）
        utterance.pitch = 1.0; // 音程
        utterance.volume = 0.8; // 音量（80%）
        
        // 音声再生
        window.speechSynthesis.speak(utterance);
        
        console.log('🔊 Full-body detection voice message played');
      } else {
        console.warn('Speech Synthesis not supported in this browser');
      }
    } catch (error) {
      console.warn('Failed to play full-body detection message:', error);
    }
  };

  // 🔊 全身検出解除時の音声再生
  const playFullBodyLostMessage = () => {
    try {
      // Web Speech API を使用してテキストを音声に変換
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Full-body is not being detected.');
        
        // 音声設定
        utterance.lang = 'en-US'; // 英語
        utterance.rate = 1.0; // 話速（通常速度）
        utterance.pitch = 1.0; // 音程
        utterance.volume = 0.8; // 音量（80%）
        
        // 音声再生
        window.speechSynthesis.speak(utterance);
        
        console.log('🔊 Full-body lost voice message played');
      } else {
        console.warn('Speech Synthesis not supported in this browser');
      }
    } catch (error) {
      console.warn('Failed to play full-body lost message:', error);
    }
  };

  // Lock-on system integration
  // Now using simplified logic directly in component instead of hook
  // const lockState = { lockState: simpleLockState, roi: currentROI };

  // 🎥 利用可能なカメラデバイスを取得
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('📷 利用可能なカメラ:', videoDevices);
      setAvailableCameras(videoDevices);
      
      // デフォルトカメラを設定（最初のデバイスまたは既存の選択）
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('カメラ列挙エラー:', error);
    }
  }, [selectedCameraId]);

  // 🤖 人物検出初期化
  const initializePersonDetection = useCallback(async () => {
    try {
      console.log('🤖 Initializing person detection...');
      const tf = await import('@tensorflow/tfjs');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      
      await tf.ready();
      const model = await cocoSsd.load({ base: 'mobilenet_v2' });
      setPersonDetector(model);
      console.log('✅ Person detection initialized');
    } catch (error) {
      console.error('❌ Failed to initialize person detection:', error);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        // カメラ列挙を先に実行
        await enumerateCameras();
        
        await initializeMediaPipePoseTracking();
        await initializeMediaPipeHandTracking();
        await initializeMediaPipeFaceTracking();
        
        // 人物検出を初期化
        await initializePersonDetection();
        
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
      
      // 人物検出のクリーンアップ
      if (personDetector) {
        personDetector.dispose();
      }
    };
  }, [enumerateCameras, initializePersonDetection]);

  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      console.log('📷 カメラセットアップ開始:', { selectedCameraId, width, height });
      
      // 既存のストリームがある場合は停止
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        // ストリーム停止後に少し待機
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          width: { ideal: width },
          height: { ideal: height },
          // カメラが選択されている場合はdeviceIdを使用、そうでなければfacingModeを使用
          ...(selectedCameraId 
            ? { deviceId: { exact: selectedCameraId } }
            : { facingMode: 'user' }
          )
        }
      };
      
      console.log('📷 カメラ制約:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ ストリーム取得成功');
      
      videoRef.current.srcObject = stream;
      
      // loadedmetadataイベントを待機
      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error('Video element not found'));
          return;
        }
        
        const video = videoRef.current;
        
        const onLoadedMetadata = () => {
          console.log('📷 メタデータ読み込み完了');
          if (canvasRef.current) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
            console.log('🎨 キャンバスサイズ設定:', { 
              width: video.videoWidth, 
              height: video.videoHeight 
            });
          }
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        };
        
        const onError = (error: Event) => {
          console.error('❌ ビデオエラー:', error);
          video.removeEventListener('error', onError);
          reject(new Error('Video loading error'));
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
        
        // タイムアウト設定
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('Video loading timeout'));
        }, 5000);
      });
      
      // 動画の再生を開始
      await videoRef.current.play();
      console.log('▶️ 動画再生開始');
      
      // 実際に映像が流れ始めるまで少し待機
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setIsRunning(true);
      console.log('✅ カメラセットアップ完了');
      
    } catch (err) {
      const errorMessage = 'Camera error: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMessage);
      console.error('📷 カメラ初期化エラー:', err);
    }
  }, [width, height, selectedCameraId]);

  // 🎥 カメラ切り替え関数
  const switchCamera = useCallback(async (deviceId: string) => {
    console.log('📷 カメラ切り替え開始:', deviceId);
    
    // まず現在の状態を停止
    setIsRunning(false);
    
    // 既存のストリームを完全に停止
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track stopped:', track.label);
      });
      videoRef.current.srcObject = null;
    }
    
    // カメラIDを更新
    setSelectedCameraId(deviceId);
    
    // より長い遅延を設けてからカメラを再初期化
    setTimeout(async () => {
      console.log('🔄 カメラ再初期化開始');
      try {
        await setupCamera();
        console.log('✅ カメラ切り替え完了');
      } catch (error) {
        console.error('❌ カメラ切り替え失敗:', error);
        setError('カメラ切り替えに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
      }
    }, 500); // 100msから500msに延長
  }, [setupCamera]);

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
            const useWhiteColor = lockOnSystemEnabled && simpleLockState === 'LOCKED';
            drawPoseLandmarks(ctx, result, canvas.width, canvas.height, true, glowSize, useWhiteColor);
            
            // 関節角度を描画（showJointAnglesがtrueの場合のみ）
            if (showJointAngles) {
              drawJointAngles(ctx, result, canvas.width, canvas.height);
            }
          }
          
          // 🔧 ROI自動追従：ポーズが検出されたら常にROIを更新
          let roi = createSimpleTrackingROI(result, canvas.width, canvas.height);
          
          // 🤖 人物検出との統合（3フレームに1回実行）
          if (personDetectionEnabled && personDetector && personDetectionIntervalRef.current % 3 === 0) {
            // 非同期処理を別途実行（メインループをブロックしない）
            personDetector.detect(video).then((personDetectionResult: any) => {
              const persons = personDetectionResult
                .filter((p: any) => p.class === 'person' && p.score >= 0.6)
                .sort((a: any, b: any) => b.score - a.score);
              
              if (persons.length > 0) {
                const primaryPerson = persons[0];
                setLastPersonDetection(primaryPerson);
                
                console.log('🤖 Person detected:', {
                  confidence: primaryPerson.score.toFixed(3),
                  bbox: primaryPerson.bbox.map((v: number) => Math.round(v))
                });
              }
            }).catch((error: any) => {
              console.warn('Person detection error:', error);
            });
          }
          personDetectionIntervalRef.current++;
          
          // 🟡 全身判定を実行
          const fullBodyVisible = checkFullBodyVisibility(result);
          setIsFullBodyVisible(fullBodyVisible);
          
          console.log('🎯 ROI計算結果:', {
            hasROI: !!roi,
            roi: roi,
            canvasSize: { width: canvas.width, height: canvas.height },
            previousROI: currentROI,
            isFullBodyVisible: fullBodyVisible
          });
          
          // 🔊 状態変化検出による音声再生
          // ※この音声再生ロジックはuseEffectに移動済み
          // if (fullBodyVisible !== previousFullBodyVisible) {
          //   console.log('🔊 全身検出状態変化:', {
          //     previous: previousFullBodyVisible,
          //     current: fullBodyVisible
          //   });
          //   
          //   if (fullBodyVisible) {
          //     // false → true：全身検出開始
          //     console.log('🔊 全身検出開始 - 音声再生');
          //     playFullBodyDetectedMessage();
          //   } else {
          //     // true → false：全身検出解除
          //     console.log('🔊 全身検出解除 - 音声再生');
          //     playFullBodyLostMessage();
          //   }
          //   
          //   // 前回状態を更新
          //   setPreviousFullBodyVisible(fullBodyVisible);
          // }
          
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
          if (lockOnSystemEnabled) {
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
                
                // Enhanced frame requirements for more stable locking
                const REQUIRED_GOOD_FRAMES = 5; // Increased from 1 to 5 frames
                
                if (newCount >= REQUIRED_GOOD_FRAMES && simpleLockState === 'SEARCHING') {
                  console.log('🔄 状態変更: SEARCHING → LOCKING');
                  setSimpleLockState('LOCKING');
                  setTimeout(() => {
                    console.log('🔒 状態変更: LOCKING → LOCKED');
                    setSimpleLockState('LOCKED');
                    // Play lock beep
                    playLockBeep();
                  }, 200); // Slightly increased delay for stability
                }
                return newCount;
              });
              setLostFrameCount(0);
            } else {
              // Reset good frame count when pose is invalid
              setGoodFrameCount(0);
              setLostFrameCount(prev => {
                const newCount = prev + 1;
                console.log('❌ Lost frame count:', newCount);
                
                // Enhanced lost frame threshold for stability
                const LOST_FRAME_THRESHOLD = 10; // Increased from 5 to 10 frames
                
                if (newCount >= LOST_FRAME_THRESHOLD && simpleLockState === 'LOCKED') {
                  console.log('🔄 状態変更: LOCKED → LOST');
                  setSimpleLockState('LOST');
                  // Play lost boops
                  playLostBoops();
                  setTimeout(() => {
                    console.log('🔄 状態変更: LOST → SEARCHING');
                    setSimpleLockState('SEARCHING');
                    // Clear ROI when transitioning back to searching
                    setCurrentROI(null);
                  }, 3000); // Increased timeout for user awareness
                }
                return newCount;
              });
            }
          }
          
          // 📊 ポーズ解析システムでフレームを解析
          if (showAnalyticsOverlay) {
            try {
              const analysis = poseAnalyticsEngine.analyzeFrame(result, undefined, Math.floor(timestamp));
              setCurrentAnalysis(analysis);
            } catch (error) {
              console.warn('Pose analytics error:', error);
            }
          }

          // 🌍 NEW: World coordinate processing
          if (showWorldCoordinates) {
            try {
              const worldPose = worldCoordinates.processPoseResult(result);
              setCurrentWorldPose(worldPose);
              console.log('🌍 World coordinates updated:', {
                isReady: worldCoordinates.isReady(),
                originInitialized: worldCoordinates.state.isInitialized,
                poseCount: worldPose ? Object.keys(worldPose).length : 0
              });
            } catch (error) {
              console.warn('World coordinates error:', error);
            }
          }

          // 🎯 NEW: Polar coordinate processing  
          if (showPolarCoordinates) {
            try {
              // 極座標データを取得
              const polarPose = worldCoordinates.state.currentPolarPose;
              const sphericalPose = worldCoordinates.state.currentSphericalPose;
              
              setCurrentPolarPose(polarPose);
              setCurrentSphericalPose(sphericalPose);
              
              console.log('🎯 Polar coordinates updated:', {
                polarCount: polarPose ? Object.keys(polarPose).length : 0,
                sphericalCount: sphericalPose ? Object.keys(sphericalPose).length : 0,
                samplePolar: polarPose?.nose ? {
                  r: polarPose.nose.r.toFixed(3),
                  theta: (polarPose.nose.theta * 180/Math.PI).toFixed(1),
                  phi: (polarPose.nose.phi * 180/Math.PI).toFixed(1)
                } : null
              });
            } catch (error) {
              console.warn('Polar coordinates error:', error);
            }
          }
          
          // Always forward pose data (lock-on doesn't interfere with pose detection)
          if (onPoseDetected) {
            onPoseDetected(result);
          }
          
          // Forward pose result for external consumers
          if (onPoseResult) {
            onPoseResult(result);
          }
        } else {
          console.log('❌ ポーズ検出失敗またはランドマークなし');
          
          // Forward null result when no pose detected
          if (onPoseResult) {
            onPoseResult(null);
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
  }, [isInitialized, isRunning, trackerStates, glowSize, onPoseDetected, lockOnSystemEnabled, simpleLockState, showJointAngles]);

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
      lockOnSystemEnabled
    });
  }, [currentROI, simpleLockState, lockOnSystemEnabled]);

  // 🔊 全身検出状態変化の監視と音声再生
  useEffect(() => {
    console.log('🔊 全身検出状態変化チェック:', {
      current: isFullBodyVisible,
      previous: previousFullBodyVisible
    });
    
    // 初回レンダリング時はスキップ
    if (previousFullBodyVisible === isFullBodyVisible) {
      return;
    }
    
    if (isFullBodyVisible && !previousFullBodyVisible) {
      // false → true：全身検出開始
      console.log('🔊 全身検出開始 - 音声再生');
      playFullBodyDetectedMessage();
    } else if (!isFullBodyVisible && previousFullBodyVisible) {
      // true → false：全身検出解除
      console.log('🔊 全身検出解除 - 音声再生');
      playFullBodyLostMessage();
    }
    
    // 前回状態を更新
    setPreviousFullBodyVisible(isFullBodyVisible);
  }, [isFullBodyVisible]);

  // 🎯 Poseトラッキング状態の監視
  useEffect(() => {
    if (!trackerStates.pose.detecting) {
      // Poseがオフになった時にROIをクリアし、Lock-onシステムをリセット
      console.log('🎯 Poseトラッキングオフ - ROIとLock-onシステムをリセット');
      setCurrentROI(null);
      setSimpleLockState('SEARCHING');
      setGoodFrameCount(0);
      setLostFrameCount(0);
      setIsFullBodyVisible(false);
      setPreviousFullBodyVisible(false);
    }
  }, [trackerStates.pose.detecting]);

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

  // 関節角度を計算して描画する関数
  const drawJointAngles = (ctx: CanvasRenderingContext2D, result: PoseLandmarkerResult, canvasWidth: number, canvasHeight: number) => {
    if (!result.landmarks || result.landmarks.length === 0) return;
    
    const landmarks = result.landmarks[0];
    
    // MediaPipeランドマークインデックス
    const LANDMARKS = {
      LEFT_SHOULDER: 11,
      RIGHT_SHOULDER: 12,
      LEFT_ELBOW: 13,
      RIGHT_ELBOW: 14,
      LEFT_WRIST: 15,
      RIGHT_WRIST: 16,
      LEFT_HIP: 23,
      RIGHT_HIP: 24,
      LEFT_KNEE: 25,
      RIGHT_KNEE: 26,
      LEFT_ANKLE: 27,
      RIGHT_ANKLE: 28,
    };

    // 3点から角度を計算する関数
    const calculateAngle = (p1: any, p2: any, p3: any): number => {
      if (!p1 || !p2 || !p3) return 0;
      
      // ベクトル計算
      const vec1 = { x: p1.x - p2.x, y: p1.y - p2.y };
      const vec2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      
      // 内積と大きさ
      const dot = vec1.x * vec2.x + vec1.y * vec2.y;
      const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
      
      if (mag1 * mag2 === 0) return 0;
      
      // 角度計算（ラジアンから度へ変換）
      const cosAngle = dot / (mag1 * mag2);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      return (angleRad * 180) / Math.PI;
    };

    // ランドマークの座標をキャンバス座標に変換（ミラーリング考慮）
    const getLandmarkPosition = (landmark: any) => {
      if (!landmark || landmark.visibility < 0.5) return null;
      return {
        x: canvasWidth - (landmark.x * canvasWidth), // ミラーリング
        y: landmark.y * canvasHeight
      };
    };

    // 角度弧を描画する関数
    const drawAngleArc = (center: {x: number, y: number}, point1: {x: number, y: number}, point2: {x: number, y: number}, angle: number, label: string, color: string = '#ffff00') => {
      ctx.save();
      
      // 2つのベクトルの角度を計算
      const angle1 = Math.atan2(point1.y - center.y, point1.x - center.x);
      const angle2 = Math.atan2(point2.y - center.y, point2.x - center.x);
      
      // 角度を正規化 (-π to π)
      let startAngle = angle1;
      let endAngle = angle2;
      
      // 角度の差を計算して、小さい方の弧を描画
      let angleDiff = endAngle - startAngle;
      if (angleDiff > Math.PI) {
        angleDiff -= 2 * Math.PI;
      } else if (angleDiff < -Math.PI) {
        angleDiff += 2 * Math.PI;
      }
      
      // 時計回りの場合は角度を入れ替え
      if (angleDiff < 0) {
        [startAngle, endAngle] = [endAngle, startAngle];
      }
      
      // 弧の半径を計算（2点までの距離の最小値の40%）
      const dist1 = Math.sqrt((point1.x - center.x) ** 2 + (point1.y - center.y) ** 2);
      const dist2 = Math.sqrt((point2.x - center.x) ** 2 + (point2.y - center.y) ** 2);
      const arcRadius = Math.min(dist1, dist2) * 0.4;
      
      // 弧を描画
      ctx.beginPath();
      ctx.arc(center.x, center.y, arcRadius, startAngle, endAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // 弧の端に小さな線を描画
      ctx.beginPath();
      ctx.moveTo(
        center.x + Math.cos(startAngle) * (arcRadius - 5),
        center.y + Math.sin(startAngle) * (arcRadius - 5)
      );
      ctx.lineTo(
        center.x + Math.cos(startAngle) * (arcRadius + 5),
        center.y + Math.sin(startAngle) * (arcRadius + 5)
      );
      ctx.moveTo(
        center.x + Math.cos(endAngle) * (arcRadius - 5),
        center.y + Math.sin(endAngle) * (arcRadius - 5)
      );
      ctx.lineTo(
        center.x + Math.cos(endAngle) * (arcRadius + 5),
        center.y + Math.sin(endAngle) * (arcRadius + 5)
      );
      ctx.stroke();
      
      // 角度テキストを弧の中央付近に表示
      const midAngle = (startAngle + endAngle) / 2;
      const textRadius = arcRadius + 15;
      const textX = center.x + Math.cos(midAngle) * textRadius;
      const textY = center.y + Math.sin(midAngle) * textRadius;
      
      // 背景の丸
      ctx.beginPath();
      ctx.arc(textX, textY, 18, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fill();
      
      // 角度テキスト
      ctx.fillStyle = color;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(angle)}°`, textX, textY - 2);
      
      // ラベル
      ctx.font = 'bold 7px Arial';
      ctx.fillText(label, textX, textY + 8);
      
      ctx.restore();
    };

    // 関節角度計算と描画
    try {
      // 左肘関節角度（肩-肘-手首）
      const leftShoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
      const leftElbow = landmarks[LANDMARKS.LEFT_ELBOW];
      const leftWrist = landmarks[LANDMARKS.LEFT_WRIST];
      
      if (leftShoulder && leftElbow && leftWrist) {
        const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        const leftElbowPos = getLandmarkPosition(leftElbow);
        const leftShoulderPos = getLandmarkPosition(leftShoulder);
        const leftWristPos = getLandmarkPosition(leftWrist);
        
        if (leftElbowPos && leftShoulderPos && leftWristPos) {
          drawAngleArc(leftElbowPos, leftShoulderPos, leftWristPos, leftElbowAngle, 'L.Elbow', '#00ff00');
        }
      }

      // 右肘関節角度（肩-肘-手首）
      const rightShoulder = landmarks[LANDMARKS.RIGHT_SHOULDER];
      const rightElbow = landmarks[LANDMARKS.RIGHT_ELBOW];
      const rightWrist = landmarks[LANDMARKS.RIGHT_WRIST];
      
      if (rightShoulder && rightElbow && rightWrist) {
        const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
        const rightElbowPos = getLandmarkPosition(rightElbow);
        const rightShoulderPos = getLandmarkPosition(rightShoulder);
        const rightWristPos = getLandmarkPosition(rightWrist);
        
        if (rightElbowPos && rightShoulderPos && rightWristPos) {
          drawAngleArc(rightElbowPos, rightShoulderPos, rightWristPos, rightElbowAngle, 'R.Elbow', '#00ff00');
        }
      }

      // 左膝関節角度（腰-膝-足首）
      const leftHip = landmarks[LANDMARKS.LEFT_HIP];
      const leftKnee = landmarks[LANDMARKS.LEFT_KNEE];
      const leftAnkle = landmarks[LANDMARKS.LEFT_ANKLE];
      
      if (leftHip && leftKnee && leftAnkle) {
        const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        const leftKneePos = getLandmarkPosition(leftKnee);
        const leftHipPos = getLandmarkPosition(leftHip);
        const leftAnklePos = getLandmarkPosition(leftAnkle);
        
        if (leftKneePos && leftHipPos && leftAnklePos) {
          drawAngleArc(leftKneePos, leftHipPos, leftAnklePos, leftKneeAngle, 'L.Knee', '#00ffff');
        }
      }

      // 右膝関節角度（腰-膝-足首）
      const rightHip = landmarks[LANDMARKS.RIGHT_HIP];
      const rightKnee = landmarks[LANDMARKS.RIGHT_KNEE];
      const rightAnkle = landmarks[LANDMARKS.RIGHT_ANKLE];
      
      if (rightHip && rightKnee && rightAnkle) {
        const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
        const rightKneePos = getLandmarkPosition(rightKnee);
        const rightHipPos = getLandmarkPosition(rightHip);
        const rightAnklePos = getLandmarkPosition(rightAnkle);
        
        if (rightKneePos && rightHipPos && rightAnklePos) {
          drawAngleArc(rightKneePos, rightHipPos, rightAnklePos, rightKneeAngle, 'R.Knee', '#00ffff');
        }
      }

      // 左肩関節角度（肘-肩-腰）
      if (leftElbow && leftShoulder && leftHip) {
        const leftShoulderAngle = calculateAngle(leftElbow, leftShoulder, leftHip);
        const leftShoulderPos = getLandmarkPosition(leftShoulder);
        const leftElbowPos = getLandmarkPosition(leftElbow);
        const leftHipPos = getLandmarkPosition(leftHip);
        
        if (leftShoulderPos && leftElbowPos && leftHipPos) {
          drawAngleArc(leftShoulderPos, leftElbowPos, leftHipPos, leftShoulderAngle, 'L.Shoulder', '#ff8800');
        }
      }

      // 右肩関節角度（肘-肩-腰）
      if (rightElbow && rightShoulder && rightHip) {
        const rightShoulderAngle = calculateAngle(rightElbow, rightShoulder, rightHip);
        const rightShoulderPos = getLandmarkPosition(rightShoulder);
        const rightElbowPos = getLandmarkPosition(rightElbow);
        const rightHipPos = getLandmarkPosition(rightHip);
        
        if (rightShoulderPos && rightElbowPos && rightHipPos) {
          drawAngleArc(rightShoulderPos, rightElbowPos, rightHipPos, rightShoulderAngle, 'R.Shoulder', '#ff8800');
        }
      }

    } catch (error) {
      console.warn('関節角度描画エラー:', error);
    }
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
                  lockOnSystemEnabled,
                  currentROI,
                  simpleLockState,
                  shouldRender: lockOnSystemEnabled
                });
                
                if (lockOnSystemEnabled) {
                  console.log('✅ LockOnOverlayをレンダリング予定');
                  return (
                    <LockOnOverlay
                      roi={currentROI}
                      state={simpleLockState}
                      width={width}
                      height={height}
                      className="absolute top-0 left-0"
                      key={forceRenderCounter}
                      isFullBodyVisible={isFullBodyVisible}
                    />
                  );
                } else {
                  console.log('❌ lockOnSystemEnabled=false のためLockOnOverlayをスキップ');
                  return null;
                }
              })()}
              
              {/* Pose Analytics overlay */}
              {showAnalyticsOverlay && (
                <OrientationOverlay
                  analysis={currentAnalysis}
                  width={width}
                  height={height}
                  className="absolute top-0 left-0"
                  showFloorInfo={true}
                  showJointAngles={true}
                  showHandOrientation={true}
                  showBodyDirection={true}
                  showCenterOfMass={true}
                  showPostureStability={true}
                />
              )}

              {/* 🌍 NEW: World Coordinate overlay */}
              {showWorldCoordinates && (
                <WorldCoordinateOverlay
                  worldPose={currentWorldPose}
                  polarPose={currentPolarPose}
                  sphericalPose={currentSphericalPose}
                  isInitialized={worldCoordinates.state.isInitialized}
                  bodyCenter={worldCoordinates.state.bodyCenter}
                  origin={worldCoordinates.state.origin}
                  width={width}
                  height={height}
                  className="absolute top-0 left-0"
                  showPolarCoordinates={showPolarCoordinates}
                />
              )}

              {/* 🎯 NEW: Coordinate Axes overlay */}
              {showCoordinateAxes && (
                <CoordinateAxesOverlay
                  width={width}
                  height={height}
                  position="bottom-left"
                  size={80}
                  className="absolute"
                />
              )}
            </Box>
          </Box>
        </Card>

        {/* 🎯 NEW: Polar Coordinate System Control */}
            <Card sx={{
              background: '#f5f7fa',
          border: `1.5px solid ${orange[600]}`,
          boxShadow: `0 0 8px ${orange[600]}22`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* ヘッダー部分 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: '1.2rem' }}>🎯</Typography>
                <Typography variant="subtitle2" sx={{ 
              color: orange[600], 
                  fontWeight: 700, 
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '0.85rem',
                  flex: 1
                }}>
              Polar Coordinates
                </Typography>
                <Typography variant="body2" sx={{ 
              color: showPolarCoordinates ? green[600] : 'gray',
                  fontWeight: 600,
                  fontSize: '0.8rem'
                }}>
              {showPolarCoordinates ? 'ON' : 'OFF'}
                </Typography>
              </Box>

          {/* 極座標on/offボタン */}
          <Box sx={{ display: 'flex', gap: 1, mb: showPolarCoordinates ? 1 : 0 }}>
                <Button
              variant={showPolarCoordinates ? "contained" : "outlined"}
                  size="small"
              onClick={() => {
                setShowPolarCoordinates(true);
                // 極座標を有効にする時は世界座標も有効にする
                if (!showWorldCoordinates) {
                  setShowWorldCoordinates(true);
                }
              }}
                  sx={{ 
                    flex: 1,
                      borderColor: orange[600], 
                color: showPolarCoordinates ? 'white' : orange[600],
                backgroundColor: showPolarCoordinates ? orange[600] : 'transparent',
                '&:hover': { 
                  borderColor: orange[700], 
                  backgroundColor: showPolarCoordinates ? orange[700] : orange[50] 
                    },
                    fontSize: '0.7rem',
                    py: 0.5
                  }}
                >
              ENABLE
                </Button>
                <Button
              variant={!showPolarCoordinates ? "contained" : "outlined"}
                  size="small"
              onClick={() => {
                setShowPolarCoordinates(false);
                setCurrentPolarPose(null);
                setCurrentSphericalPose(null);
              }}
                  sx={{ 
                    flex: 1,
                    borderColor: 'gray', 
                color: !showPolarCoordinates ? 'white' : 'gray',
                backgroundColor: !showPolarCoordinates ? 'gray' : 'transparent',
                    '&:hover': { 
                      borderColor: '#666', 
                  backgroundColor: !showPolarCoordinates ? '#666' : '#f5f5f5' 
                    },
                    fontSize: '0.7rem',
                    py: 0.5
                  }}
                >
              DISABLE
                </Button>
          </Box>

          {/* デバッグ情報表示 */}
          {showPolarCoordinates && currentPolarPose && (
            <Box sx={{ 
              p: 0.8, 
              backgroundColor: 'rgba(255,152,0,0.1)', 
              borderRadius: 1,
              fontFamily: 'monospace'
            }}>
              <Typography variant="caption" sx={{ 
                color: orange[700],
                fontSize: '0.65rem',
                display: 'block'
              }}>
                Polar Landmarks: {Object.keys(currentPolarPose).length}
              </Typography>
              {currentPolarPose.nose && (
                <Typography variant="caption" sx={{ 
                  color: orange[700],
                  fontSize: '0.65rem',
                  display: 'block'
                }}>
                  Nose: r={currentPolarPose.nose.r.toFixed(2)}m, 
                  θ={(currentPolarPose.nose.theta * 180/Math.PI).toFixed(1)}°, 
                  φ={(currentPolarPose.nose.phi * 180/Math.PI).toFixed(1)}°
            </Typography>
              )}
              {currentSphericalPose && currentSphericalPose.nose && (
                <Typography variant="caption" sx={{ 
                  color: orange[700],
                  fontSize: '0.65rem',
                  display: 'block'
                }}>
                  Spherical: θ={(currentSphericalPose.nose.theta * 180/Math.PI).toFixed(1)}°, 
                  φ={(currentSphericalPose.nose.phi * 180/Math.PI).toFixed(1)}°
                </Typography>
              )}
          </Box>
          )}
        </Card>

        {/* Lock-On System Container - 右半分に配置、左半分は新コンポーネント用に空ける */}
        <Box sx={{ display: 'flex', gap: 2, width: width, mb: 1 }}>
          {/* 左半分: カメラ・表示設定コントロール */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* カメラ選択セクション */}
            <Card sx={{ background: '#f5f7fa', border: '1.5px solid #e3e3e3', boxShadow: '0 0 8px #e3e3e3', borderRadius: 2, p: 1.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#555', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1, fontSize: '1.05rem' }}>
                  🎥 Camera Selection
                </Typography>
                <Select
                  value={selectedCameraId}
                  onChange={(e) => {
                    switchCamera(e.target.value);
              }}
              sx={{ 
                    '& .MuiSelect-select': {
                      padding: '0.5rem',
                    },
                  }}
                >
                  {availableCameras.map((camera) => (
                    <MenuItem key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </MenuItem>
                  ))}
                </Select>
          </Box>
        </Card>

            {/* 表示設定セクション */}
            <Card sx={{ background: '#f5f7fa', border: '1.5px solid #e3e3e3', boxShadow: '0 0 8px #e3e3e3', borderRadius: 2, p: 1.5 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#555', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', letterSpacing: 1, fontSize: '1.05rem' }}>
                  🎯 Display Settings
                  </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={showJointAngles ? 'joint_angles' : 'no_joint_angles'}
                  onChange={(_, value) => {
                    setShowJointAngles(value === 'joint_angles');
                  }}
                  sx={{ 
                    '& .MuiToggleButtonGroup-root': {
                      justifyContent: 'space-between',
                    },
                  }}
                >
                  <ToggleButton value="joint_angles">Joint Angles</ToggleButton>
                  <ToggleButton value="no_joint_angles">No Joint Angles</ToggleButton>
                </ToggleButtonGroup>
                
                {/* 座標軸表示コントロール */}
                <ToggleButtonGroup
                  exclusive
                  value={showCoordinateAxes ? 'show_axes' : 'hide_axes'}
                  onChange={(_, value) => {
                    setShowCoordinateAxes(value === 'show_axes');
                  }}
                  sx={{ 
                    '& .MuiToggleButtonGroup-root': {
                      justifyContent: 'space-between',
                    },
                  }}
                >
                  <ToggleButton value="show_axes">XYZ Axes</ToggleButton>
                  <ToggleButton value="hide_axes">No Axes</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Card>
          </Box>
        </Box>

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