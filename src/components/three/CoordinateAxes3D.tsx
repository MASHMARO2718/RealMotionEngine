/**
 * 3D Coordinate Axes Component for Three.js
 * Displays XYZ coordinate system in 3D space
 */

import React, { useRef } from 'react';
import * as THREE from 'three';

interface CoordinateAxes3DProps {
  size?: number;
  position?: [number, number, number];
  fixed?: boolean;
}

export default function CoordinateAxes3D({ 
  size = 5, 
  position = [0, 0, 0] 
}: CoordinateAxes3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // デバッグログを追加
  console.log('🎯 CoordinateAxes3D rendering with size:', size, 'position:', position);

  return (
    <group ref={groupRef} position={position}>
      {/* X軸 (赤) - 非常に目立つように */}
      <group>
        <mesh position={[size / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={1000}>
          <cylinderGeometry args={[0.1, 0.1, size, 8]} />
          <meshBasicMaterial color="#ff0000" depthTest={false} />
        </mesh>
        {/* X軸の矢印 */}
        <mesh position={[size, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={1000}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#ff0000" depthTest={false} />
        </mesh>
      </group>

      {/* Y軸 (緑) - 非常に目立つように */}
      <group>
        <mesh position={[0, size / 2, 0]} renderOrder={1000}>
          <cylinderGeometry args={[0.1, 0.1, size, 8]} />
          <meshBasicMaterial color="#00ff00" depthTest={false} />
        </mesh>
        {/* Y軸の矢印 */}
        <mesh position={[0, size, 0]} renderOrder={1000}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#00ff00" depthTest={false} />
        </mesh>
      </group>

      {/* Z軸 (青) - 非常に目立つように */}
      <group>
        <mesh position={[0, 0, size / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1000}>
          <cylinderGeometry args={[0.1, 0.1, size, 8]} />
          <meshBasicMaterial color="#0000ff" depthTest={false} />
        </mesh>
        {/* Z軸の矢印 */}
        <mesh position={[0, 0, size]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1000}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#0000ff" depthTest={false} />
        </mesh>
      </group>

      {/* 原点の大きな球 */}
      <mesh position={[0, 0, 0]} renderOrder={1000}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#ffff00" depthTest={false} />
      </mesh>
    </group>
  );
} 