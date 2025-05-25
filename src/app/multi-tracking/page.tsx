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

// DummyBoxも動的インポートにしておく
const DummyBox = dynamic(
  () => import('../../components/layout/DummyBox'),
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
        width: 'max(100vw, 1470px)',
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
          <DummyBox label={"Recorder UI"} width={560} height={120} sx={{ mt: 2 }} />
        </Box>
        <Box sx={{ width: 350, minWidth: 350, maxWidth: 350, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <BodyDataAnalyzer 
            poseData={poseData}
            width={350} 
            height={320} 
          />
          <Box sx={{ mt: 2, width: '100%' }}>
            <JointAngleAnalyzer 
              poseData={poseData}
              width={350} 
              height={400} 
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
} 