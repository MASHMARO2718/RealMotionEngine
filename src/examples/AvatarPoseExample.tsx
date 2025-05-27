/**
 * Simple Avatar Pose Example
 * Demonstrates basic usage of the pose-to-avatar pipeline
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

import { PoseAnalyticsEngine } from '../lib/analytics/PoseAnalytics';
import { useAvatarPoseWithAnalytics } from '../hooks/useAvatarPose';
import { createPoseDriver } from '../three/PoseDriver';
import EnhancedAvatarViewer from '../components/three/EnhancedAvatarViewer';

// Example 1: Simple React Component Integration
export function SimpleAvatarPoseExample() {
  // This would come from your existing pose detection system
  const [currentAnalysis, setCurrentAnalysis] = React.useState(null);
  
  // Use the avatar pose hook with automatic analytics integration
  const avatarPose = useAvatarPoseWithAnalytics(currentAnalysis, {
    avatarUrl: '/models/stickman.glb',
    smoothingFactor: 0.3,
    enableFloorAlignment: true,
    enableBodyDirection: true,
    enableDebugLog: true
  });

  return (
    <Box sx={{ width: '100%', height: '500px' }}>
      <Typography variant="h6" gutterBottom>
        🎭 Simple Avatar Pose Example
      </Typography>
      
      {avatarPose.error && (
        <Typography color="error" gutterBottom>
          Error: {avatarPose.error}
        </Typography>
      )}
      
      <EnhancedAvatarViewer
        width={800}
        height={400}
        analysis={currentAnalysis}
        avatarUrl="/models/stickman.glb"
        enableDebug={true}
      />
    </Box>
  );
}

// Example 2: Standalone Usage (no React)
export async function createStandaloneAvatarSystem() {
  try {
    // Create pose analytics engine
    const poseAnalytics = new PoseAnalyticsEngine();
    
    // Create avatar pose driver
    const poseDriver = await createPoseDriver('/models/stickman.glb', {
      smoothingFactor: 0.3,
      enableFloorAlignment: true,
      enableBodyDirection: true,
      confidenceThreshold: 0.5
    });
    
    console.log('✅ Standalone avatar system created:', {
      analytics: poseAnalytics,
      driver: poseDriver.getDebugInfo()
    });
    
    return { poseAnalytics, poseDriver };
  } catch (error) {
    console.error('❌ Failed to create standalone system:', error);
    throw error;
  }
}

// Example 3: Integration with existing MediaPipe pose stream
export function integrateWithExistingPoseStream(
  poseStream: any, // Your existing pose stream
  avatarUrl: string = '/models/stickman.glb'
) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create the system
      const { poseAnalytics, poseDriver } = await createStandaloneAvatarSystem();
      
      // Connect to your pose stream
      poseStream.on('frame', (poseResult: any) => {
        try {
          // Analyze the pose frame
          const analysis = poseAnalytics.analyzeFrame(poseResult, undefined, Date.now());
          
          // Update avatar
          poseDriver.update(analysis);
          
        } catch (error) {
          console.error('Frame processing error:', error);
        }
      });
      
      resolve({ poseAnalytics, poseDriver });
    } catch (error) {
      reject(error);
    }
  });
}

// Example usage in your existing MultiTrackerWithLockOn component:
/*
// In MultiTrackerWithLockOn.tsx, add this to your pose detection success handler:

import { PoseAnalyticsEngine } from '../../lib/analytics/PoseAnalytics';
import { createPoseDriver } from '../../three/PoseDriver';

// Add these to your component state:
const [poseAnalytics] = useState(() => new PoseAnalyticsEngine());
const [avatarDriver, setAvatarDriver] = useState(null);

// Initialize avatar driver:
useEffect(() => {
  createPoseDriver('/models/stickman.glb').then(driver => {
    setAvatarDriver(driver);
  });
}, []);

// In your pose detection success block:
if (result && result.landmarks && result.landmarks.length > 0) {
  // Existing code...
  
  // Add pose analytics:
  if (poseAnalytics && avatarDriver) {
    const analysis = poseAnalytics.analyzeFrame(result, undefined, Math.floor(timestamp));
    avatarDriver.update(analysis);
  }
  
  // Rest of existing code...
}
*/

export default SimpleAvatarPoseExample; 