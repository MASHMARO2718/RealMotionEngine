'use client';

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import Box from '@mui/material/Box';
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
        width: 'max(100vw, 1600px)',
        minHeight: 'calc(100vh - 32px)',
        alignItems: 'flex-start', 
        justifyContent: 'flex-start',
        gap: 4
      }}>
        <Box sx={{ width: 560, minWidth: 560, maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <MultiTrackerWithLockOn 
            width={560} 
            height={420} 
            onPoseDetected={setPoseData}
            lockOnEnabled={true}
          />
        </Box>
        <Box sx={{ width: 560, minWidth: 560, maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ModelViewer 
            width={560} 
            height={420} 
            poseData={poseData}
          />
        </Box>
        <Box sx={{ width: 480, minWidth: 480, maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <BodyDataAnalyzer 
            poseData={poseData}
            width={480} 
            height={580} 
          />
          <JointAngleAnalyzer 
            poseData={poseData}
            width={480} 
            height={320} 
          />
        </Box>
      </Box>
    </Box>
  );
} 