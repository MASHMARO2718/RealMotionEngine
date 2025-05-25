'use client';

import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Analytics, BarChart, DirectionsRun, Height, Timeline, Visibility } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { blue, green, orange, purple, red } from '@mui/material/colors';
import { useEffect, useState } from 'react';

// MediaPipeランドマークのインデックス定義
const LANDMARK_INDICES = {
  // 上半身
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  // 下半身
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
} as const;

interface BodyDataAnalyzerProps {
  poseData: PoseLandmarkerResult | null;
  width?: number;
  height?: number;
}

interface AnalysisMetrics {
  overallConfidence: number;
  visibleLandmarks: number;
  totalLandmarks: number;
  poseType: string;
  bodyAlignment: {
    shoulderBalance: number;
    hipBalance: number;
    spineAlignment: number;
  };
  limbPositions: {
    leftArm: number;
    rightArm: number;
    leftLeg: number;
    rightLeg: number;
  };
  stability: {
    centerOfMass: { x: number; y: number };
    balanceScore: number;
  };
}

export default function BodyDataAnalyzer({ 
  poseData, 
  width = 220, 
  height = 540 
}: BodyDataAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AnalysisMetrics | null>(null);
  const [isActive, setIsActive] = useState(false);

  // ポーズデータを解析してメトリクスを計算
  const analyzeBodyData = (data: PoseLandmarkerResult): AnalysisMetrics => {
    if (!data.landmarks || data.landmarks.length === 0) {
      return {
        overallConfidence: 0,
        visibleLandmarks: 0,
        totalLandmarks: 33,
        poseType: 'None',
        bodyAlignment: { shoulderBalance: 0, hipBalance: 0, spineAlignment: 0 },
        limbPositions: { leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
        stability: { centerOfMass: { x: 0, y: 0 }, balanceScore: 0 }
      };
    }

    const landmarks = data.landmarks[0];
    
    // 可視性と信頼度の計算
    let totalVisibility = 0;
    let visibleCount = 0;
    
    landmarks.forEach(landmark => {
      if (landmark.visibility !== undefined) {
        totalVisibility += landmark.visibility;
        if (landmark.visibility > 0.5) visibleCount++;
      }
    });

    const overallConfidence = landmarks.length > 0 ? totalVisibility / landmarks.length : 0;

    // 体のアライメント分析
    const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER];
    const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER];
    const leftHip = landmarks[LANDMARK_INDICES.LEFT_HIP];
    const rightHip = landmarks[LANDMARK_INDICES.RIGHT_HIP];
    const nose = landmarks[LANDMARK_INDICES.NOSE];

    // 肩のバランス（水平度）
    const shoulderBalance = leftShoulder && rightShoulder 
      ? 100 - Math.abs(leftShoulder.y - rightShoulder.y) * 100
      : 0;

    // 腰のバランス（水平度）
    const hipBalance = leftHip && rightHip 
      ? 100 - Math.abs(leftHip.y - rightHip.y) * 100
      : 0;

    // 背骨のアライメント（頭-肩-腰の直線性）
    let spineAlignment = 0;
    if (nose && leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderCenter = { 
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2
      };
      const hipCenter = { 
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2
      };
      
      // 頭-肩-腰のX座標の直線性を評価
      const headToShoulder = Math.abs(nose.x - shoulderCenter.x);
      const shoulderToHip = Math.abs(shoulderCenter.x - hipCenter.x);
      spineAlignment = Math.max(0, 100 - (headToShoulder + shoulderToHip) * 200);
    }

    // 四肢の位置分析
    const calculateLimbPosition = (shoulder: any, elbow: any, wrist: any): number => {
      if (!shoulder || !elbow || !wrist) return 0;
      
      // 肩-肘-手首の角度を計算
      const vec1 = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
      const vec2 = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
      
      const dot = vec1.x * vec2.x + vec1.y * vec2.y;
      const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
      
      if (mag1 * mag2 === 0) return 0;
      
      const cosAngle = dot / (mag1 * mag2);
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      return (angle / Math.PI) * 100; // 0-100の範囲に正規化
    };

    const leftArmPosition = calculateLimbPosition(
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER],
      landmarks[LANDMARK_INDICES.LEFT_ELBOW],
      landmarks[LANDMARK_INDICES.LEFT_WRIST]
    );

    const rightArmPosition = calculateLimbPosition(
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER],
      landmarks[LANDMARK_INDICES.RIGHT_ELBOW],
      landmarks[LANDMARK_INDICES.RIGHT_WRIST]
    );

    const leftLegPosition = calculateLimbPosition(
      landmarks[LANDMARK_INDICES.LEFT_HIP],
      landmarks[LANDMARK_INDICES.LEFT_KNEE],
      landmarks[LANDMARK_INDICES.LEFT_ANKLE]
    );

    const rightLegPosition = calculateLimbPosition(
      landmarks[LANDMARK_INDICES.RIGHT_HIP],
      landmarks[LANDMARK_INDICES.RIGHT_KNEE],
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE]
    );

    // 重心と安定性の計算
    let centerOfMass = { x: 0, y: 0 };
    let validLandmarks = 0;
    
    landmarks.forEach(landmark => {
      if (landmark.visibility !== undefined && landmark.visibility > 0.3) {
        centerOfMass.x += landmark.x;
        centerOfMass.y += landmark.y;
        validLandmarks++;
      }
    });

    if (validLandmarks > 0) {
      centerOfMass.x /= validLandmarks;
      centerOfMass.y /= validLandmarks;
    }

    // バランススコア（重心の中央からの距離）
    const balanceScore = Math.max(0, 100 - Math.abs(centerOfMass.x - 0.5) * 200);

    // ポーズタイプの判定
    let poseType = 'Standing';
    const leftKnee = landmarks[LANDMARK_INDICES.LEFT_KNEE];
    const rightKnee = landmarks[LANDMARK_INDICES.RIGHT_KNEE];
    
    if (leftHip && rightHip && leftKnee && rightKnee) {
      const hipKneeDistance = Math.abs(leftHip.y - leftKnee.y) +
                              Math.abs(rightHip.y - rightKnee.y);
      
      if (hipKneeDistance < 0.1) {
        poseType = 'Sitting';
      } else if (hipKneeDistance > 0.3) {
        poseType = 'Standing';
      } else {
        poseType = 'Transitioning';
      }
    }

    return {
      overallConfidence: overallConfidence * 100,
      visibleLandmarks: visibleCount,
      totalLandmarks: landmarks.length,
      poseType,
      bodyAlignment: {
        shoulderBalance,
        hipBalance,
        spineAlignment
      },
      limbPositions: {
        leftArm: leftArmPosition,
        rightArm: rightArmPosition,
        leftLeg: leftLegPosition,
        rightLeg: rightLegPosition
      },
      stability: {
        centerOfMass,
        balanceScore
      }
    };
  };

  // ポーズデータが更新されたら解析を実行
  useEffect(() => {
    if (poseData) {
      const metrics = analyzeBodyData(poseData);
      setAnalysis(metrics);
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }, [poseData]);

  // メトリクス値に基づく色の決定
  const getScoreColor = (score: number) => {
    if (score >= 80) return green[500];
    if (score >= 60) return orange[500];
    return red[500];
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <Box sx={{ width, height, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ヘッダー */}
      <Card sx={{
        background: isActive ? green[50] : '#f5f7fa',
        border: `1.5px solid ${isActive ? green[500] : '#ddd'}`,
        borderRadius: 2,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <Analytics sx={{ color: isActive ? green[500] : '#666' }} />
        <Typography variant="subtitle2" sx={{ 
          color: isActive ? green[700] : '#666',
          fontWeight: 700,
          fontFamily: 'Orbitron, sans-serif'
        }}>
          Body Data Analysis
        </Typography>
        <Chip 
          label={isActive ? 'ACTIVE' : 'WAITING'} 
          size="small"
          sx={{ 
            bgcolor: isActive ? green[500] : '#ccc',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 'bold'
          }}
        />
      </Card>

      {analysis && (
        <>
          {/* 全体的な信頼度 */}
          <Card sx={{ p: 1.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Visibility sx={{ color: blue[500], fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Detection Quality
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={analysis.overallConfidence}
              sx={{ 
                height: 8, 
                borderRadius: 4,
                bgcolor: '#eee',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: getScoreColor(analysis.overallConfidence)
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                {analysis.visibleLandmarks}/{analysis.totalLandmarks} landmarks
              </Typography>
              <Typography variant="caption" sx={{ 
                fontSize: '0.7rem',
                color: getScoreColor(analysis.overallConfidence),
                fontWeight: 'bold'
              }}>
                {analysis.overallConfidence.toFixed(1)}%
              </Typography>
            </Box>
          </Card>

          {/* ポーズタイプ */}
          <Card sx={{ p: 1.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Height sx={{ color: purple[500], fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Pose Type
              </Typography>
            </Box>
            <Chip 
              label={analysis.poseType}
              sx={{ 
                bgcolor: purple[100],
                color: purple[700],
                fontWeight: 'bold',
                fontSize: '0.8rem'
              }}
            />
          </Card>

          {/* 体のアライメント */}
          <Card sx={{ p: 1.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BarChart sx={{ color: orange[500], fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Body Alignment
              </Typography>
            </Box>
            
            {['shoulderBalance', 'hipBalance', 'spineAlignment'].map((key) => {
              const score = analysis.bodyAlignment[key as keyof typeof analysis.bodyAlignment];
              const labels = {
                shoulderBalance: 'Shoulders',
                hipBalance: 'Hips',
                spineAlignment: 'Spine'
              };
              
              return (
                <Box key={key} sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {labels[key as keyof typeof labels]}
                    </Typography>
                    <Typography variant="caption" sx={{ 
                      fontSize: '0.7rem',
                      color: getScoreColor(score),
                      fontWeight: 'bold'
                    }}>
                      {score.toFixed(0)}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={score}
                    sx={{ 
                      height: 4, 
                      borderRadius: 2,
                      bgcolor: '#eee',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getScoreColor(score)
                      }
                    }}
                  />
                </Box>
              );
            })}
          </Card>

          {/* 安定性 */}
          <Card sx={{ p: 1.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Timeline sx={{ color: blue[500], fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Stability
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                Balance Score
              </Typography>
              <Typography variant="caption" sx={{ 
                fontSize: '0.7rem',
                color: getScoreColor(analysis.stability.balanceScore),
                fontWeight: 'bold'
              }}>
                {getScoreLabel(analysis.stability.balanceScore)}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={analysis.stability.balanceScore}
              sx={{ 
                height: 6, 
                borderRadius: 3,
                bgcolor: '#eee',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: getScoreColor(analysis.stability.balanceScore)
                }
              }}
            />
            
            <Typography variant="caption" sx={{ 
              fontSize: '0.6rem', 
              color: '#666',
              mt: 0.5,
              display: 'block'
            }}>
              Center: ({analysis.stability.centerOfMass.x.toFixed(2)}, {analysis.stability.centerOfMass.y.toFixed(2)})
            </Typography>
          </Card>

          {/* 四肢の位置 */}
          <Card sx={{ p: 1.5, borderRadius: 2, flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <DirectionsRun sx={{ color: green[500], fontSize: '1.1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Limb Positions
              </Typography>
            </Box>
            
            {Object.entries(analysis.limbPositions).map(([limb, value]) => {
              const labels = {
                leftArm: 'L.Arm',
                rightArm: 'R.Arm',
                leftLeg: 'L.Leg',
                rightLeg: 'R.Leg'
              };
              
              return (
                <Box key={limb} sx={{ mb: 0.8 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {labels[limb as keyof typeof labels]}
                    </Typography>
                    <Typography variant="caption" sx={{ 
                      fontSize: '0.6rem',
                      color: '#666'
                    }}>
                      {value.toFixed(0)}°
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(value / 180) * 100}
                    sx={{ 
                      height: 3, 
                      borderRadius: 1.5,
                      bgcolor: '#eee',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: green[400]
                      }
                    }}
                  />
                </Box>
              );
            })}
          </Card>
        </>
      )}

      {!analysis && (
        <Card sx={{ 
          p: 3, 
          borderRadius: 2, 
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999'
        }}>
          <Analytics sx={{ fontSize: '2rem', mb: 1, color: '#ccc' }} />
          <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Waiting for pose data...
          </Typography>
          <Typography variant="caption" sx={{ textAlign: 'center', fontSize: '0.7rem', mt: 0.5 }}>
            Start tracking to see analysis
          </Typography>
        </Card>
      )}
    </Box>
  );
} 