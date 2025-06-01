/**
 * 3D Angle Arcs Component
 * Displays angles as 3D arcs in the model viewer
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface AngleData {
  polarAngles: Record<string, { theta: number; phi: number; position: THREE.Vector3; omega: number; projectedPoint: THREE.Vector3 }>;
  jointAngles: Record<string, { angle: number; position: THREE.Vector3; axis: THREE.Vector3 }>;
  torsoPlane?: { origin: THREE.Vector3; normal: THREE.Vector3; rightVector: THREE.Vector3; upVector: THREE.Vector3 };
}

interface AngleArcs3DProps {
  angleData?: AngleData | null;
  showPolarAngles?: boolean;
  showJointAngles?: boolean;
  arcRadius?: number;
}

export default function AngleArcs3D({ 
  angleData, 
  showPolarAngles = true, 
  showJointAngles = true,
  arcRadius = 0.15  // より小さく、関節に密着
}: AngleArcs3DProps) {
  
  // 関節角度の弧を生成（改良版 - 関節により密着）
  const jointArcs = useMemo(() => {
    if (!angleData?.jointAngles || !showJointAngles) return [];

    const arcs: JSX.Element[] = [];
    
    Object.entries(angleData.jointAngles).forEach(([name, data], index) => {
      const { angle, position, axis } = data;
      
      // より幅広い角度範囲で表示（ほぼすべての角度を表示）
      if (angle > 0.05 && angle < Math.PI - 0.05) {
        // 関節の種類に応じて色とサイズを調整
        let color = "#ffa726";
        let radius = arcRadius;
        let thickness = 0.005; // より薄く
        
        if (name.includes('Elbow')) {
          color = "#ff5722"; // 肘は赤オレンジ
          radius = arcRadius * 1.5; // より大きく
          thickness = 0.008;
        } else if (name.includes('Knee')) {
          color = "#2196f3"; // 膝は青
          radius = arcRadius * 1.8; // より大きく
          thickness = 0.01;
        } else if (name.includes('Shoulder')) {
          color = "#4caf50"; // 肩は緑
          radius = arcRadius * 1.3;
          thickness = 0.006;
        } else if (name.includes('Hip')) {
          color = "#9c27b0"; // 腰は紫
          radius = arcRadius * 1.4;
          thickness = 0.008;
        } else if (name.includes('Ankle')) {
          color = "#ff9800"; // 足首はオレンジ
          radius = arcRadius * 1.1;
          thickness = 0.005;
        } else if (name.includes('neck')) {
          color = "#e91e63"; // 首はピンク
          radius = arcRadius * 1.0;
          thickness = 0.004;
        }

        // より細かい弧のジオメトリ
        const arcGeometry = new THREE.RingGeometry(
          radius - thickness, 
          radius + thickness, 
          16, // より滑らかな弧
          2,  // より厚み
          0, 
          angle
        );

        // 軸の方向に基づいて回転を計算
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);

        arcs.push(
          <group key={`joint-${name}`} position={position.toArray()}>
            {/* メインの角度弧 */}
            <mesh 
              quaternion={quaternion.toArray() as [number, number, number, number]}
              renderOrder={100}
            >
              <primitive object={arcGeometry} />
              <meshBasicMaterial 
                color={color} 
                transparent 
                opacity={0.9} 
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
            
            {/* 角度の開始点マーカー */}
            <mesh position={[radius, 0, 0]} renderOrder={101}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
            
            {/* 角度の終了点マーカー */}
            <mesh 
              position={[
                radius * Math.cos(angle), 
                radius * Math.sin(angle), 
                0
              ]} 
              quaternion={quaternion.toArray() as [number, number, number, number]}
              renderOrder={101}
            >
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>

            {/* 角度値表示（小さなボックス） */}
            <mesh 
              position={[
                radius * 0.7 * Math.cos(angle / 2), 
                radius * 0.7 * Math.sin(angle / 2), 
                0
              ]}
              quaternion={quaternion.toArray() as [number, number, number, number]}
              renderOrder={102}
            >
              <boxGeometry args={[0.03, 0.015, 0.005]} />
              <meshBasicMaterial 
                color="#ffffff" 
                transparent 
                opacity={0.8}
                depthTest={false}
              />
            </mesh>
          </group>
        );

        // 角度の数値を近くに表示するための追加要素
        const degrees = Math.round(angle * 180 / Math.PI);
        arcs.push(
          <group key={`label-${name}`} position={[
            position.x + radius * 1.5, 
            position.y + 0.1, 
            position.z
          ]}>
            <mesh renderOrder={103}>
              <boxGeometry args={[0.02, 0.02, 0.02]} />
              <meshBasicMaterial 
                color={color} 
                transparent 
                opacity={0.7}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      }
    });

    return arcs;
  }, [angleData?.jointAngles, showJointAngles, arcRadius]);

  // 極座標角度の弧（体幹平面ベース - omegaとphiのみ）
  const polarArcs = useMemo(() => {
    if (!angleData?.polarAngles || !showPolarAngles || !angleData?.torsoPlane) return [];

    const arcs: JSX.Element[] = [];
    
    // 肘と手首のみに極座標を表示（体幹平面ベース）
    const targetJoints = ['leftElbow', 'rightElbow', 'leftWrist', 'rightWrist'];
    
    Object.entries(angleData.polarAngles).forEach(([name, data], index) => {
      if (!targetJoints.includes(name)) return;
      
      const { omega, projectedPoint } = data;
      const { normal } = angleData.torsoPlane!;
      
      // omega角度の弧（体幹平面内）- より大きく表示
      if (Math.abs(omega) > 0.1) {
        const omegaGeometry = new THREE.RingGeometry(
          arcRadius * 0.8, 
          arcRadius * 1.2, 
          16, 
          2, 
          0, 
          Math.abs(omega)
        );
        
        // 体幹平面の向きに合わせて弧を配置
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        
        arcs.push(
          <group key={`omega-${name}`} position={projectedPoint.toArray()}>
            <mesh 
              quaternion={quaternion.toArray() as [number, number, number, number]}
              renderOrder={95}
            >
              <primitive object={omegaGeometry} />
              <meshBasicMaterial 
                color={name.includes('Elbow') ? "#ffc107" : "#ff9800"} 
                transparent 
                opacity={0.9} 
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
            
            {/* omega角度の中心マーカー */}
            <mesh renderOrder={96}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial 
                color={name.includes('Elbow') ? "#ffc107" : "#ff9800"} 
                depthTest={false} 
              />
            </mesh>
          </group>
        );
      }
    });

    return arcs;
  }, [angleData?.polarAngles, angleData?.torsoPlane, showPolarAngles, arcRadius]);

  // 体幹平面と平行平面の可視化
  const torsoPlaneVisualization = useMemo(() => {
    if (!angleData?.torsoPlane || !showPolarAngles) return [];

    const { origin, normal, rightVector, upVector } = angleData.torsoPlane;
    const planeElements: JSX.Element[] = [];

    // 体幹平面（透明な黄色い平面）の表示
    const planeSize = 2.0; // より大きく
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    
    // 体幹平面の向きを設定
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    planeElements.push(
      <group key="torso-plane">
        {/* 体幹平面（透明な黄色い平面） */}
        <mesh 
          position={origin.toArray()} 
          quaternion={quaternion.toArray() as [number, number, number, number]}
          renderOrder={50}
        >
          <primitive object={planeGeometry} />
          <meshBasicMaterial 
            color="#ffeb3b" 
            transparent 
            opacity={0.4} 
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>

        {/* 体幹平面の枠線 */}
        <lineSegments 
          position={origin.toArray()} 
          quaternion={quaternion.toArray() as [number, number, number, number]}
          renderOrder={51}
        >
          <edgesGeometry args={[planeGeometry]} />
          <lineBasicMaterial color="#ffc107" linewidth={3} />
        </lineSegments>

        {/* 体幹平面のグリッド線 */}
        <group 
          position={origin.toArray()} 
          quaternion={quaternion.toArray() as [number, number, number, number]}
          renderOrder={49}
        >
          {/* 縦のグリッド線 */}
          {[-0.8, -0.4, 0, 0.4, 0.8].map((x, i) => (
            <line key={`vertical-${i}`}>
              <bufferGeometry>
                <bufferAttribute 
                  attach="attributes-position"
                  array={new Float32Array([
                    x, -planeSize/2, 0,
                    x, planeSize/2, 0
                  ])}
                  count={2}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ffeb3b" transparent opacity={0.3} />
            </line>
          ))}
          
          {/* 横のグリッド線 */}
          {[-0.8, -0.4, 0, 0.4, 0.8].map((y, i) => (
            <line key={`horizontal-${i}`}>
              <bufferGeometry>
                <bufferAttribute 
                  attach="attributes-position"
                  array={new Float32Array([
                    -planeSize/2, y, 0,
                    planeSize/2, y, 0
                  ])}
                  count={2}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ffeb3b" transparent opacity={0.3} />
            </line>
          ))}
        </group>

        {/* 体幹平面の基準ベクトル（黄色系ベクトル） */}
        {/* 右方向ベクトル */}
        <group position={origin.toArray()}>
          <mesh position={rightVector.clone().multiplyScalar(0.4).toArray()}>
            <cylinderGeometry args={[0.025, 0.025, 0.8]} />
            <meshBasicMaterial color="#ff9800" depthTest={false} />
          </mesh>
          <arrowHelper args={[rightVector, origin, 0.8, "#ff9800"]} />
        </group>

        {/* 上方向ベクトル */}
        <group position={origin.toArray()}>
          <mesh position={upVector.clone().multiplyScalar(0.4).toArray()}>
            <cylinderGeometry args={[0.025, 0.025, 0.8]} />
            <meshBasicMaterial color="#ff9800" depthTest={false} />
          </mesh>
          <arrowHelper args={[upVector, origin, 0.8, "#ff9800"]} />
        </group>

        {/* 法線ベクトル（黄色） */}
        <group position={origin.toArray()}>
          <arrowHelper args={[normal, origin, 0.6, "#ffeb3b"]} />
        </group>

        {/* 体幹平面の中心マーカー */}
        <mesh position={origin.toArray()} renderOrder={52}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#ffc107" depthTest={false} />
        </mesh>
      </group>
    );

    // 肘と手首を通る平行平面
    ['leftElbow', 'rightElbow'].forEach(elbowName => {
      const wristName = elbowName.replace('Elbow', 'Wrist');
      const elbowData = angleData.polarAngles[elbowName];
      const wristData = angleData.polarAngles[wristName];

      if (elbowData && wristData) {
        // 肘の位置に平行平面を配置
        const parallelPlaneGeometry = new THREE.PlaneGeometry(0.6, 0.6);
        
        planeElements.push(
          <group key={`parallel-plane-${elbowName}`}>
            {/* 平行平面 */}
            <mesh 
              position={elbowData.position.toArray()} 
              quaternion={quaternion.toArray() as [number, number, number, number]}
              renderOrder={51}
            >
              <primitive object={parallelPlaneGeometry} />
              <meshBasicMaterial 
                color={elbowName.includes('left') ? "#ff5722" : "#4caf50"} 
                transparent 
                opacity={0.2} 
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>

            {/* 射影点の表示 */}
            <mesh position={elbowData.projectedPoint.toArray()} renderOrder={60}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial 
                color={elbowName.includes('left') ? "#ff5722" : "#4caf50"} 
                depthTest={false} 
              />
            </mesh>

            {/* 手首の射影点 */}
            <mesh position={wristData.projectedPoint.toArray()} renderOrder={60}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial 
                color={elbowName.includes('left') ? "#ff9800" : "#8bc34a"} 
                depthTest={false} 
              />
            </mesh>

            {/* 射影線 */}
            <line>
              <bufferGeometry>
                <bufferAttribute 
                  attach="attributes-position"
                  array={new Float32Array([
                    ...elbowData.position.toArray(),
                    ...elbowData.projectedPoint.toArray()
                  ])}
                  count={2}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial 
                color={elbowName.includes('left') ? "#ff5722" : "#4caf50"} 
                transparent 
                opacity={0.6}
              />
            </line>

            {/* omega角度の弧表示 */}
            <mesh 
              position={elbowData.projectedPoint.toArray()}
              quaternion={quaternion.toArray() as [number, number, number, number]}
              renderOrder={70}
            >
              <ringGeometry args={[0.05, 0.08, 12, 1, 0, Math.abs(elbowData.omega)]} />
              <meshBasicMaterial 
                color="#ffc107" 
                transparent 
                opacity={0.8} 
                side={THREE.DoubleSide}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      }
    });

    return planeElements;
  }, [angleData?.torsoPlane, angleData?.polarAngles, showPolarAngles]);

  if (!angleData) return null;

  console.log('🌟 AngleArcs3D rendering (体幹平面ベース):', {
    polarAnglesCount: Object.keys(angleData.polarAngles || {}).length,
    jointAnglesCount: Object.keys(angleData.jointAngles || {}).length,
    hasTorsoPlane: !!angleData.torsoPlane,
    arcRadius,
    showPolarAngles,
    showJointAngles,
    // 体幹平面ベースの値を表示
    leftElbowOmega: angleData.polarAngles?.leftElbow ? (angleData.polarAngles.leftElbow.omega * 180 / Math.PI).toFixed(1) + '°' : 'N/A',
    leftElbowTheta: angleData.polarAngles?.leftElbow ? (angleData.polarAngles.leftElbow.theta * 180 / Math.PI).toFixed(1) + '°' : 'N/A',
    torsoPlaneOrigin: angleData.torsoPlane?.origin ? angleData.torsoPlane.origin.toArray().map(v => v.toFixed(2)) : 'N/A'
  });

  return (
    <group>
      {/* 関節角度の弧（メイン） */}
      {jointArcs}
      
      {/* 極座標角度の弧（補助） */}
      {polarArcs}
      
      {/* 体幹平面と平行平面の可視化 */}
      {torsoPlaneVisualization}
    </group>
  );
} 