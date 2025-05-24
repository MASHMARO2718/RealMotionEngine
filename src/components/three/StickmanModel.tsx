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
  const { scene } = useGLTF('/models/Y-bot.glb');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [bones, setBones] = useState<THREE.Object3D[]>([]);

  // Y-bot モデル初期化
  useEffect(() => {
    console.log('🤖 Y-bot初期化開始', { 
      scene: !!scene, 
      groupRef: !!groupRef.current 
    });
    
    if (!scene || !groupRef.current) return;

    console.log('🔍 Y-botボーン検索...');
    const foundBones: THREE.Object3D[] = [];
    
    scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh && object.skeleton) {
        console.log(`📦 SkinnedMesh発見: "${object.name}" (${object.skeleton.bones.length}個のボーン)`);
        
        object.skeleton.bones.forEach((bone, index) => {
          foundBones.push(bone);
          
          // 重要なY-botボーンをログ出力
          if (bone.name.includes('mixamorigLeftArm') || 
              bone.name.includes('mixamorigRightArm') || 
              bone.name.includes('mixamorigLeftForeArm') || 
              bone.name.includes('mixamorigRightForeArm')) {
            console.log(`⭐ [${index}] "${bone.name}" (重要ボーン)`);
          }
        });
      }
    });

    console.log(`✅ Y-botボーン検索完了: ${foundBones.length}個発見`);
    setBones(foundBones);

    // モデル位置調整
    const bbox = new THREE.Box3().setFromObject(scene);
    groupRef.current.position.setY(-bbox.min.y);

    setModelLoaded(true);
    console.log('🎯 Y-bot初期化完了');
  }, [scene]);

  // MediaPipe連携アニメーション
  useFrame(() => {
    if (!modelLoaded || !poseData || !poseData.landmarks || poseData.landmarks.length === 0 || bones.length === 0) {
      return;
    }

    try {
      const rotations = calculateJointRotations(poseData);
      if (!rotations) return;

      console.log(`🎯 ${Object.keys(rotations).length}個の関節データ受信`);

      let appliedCount = 0;

      // Y-bot (mixamorig) 専用マッピング
      Object.entries(rotations).forEach(([jointName, rotation]) => {
        if (!(rotation instanceof THREE.Quaternion)) return;
        
        let targetBoneName = '';
        switch(jointName) {
          // 腕部
          case 'leftShoulder':
            targetBoneName = 'mixamorigLeftArm';
            break;
          case 'rightShoulder':
            targetBoneName = 'mixamorigRightArm';
            break;
          case 'leftElbow':
            targetBoneName = 'mixamorigLeftForeArm';
            break;
          case 'rightElbow':
            targetBoneName = 'mixamorigRightForeArm';
            break;
          // 体幹部
          case 'spine':
            targetBoneName = 'mixamorigSpine1'; // Y-botの主要スパイン
            break;
          // 脚部
          case 'leftHip':
            targetBoneName = 'mixamorigLeftUpLeg';
            break;
          case 'rightHip':
            targetBoneName = 'mixamorigRightUpLeg';
            break;
          case 'leftKnee':
            targetBoneName = 'mixamorigLeftLeg';
            break;
          case 'rightKnee':
            targetBoneName = 'mixamorigRightLeg';
            break;
        }
        
        if (!targetBoneName) return;

        // 正確なボーン名でダイレクト検索
        const targetBone = bones.find(bone => 
          bone.name === targetBoneName
        );

        if (targetBone) {
          // 回転を適用
          const oldRotation = targetBone.quaternion.clone();
          targetBone.quaternion.slerp(rotation, 0.3); // Y-bot用により強い補間
          appliedCount++;
          
          console.log(`🤖 Y-bot回転適用: ${jointName} → ${targetBone.name} (変化: ${oldRotation.angleTo(targetBone.quaternion).toFixed(3)}rad)`);
        } else {
          console.log(`⚠️ Y-botボーンが見つかりません: ${jointName} → ${targetBoneName}`);
        }
      });
      
      console.log(`📊 ${appliedCount}個のY-botボーンに回転を適用`);
      
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