import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Environment, Grid,OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { PolarPoseRetarget } from '../../three/PolarPoseRetarget';

interface PolarAvatarProps {
  poseData?: PoseLandmarkerResult | null;
  modelPath?: string;
}

function PolarAvatar({ poseData, modelPath = '/models/stickman.glb' }: PolarAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const retarget = useRef(new PolarPoseRetarget(0.1));
  const { scene } = useGLTF(modelPath) as any;
  const [bones, setBones] = useState<THREE.Bone[]>([]);

  // ボーンを抽出
  useEffect(() => {
    if (scene) {
      const foundBones: THREE.Bone[] = [];
      scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Bone) {
          foundBones.push(child);
        }
      });
      setBones(foundBones);
      console.log(`🦴 発見されたボーン数: ${foundBones.length}`);
      foundBones.forEach((bone, index) => {
        console.log(`  ${index}: ${bone.name}`);
      });
    }
  }, [scene]);

  // モデルの配置とスケール調整
  useEffect(() => {
    if (group.current && scene) {
      // スケール調整
      const bbox = new THREE.Box3().setFromObject(scene);
      const size = bbox.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      
      let scale = 1;
      if (maxSize < 1) {
        scale = 3 / maxSize;
      } else if (maxSize > 5) {
        scale = 3 / maxSize;
      }
      
      group.current.scale.set(scale, scale, scale);
      
      // 地面に配置
      const minY = bbox.min.y * scale;
      const yOffset = -minY;
      group.current.position.setY(yOffset);
      
      console.log(`🎯 Polar Avatar配置: スケール=${scale}, Y調整=${yOffset}`);
    }
  }, [scene]);

  // ポーズデータを適用
  useFrame(() => {
    if (poseData && bones.length > 0) {
      const rotations = retarget.current.calculateJointRotations(poseData);
      
      bones.forEach((bone) => {
        const boneName = bone.name.toLowerCase();
        
        // ボーン名マッピング
        for (const [jointName, rotation] of Object.entries(rotations)) {
          if (rotation instanceof THREE.Quaternion) {
            let shouldApply = false;
            
            switch (jointName) {
              case 'leftShoulder':
                shouldApply = boneName.includes('left') && 
                  (boneName.includes('shoulder') || boneName.includes('arm') || boneName.includes('upper'));
                break;
              case 'rightShoulder':
                shouldApply = boneName.includes('right') && 
                  (boneName.includes('shoulder') || boneName.includes('arm') || boneName.includes('upper'));
                break;
              case 'leftElbow':
                shouldApply = boneName.includes('left') && 
                  (boneName.includes('elbow') || boneName.includes('forearm') || boneName.includes('lower'));
                break;
              case 'rightElbow':
                shouldApply = boneName.includes('right') && 
                  (boneName.includes('elbow') || boneName.includes('forearm') || boneName.includes('lower'));
                break;
              case 'leftHip':
                shouldApply = boneName.includes('left') && 
                  (boneName.includes('hip') || boneName.includes('thigh') || boneName.includes('leg'));
                break;
              case 'rightHip':
                shouldApply = boneName.includes('right') && 
                  (boneName.includes('hip') || boneName.includes('thigh') || boneName.includes('leg'));
                break;
              case 'leftKnee':
                shouldApply = boneName.includes('left') && 
                  (boneName.includes('knee') || boneName.includes('shin') || boneName.includes('calf'));
                break;
              case 'rightKnee':
                shouldApply = boneName.includes('right') && 
                  (boneName.includes('knee') || boneName.includes('shin') || boneName.includes('calf'));
                break;
              case 'spine':
                shouldApply = boneName.includes('spine') || boneName.includes('torso') || 
                  boneName.includes('back') || boneName.includes('chest');
                break;
            }
            
            if (shouldApply) {
              bone.quaternion.slerp(rotation, 0.1);
              break;
            }
          }
        }
      });
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

interface PolarAvatarViewerProps {
  width?: number;
  height?: number;
  poseData?: PoseLandmarkerResult | null;
  modelPath?: string;
  showGrid?: boolean;
}

export default function PolarAvatarViewer({ 
  width = 400, 
  height = 300, 
  poseData, 
  modelPath,
  showGrid = true 
}: PolarAvatarViewerProps) {
  return (
    <div style={{ width, height, border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 2, 5], fov: 50 }}
        shadows
        style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #98FB98 100%)' }}
      >
        {/* ライティング */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
        <directionalLight position={[-10, 5, -5]} intensity={0.6} />
        <pointLight position={[0, 5, 0]} intensity={0.3} />

        {/* グリッド */}
        {showGrid && (
          <Grid
            args={[10, 10]}
            position={[0, 0, 0]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#888888"
            sectionSize={2}
            sectionThickness={1}
            sectionColor="#555555"
            fadeDistance={15}
            fadeStrength={1}
            infiniteGrid
          />
        )}

        {/* 3Dアバター */}
        <PolarAvatar poseData={poseData} modelPath={modelPath} />

        {/* カメラコントロール */}
        <OrbitControls 
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={10}
          target={[0, 1, 0]}
        />

        {/* 環境 */}
        <Environment preset="sunset" />
      </Canvas>
    </div>
  );
} 