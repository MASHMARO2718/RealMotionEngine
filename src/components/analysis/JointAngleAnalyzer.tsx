'use client';

import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Assessment, TrendingUp } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { blue, green, orange, red } from '@mui/material/colors';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

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
} as const;

interface JointAngle {
  name: string;
  angle: number;
  side: 'left' | 'right';
  type: 'arm' | 'leg';
}

interface JointAngleAnalyzerProps {
  poseData: PoseLandmarkerResult | null;
  width?: number;
  height?: number;
}

// 円形プログレスコンポーネント
interface CircularAngleProps {
  angle: number;
  type: 'arm' | 'leg';
  name: string;
  size?: number;
}

function CircularAngle({ angle, type, name, size = 50 }: CircularAngleProps) {
  // すべてのグラフを0~180度で統一表示
  const jointRange = { min: 0, max: 180 };
  
  // 角度を0-180度の範囲での割合に変換（0-100%）
  const normalizedAngle = Math.max(0, Math.min(100, 
    (angle / 180) * 100
  ));
  
  // 半円表示のため、180度を100%とする
  const progressValue = (normalizedAngle / 100) * 50; // 50%が最大（180度）
  
  // 角度に基づく色の決定
  const getAngleColor = (angle: number, type: 'arm' | 'leg') => {
    const healthyRanges = {
      arm: { min: 30, max: 150 },
      leg: { min: 120, max: 180 }
    };

    const range = healthyRanges[type];
    if (angle >= range.min && angle <= range.max) return green[500];
    if (angle >= range.min - 20 && angle <= range.max + 20) return orange[500];
    return red[500];
  };

  const color = getAngleColor(angle, type);

  return (
    <Box sx={{ 
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
      width: '100%',
      height: size / 2 + 30, // 角度表示分のスペースを確保
      px: 1
    }}>
      {/* 半円グラフコンテナ */}
      <Box sx={{ 
        position: 'relative',
        width: size,
        height: size / 2 + 15, // 角度表示のためさらに余裕を追加
        overflow: 'visible', // 角度表示が見えるようにvisibleに変更
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {/* 背景の半円 - 回転してから配置 */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: 'rotate(-90deg)',
          transformOrigin: `${size/2}px ${size/2}px`
        }}>
          <CircularProgress
            variant="determinate"
            value={50}
            size={size}
            thickness={5}
            sx={{
              color: '#e0e0e0',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
        </Box>
        
        {/* 角度を表す半円 - 回転してから配置 */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: 'rotate(-90deg)',
          transformOrigin: `${size/2}px ${size/2}px`
        }}>
          <CircularProgress
            variant="determinate"
            value={progressValue}
            size={size}
            thickness={5}
            sx={{
              color: color,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
                filter: `drop-shadow(0 0 3px ${color}40)`,
              },
            }}
          />
        </Box>

        {/* 中央の角度表示 - コンテナ外に配置 */}
        <Box sx={{
          position: 'absolute',
          top: size / 2 + 5, // コンテナの下側に配置
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: '4px',
          px: 0.5,
          py: 0.2
        }}>
          <Typography variant="caption" sx={{ 
            fontSize: '0.75rem', 
            fontWeight: 'bold',
            color: color,
            lineHeight: 1
          }}>
            {angle.toFixed(0)}°
          </Typography>
        </Box>
      </Box>
      
      {/* 関節名と可動域表示 - グラフの横に配置 */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flexGrow: 1
      }}>
        <Typography variant="caption" sx={{ 
          fontSize: '0.7rem', 
          color: '#333',
          fontWeight: 600,
          lineHeight: 1.2,
          mb: 0.3
        }}>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ 
          fontSize: '0.6rem', 
          color: '#666',
          lineHeight: 1
        }}>
          {jointRange.min}°-{jointRange.max}°
        </Typography>
      </Box>
    </Box>
  );
}

export default function JointAngleAnalyzer({ 
  poseData, 
  width = 350, 
  height = 400 
}: JointAngleAnalyzerProps) {
  const [jointAngles, setJointAngles] = useState<JointAngle[]>([]);
  const [isActive, setIsActive] = useState(false);

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

  // 関節角度の計算
  const calculateJointAngles = (data: PoseLandmarkerResult): JointAngle[] => {
    if (!data.landmarks || data.landmarks.length === 0) return [];
    
    const landmarks = data.landmarks[0];
    const angles: JointAngle[] = [];

    // 左肘関節角度（肩-肘-手首）
    const leftElbowAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_ELBOW],
      landmarks[LANDMARKS.LEFT_WRIST]
    );
    angles.push({ name: 'Left Elbow', angle: leftElbowAngle, side: 'left', type: 'arm' });

    // 右肘関節角度（肩-肘-手首）
    const rightElbowAngle = calculateAngle(
      landmarks[LANDMARKS.RIGHT_SHOULDER],
      landmarks[LANDMARKS.RIGHT_ELBOW],
      landmarks[LANDMARKS.RIGHT_WRIST]
    );
    angles.push({ name: 'Right Elbow', angle: rightElbowAngle, side: 'right', type: 'arm' });

    // 左肩関節角度（肘-肩-腰）
    const leftShoulderAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_ELBOW],
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_HIP]
    );
    angles.push({ name: 'Left Shoulder', angle: leftShoulderAngle, side: 'left', type: 'arm' });

    // 右肩関節角度（肘-肩-腰）
    const rightShoulderAngle = calculateAngle(
      landmarks[LANDMARKS.RIGHT_ELBOW],
      landmarks[LANDMARKS.RIGHT_SHOULDER],
      landmarks[LANDMARKS.RIGHT_HIP]
    );
    angles.push({ name: 'Right Shoulder', angle: rightShoulderAngle, side: 'right', type: 'arm' });

    // 左膝関節角度（腰-膝-足首）
    const leftKneeAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_HIP],
      landmarks[LANDMARKS.LEFT_KNEE],
      landmarks[LANDMARKS.LEFT_ANKLE]
    );
    angles.push({ name: 'Left Knee', angle: leftKneeAngle, side: 'left', type: 'leg' });

    // 右膝関節角度（腰-膝-足首）
    const rightKneeAngle = calculateAngle(
      landmarks[LANDMARKS.RIGHT_HIP],
      landmarks[LANDMARKS.RIGHT_KNEE],
      landmarks[LANDMARKS.RIGHT_ANKLE]
    );
    angles.push({ name: 'Right Knee', angle: rightKneeAngle, side: 'right', type: 'leg' });

    // 左股関節角度（肩-腰-膝）
    const leftHipAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_HIP],
      landmarks[LANDMARKS.LEFT_KNEE]
    );
    angles.push({ name: 'Left Hip', angle: leftHipAngle, side: 'left', type: 'leg' });

    // 右股関節角度（肩-腰-膝）
    const rightHipAngle = calculateAngle(
      landmarks[LANDMARKS.RIGHT_SHOULDER],
      landmarks[LANDMARKS.RIGHT_HIP],
      landmarks[LANDMARKS.RIGHT_KNEE]
    );
    angles.push({ name: 'Right Hip', angle: rightHipAngle, side: 'right', type: 'leg' });

    return angles;
  };

  // ポーズデータが更新されたら角度を計算
  useEffect(() => {
    if (poseData) {
      const angles = calculateJointAngles(poseData);
      setJointAngles(angles);
      setIsActive(true);
    } else {
      setJointAngles([]);
      setIsActive(false);
    }
  }, [poseData]);

  return (
    <Box sx={{ width, height, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ヘッダー */}
      <Card sx={{
        background: isActive ? blue[50] : '#f5f7fa',
        border: `1.5px solid ${isActive ? blue[500] : '#ddd'}`,
        borderRadius: 2,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <Assessment sx={{ color: isActive ? blue[500] : '#666' }} />
        <Typography variant="subtitle2" sx={{ 
          color: isActive ? blue[700] : '#666',
          fontWeight: 700,
          fontFamily: 'Orbitron, sans-serif'
        }}>
          Joint Angles
        </Typography>
        <Chip 
          label={isActive ? 'TRACKING' : 'WAITING'} 
          size="small"
          sx={{ 
            bgcolor: isActive ? blue[500] : '#ccc',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 'bold'
          }}
        />
      </Card>

      {jointAngles.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
          {/* 腕の関節 */}
          <Card sx={{ p: 1.2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUp sx={{ color: green[500], fontSize: '1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Arms
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr',
              gap: 1.8, // 間隔を少し広げる
              justifyItems: 'center',
              px: 1.5
            }}>
              {jointAngles
                .filter(joint => joint.type === 'arm')
                .map((joint, index) => (
                  <CircularAngle
                    key={index}
                    angle={joint.angle}
                    type={joint.type}
                    name={joint.name}
                    size={50}
                  />
                ))}
            </Box>
          </Card>

          {/* 脚の関節 */}
          <Card sx={{ p: 1.2, borderRadius: 2, flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUp sx={{ color: blue[500], fontSize: '1rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Legs
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr',
              gap: 1.8, // 間隔を少し広げる
              justifyItems: 'center',
              px: 1.5
            }}>
              {jointAngles
                .filter(joint => joint.type === 'leg')
                .map((joint, index) => (
                  <CircularAngle
                    key={index}
                    angle={joint.angle}
                    type={joint.type}
                    name={joint.name}
                    size={50}
                  />
                ))}
            </Box>
          </Card>
        </Box>
      )}

      {jointAngles.length === 0 && (
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
          <Assessment sx={{ fontSize: '2rem', mb: 1, color: '#ccc' }} />
          <Typography variant="body2" sx={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Waiting for pose data...
          </Typography>
          <Typography variant="caption" sx={{ textAlign: 'center', fontSize: '0.7rem', mt: 0.5 }}>
            Start tracking to see joint angles
          </Typography>
        </Card>
      )}
    </Box>
  );
} 