'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { calculateJointRotations } from '../../lib/shared/pose-utils';
import { PolarPoseRetarget } from '../../three/PolarPoseRetarget';

interface StickmanModelProps {
  poseData?: PoseLandmarkerResult | null;
  angleAdjustments?: Record<string, { omega: number; phi: number }>;
  poseRetarget?: PolarPoseRetarget; // 外部から渡されるPolarPoseRetargetインスタンス
  isTuned?: boolean; // チューニング完了フラグ
}

export default function StickmanModel({ poseData, angleAdjustments, poseRetarget, isTuned = false }: StickmanModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/Y-bot.glb');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [bones, setBones] = useState<THREE.Object3D[]>([]);
  const [isTPoseSet, setIsTPoseSet] = useState(false);
  
  // 外部から渡されたposeRetargetを使用、なければフォールバック用のインスタンスを作成
  const polarRetargetRef = useRef<PolarPoseRetarget>(poseRetarget || new PolarPoseRetarget(0.1));

  // poseRetargetプロパティが変更された時の処理
  useEffect(() => {
    if (poseRetarget) {
      polarRetargetRef.current = poseRetarget;
      console.log('🔄 StickmanModel: 外部PolarPoseRetargetインスタンスを使用');
    }
  }, [poseRetarget]);

  // T-poseを設定する関数
  const setTPose = useCallback(() => {
    if (!bones.length) return;

    console.log('🎯 アバターをT-poseに設定中...');
    console.log('📊 利用可能なボーン数:', bones.length);
    
    // 全ボーン名をログ出力
    bones.forEach((bone, index) => {
      console.log(`  [${index}] ${bone.name}`);
    });

    // 複数の回転軸パターンをテスト
    const tPoseRotationPatterns = {
      // パターン1: Z軸回転 (現在)
      pattern1: {
        'mixamorigLeftArm': new THREE.Euler(0, 0, Math.PI / 2),
        'mixamorigRightArm': new THREE.Euler(0, 0, -Math.PI / 2),
      },
      // パターン2: Y軸回転
      pattern2: {
        'mixamorigLeftArm': new THREE.Euler(0, Math.PI / 2, 0),
        'mixamorigRightArm': new THREE.Euler(0, -Math.PI / 2, 0),
      },
      // パターン3: X軸回転
      pattern3: {
        'mixamorigLeftArm': new THREE.Euler(Math.PI / 2, 0, 0),
        'mixamorigRightArm': new THREE.Euler(-Math.PI / 2, 0, 0),
      },
      // パターン4: 複合回転
      pattern4: {
        'mixamorigLeftArm': new THREE.Euler(0, 0, Math.PI / 2),
        'mixamorigRightArm': new THREE.Euler(0, Math.PI, -Math.PI / 2),
      }
    };

    // 現在はパターン1でテスト、後で他のパターンも試せるように
    const selectedPattern = tPoseRotationPatterns.pattern1;

    console.log('🔧 T-pose回転パターン適用中...');
    
    Object.entries(selectedPattern).forEach(([boneName, rotation]) => {
      // より柔軟なボーン検索
      const targetBone = bones.find(bone => 
        bone.name === boneName || 
        bone.name.includes('LeftArm') || 
        bone.name.includes('RightArm') ||
        bone.name.toLowerCase().includes('leftarm') ||
        bone.name.toLowerCase().includes('rightarm')
      );

      if (targetBone) {
        console.log(`🔄 ボーン発見: "${targetBone.name}" → 回転適用`);
        console.log(`   適用前回転:`, targetBone.rotation.x.toFixed(3), targetBone.rotation.y.toFixed(3), targetBone.rotation.z.toFixed(3));
        
        // 回転適用
        targetBone.rotation.copy(rotation);
        targetBone.updateMatrixWorld(true);
        
        console.log(`   適用後回転:`, targetBone.rotation.x.toFixed(3), targetBone.rotation.y.toFixed(3), targetBone.rotation.z.toFixed(3));
        console.log(`✅ ${targetBone.name} T-pose設定完了`);
      } else {
        console.warn(`❌ ボーンが見つかりません: ${boneName}`);
        console.log('🔍 類似ボーン検索結果:');
        bones.filter(bone => 
          bone.name.toLowerCase().includes('arm') || 
          bone.name.toLowerCase().includes('shoulder')
        ).forEach(bone => {
          console.log(`  候補: "${bone.name}"`);
        });
      }
    });

    setIsTPoseSet(true);
    console.log('🎉 T-pose設定完了！');
  }, [bones]);

  // モデル読み込み完了時にT-poseを設定
  useEffect(() => {
    if (modelLoaded && bones.length > 0 && !isTPoseSet) {
      // 少し遅延してからT-poseを設定（ボーンの初期化完了を待つ）
      setTimeout(() => {
        setTPose();
      }, 100);
    }
  }, [modelLoaded, bones.length, isTPoseSet, setTPose]);

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
        
        // 🔍 調査3: Y-botの詳細骨格構造分析
        console.log('\n🦴 Y-bot骨格詳細分析:');
        object.skeleton.bones.forEach((bone, index) => {
          foundBones.push(bone);
          
          // ボーンの初期状態を記録
          const position = bone.position.clone();
          const rotation = bone.rotation.clone();
          const quaternion = bone.quaternion.clone();
          
          console.log(`  [${index}] "${bone.name}"`);
          console.log(`       pos: x=${position.x.toFixed(3)}, y=${position.y.toFixed(3)}, z=${position.z.toFixed(3)}`);
          console.log(`       rot: x=${rotation.x.toFixed(3)}, y=${rotation.y.toFixed(3)}, z=${rotation.z.toFixed(3)}`);
          console.log(`       quat: x=${quaternion.x.toFixed(3)}, y=${quaternion.y.toFixed(3)}, z=${quaternion.z.toFixed(3)}, w=${quaternion.w.toFixed(3)}`);
          
          // 重要なY-botボーンをログ出力
          if (bone.name.includes('mixamorigLeftArm') || 
              bone.name.includes('mixamorigRightArm') || 
              bone.name.includes('mixamorigLeftForeArm') || 
              bone.name.includes('mixamorigRightForeArm') ||
              bone.name.includes('mixamorigSpine') ||
              bone.name.includes('mixamorigLeftUpLeg') ||
              bone.name.includes('mixamorigRightUpLeg') ||
              bone.name.includes('mixamorigLeftLeg') ||
              bone.name.includes('mixamorigRightLeg')) {
            console.log(`⭐ [${index}] "${bone.name}" (重要ボーン) - 初期回転保存`);
            
            // 🔍 肩ボーンの詳細分析
            if (bone.name.includes('mixamorigLeftArm') || bone.name.includes('mixamorigRightArm')) {
              console.log(`    🔍 肩ボーン詳細分析:`);
              const worldDirection = bone.getWorldDirection(new THREE.Vector3());
              const rotationArray = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
              const worldPosition = bone.getWorldPosition(new THREE.Vector3());
              
              console.log(`       初期方向ベクトル: ${worldDirection.x.toFixed(3)}, ${worldDirection.y.toFixed(3)}, ${worldDirection.z.toFixed(3)}`);
              console.log(`       ローカル回転: ${rotationArray.map(v => v.toFixed(3)).join(', ')}`);
              console.log(`       ワールド位置: ${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)}`);
            }
            
            // 🔍 足の付け根ボーンの詳細分析
            if (bone.name.includes('mixamorigLeftUpLeg') || bone.name.includes('mixamorigRightUpLeg')) {
              console.log(`    🦵 足の付け根ボーン詳細分析:`);
              const worldDirection = bone.getWorldDirection(new THREE.Vector3());
              const rotationArray = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
              const worldPosition = bone.getWorldPosition(new THREE.Vector3());
              
              console.log(`       初期方向ベクトル: ${worldDirection.x.toFixed(3)}, ${worldDirection.y.toFixed(3)}, ${worldDirection.z.toFixed(3)}`);
              console.log(`       ローカル回転: ${rotationArray.map(v => v.toFixed(3)).join(', ')}`);
              console.log(`       ワールド位置: ${worldPosition.x.toFixed(3)}, ${worldPosition.y.toFixed(3)}, ${worldPosition.z.toFixed(3)}`);
            }
          }
        });
        
        // 🔍 調査4: 骨格階層構造の調査
        console.log('\n🌳 Y-bot骨格階層構造:');
        const printHierarchy = (bone: THREE.Object3D, depth: number = 0) => {
          const indent = '  '.repeat(depth);
          console.log(`${indent}${bone.name || '(無名)'} [${bone.type}]`);
          bone.children.forEach(child => printHierarchy(child, depth + 1));
        };
        object.skeleton.bones[0] && printHierarchy(object.skeleton.bones[0]);
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
    // ❌ チューニングが完了していない場合でも、手動調整は反映させる
    if (!modelLoaded || bones.length === 0) {
      return;
    }

    // 🔧 手動角度調整のみ適用（チューニング状態に関わらず）
    if (angleAdjustments && Object.keys(angleAdjustments).length > 0) {
      // 手動調整値をPolarPoseRetargetに適用
      polarRetargetRef.current.setAngleAdjustments(angleAdjustments);
      console.log('🎛️ 手動角度調整を適用:', angleAdjustments);
    }

    // ⚠️ チューニングが完了していない場合は、自動ポーズトラッキングを無効にする
    if (!isTuned) {
      // T-poseを維持（手動調整は上記のuseEffectで処理される）
      return; // 自動ポーズトラッキングは無効
    }

    // ✅ チューニング完了済みの場合のみ、自動ポーズトラッキングを実行
    if (!poseData || !poseData.landmarks || poseData.landmarks.length === 0) {
      return;
    }

    try {
      // 角度調整値を適用
      if (angleAdjustments) {
        polarRetargetRef.current.setAngleAdjustments(angleAdjustments);
      }
      
      // PolarPoseRetargetで計算（角度調整が適用される）
      const rotations = polarRetargetRef.current.calculateJointRotations(poseData);
      if (!rotations) return;

      console.log(`🎯 ${Object.keys(rotations).length}個の関節データ受信（角度調整適用済み）`);

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
          // 🔍 調査5: 回転適用プロセスの詳細調査
          const oldRotation = targetBone.quaternion.clone();
          const oldEuler = new THREE.Euler().setFromQuaternion(oldRotation);
          const newEuler = new THREE.Euler().setFromQuaternion(rotation);
          
          console.log(`\n🔄 [${jointName}] → [${targetBone.name}] 回転適用詳細:`);
          console.log(`  MediaPipe計算回転: x=${newEuler.x.toFixed(3)}, y=${newEuler.y.toFixed(3)}, z=${newEuler.z.toFixed(3)}`);
          console.log(`  ボーン適用前回転: x=${oldEuler.x.toFixed(3)}, y=${oldEuler.y.toFixed(3)}, z=${oldEuler.z.toFixed(3)}`);
          
          // 🔧 改善された回転適用（より反応性を高める）
          const interpolationFactor = jointName.includes('Shoulder') ? 0.9 : 
                                     jointName.includes('Hip') ? 0.7 : 0.6; // 足の付け根も高反応性
          targetBone.quaternion.slerp(rotation, interpolationFactor);
          
          // 🔧 ボーン階層の更新を強制
          if (targetBone.parent) {
            targetBone.parent.updateMatrixWorld(true);
          }
          targetBone.updateMatrixWorld(true);
          
          const finalEuler = new THREE.Euler().setFromQuaternion(targetBone.quaternion);
          console.log(`  ボーン適用後回転: x=${finalEuler.x.toFixed(3)}, y=${finalEuler.y.toFixed(3)}, z=${finalEuler.z.toFixed(3)}`);
          console.log(`  変化量: ${oldRotation.angleTo(targetBone.quaternion).toFixed(3)}rad`);
          console.log(`  補間率: ${interpolationFactor}`);
          
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

  // T-poseに手動調整を適用する関数
  const applyManualAdjustmentsToTPose = useCallback(() => {
    if (!bones.length || !angleAdjustments || Object.keys(angleAdjustments).length === 0) return;

    console.log('🎛️ T-poseに手動調整を適用中...', angleAdjustments);

    // 基本のT-pose回転を設定
    const baseTposeRotations = {
      'mixamorigLeftArm': new THREE.Euler(0, 0, Math.PI / 2),
      'mixamorigRightArm': new THREE.Euler(0, 0, -Math.PI / 2),
    };

    Object.entries(baseTposeRotations).forEach(([boneName, baseRotation]) => {
      const targetBone = bones.find(bone => 
        bone.name === boneName || 
        bone.name.includes('LeftArm') || 
        bone.name.includes('RightArm')
      );

      if (targetBone) {
        // ベース回転を適用
        let finalRotation = new THREE.Quaternion().setFromEuler(baseRotation);
        
        // 手動調整を追加
        const jointMapping = boneName.includes('Left') ? 'leftShoulder' : 'rightShoulder';
        const adjustment = angleAdjustments[jointMapping];
        
        if (adjustment) {
          // Omega調整（Z軸回転）
          if (adjustment.omega !== 0) {
            const omegaRotation = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 0, 1), 
              adjustment.omega * Math.PI / 180
            );
            finalRotation = finalRotation.multiply(omegaRotation);
          }

          // Phi調整（X軸回転）
          if (adjustment.phi !== 0) {
            const phiRotation = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0), 
              adjustment.phi * Math.PI / 180
            );
            finalRotation = finalRotation.multiply(phiRotation);
          }
          
          console.log(`🔧 ${jointMapping}に調整適用: omega=${adjustment.omega}°, phi=${adjustment.phi}°`);
        }

        // 回転を適用
        targetBone.quaternion.copy(finalRotation);
        targetBone.updateMatrixWorld(true);
        
        console.log(`✅ ${targetBone.name}にT-pose+手動調整を適用`);
      }
    });
  }, [bones, angleAdjustments]);

  // 角度調整値が変更されたときの処理
  useEffect(() => {
    if (angleAdjustments && Object.keys(angleAdjustments).length > 0 && !isTuned && isTPoseSet) {
      // チューニング前の状態で角度調整が変更された場合、T-poseに反映
      console.log('🔄 角度調整が変更されました。T-poseに適用します。');
      applyManualAdjustmentsToTPose();
    }
  }, [angleAdjustments, isTuned, isTPoseSet, applyManualAdjustmentsToTPose]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
} 