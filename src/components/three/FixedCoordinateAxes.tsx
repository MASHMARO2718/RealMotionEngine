/**
 * Fixed Coordinate Axes Component
 * Displays XYZ coordinate system in fixed position (corner of viewport)
 */

import { useFrame, useThree } from '@react-three/fiber';
import React, { useRef } from 'react';
import * as THREE from 'three';

interface FixedCoordinateAxesProps {
  size?: number;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export default function FixedCoordinateAxes({ 
  size = 1, 
  position = 'bottom-left' 
}: FixedCoordinateAxesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size: canvasSize } = useThree();

  useFrame(() => {
    if (groupRef.current && camera) {
      // カメラの回転に同期させて、常に同じ向きで表示
      groupRef.current.quaternion.copy(camera.quaternion);
      
      // ビューポートの隅に固定配置
      const distance = 10; // カメラからの距離
      const aspect = canvasSize.width / canvasSize.height;
      const offsetX = position.includes('right') ? distance * 0.8 : -distance * 0.8;
      const offsetY = position.includes('top') ? distance * 0.6 : -distance * 0.6;
      
      // カメラの相対位置で配置
      const cameraDirection = new THREE.Vector3(0, 0, -1);
      cameraDirection.applyQuaternion(camera.quaternion);
      
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyQuaternion(camera.quaternion);
      
      const upVector = new THREE.Vector3(0, 1, 0);
      upVector.applyQuaternion(camera.quaternion);
      
      const axesPosition = camera.position.clone();
      axesPosition.add(cameraDirection.multiplyScalar(distance));
      axesPosition.add(rightVector.multiplyScalar(offsetX));
      axesPosition.add(upVector.multiplyScalar(offsetY / aspect));
      
      groupRef.current.position.copy(axesPosition);
    }
  });

  console.log('🎯 FixedCoordinateAxes rendering with size:', size, 'position:', position);

  return (
    <group ref={groupRef}>
      {/* X軸 (赤) */}
      <group>
        <mesh position={[size / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={2000}>
          <cylinderGeometry args={[0.05, 0.05, size, 8]} />
          <meshBasicMaterial color="#ff0000" depthTest={false} />
        </mesh>
        <mesh position={[size, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={2000}>
          <coneGeometry args={[0.15, 0.3, 8]} />
          <meshBasicMaterial color="#ff0000" depthTest={false} />
        </mesh>
      </group>

      {/* Y軸 (緑) */}
      <group>
        <mesh position={[0, size / 2, 0]} renderOrder={2000}>
          <cylinderGeometry args={[0.05, 0.05, size, 8]} />
          <meshBasicMaterial color="#00ff00" depthTest={false} />
        </mesh>
        <mesh position={[0, size, 0]} renderOrder={2000}>
          <coneGeometry args={[0.15, 0.3, 8]} />
          <meshBasicMaterial color="#00ff00" depthTest={false} />
        </mesh>
      </group>

      {/* Z軸 (青) */}
      <group>
        <mesh position={[0, 0, size / 2]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2000}>
          <cylinderGeometry args={[0.05, 0.05, size, 8]} />
          <meshBasicMaterial color="#0000ff" depthTest={false} />
        </mesh>
        <mesh position={[0, 0, size]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2000}>
          <coneGeometry args={[0.15, 0.3, 8]} />
          <meshBasicMaterial color="#0000ff" depthTest={false} />
        </mesh>
      </group>

      {/* 原点の球 */}
      <mesh position={[0, 0, 0]} renderOrder={2000}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
    </group>
  );
} 