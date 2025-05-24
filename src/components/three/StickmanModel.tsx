'use client';

import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { calculateJointRotations } from '../../lib/shared/pose-utils';

interface StickmanModelProps {
  poseData?: PoseLandmarkerResult | null;
}

export default function StickmanModel({ poseData }: StickmanModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/stickman.glb');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [bones, setBones] = useState<THREE.Object3D[]>([]);

  // モデル初期化
  useEffect(() => {
    if (!scene || !groupRef.current) return;

    console.log('🚀 Stickman モデル初期化開始...');
    console.log('📦 シーンオブジェクト:', scene);
    
    // ボーンを検索・収集（Blenderのリグオブジェクトも含める）
    const foundBones: THREE.Object3D[] = [];
    scene.traverse((object) => {
      console.log(`🔍 オブジェクト検出: ${object.type} - "${object.name}"`);
      
      // 従来のボーン検索
      if (object instanceof THREE.SkinnedMesh && object.skeleton) {
        console.log(`🦴 SkinnedMesh発見: ${object.skeleton.bones.length}個のボーン`);
        object.skeleton.bones.forEach((bone) => {
          foundBones.push(bone);
        });
      }
      if (object instanceof THREE.Bone) {
        foundBones.push(object);
      }
      
      // Blenderリグオブジェクトを検索（WGT-rig_で始まる名前）
      if (object.name.startsWith('WGT-rig_')) {
        // アニメーション可能な重要なボーンのみを選択
        const importantBones = [
          'upper_arm_fkL', 'upper_arm_fkR',  // 上腕
          'forearm_fkL', 'forearm_fkR',      // 前腕
          'thigh_fkL', 'thigh_fkR',          // 太もも
          'shin_fkL', 'shin_fkR',            // すね
          'torso', 'chest', 'spine',         // 胴体
          'neck', 'head'                     // 首・頭
        ];
        
        const boneName = object.name.replace('WGT-rig_', '');
        if (importantBones.some(important => boneName.includes(important))) {
          foundBones.push(object);
          console.log(`🦴 リグボーン発見: "${object.name}" を使用可能なボーンとして追加`);
        }
      }
    });

    setBones(foundBones);
    console.log(`✅ 合計 ${foundBones.length} 個のボーン/リグオブジェクトを発見`);

    // モデル位置調整（足を地面に）
    const bbox = new THREE.Box3().setFromObject(scene);
    const minY = bbox.min.y;
    console.log(`📏 モデルサイズ: minY = ${minY}`);
    
    if (groupRef.current) {
      groupRef.current.position.setY(-minY);
      console.log(`🦵 足を地面に配置: Y位置を ${-minY} に調整`);
    }

    setModelLoaded(true);
    console.log('✅ Stickman モデル初期化完了');
  }, [scene]);

  // MediaPipe連携アニメーション
  useFrame(() => {
    if (!modelLoaded || !poseData || !poseData.landmarks || poseData.landmarks.length === 0 || bones.length === 0) {
      return;
    }

    try {
      const rotations = calculateJointRotations(poseData);
      if (!rotations) return;

      console.log('🎯 アニメーション適用中...', Object.keys(rotations));

      // ボーンに回転を適用
      bones.forEach((bone) => {
        const boneName = bone.name.toLowerCase();

        for (const [jointName, rotation] of Object.entries(rotations)) {
          if (!(rotation instanceof THREE.Quaternion)) continue;

          let shouldApply = false;

          // 改良されたボーン名マッピング（Blenderリグオブジェクト対応）
          if (jointName === 'leftShoulder') {
            shouldApply = boneName.includes('left') && boneName.includes('upper_arm') ||
                         boneName.includes('shoulderl') || boneName.includes('upper_arm_fkl');
          } else if (jointName === 'rightShoulder') {
            shouldApply = boneName.includes('right') && boneName.includes('upper_arm') ||
                         boneName.includes('shoulderr') || boneName.includes('upper_arm_fkr');
          } else if (jointName === 'leftElbow') {
            shouldApply = boneName.includes('left') && boneName.includes('forearm') ||
                         boneName.includes('forearm_fkl');
          } else if (jointName === 'rightElbow') {
            shouldApply = boneName.includes('right') && boneName.includes('forearm') ||
                         boneName.includes('forearm_fkr');
          } else if (jointName === 'spine') {
            shouldApply = boneName.includes('spine') || boneName.includes('torso') || boneName.includes('chest');
          } else if (jointName === 'leftHip') {
            shouldApply = boneName.includes('left') && boneName.includes('thigh') ||
                         boneName.includes('thigh_fkl');
          } else if (jointName === 'rightHip') {
            shouldApply = boneName.includes('right') && boneName.includes('thigh') ||
                         boneName.includes('thigh_fkr');
          } else if (jointName === 'leftKnee') {
            shouldApply = boneName.includes('left') && boneName.includes('shin') ||
                         boneName.includes('shin_fkl');
          } else if (jointName === 'rightKnee') {
            shouldApply = boneName.includes('right') && boneName.includes('shin') ||
                         boneName.includes('shin_fkr');
          }

          if (shouldApply) {
            // 回転をスムーズに適用
            bone.quaternion.slerp(rotation, 0.2);
            console.log(`✅ 回転適用: "${bone.name}" ← ${jointName}`);
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