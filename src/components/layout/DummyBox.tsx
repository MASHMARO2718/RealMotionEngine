import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import { SxProps, Theme } from '@mui/material/styles';

export default function DummyBox({ label, width = '100%', height = 200, sx }: { label: string; width?: number | string; height?: number | string; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={{
        border: '1.5px solid #aaa',
        borderRadius: 2,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#fafbfc',
        color: '#555',
        fontSize: '1.2rem',
        fontWeight: 400,
        textAlign: 'center',
        ...sx,
      }}
    >
      <Typography variant="body1">{label}</Typography>
    </Box>
  );
} 