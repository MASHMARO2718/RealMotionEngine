import DummyBox from '../../components/layout/DummyBox';
import Box from '@mui/material/Box';

export default function LayoutTestPage() {
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <DummyBox label="Camera" width={400} height={300} />
        <DummyBox label="3D Model\nthrough Unity" width={400} height={300} />
        <DummyBox label="Analyzed body data" width={200} height={300} />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <DummyBox label="Thumb 1" width={150} height={120} />
        <DummyBox label="Thumb 2" width={150} height={120} />
        <DummyBox label="Thumb 3" width={150} height={120} />
        <DummyBox label="Recorder UI" width={400} height={120} />
      </Box>
    </Box>
  );
} 