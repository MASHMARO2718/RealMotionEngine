'use client';

import { useEffect } from 'react';
import { Suspense } from 'react';
import Box from '@mui/material/Box';
import { Canvas } from '@react-three/fiber';
import { Environment, Grid, OrbitControls, useGLTF } from '@react-three/drei';

function Model() {
  const { scene } = useGLTF('/models/human.glb');
  
  useEffect(() => {
    // モデルの初期位置とスケールを調整
    scene.position.set(0, -1, 0);
    scene.scale.set(1, 1, 1);
  }, [scene]);

  return <primitive object={scene} />;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Grid
        args={[10, 10]}
        position={[0, -1, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={3.3}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      <Suspense fallback={null}>
        <Model />
      </Suspense>
      <OrbitControls makeDefault />
      <Environment preset="city" />
    </>
  );
}

export default function ModelViewer({ width = 560, height = 420 }) {
  return (
    <Box sx={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ background: '#f0f0f0' }}
      >
        <Scene />
      </Canvas>
    </Box>
  );
} 