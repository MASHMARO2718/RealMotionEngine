'use client';

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useCallback,useRef, useState } from 'react';

import { PolarPoseRetarget } from '../../three/PolarPoseRetarget';

interface AutoTuningPanelProps {
  width?: number;
  height?: number;
  poseData?: PoseLandmarkerResult | null;
  onTuningComplete?: (adjustments: Record<string, { omega: number; phi: number }>) => void;
  poseRetarget?: PolarPoseRetarget;
}

interface TPoseCalibration {
  isActive: boolean;
  countdown: number;
  samples: PoseLandmarkerResult[];
  targetSamples: number;
}

export default function AutoTuningPanel({ 
  width = 280, 
  height = 300, 
  poseData, 
  onTuningComplete,
  poseRetarget
}: AutoTuningPanelProps) {
  const [calibration, setCalibration] = useState<TPoseCalibration>({
    isActive: false,
    countdown: 0,
    samples: [],
    targetSamples: 30 // 1秒間（30フレーム）のサンプリング
  });
  
  const [tuningResult, setTuningResult] = useState<Record<string, { omega: number; phi: number }> | null>(null);
  const calibrationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const samplingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // T-poseかどうかを検出（PolarPoseRetargetのメソッドを使用）
  const detectTPose = useCallback((landmarks: any[]): boolean => {
    if (!poseRetarget) {
      console.warn('PolarPoseRetargetが設定されていません');
      return false;
    }
    return poseRetarget.detectTPose(landmarks);
  }, [poseRetarget]);

  // オートチューニング開始
  const startAutoTuning = useCallback(() => {
    if (!poseData?.landmarks?.[0]) {
      alert('ポーズデータが検出されていません。カメラの前に立ってください。');
      return;
    }

    if (!poseRetarget) {
      alert('姿勢処理システムが初期化されていません。');
      return;
    }

    const landmarks = poseData.landmarks[0];
    if (!detectTPose(landmarks)) {
      alert('T-poseが検出されていません。\n両腕を肩の高さで水平に伸ばしてください。');
      return;
    }

    // カウントダウン開始
    setCalibration({
      isActive: true,
      countdown: 3,
      samples: [],
      targetSamples: 30
    });

    // カウントダウンタイマー
    let count = 3;
    calibrationTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(calibrationTimerRef.current!);
        startSampling();
      } else {
        setCalibration(prev => ({ ...prev, countdown: count }));
      }
    }, 1000);
  }, [poseData, detectTPose, poseRetarget]);

  // サンプリング開始
  const startSampling = useCallback(() => {
    const samples: PoseLandmarkerResult[] = [];
    let sampleCount = 0;

    setCalibration(prev => ({ 
      ...prev, 
      countdown: 0,
      samples: []
    }));

    samplingTimerRef.current = setInterval(() => {
      if (poseData?.landmarks?.[0]) {
        const landmarks = poseData.landmarks[0];
        if (detectTPose(landmarks)) {
          samples.push(JSON.parse(JSON.stringify(poseData))); // Deep copy
          sampleCount++;
          
          setCalibration(prev => ({ 
            ...prev, 
            samples: [...samples] 
          }));

          if (sampleCount >= 30) {
            clearInterval(samplingTimerRef.current!);
            calculateAdjustments(samples);
          }
        }
      }
    }, 33); // 30fps
  }, [poseData, detectTPose]);

  // 補正値を計算（PolarPoseRetargetのメソッドを使用）
  const calculateAdjustments = useCallback((samples: PoseLandmarkerResult[]) => {
    if (!poseRetarget) {
      alert('姿勢処理システムが利用できません。');
      setCalibration({ isActive: false, countdown: 0, samples: [], targetSamples: 30 });
      return;
    }

    if (samples.length === 0) {
      alert('サンプルが取得できませんでした。もう一度お試しください。');
      setCalibration({ isActive: false, countdown: 0, samples: [], targetSamples: 30 });
      return;
    }

    console.log(`🎯 ${samples.length}個のT-poseサンプルから補正値を計算中...`);

    // PolarPoseRetargetのオートチューニング機能を使用
    const success = poseRetarget.performAutoTuning(samples);
    
    if (success) {
      // 計算された補正値を取得
      const adjustments = poseRetarget.getAngleAdjustments();
      console.log('🎛️ 計算された補正値:', adjustments);
      
      setTuningResult(adjustments);
      setCalibration({ isActive: false, countdown: 0, samples: [], targetSamples: 30 });
      
      // 補正値を適用
      onTuningComplete?.(adjustments);
    } else {
      alert('オートチューニングに失敗しました。T-poseを正しく維持してもう一度お試しください。');
      setCalibration({ isActive: false, countdown: 0, samples: [], targetSamples: 30 });
    }
    
  }, [onTuningComplete, poseRetarget]);

  // チューニングキャンセル
  const cancelTuning = useCallback(() => {
    if (calibrationTimerRef.current) {
      clearInterval(calibrationTimerRef.current);
    }
    if (samplingTimerRef.current) {
      clearInterval(samplingTimerRef.current);
    }
    setCalibration({ isActive: false, countdown: 0, samples: [], targetSamples: 30 });
  }, []);

  const progress = calibration.samples.length / calibration.targetSamples * 100;
  const isTPoseDetected = poseData?.landmarks?.[0] ? detectTPose(poseData.landmarks[0]) : false;

  return (
    <Paper sx={{ 
      width, 
      height, 
      p: 2, 
      backgroundColor: '#f8f9fa',
      border: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }}>
      <Typography variant="h6" sx={{ 
        textAlign: 'center', 
        color: '#333',
        fontWeight: 'bold',
        fontSize: '16px'
      }}>
        🎯 オートチューニング
      </Typography>
      
      {/* T-pose検出状態 */}
      <Box sx={{ 
        p: 1.5, 
        backgroundColor: isTPoseDetected ? '#e8f5e8' : '#fff3e0',
        borderRadius: 1,
        border: `2px solid ${isTPoseDetected ? '#4caf50' : '#ff9800'}`
      }}>
        <Typography variant="body2" sx={{ 
          textAlign: 'center',
          color: isTPoseDetected ? '#2e7d32' : '#f57c00',
          fontWeight: 'bold'
        }}>
          {isTPoseDetected ? '✅ T-pose検出中' : '⚠️ T-poseしてください'}
        </Typography>
      </Box>

      {!calibration.isActive ? (
        <>
          {/* チューニング開始ボタン */}
          <Button
            variant="contained"
            onClick={startAutoTuning}
            disabled={!isTPoseDetected || !poseRetarget}
            sx={{
              bgcolor: '#2196f3',
              '&:hover': { bgcolor: '#1976d2' },
              '&:disabled': { bgcolor: '#ccc' }
            }}
          >
            🚀 オートチューニング開始
          </Button>
          
          {/* 使用方法 */}
          <Typography variant="caption" sx={{ color: '#666', fontSize: '11px' }}>
            💡 使用方法：<br/>
            1. T-poseをしてください<br/>
            2. ボタンを押してください<br/>
            3. 3秒後に自動測定開始<br/>
            4. 1秒間T-poseを維持
          </Typography>
        </>
      ) : (
        <>
          {/* カウントダウン表示 */}
          {calibration.countdown > 0 && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                {calibration.countdown}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                T-poseを維持してください
              </Typography>
            </Box>
          )}
          
          {/* サンプリング進行状況 */}
          {calibration.countdown === 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, textAlign: 'center' }}>
                📊 測定中... ({calibration.samples.length}/{calibration.targetSamples})
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}
          
          {/* キャンセルボタン */}
          <Button
            variant="outlined"
            onClick={cancelTuning}
            color="error"
            size="small"
          >
            ❌ キャンセル
          </Button>
        </>
      )}
      
      {/* チューニング結果 */}
      {tuningResult && (
        <Box sx={{ 
          p: 1, 
          backgroundColor: '#e8f5e8',
          borderRadius: 1,
          border: '2px solid #4caf50'
        }}>
          <Typography variant="body2" sx={{ 
            textAlign: 'center',
            color: '#2e7d32',
            fontWeight: 'bold'
          }}>
            ✅ チューニング完了！
          </Typography>
        </Box>
      )}
    </Paper>
  );
} 