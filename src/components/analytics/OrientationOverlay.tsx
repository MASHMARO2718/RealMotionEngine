/**
 * Orientation Overlay Component
 * Displays real-time pose analytics data over the video feed
 */

import React from 'react';
import { Box, Typography, Chip, Paper, LinearProgress } from '@mui/material';
import { blue, green, orange, red, cyan, purple } from '@mui/material/colors';

import type { FullPoseAnalysis } from '../../lib/analytics/PoseAnalytics';

interface OrientationOverlayProps {
  analysis: FullPoseAnalysis | null;
  width: number;
  height: number;
  showFloorInfo?: boolean;
  showJointAngles?: boolean;
  showHandOrientation?: boolean;
  showBodyDirection?: boolean;
  showCenterOfMass?: boolean;
  showPostureStability?: boolean;
  className?: string;
}

export default function OrientationOverlay({
  analysis,
  width,
  height,
  showFloorInfo = true,
  showJointAngles = true,
  showHandOrientation = true,
  showBodyDirection = true,
  showCenterOfMass = true,
  showPostureStability = true,
  className = ''
}: OrientationOverlayProps) {
  
  if (!analysis || !analysis.isValid) {
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
        <Paper 
          elevation={3} 
          sx={{ 
            p: 2, 
            backgroundColor: 'rgba(0,0,0,0.8)', 
            color: 'white',
            borderRadius: 2
          }}
        >
          <Typography variant="body2">
            📊 Pose Analytics Initializing...
          </Typography>
        </Paper>
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
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Top Left: Floor Detection Info */}
      {showFloorInfo && (
        <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 1.5, 
              backgroundColor: 'rgba(0,0,0,0.85)', 
              color: 'white',
              borderRadius: 2,
              minWidth: 200
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: cyan[300] }}>
              🏠 Floor Detection
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" sx={{ minWidth: 80 }}>Confidence:</Typography>
              <LinearProgress 
                variant="determinate" 
                value={analysis.floorDetection.confidence * 100}
                sx={{ 
                  flex: 1, 
                  height: 6, 
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: analysis.floorDetection.confidence > 0.7 ? green[400] : 
                                   analysis.floorDetection.confidence > 0.4 ? orange[400] : red[400]
                  }
                }} 
              />
              <Typography variant="caption" sx={{ minWidth: 35 }}>
                {(analysis.floorDetection.confidence * 100).toFixed(0)}%
              </Typography>
            </Box>
            
            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
              Normal: ({analysis.floorDetection.floorNormal.x.toFixed(2)}, {analysis.floorDetection.floorNormal.y.toFixed(2)}, {analysis.floorDetection.floorNormal.z.toFixed(2)})
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Top Right: Joint Angles */}
      {showJointAngles && (
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 1.5, 
              backgroundColor: 'rgba(0,0,0,0.85)', 
              color: 'white',
              borderRadius: 2,
              minWidth: 200
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: orange[300] }}>
              🦴 Joint Angles
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
              {Object.entries(analysis.jointAngles).map(([jointName, jointData]) => (
                <Box key={jointName} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                    {jointName.replace(/([A-Z])/g, ' $1').trim()}:
                  </Typography>
                  <Chip 
                    label={jointData.isValid ? `${Math.round(jointData.angle)}°` : 'N/A'}
                    size="small"
                    sx={{ 
                      height: 18,
                      fontSize: '0.6rem',
                      backgroundColor: jointData.isValid ? green[700] : red[700],
                      color: 'white'
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Bottom Left: Hand Orientation */}
      {showHandOrientation && (analysis.handOrientation.leftHand || analysis.handOrientation.rightHand) && (
        <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 1.5, 
              backgroundColor: 'rgba(0,0,0,0.85)', 
              color: 'white',
              borderRadius: 2,
              minWidth: 180
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: purple[300] }}>
              🤚 Hand Orientation
            </Typography>
            
            {analysis.handOrientation.leftHand && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Left: 
                  <Chip 
                    label={analysis.handOrientation.leftHand.side}
                    size="small"
                    sx={{ 
                      ml: 0.5,
                      height: 16,
                      fontSize: '0.6rem',
                      backgroundColor: analysis.handOrientation.leftHand.side === 'palm' ? green[700] : 
                                     analysis.handOrientation.leftHand.side === 'back' ? blue[700] : 'gray',
                      color: 'white'
                    }}
                  />
                  {analysis.handOrientation.leftHand.roll !== 0 && (
                    <Typography component="span" sx={{ ml: 0.5, fontSize: '0.6rem', opacity: 0.8 }}>
                      Roll: {Math.round(analysis.handOrientation.leftHand.roll)}°
                    </Typography>
                  )}
                </Typography>
              </Box>
            )}
            
            {analysis.handOrientation.rightHand && (
              <Box>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  Right: 
                  <Chip 
                    label={analysis.handOrientation.rightHand.side}
                    size="small"
                    sx={{ 
                      ml: 0.5,
                      height: 16,
                      fontSize: '0.6rem',
                      backgroundColor: analysis.handOrientation.rightHand.side === 'palm' ? green[700] : 
                                     analysis.handOrientation.rightHand.side === 'back' ? blue[700] : 'gray',
                      color: 'white'
                    }}
                  />
                  {analysis.handOrientation.rightHand.roll !== 0 && (
                    <Typography component="span" sx={{ ml: 0.5, fontSize: '0.6rem', opacity: 0.8 }}>
                      Roll: {Math.round(analysis.handOrientation.rightHand.roll)}°
                    </Typography>
                  )}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Bottom Center: Body Direction */}
      {showBodyDirection && analysis.bodyDirection.confidence > 0.3 && (
        <Box sx={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 1.5, 
              backgroundColor: 'rgba(0,0,0,0.85)', 
              color: 'white',
              borderRadius: 2,
              textAlign: 'center',
              minWidth: 150
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'bold', color: blue[300] }}>
              🧭 Body Direction
            </Typography>
            
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: blue[100] }}>
              {Math.round(analysis.bodyDirection.angle)}°
            </Typography>
            
            <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
              Confidence: {(analysis.bodyDirection.confidence * 100).toFixed(0)}%
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Bottom Right: Center of Mass & Posture */}
      {(showCenterOfMass || showPostureStability) && (
        <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 1.5, 
              backgroundColor: 'rgba(0,0,0,0.85)', 
              color: 'white',
              borderRadius: 2,
              minWidth: 200
            }}
          >
            {showPostureStability && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: green[300] }}>
                  🏃 Posture Stability
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="caption" sx={{ minWidth: 60 }}>Score:</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={analysis.postureStability.score * 100}
                    sx={{ 
                      flex: 1, 
                      height: 6, 
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: analysis.postureStability.score > 0.8 ? green[400] : 
                                       analysis.postureStability.score > 0.6 ? orange[400] : red[400]
                      }
                    }} 
                  />
                  <Typography variant="caption" sx={{ minWidth: 35 }}>
                    {(analysis.postureStability.score * 100).toFixed(0)}%
                  </Typography>
                </Box>
                
                {analysis.postureStability.riskFactors.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    {analysis.postureStability.riskFactors.slice(0, 2).map((risk, index) => (
                      <Chip 
                        key={index}
                        label={risk}
                        size="small"
                        sx={{ 
                          height: 16,
                          fontSize: '0.6rem',
                          backgroundColor: red[700],
                          color: 'white',
                          mr: 0.5,
                          mb: 0.5
                        }}
                      />
                    ))}
                  </Box>
                )}
              </>
            )}
            
            {showCenterOfMass && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 'bold', color: cyan[300] }}>
                  ⚖️ Center of Mass
                </Typography>
                
                <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8, display: 'block' }}>
                  Velocity: {(Math.sqrt(
                    analysis.centerOfMass.velocity.x ** 2 + 
                    analysis.centerOfMass.velocity.y ** 2 + 
                    analysis.centerOfMass.velocity.z ** 2
                  ) * 100).toFixed(1)} cm/frame
                </Typography>
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* Center: Overall Confidence Indicator */}
      <Box sx={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)' }}>
        <Paper 
          elevation={2} 
          sx={{ 
            p: 1, 
            backgroundColor: 'rgba(0,0,0,0.85)', 
            color: 'white',
            borderRadius: '50%',
            width: 60,
            height: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            fontSize: '1rem',
            color: analysis.confidence > 0.8 ? green[300] : 
                   analysis.confidence > 0.5 ? orange[300] : red[300]
          }}>
            {(analysis.confidence * 100).toFixed(0)}%
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8 }}>
            Overall
          </Typography>
        </Paper>
      </Box>

      {/* Footwork visualization (if stance is interesting) */}
      {analysis.footwork.stance !== 'neutral' && (
        <Box sx={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)' }}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 1, 
              backgroundColor: 'rgba(0,0,0,0.85)', 
              color: 'white',
              borderRadius: 2,
              textAlign: 'center'
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 'bold', color: cyan[300] }}>
              👣 Stance
            </Typography>
            <Typography variant="body2" sx={{ 
              fontWeight: 'bold',
              color: analysis.footwork.stance === 'wide' ? green[300] : 
                     analysis.footwork.stance === 'narrow' ? orange[300] : 'white'
            }}>
              {analysis.footwork.stance.toUpperCase()}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
} 