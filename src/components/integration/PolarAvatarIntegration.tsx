import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Box, FormControlLabel, Paper, Switch, Typography } from '@mui/material';
import React, { useState } from 'react';

import PolarAvatarViewer from '../three/PolarAvatarViewer';

interface PolarAvatarIntegrationProps {
  poseData?: PoseLandmarkerResult | null;
  width?: number;
  height?: number;
}

export default function PolarAvatarIntegration({ 
  poseData, 
  width = 800, 
  height = 600 
}: PolarAvatarIntegrationProps) {
  const [showGrid, setShowGrid] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // ポーズデータの統計を計算
  const poseStats = React.useMemo(() => {
    if (!poseData?.landmarks?.[0]) return null;
    
    const landmarks = poseData.landmarks[0];
    const visibleCount = landmarks.filter(l => (l.visibility || 0) > 0.5).length;
    const avgConfidence = landmarks.reduce((sum, l) => sum + (l.visibility || 0), 0) / landmarks.length;
    
    return {
      totalLandmarks: landmarks.length,
      visibleLandmarks: visibleCount,
      averageConfidence: avgConfidence,
      hasValidPose: avgConfidence > 0.3 && visibleCount > 20
    };
  }, [poseData]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        🌟 Polar 3D Avatar Integration
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* 3Dビューワー */}
        <Box sx={{ flex: '1 1 60%', minWidth: 400 }}>
          <Paper elevation={3} sx={{ p: 1 }}>
            <PolarAvatarViewer 
              width={width * 0.7}
              height={height * 0.8}
              poseData={poseData}
              showGrid={showGrid}
            />
          </Paper>
        </Box>

        {/* コントロールパネル */}
        <Box sx={{ flex: '1 1 35%', minWidth: 300 }}>
          <Paper elevation={2} sx={{ p: 2, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom>
              🎛️ 設定
            </Typography>
            
            <FormControlLabel
              control={
                <Switch 
                  checked={showGrid} 
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
              }
              label="グリッド表示"
            />
            
            <FormControlLabel
              control={
                <Switch 
                  checked={showStats} 
                  onChange={(e) => setShowStats(e.target.checked)}
                />
              }
              label="統計表示"
            />

            {/* ポーズ統計 */}
            {showStats && poseStats && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  📊 ポーズ統計
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>総ランドマーク:</strong> {poseStats.totalLandmarks}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>可視ランドマーク:</strong> {poseStats.visibleLandmarks}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>平均信頼度:</strong> {(poseStats.averageConfidence * 100).toFixed(1)}%
                </Typography>
                
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: poseStats.hasValidPose ? 'success.main' : 'error.main',
                    fontWeight: 'bold'
                  }}
                >
                  <strong>ポーズ状態:</strong> {poseStats.hasValidPose ? '✅ 良好' : '❌ 不安定'}
                </Typography>
              </Box>
            )}

            {/* モデル情報 */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                🤖 モデル情報
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>モデル:</strong> Stickman GLB
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>リターゲット:</strong> Polar座標系
              </Typography>
              
              <Typography variant="body2">
                <strong>スムージング:</strong> 線形補間 (0.1)
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* 使用方法 */}
      <Paper elevation={1} sx={{ mt: 2, p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
        <Typography variant="body2">
          💡 <strong>使用方法:</strong> カメラの前で動いてください。リアルタイムで3Dアバターがあなたの動きを再現します。
          カメラビューで関節が正しく検出されていることを確認してください。
        </Typography>
      </Paper>
    </Box>
  );
} 