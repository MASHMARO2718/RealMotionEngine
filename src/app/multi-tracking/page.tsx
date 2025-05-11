'use client';

import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// クライアントサイドのみでレンダリングする必要がある
const MultiTracker = dynamic(
  () => import('../../components/multi/MultiTracker'),
  { ssr: false }
);

export default function MultiTrackingPage() {
  return (
    <Box sx={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 0 }}>
      <Typography variant="h4" sx={{ color: '#1976d2', fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, mt: 3, mb: 1, textShadow: '0 0 8px #1976d222' }}>
        Multi Modal Real-Time Tracking
      </Typography>
      <MultiTracker width={560} height={420} />
    </Box>
  );
} 