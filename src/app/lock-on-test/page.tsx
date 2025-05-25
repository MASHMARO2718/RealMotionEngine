'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

// クライアントサイドのみでレンダリングする必要がある
const MultiTrackerWithLockOn = dynamic(
  () => import('../../components/multi/MultiTrackerWithLockOn'),
  { ssr: false }
);

export default function LockOnTestPage() {
  const [poseData, setPoseData] = useState<PoseLandmarkerResult | null>(null);
  const [lockOnStats, setLockOnStats] = useState({
    detectionCount: 0,
    lockCount: 0,
    lostCount: 0
  });

  const handlePoseDetected = (result: PoseLandmarkerResult) => {
    setPoseData(result);
    setLockOnStats(prev => ({
      ...prev,
      detectionCount: prev.detectionCount + 1
    }));
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      p: 4, 
      minHeight: '100vh', 
      background: '#f5f7fa',
      alignItems: 'center',
      gap: 3
    }}>
      <Typography variant="h4" sx={{ 
        color: '#1976d2', 
        fontWeight: 700, 
        fontFamily: 'Orbitron, sans-serif',
        mb: 2
      }}>
        Lock-On System Test
      </Typography>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'row', 
        gap: 4,
        alignItems: 'flex-start'
      }}>
        {/* Lock-On Tracker */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <MultiTrackerWithLockOn 
            width={640} 
            height={480} 
            onPoseDetected={handlePoseDetected}
            lockOnEnabled={true}
          />
        </Box>

        {/* Statistics Panel */}
        <Card sx={{ 
          p: 3, 
          minWidth: 300,
          background: '#fff',
          border: '1.5px solid #e3e3e3',
          boxShadow: '0 0 24px #e3e3e322'
        }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', fontWeight: 600 }}>
            Lock-On Statistics
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Pose Detections:
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {lockOnStats.detectionCount}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Lock Acquisitions:
              </Typography>
              <Typography variant="body2" fontWeight={600} color="success.main">
                {lockOnStats.lockCount}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Lock Losses:
              </Typography>
              <Typography variant="body2" fontWeight={600} color="error.main">
                {lockOnStats.lostCount}
              </Typography>
            </Box>
          </Box>

          {poseData && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2' }}>
                Latest Pose Data
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Landmarks: {poseData.landmarks?.[0]?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Timestamp: {new Date().toLocaleTimeString()}
              </Typography>
            </Box>
          )}
        </Card>
      </Box>

      <Card sx={{ 
        p: 3, 
        maxWidth: 800,
        background: '#fff',
        border: '1.5px solid #e3e3e3'
      }}>
        <Typography variant="h6" sx={{ mb: 2, color: '#1976d2' }}>
          Test Instructions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          1. <strong>SEARCHING</strong>: Stand in front of the camera. The system will show a yellow rectangle when detecting a person.<br/>
          2. <strong>LOCKING</strong>: Stay still for a few seconds. The rectangle will start pinging as it locks onto you.<br/>
          3. <strong>LOCKED</strong>: You&apos;ll hear a beep and see a green pulsing rectangle. The system is now tracking you.<br/>
          4. <strong>LOST</strong>: Move out of frame or cover the camera. You&apos;ll hear two low boops and see a red blinking rectangle.<br/>
          5. Use the &quot;Reacquire Target&quot; button to reset the system back to searching mode.
        </Typography>
      </Card>
    </Box>
  );
} 