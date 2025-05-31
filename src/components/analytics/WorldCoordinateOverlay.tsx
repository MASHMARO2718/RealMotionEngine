/**
 * World Coordinate Overlay Component
 * Displays real-time world coordinate information
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { cyan, green, orange, purple } from '@mui/material/colors';
import type { Vec3, PolarCoordinate, SphericalCoordinate } from '../../utils/coordinateTransform';

interface WorldCoordinateOverlayProps {
  worldPose: { [key: string]: Vec3 } | null;
  polarPose?: { [key: string]: PolarCoordinate } | null;
  sphericalPose?: { [key: string]: SphericalCoordinate } | null;
  isInitialized: boolean;
  bodyCenter: Vec3 | null;
  origin: { x: number; y: number; z: number } | null;
  width: number;
  height: number;
  className?: string;
  showPolarCoordinates?: boolean;
}

export default function WorldCoordinateOverlay({
  worldPose,
  polarPose,
  sphericalPose,
  isInitialized,
  bodyCenter,
  origin,
  width,
  height,
  className = '',
  showPolarCoordinates = false
}: WorldCoordinateOverlayProps) {
  
  if (!isInitialized || !worldPose) {
    return (
      <Box
        className={className}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: orange[500],
            fontFamily: 'Orbitron, monospace',
            fontWeight: 700,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0,0,0,0.5)',
            px: 2,
            py: 1,
            borderRadius: 1
          }}
        >
          🌍 Initializing World Coordinates...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className={className}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none'
      }}
    >
      {/* World Origin Info (top-left) */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: 1,
          p: 1,
          minWidth: 200
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: cyan[400],
            fontFamily: 'Orbitron, monospace',
            fontWeight: 700,
            fontSize: '0.7rem',
            display: 'block'
          }}
        >
          🌍 WORLD ORIGIN
        </Typography>
        {origin && (
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            X: {origin.x.toFixed(3)}m
          </Typography>
        )}
        {origin && (
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            Y: {origin.y.toFixed(3)}m
          </Typography>
        )}
        {origin && (
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            Z: {origin.z.toFixed(3)}m
          </Typography>
        )}
      </Box>

      {/* Body Center Position (top-right) */}
      {bodyCenter && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: 1,
            p: 1,
            minWidth: 180
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: green[400],
              fontFamily: 'Orbitron, monospace',
              fontWeight: 700,
              fontSize: '0.7rem',
              display: 'block'
            }}
          >
            🎯 BODY CENTER
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            X: {bodyCenter.x.toFixed(3)}m
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            Y: {bodyCenter.y.toFixed(3)}m
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            Z: {bodyCenter.z.toFixed(3)}m
          </Typography>
        </Box>
      )}

      {/* Key Landmarks Position (bottom-left) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: 1,
          p: 1,
          maxWidth: 300,
          maxHeight: 200,
          overflow: 'auto'
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: purple[400],
            fontFamily: 'Orbitron, monospace',
            fontWeight: 700,
            fontSize: '0.7rem',
            display: 'block',
            mb: 0.5
          }}
        >
          📍 KEY LANDMARKS
        </Typography>
        
        {/* Show main body landmarks */}
        {['nose', 'leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee'].map(landmarkName => {
          const landmark = worldPose[landmarkName];
          if (!landmark) return null;
          
          return (
            <Typography
              key={landmarkName}
              variant="caption"
              sx={{
                color: 'white',
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                display: 'block'
              }}
            >
              {landmarkName}: ({landmark.x.toFixed(2)}, {landmark.y.toFixed(2)}, {landmark.z.toFixed(2)})
            </Typography>
          );
        })}
      </Box>

      {/* 🎯 NEW: Polar Coordinates Display (center-left) */}
      {showPolarCoordinates && polarPose && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: 8,
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 1,
            p: 1,
            maxWidth: 350,
            maxHeight: 300,
            overflow: 'auto',
            border: `2px solid ${orange[500]}`
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: orange[400],
              fontFamily: 'Orbitron, monospace',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'block',
              mb: 1
            }}
          >
            🎯 POLAR COORDINATES
          </Typography>
          
          {/* Show key landmarks in polar coordinates */}
          {['nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee'].map(landmarkName => {
            const polar = polarPose[landmarkName];
            if (!polar) return null;
            
            const thetaDeg = (polar.theta * 180 / Math.PI).toFixed(1);
            const phiDeg = (polar.phi * 180 / Math.PI).toFixed(1);
            
            return (
              <Typography
                key={landmarkName}
                variant="caption"
                sx={{
                  color: 'white',
                  fontFamily: 'monospace',
                  fontSize: '0.6rem',
                  display: 'block'
                }}
              >
                {landmarkName}: r={polar.r.toFixed(2)}m θ={thetaDeg}° φ={phiDeg}°
              </Typography>
            );
          })}
        </Box>
      )}

      {/* Statistics (bottom-right) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: 1,
          p: 1,
          minWidth: 150
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: orange[400],
            fontFamily: 'Orbitron, monospace',
            fontWeight: 700,
            fontSize: '0.7rem',
            display: 'block'
          }}
        >
          📊 STATS
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '0.65rem',
            display: 'block'
          }}
        >
          Landmarks: {Object.keys(worldPose).length}
        </Typography>
        
        {/* Distance from origin */}
        {bodyCenter && origin && (
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              display: 'block'
            }}
          >
            Distance: {Math.sqrt(
              Math.pow(bodyCenter.x - origin.x, 2) +
              Math.pow(bodyCenter.y - origin.y, 2) +
              Math.pow(bodyCenter.z - origin.z, 2)
            ).toFixed(2)}m
          </Typography>
        )}
      </Box>
    </Box>
  );
} 