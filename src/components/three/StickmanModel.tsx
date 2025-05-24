'use client';

import { useEffect, useRef, useState } from 'react';

import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { calculateJointRotations } from '../../lib/shared/pose-utils';

interface StickmanModelProps {
  poseData?: PoseLandmarkerResult | null;
}

export default function StickmanModel({ poseData }: StickmanModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/stickman.glb');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [bones, setBones] = useState<THREE.Bone[]>([]);

  // モデル初期化
  useEffect(() => {
    if (!scene || !groupRef.current) return;

    console.log('🚀 Stickman モデル初期化開始...');
    
    // ボーンを検索・収集
    const foundBones: THREE.Bone[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.skeleton) {
        object.skeleton.bones.forEach((bone) => {
          foundBones.push(bone);
        });
      }
      if (object instanceof THREE.Bone) {
        foundBones.push(object);
      }
    });

    setBones(foundBones);
    console.log(`✅ 合計 ${foundBones.length} 個のボーンを発見`);

    // モデル位置調整（足を地面に）
    const bbox = new THREE.Box3().setFromObject(scene);
    const minY = bbox.min.y;
    if (groupRef.current) {
      groupRef.current.position.setY(-minY);
    }

    setModelLoaded(true);
  }, [scene]);

  // MediaPipe連携アニメーション
  useFrame(() => {
    if (!modelLoaded || !poseData || !poseData.landmarks || poseData.landmarks.length === 0 || bones.length === 0) {
      return;
    }

    try {
      const rotations = calculateJointRotations(poseData);
      if (!rotations) return;

      // ボーンに回転を適用
      bones.forEach((bone) => {
        const boneName = bone.name.toLowerCase();

        for (const [jointName, rotation] of Object.entries(rotations)) {
          if (!(rotation instanceof THREE.Quaternion)) continue;

          let shouldApply = false;

          // ボーン名マッピング
          if (jointName === 'leftShoulder' && boneName.includes('left') && boneName.includes('shoulder')) {
            shouldApply = true;
          } else if (jointName === 'rightShoulder' && boneName.includes('right') && boneName.includes('shoulder')) {
            shouldApply = true;
          } else if (jointName === 'spine' && boneName.includes('spine')) {
            shouldApply = true;
          }

          if (shouldApply) {
            bone.quaternion.slerp(rotation, 0.1);
            break;
          }
        }
      });
    } catch (error) {
      console.error('❌ アニメーションエラー:', error);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
} 