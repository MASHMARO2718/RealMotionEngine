import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { 
  Alert,
  Box, 
  Button,
  CircularProgress,
  Paper,
  Tab, 
  Tabs, 
  Typography} from '@mui/material';
import React, { useEffect,useRef, useState } from 'react';

import MultiTrackerWithLockOn from '../components/multi/MultiTrackerWithLockOn';
import PolarAvatarViewer from '../components/three/PolarAvatarViewer';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Polar3DTest() {
  const [currentTab, setCurrentTab] = useState(0);
  const [poseData, setPoseData] = useState<PoseLandmarkerResult | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handlePoseResult = (result: PoseLandmarkerResult | null) => {
    setPoseData(result);
    if (result && !isTracking) {
      setIsTracking(true);
    }
  };

  const handlePoseDetected = (result: PoseLandmarkerResult) => {
    setPoseData(result);
    if (!isTracking) {
      setIsTracking(true);
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsTracking(false);
  };

  const resetTracking = () => {
    setPoseData(null);
    setIsTracking(false);
    setError(null);
  };

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      {/* ヘッダー */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Typography variant="h3" gutterBottom>
          🌟 Polar 3D Testing Environment
        </Typography>
        <Typography variant="h6">
          リアルタイム姿勢検出と3Dアバター統合のテスト環境
        </Typography>
      </Paper>

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ステータス */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            トラッキング状態:
          </Typography>
          {isTracking ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} color="success" />
              <Typography color="success.main">アクティブ</Typography>
            </Box>
          ) : (
            <Typography color="error.main">停止中</Typography>
          )}
          
          <Button 
            variant="outlined" 
            size="small" 
            onClick={resetTracking}
            sx={{ ml: 'auto' }}
          >
            リセット
          </Button>
        </Box>
      </Paper>

      {/* タブナビゲーション */}
      <Paper elevation={2}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange} 
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="📹 カメラトラッキング" />
          <Tab label="🤖 3Dアバター" />
        </Tabs>

        {/* カメラトラッキング */}
        <TabPanel value={currentTab} index={0}>
          <Typography variant="h5" gutterBottom>
            📹 カメラベースポーズトラッキング
          </Typography>
          <Typography variant="body1" paragraph>
            WebカメラからリアルタイムでMediaPipe姿勢検出を実行します。
            検出された姿勢データは3Dアバタータブで使用されます。
          </Typography>
          
          <MultiTrackerWithLockOn 
            onPoseDetected={handlePoseDetected}
            onPoseResult={handlePoseResult}
            onError={handleError}
            showAnalytics={true}
            lockOnEnabled={true}
            width={800}
            height={600}
          />
        </TabPanel>

        {/* 3Dアバター */}
        <TabPanel value={currentTab} index={1}>
          <Typography variant="h5" gutterBottom>
            🤖 3D Avatar Integration
          </Typography>
          <Typography variant="body1" paragraph>
            Polar座標系ベースの姿勢リターゲティングで3Dアバターを制御します。
            リアルタイムで姿勢を同期して動作を再現します。
          </Typography>
          
          {!isTracking && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              まず「カメラトラッキング」タブでポーズ検出を開始してください。
            </Alert>
          )}
          
          <Paper elevation={3} sx={{ p: 2 }}>
            <PolarAvatarViewer 
              width={900}
              height={600}
              poseData={poseData}
              showGrid={true}
            />
          </Paper>

          {/* ポーズ統計 */}
          {poseData && (
            <Paper elevation={1} sx={{ mt: 2, p: 2 }}>
              <Typography variant="h6" gutterBottom>
                📊 ポーズ統計
              </Typography>
              <Typography variant="body2">
                ランドマーク数: {poseData.landmarks?.[0]?.length || 0}
              </Typography>
              <Typography variant="body2">
                タイムスタンプ: {new Date().toLocaleTimeString()}
              </Typography>
            </Paper>
          )}
        </TabPanel>
      </Paper>

      {/* フッター情報 */}
      <Paper elevation={1} sx={{ mt: 3, p: 2, bgcolor: 'grey.100' }}>
        <Typography variant="body2" color="text.secondary">
          💡 <strong>使用方法:</strong> 
          まず「カメラトラッキング」でポーズ検出を開始し、その後「3Dアバター」で動作確認してください。
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          🔧 <strong>要件:</strong> 
          WebRTC対応ブラウザ、Webカメラ、MediaPipe Pose、Three.js
        </Typography>
      </Paper>
    </Box>
  );
} 