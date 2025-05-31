'use client';

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import BodyDataAnalyzer from '../../components/analysis/BodyDataAnalyzer';
import JointAngleAnalyzer from '../../components/analysis/JointAngleAnalyzer';

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
        width: 'max(100vw, 1340px)',
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
        
        {/* 右側：3Dモデルビューとデータ分析（拡大） */}
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
          </Box>
          
          {/* 3Dモデルビュー */}
          <ModelViewer 
            width={680} 
            height={420} 
            poseData={poseData}
            showAxes={showAxes}
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
      </Box>
    </Box>
  );
} 