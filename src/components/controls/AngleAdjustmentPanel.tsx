'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { useState, useEffect } from 'react';

interface AngleAdjustments {
  [key: string]: {
    omega: number;
    phi: number;
  };
}

interface AngleAdjustmentPanelProps {
  width?: number;
  height?: number;
  onAdjustmentChange?: (adjustments: AngleAdjustments) => void;
}

const jointNames = [
  { key: 'leftShoulder', label: '左肩', color: '#4caf50' },
  { key: 'rightShoulder', label: '右肩', color: '#8bc34a' },
  { key: 'leftElbow', label: '左肘', color: '#ff5722' },
  { key: 'rightElbow', label: '右肘', color: '#ff9800' },
  { key: 'leftWrist', label: '左手首', color: '#e91e63' },
  { key: 'rightWrist', label: '右手首', color: '#f06292' },
  { key: 'leftHip', label: '左腰', color: '#9c27b0' },
  { key: 'rightHip', label: '右腰', color: '#ba68c8' },
  { key: 'leftKnee', label: '左膝', color: '#2196f3' },
  { key: 'rightKnee', label: '右膝', color: '#64b5f6' },
  { key: 'leftAnkle', label: '左足首', color: '#ff9800' },
  { key: 'rightAnkle', label: '右足首', color: '#ffb74d' },
];

export default function AngleAdjustmentPanel({ 
  width = 280, 
  height = 800, 
  onAdjustmentChange 
}: AngleAdjustmentPanelProps) {
  const [adjustments, setAdjustments] = useState<AngleAdjustments>(() => {
    const initial: AngleAdjustments = {};
    jointNames.forEach(joint => {
      initial[joint.key] = { omega: 0, phi: 0 };
    });
    return initial;
  });

  const handleSliderChange = (jointKey: string, angleType: 'omega' | 'phi', value: number) => {
    const newAdjustments = {
      ...adjustments,
      [jointKey]: {
        ...adjustments[jointKey],
        [angleType]: value
      }
    };
    setAdjustments(newAdjustments);
    onAdjustmentChange?.(newAdjustments);
  };

  const formatAngle = (degrees: number) => {
    return `${degrees > 0 ? '+' : ''}${degrees}°`;
  };

  return (
    <Paper sx={{ 
      width, 
      height, 
      p: 2, 
      overflowY: 'auto',
      backgroundColor: '#f8f9fa',
      border: '1px solid #e0e0e0'
    }}>
      <Typography variant="h6" sx={{ 
        mb: 2, 
        textAlign: 'center', 
        color: '#333',
        fontWeight: 'bold',
        fontSize: '16px'
      }}>
        🎛️ 角度補正調整
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {jointNames.map((joint) => (
          <Paper key={joint.key} sx={{ 
            p: 1.5, 
            backgroundColor: '#fff',
            border: `2px solid ${joint.color}`,
            borderRadius: 2
          }}>
            <Typography variant="subtitle2" sx={{ 
              mb: 1, 
              color: joint.color, 
              fontWeight: 'bold',
              fontSize: '13px'
            }}>
              {joint.label}
            </Typography>
            
            {/* Omega調整スライダー */}
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#666', fontSize: '11px' }}>
                Ω (Omega): {formatAngle(adjustments[joint.key]?.omega || 0)}
              </Typography>
              <Slider
                value={adjustments[joint.key]?.omega || 0}
                onChange={(_, value) => handleSliderChange(joint.key, 'omega', value as number)}
                min={-180}
                max={180}
                step={5}
                size="small"
                sx={{
                  color: joint.color,
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                  },
                  '& .MuiSlider-track': {
                    height: 3,
                  },
                  '& .MuiSlider-rail': {
                    height: 3,
                    opacity: 0.3,
                  },
                }}
              />
            </Box>
            
            {/* Phi調整スライダー */}
            <Box>
              <Typography variant="caption" sx={{ color: '#666', fontSize: '11px' }}>
                Φ (Phi): {formatAngle(adjustments[joint.key]?.phi || 0)}
              </Typography>
              <Slider
                value={adjustments[joint.key]?.phi || 0}
                onChange={(_, value) => handleSliderChange(joint.key, 'phi', value as number)}
                min={-180}
                max={180}
                step={5}
                size="small"
                sx={{
                  color: joint.color,
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                  },
                  '& .MuiSlider-track': {
                    height: 3,
                  },
                  '& .MuiSlider-rail': {
                    height: 3,
                    opacity: 0.3,
                  },
                }}
              />
            </Box>
          </Paper>
        ))}
      </Box>
      
      {/* リセットボタン */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <button
          onClick={() => {
            const resetAdjustments: AngleAdjustments = {};
            jointNames.forEach(joint => {
              resetAdjustments[joint.key] = { omega: 0, phi: 0 };
            });
            setAdjustments(resetAdjustments);
            onAdjustmentChange?.(resetAdjustments);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ff5722',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          🔄 リセット
        </button>
      </Box>
    </Paper>
  );
} 