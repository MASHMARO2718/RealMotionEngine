import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

/**
 * MediaPipeのポーズランドマークから主要な関節角度を計算
 * MediaPipeの座標（x: 0-1, y: 0-1, z: 相対深度）から3D回転を計算
 */
export function calculateJointRotations(poseData: PoseLandmarkerResult): { [key: string]: THREE.Quaternion } | null {
  if (!poseData || !poseData.landmarks || poseData.landmarks.length === 0) {
    console.log('❌ ポーズデータが無効または空です');
    return null;
  }

  const landmarks = poseData.landmarks[0];
  const rotations: { [key: string]: THREE.Quaternion } = {};

  // 🔧 改善された座標系変換関数
  const getPosition = (landmarkIndex: number): THREE.Vector3 => {
    const landmark = landmarks[landmarkIndex];
    if (!landmark) return new THREE.Vector3(0, 0, 0);
    
    // MediaPipe座標系 → Three.js座標系の正確な変換
    return new THREE.Vector3(
      -(landmark.x - 0.5) * 2,    // X軸反転（MediaPipeは左右反転）
      -(landmark.y - 0.5) * 2,   // Y軸は下向きが正
      (landmark.z || 0) * 1      // Z軸はそのまま（スケール調整）
    );
  };

  // 🔧 強化された可視性チェック
  const isLandmarkVisible = (index: number, minVisibility: number = 0.7): boolean => {
    const landmark = landmarks[index];
    if (!landmark) {
      console.log(`⚠️ ランドマーク ${index} が存在しません`);
      return false;
    }
    
    const visible = landmark.visibility === undefined || landmark.visibility > minVisibility;
    if (!visible) {
      console.log(`⚠️ ランドマーク ${index} の可視性が低い: ${landmark.visibility} < ${minVisibility}`);
    }
    return visible;
  };

  // 🔧 品質チェック付き関節回転計算
  const calculateJointRotation = (
    parentIndex: number, 
    jointIndex: number, 
    childIndex: number, 
    jointName: string,
    minVisibility: number = 0.7
  ): THREE.Quaternion | null => {
    // 厳格な可視性チェック
    if (!isLandmarkVisible(parentIndex, minVisibility) || 
        !isLandmarkVisible(jointIndex, minVisibility) || 
        !isLandmarkVisible(childIndex, minVisibility)) {
      console.log(`❌ ${jointName}: 可視性不足によりスキップ`);
      return null;
    }

    const parentPos = getPosition(parentIndex);
    const jointPos = getPosition(jointIndex);
    const childPos = getPosition(childIndex);
    
    // ベクトルの品質チェック
    const toChild = childPos.clone().sub(jointPos);
    const toParent = parentPos.clone().sub(jointPos);
    
    if (toChild.length() < 0.01 || toParent.length() < 0.01) {
      console.log(`❌ ${jointName}: ベクトルが短すぎます`);
      return null;
    }
    
    toChild.normalize();
    toParent.normalize();
    
    // より自然な回転計算（Y-bot用に最適化）
    const defaultDirection = new THREE.Vector3(0, -1, 0); // Y-botの標準下向き
    const currentDirection = toChild;
    
    const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultDirection, currentDirection);
    
    console.log(`✅ ${jointName}: 高品質回転計算成功`);
    return quaternion;
  };

  try {
    console.log('🧮 関節角度計算開始...');
    console.log(`📊 受信したランドマーク数: ${landmarks.length}`);
    
    // 🔍 調査1: MediaPipeの生データを詳細に調査
    console.log('\n📋 MediaPipe生データ調査:');
    const keyLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    keyLandmarks.forEach(index => {
      const landmark = landmarks[index];
      if (landmark) {
        console.log(`  [${index}] 生座標: x=${landmark.x.toFixed(4)}, y=${landmark.y.toFixed(4)}, z=${landmark.z?.toFixed(4) || 'undefined'}, visibility=${landmark.visibility?.toFixed(3) || 'undefined'}`);
        
        // 変換後座標も表示
        const converted = getPosition(index);
        console.log(`       変換後: x=${converted.x.toFixed(4)}, y=${converted.y.toFixed(4)}, z=${converted.z.toFixed(4)}`);
      }
    });
    
    // 🔍 調査2: 座標系の整合性チェック
    console.log('\n🔍 座標系整合性チェック:');
    if (landmarks[11] && landmarks[12]) {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      console.log(`  左肩 vs 右肩: x差=${(rightShoulder.x - leftShoulder.x).toFixed(4)} (正の値=右肩が右側)`);
      console.log(`  MediaPipe座標系: 左肩x=${leftShoulder.x.toFixed(4)}, 右肩x=${rightShoulder.x.toFixed(4)}`);
    }
    
    // 重要なランドマークの可視性を確認
    const importantLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    console.log('\n🔍 重要なランドマークの状態:');
    importantLandmarks.forEach(index => {
      const landmark = landmarks[index];
      if (landmark) {
        console.log(`  [${index}] visibility: ${landmark.visibility?.toFixed(3) || 'undefined'}, x: ${landmark.x.toFixed(3)}, y: ${landmark.y.toFixed(3)}`);
      } else {
        console.log(`  [${index}] 欠損`);
      }
    });
    
    // 🔧 品質重視の関節計算
    console.log('\n🎯 品質重視の関節計算開始...');
    
    // 🔧 改善された肩の計算（肩→肘のベクトルベース）
    if (isLandmarkVisible(11, 0.8) && isLandmarkVisible(13, 0.5)) {
      console.log('🔧 左肩の改善された回転計算中...');
      const leftShoulderPos = getPosition(11);
      const leftElbowPos = getPosition(13);
      
      // 肩から肘への方向ベクトル
      const armDirection = leftElbowPos.clone().sub(leftShoulderPos).normalize();
      
      // Y-botの標準腕姿勢（下向き）から現在の腕方向への回転
      const defaultArmDirection = new THREE.Vector3(0, -1, 0); // Y-bot標準：腕は下向き
      
      const leftShoulderRotation = new THREE.Quaternion().setFromUnitVectors(defaultArmDirection, armDirection);
      rotations['leftShoulder'] = leftShoulderRotation;
      console.log('✅ 左肩の高品質回転計算成功');
    }
    
    if (isLandmarkVisible(12, 0.8) && isLandmarkVisible(14, 0.5)) {
      console.log('🔧 右肩の改善された回転計算中...');
      const rightShoulderPos = getPosition(12);
      const rightElbowPos = getPosition(14);
      
      // 肩から肘への方向ベクトル
      const armDirection = rightElbowPos.clone().sub(rightShoulderPos).normalize();
      
      // Y-botの標準腕姿勢（下向き）から現在の腕方向への回転
      const defaultArmDirection = new THREE.Vector3(0, -1, 0); // Y-bot標準：腕は下向き
      
      const rightShoulderRotation = new THREE.Quaternion().setFromUnitVectors(defaultArmDirection, armDirection);
      rotations['rightShoulder'] = rightShoulderRotation;
      console.log('✅ 右肩の高品質回転計算成功');
    }
    
    // 🔧 改善された肘の計算（上腕→前腕のベクトルベース）
    if (isLandmarkVisible(11, 0.7) && isLandmarkVisible(13, 0.5) && isLandmarkVisible(15, 0.3)) {
      console.log('🔧 左肘の改善された回転計算中...');
      const leftShoulderPos = getPosition(11);
      const leftElbowPos = getPosition(13);
      const leftWristPos = getPosition(15);
      
      // 上腕と前腕のベクトル
      const upperArmDir = leftElbowPos.clone().sub(leftShoulderPos).normalize();
      const forearmDir = leftWristPos.clone().sub(leftElbowPos).normalize();
      
      // 上腕方向から前腕方向への回転（肘の曲がり具合）
      const leftElbowRotation = new THREE.Quaternion().setFromUnitVectors(upperArmDir, forearmDir);
      rotations['leftElbow'] = leftElbowRotation;
      console.log('✅ 左肘の高品質回転計算成功');
    }
    
    if (isLandmarkVisible(12, 0.7) && isLandmarkVisible(14, 0.5) && isLandmarkVisible(16, 0.3)) {
      console.log('🔧 右肘の改善された回転計算中...');
      const rightShoulderPos = getPosition(12);
      const rightElbowPos = getPosition(14);
      const rightWristPos = getPosition(16);
      
      // 上腕と前腕のベクトル
      const upperArmDir = rightElbowPos.clone().sub(rightShoulderPos).normalize();
      const forearmDir = rightWristPos.clone().sub(rightElbowPos).normalize();
      
      // 上腕方向から前腕方向への回転（肘の曲がり具合）
      const rightElbowRotation = new THREE.Quaternion().setFromUnitVectors(upperArmDir, forearmDir);
      rotations['rightElbow'] = rightElbowRotation;
      console.log('✅ 右肘の高品質回転計算成功');
    }
    
    // 体幹の計算（肩と腰の中心を使用）
    if (isLandmarkVisible(11, 0.8) && isLandmarkVisible(12, 0.8) && 
        isLandmarkVisible(23, 0.3) && isLandmarkVisible(24, 0.3)) {
      const leftShoulder = getPosition(11);
      const rightShoulder = getPosition(12);
      const leftHip = getPosition(23);
      const rightHip = getPosition(24);
      
      const shoulderCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
      const hipCenter = leftHip.clone().add(rightHip).multiplyScalar(0.5);
      
      const spineDirection = shoulderCenter.clone().sub(hipCenter).normalize();
      const defaultSpine = new THREE.Vector3(0, 1, 0);
      
      const spineRotation = new THREE.Quaternion().setFromUnitVectors(defaultSpine, spineDirection);
      rotations['spine'] = spineRotation;
      console.log('✅ 体幹の回転計算成功');
    }
    
    // 🔧 改善された足の付け根の計算（腰→膝のベクトルベース）
    if (isLandmarkVisible(23, 0.4) && isLandmarkVisible(25, 0.3)) {
      console.log('🔧 左足の付け根の改善された回転計算中...');
      const leftHipPos = getPosition(23);
      const leftKneePos = getPosition(25);
      
      // 腰から膝への方向ベクトル
      const thighDirection = leftKneePos.clone().sub(leftHipPos).normalize();
      
      // Y-botの標準太もも姿勢（下向き）から現在の太もも方向への回転
      const defaultThighDirection = new THREE.Vector3(0, -1, 0); // Y-bot標準：太ももは下向き
      
      const leftHipRotation = new THREE.Quaternion().setFromUnitVectors(defaultThighDirection, thighDirection);
      rotations['leftHip'] = leftHipRotation;
      console.log('✅ 左足の付け根の高品質回転計算成功');
    }
    
    if (isLandmarkVisible(24, 0.4) && isLandmarkVisible(26, 0.3)) {
      console.log('🔧 右足の付け根の改善された回転計算中...');
      const rightHipPos = getPosition(24);
      const rightKneePos = getPosition(26);
      
      // 腰から膝への方向ベクトル
      const thighDirection = rightKneePos.clone().sub(rightHipPos).normalize();
      
      // Y-botの標準太もも姿勢（下向き）から現在の太もも方向への回転
      const defaultThighDirection = new THREE.Vector3(0, -1, 0); // Y-bot標準：太ももは下向き
      
      const rightHipRotation = new THREE.Quaternion().setFromUnitVectors(defaultThighDirection, thighDirection);
      rotations['rightHip'] = rightHipRotation;
      console.log('✅ 右足の付け根の高品質回転計算成功');
    }
    
    // 🔧 改善された膝の計算（太もも→すねのベクトルベース）
    if (isLandmarkVisible(23, 0.3) && isLandmarkVisible(25, 0.2) && isLandmarkVisible(27, 0.1)) {
      console.log('🔧 左膝の改善された回転計算中...');
      const leftHipPos = getPosition(23);
      const leftKneePos = getPosition(25);
      const leftAnklePos = getPosition(27);
      
      // 太ももとすねのベクトル
      const thighDir = leftKneePos.clone().sub(leftHipPos).normalize();
      const shinDir = leftAnklePos.clone().sub(leftKneePos).normalize();
      
      // 太もも方向からすね方向への回転（膝の曲がり具合）
      const leftKneeRotation = new THREE.Quaternion().setFromUnitVectors(thighDir, shinDir);
      rotations['leftKnee'] = leftKneeRotation;
      console.log('✅ 左膝の高品質回転計算成功');
    }
    
    if (isLandmarkVisible(24, 0.3) && isLandmarkVisible(26, 0.2) && isLandmarkVisible(28, 0.1)) {
      console.log('🔧 右膝の改善された回転計算中...');
      const rightHipPos = getPosition(24);
      const rightKneePos = getPosition(26);
      const rightAnklePos = getPosition(28);
      
      // 太ももとすねのベクトル
      const thighDir = rightKneePos.clone().sub(rightHipPos).normalize();
      const shinDir = rightAnklePos.clone().sub(rightKneePos).normalize();
      
      // 太もも方向からすね方向への回転（膝の曲がり具合）
      const rightKneeRotation = new THREE.Quaternion().setFromUnitVectors(thighDir, shinDir);
      rotations['rightKnee'] = rightKneeRotation;
      console.log('✅ 右膝の高品質回転計算成功');
    }
    
    console.log(`🎯 計算完了: ${Object.keys(rotations).length}個の関節角度`);
    console.log('📝 計算された関節一覧:', Object.keys(rotations));
    return rotations;
    
  } catch (error) {
    console.error('❌ 角度計算エラー:', error);
    return null;
  }
}

/**
 * 計算された関節角度を3Dモデルのスケルトンに適用
 */
export function applyRotationsToSkeleton(
  skeleton: THREE.Skeleton,
  rotations: { [key: string]: THREE.Quaternion },
  boneMap: { [key: string]: number }
) {
  if (!skeleton || !rotations || !boneMap) return;
  
  // 各関節の回転を適用
  Object.entries(boneMap).forEach(([jointName, boneIndex]) => {
    const rotation = rotations[jointName];
    if (rotation && boneIndex >= 0 && boneIndex < skeleton.bones.length) {
      skeleton.bones[boneIndex].quaternion.copy(rotation);
    }
  });
  
  // スケルトンの更新
  skeleton.update();
} 