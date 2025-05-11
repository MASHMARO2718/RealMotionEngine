'use client';

import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';

// クライアントサイドのみでレンダリングする必要がある
const MultiTracker = dynamic(
  () => import('../../components/multi/MultiTracker'),
  { ssr: false }
);

export default function MultiTrackingPage() {
  return (
    <Box sx={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 0 }}>
      <MultiTracker width={560} height={420} />
    </Box>
  );
} 