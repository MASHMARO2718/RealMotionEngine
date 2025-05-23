'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import Box from '@mui/material/Box';
import DummyBox from '../../components/layout/DummyBox';
import FetchDemo from '../../components/FetchDemo';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

// クライアントサイドのみでレンダリングする必要がある
const MultiTracker = dynamic(
  () => import('../../components/multi/MultiTracker'),
  { ssr: false }
);

const ModelViewer = dynamic(
  () => import('../../components/three/ModelViewer'),
  { ssr: false }
);

export default function MultiTrackingPage() {
  const [poseData, setPoseData] = useState<PoseLandmarkerResult | null>(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', p: 4, pl: 12, minHeight: '100vh', background: '#fff', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
      <Box sx={{ width: 560, minWidth: 560, maxWidth: 560, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MultiTracker 
          width={560} 
          height={420} 
          onPoseDetected={setPoseData} 
        />
      </Box>
      <Box sx={{ width: 560, minWidth: 560, maxWidth: 560, ml: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <ModelViewer 
          width={560} 
          height={420} 
          poseData={poseData}
        />
        <DummyBox label={"Recorder UI"} width={560} height={120} sx={{ mt: 2 }} />
      </Box>
      <Box sx={{ width: 220, minWidth: 220, maxWidth: 220, ml: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <DummyBox label={"Analyzed body data"} width={220} height={540} />
        <Box sx={{ mt: 2, width: '100%' }}>
          <FetchDemo />
        </Box>
      </Box>
    </Box>
  );
} 