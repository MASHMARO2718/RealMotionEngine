/**
 * Enhanced Avatar Viewer
 * Complete demonstration of pose analytics to Three.js avatar animation pipeline
 */

import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { Box, Card, Typography, Button, Slider, FormControlLabel, Switch, Alert } from '@mui/material';
import * as THREE from 'three';

import type { FullPoseAnalysis } from '../../lib/analytics/PoseAnalytics';
import { PoseDriver } from '../../three/PoseDriver';
import { useAvatarPose } from '../../hooks/useAvatarPose';
import { FloorHelper } from '../../three/helpers/FloorHelper';

interface EnhancedAvatarViewerProps {
  width?: number;
  height?: number;
  analysis: FullPoseAnalysis | null;
  avatarUrl?: string;
  enableDebug?: boolean;
}

function AvatarScene({ 
  analysis, 
  avatarPose, 
  showFloorHelper, 
  floorHelperConfig 
}: { 
  analysis: FullPoseAnalysis | null;
  avatarPose: ReturnType<typeof useAvatarPose>;
  showFloorHelper: boolean;
  floorHelperConfig: any;
}) {
  const floorHelperRef = useRef<FloorHelper>(null);

  // Update floor helper when analysis changes
  React.useEffect(() => {
    if (floorHelperRef.current && analysis) {
      floorHelperRef.current.updateFromAnalysis(analysis);
    }
  }, [analysis]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      
      {/* Environment */}
      <Environment preset="apartment" />
      
      {/* Floor Helper */}
      {showFloorHelper && (
        <primitive 
          ref={floorHelperRef}
          object={new FloorHelper(floorHelperConfig)} 
        />
      )}
      
      {/* Avatar with Pose Driver */}
      {avatarPose.avatar && (
        <PoseDriver 
          avatar={avatarPose.avatar}
          analysis={analysis}
          config={avatarPose.retargeter?.getDebugInfo()?.config}
          onError={(error) => console.error('PoseDriver error:', error)}
        />
      )}
      
      {/* Camera Controls */}
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        target={[0, 1, 0]}
      />
    </>
  );
}

export default function EnhancedAvatarViewer({
  width = 800,
  height = 600,
  analysis,
  avatarUrl = '/models/stickman.glb',
  enableDebug = false
}: EnhancedAvatarViewerProps) {
  
  // Avatar pose hook
  const avatarPose = useAvatarPose({
    avatarUrl,
    autoLoad: true,
    enableDebugLog: enableDebug,
    smoothingFactor: 0.3,
    enableFloorAlignment: true,
    enableBodyDirection: true,
    confidenceThreshold: 0.5
  });

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showFloorHelper, setShowFloorHelper] = useState(true);
  const [smoothingFactor, setSmoothingFactor] = useState(0.3);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);

  // Floor helper configuration
  const [floorHelperConfig, setFloorHelperConfig] = useState({
    gridSize: 10,
    gridDivisions: 20,
    showFloorPlane: true,
    showCenterOfMass: true,
    showFootPositions: true,
    showBodyDirection: true,
    floorOpacity: 0.3,
    colorScheme: 'default' as const
  });

  // Update configuration when sliders change
  React.useEffect(() => {
    avatarPose.updateConfig({
      smoothingFactor,
      confidenceThreshold
    });
  }, [smoothingFactor, confidenceThreshold, avatarPose]);

  return (
    <Box sx={{ width, height, display: 'flex', flexDirection: 'row' }}>
      {/* 3D Viewer */}
      <Box sx={{ flex: 1, position: 'relative', border: '1px solid #ddd', borderRadius: 1 }}>
        <Canvas
          camera={{ 
            position: [3, 2, 3], 
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          shadows
        >
          <AvatarScene 
            analysis={analysis}
            avatarPose={avatarPose}
            showFloorHelper={showFloorHelper}
            floorHelperConfig={floorHelperConfig}
          />
        </Canvas>
        
        {/* Loading/Error Overlay */}
        {avatarPose.isLoading && (
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            zIndex: 10
          }}>
            <Typography variant="h6">Loading Avatar...</Typography>
          </Box>
        )}
        
        {avatarPose.error && (
          <Alert 
            severity="error" 
            sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 10 }}
          >
            {avatarPose.error}
          </Alert>
        )}
      </Box>

      {/* Control Panel */}
      {showControls && (
        <Box sx={{ width: 300, p: 2, borderLeft: '1px solid #ddd' }}>
          <Typography variant="h6" gutterBottom>
            🎭 Avatar Controls
          </Typography>

          {/* Status */}
          <Card sx={{ p: 2, mb: 2, backgroundColor: avatarPose.isReady ? '#e8f5e8' : '#fff3e0' }}>
            <Typography variant="subtitle2" gutterBottom>
              Status: {avatarPose.isReady ? '✅ Ready' : '⏳ Loading'}
            </Typography>
            {avatarPose.avatar && (
              <Typography variant="caption">
                Bones: {avatarPose.avatar.bones.size} | 
                Mapped: {Object.keys(avatarPose.avatar.boneMapping).length}
              </Typography>
            )}
          </Card>

          {/* Performance Stats */}
          {enableDebug && avatarPose.debugInfo && (
            <Card sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                📊 Performance
              </Typography>
              <Typography variant="caption" component="div">
                Frames: {avatarPose.debugInfo.frameCount}
              </Typography>
              <Typography variant="caption" component="div">
                Avg Update: {avatarPose.debugInfo.averageUpdateTime.toFixed(2)}ms
              </Typography>
              <Typography variant="caption" component="div">
                Last Update: {avatarPose.debugInfo.lastUpdateTime.toFixed(2)}ms
              </Typography>
            </Card>
          )}

          {/* Pose Configuration */}
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚙️ Pose Settings
            </Typography>
            
            <Typography variant="caption" gutterBottom component="div">
              Smoothing Factor: {smoothingFactor.toFixed(2)}
            </Typography>
            <Slider
              value={smoothingFactor}
              onChange={(_, value) => setSmoothingFactor(value as number)}
              min={0.1}
              max={1.0}
              step={0.1}
              size="small"
              sx={{ mb: 2 }}
            />
            
            <Typography variant="caption" gutterBottom component="div">
              Confidence Threshold: {confidenceThreshold.toFixed(2)}
            </Typography>
            <Slider
              value={confidenceThreshold}
              onChange={(_, value) => setConfidenceThreshold(value as number)}
              min={0.1}
              max={0.9}
              step={0.1}
              size="small"
              sx={{ mb: 2 }}
            />

            <Button 
              variant="outlined" 
              size="small" 
              onClick={avatarPose.reset}
              fullWidth
            >
              🔄 Reset Pose
            </Button>
          </Card>

          {/* Floor Helper Controls */}
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              🏠 Floor Visualization
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={showFloorHelper}
                  onChange={(e) => setShowFloorHelper(e.target.checked)}
                  size="small"
                />
              }
              label="Show Floor Helper"
            />
            
            {showFloorHelper && (
              <Box sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={floorHelperConfig.showCenterOfMass}
                      onChange={(e) => setFloorHelperConfig(prev => ({
                        ...prev,
                        showCenterOfMass: e.target.checked
                      }))}
                      size="small"
                    />
                  }
                  label="Center of Mass"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={floorHelperConfig.showFootPositions}
                      onChange={(e) => setFloorHelperConfig(prev => ({
                        ...prev,
                        showFootPositions: e.target.checked
                      }))}
                      size="small"
                    />
                  }
                  label="Foot Positions"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={floorHelperConfig.showBodyDirection}
                      onChange={(e) => setFloorHelperConfig(prev => ({
                        ...prev,
                        showBodyDirection: e.target.checked
                      }))}
                      size="small"
                    />
                  }
                  label="Body Direction"
                />
              </Box>
            )}
          </Card>

          {/* Current Analysis Info */}
          {analysis && (
            <Card sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                📊 Current Analysis
              </Typography>
              
              <Typography variant="caption" component="div">
                Overall Confidence: {(analysis.confidence * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption" component="div">
                Floor Detection: {analysis.floorDetection.isValid ? '✅' : '❌'} 
                ({(analysis.floorDetection.confidence * 100).toFixed(1)}%)
              </Typography>
              <Typography variant="caption" component="div">
                Body Direction: {analysis.bodyDirection.angle.toFixed(1)}° 
                ({(analysis.bodyDirection.confidence * 100).toFixed(1)}%)
              </Typography>
              <Typography variant="caption" component="div">
                Posture Stability: {(analysis.postureStability.score * 100).toFixed(1)}%
              </Typography>
            </Card>
          )}
        </Box>
      )}

      {/* Toggle Controls Button */}
      <Button
        onClick={() => setShowControls(!showControls)}
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 100,
          minWidth: 40,
          backgroundColor: 'rgba(255,255,255,0.9)'
        }}
        variant="outlined"
        size="small"
      >
        {showControls ? '◀' : '▶'}
      </Button>
    </Box>
  );
} 