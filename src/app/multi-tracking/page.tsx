'use client';

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import BodyDataAnalyzer from '../../components/analysis/BodyDataAnalyzer';
import JointAngleAnalyzer from '../../components/analysis/JointAngleAnalyzer';
import AngleAdjustmentPanel from '../../components/controls/AngleAdjustmentPanel';

// クライアントサイドのみでレンダリングする必要がある
const MultiTrackerWithLockOn = dynamic(
  () => import('../../components/multi/MultiTrackerWithLockOn'),
  { ssr: false }
);

const ModelViewer = dynamic(
  () => import('../../components/three/ModelViewer'),
  { ssr: false }
);

export default function MultiTrackingPage() {
  const [poseData, setPoseData] = useState<PoseLandmarkerResult | null>(null);
  const [showAxes, setShowAxes] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [legCorrectionMode, setLegCorrectionMode] = useState<'full' | 'partial'>('full');
  const [angleAdjustments, setAngleAdjustments] = useState<Record<string, { omega: number; phi: number }>>({});

  return (
    <Box sx={{ 
      width: '100vw',
      height: '100vh',
      overflowX: 'auto',
      overflowY: 'auto',
      background: '#fff'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'row', 
        p: 4, 
        pl: 12, 
        width: 'max(100vw, 1640px)',
        minHeight: 'calc(100vh - 32px)',
        alignItems: 'flex-start', 
        justifyContent: 'flex-start',
        gap: 4
      }}>
        {/* 左側：カメラとトラッキング（コンパクト化） */}
        <Box sx={{ width: 480, minWidth: 480, maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <MultiTrackerWithLockOn 
            width={480} 
            height={360} 
            onPoseDetected={setPoseData}
            lockOnEnabled={true}
          />
        </Box>
        
        {/* 中央：3Dモデルビューとデータ分析 */}
        <Box sx={{ width: 680, minWidth: 680, maxWidth: 680, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {/* 3D表示制御 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Button
              variant={showAxes ? "contained" : "outlined"}
              size="small"
              onClick={() => setShowAxes(!showAxes)}
              color={showAxes ? "primary" : "inherit"}
            >
              {showAxes ? "🎯 XYZ軸: ON" : "🎯 XYZ軸: OFF"}
            </Button>
            <Button
              variant={showAngles ? "contained" : "outlined"}
              size="small"
              onClick={() => setShowAngles(!showAngles)}
              color={showAngles ? "secondary" : "inherit"}
            >
              {showAngles ? "📐 角度弧: ON" : "📐 角度弧: OFF"}
            </Button>
          </Box>
          
          {/* 3Dモデルビュー */}
          <ModelViewer 
            width={680} 
            height={420} 
            poseData={poseData}
            showAxes={showAxes}
            showAngles={showAngles}
            legCorrectionMode={legCorrectionMode}
            onLegCorrectionModeChange={setLegCorrectionMode}
            angleAdjustments={angleAdjustments}
          />
          
          {/* データ分析コンポーネント群 */}
          <Box sx={{ 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'row', 
            gap: 2,
            flexWrap: 'nowrap',
            alignItems: 'flex-start'
          }}>
            <Box sx={{ width: 330, minWidth: 330 }}>
              <JointAngleAnalyzer 
                poseData={poseData}
                width={330} 
                height={500} 
              />
            </Box>
            <Box sx={{ width: 300, minWidth: 300 }}>
              <BodyDataAnalyzer 
                poseData={poseData}
                width={300} 
                height={450} 
              />
            </Box>
          </Box>
        </Box>

        {/* 右側：角度調整パネル */}
        <Box sx={{ width: 280, minWidth: 280, maxWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AngleAdjustmentPanel 
            width={280}
            height={800}
            onAdjustmentChange={setAngleAdjustments}
          />
        </Box>
      </Box>
    </Box>
  );
} 