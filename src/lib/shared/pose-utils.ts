import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

/**
 * MediaPipeのポーズランドマークから主要な関節角度を計算
 * MediaPipeの座標（x: 0-1, y: 0-1, z: 相対深度）から3D回転を計算
 */
export function calculateJointRotations(poseData: PoseLandmarkerResult): { [key: string]: THREE.Quaternion } | null {
  if (!poseData || !poseData.landmarks || poseData.landmarks.length === 0) {
    return null;
  }

  const landmarks = poseData.landmarks[0];
  const rotations: { [key: string]: THREE.Quaternion } = {};

  // MediaPipeの座標を3D空間に変換
  const getPosition = (landmarkIndex: number): THREE.Vector3 => {
    const landmark = landmarks[landmarkIndex];
    if (!landmark) return new THREE.Vector3(0, 0, 0);
    
    return new THREE.Vector3(
      (landmark.x - 0.5) * 10,  // -5 to 5
      (0.5 - landmark.y) * 10,  // -5 to 5 (Y軸反転)
      (landmark.z || 0) * 4     // -2 to 2
    );
  };

  // 3点から関節の回転を計算する関数
  const calculateJointRotation = (parentIndex: number, jointIndex: number, childIndex: number): THREE.Quaternion => {
    const parentPos = getPosition(parentIndex);
    const jointPos = getPosition(jointIndex);
    const childPos = getPosition(childIndex);
    
    // 関節から親と子への方向ベクトル
    const toParent = parentPos.clone().sub(jointPos).normalize();
    const toChild = childPos.clone().sub(jointPos).normalize();
    
    // デフォルトの向き（Y軸負方向 = 下向き）
    const defaultDirection = new THREE.Vector3(0, -1, 0);
    
    // 子方向への回転を計算
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(defaultDirection, toChild);
    
    return quaternion;
  };

  try {
    console.log('🧮 関節角度計算開始...');
    
    // 左肩の回転（左肩→左肘）
    if (landmarks[11] && landmarks[13]) {
      rotations['leftShoulder'] = calculateJointRotation(12, 11, 13); // 右肩→左肩→左肘
      console.log('✅ 左肩の回転を計算');
    }
    
    // 右肩の回転（右肩→右肘）
    if (landmarks[12] && landmarks[14]) {
      rotations['rightShoulder'] = calculateJointRotation(11, 12, 14); // 左肩→右肩→右肘
      console.log('✅ 右肩の回転を計算');
    }
    
    // 左肘の回転（左肩→左肘→左手首）
    if (landmarks[11] && landmarks[13] && landmarks[15]) {
      rotations['leftElbow'] = calculateJointRotation(11, 13, 15);
      console.log('✅ 左肘の回転を計算');
    }
    
    // 右肘の回転（右肩→右肘→右手首）
    if (landmarks[12] && landmarks[14] && landmarks[16]) {
      rotations['rightElbow'] = calculateJointRotation(12, 14, 16);
      console.log('✅ 右肘の回転を計算');
    }
    
    // 左股関節の回転（腰→左股関節→左膝）
    if (landmarks[23] && landmarks[25]) {
      rotations['leftHip'] = calculateJointRotation(24, 23, 25); // 右腰→左腰→左膝
      console.log('✅ 左股関節の回転を計算');
    }
    
    // 右股関節の回転（腰→右股関節→右膝）
    if (landmarks[24] && landmarks[26]) {
      rotations['rightHip'] = calculateJointRotation(23, 24, 26); // 左腰→右腰→右膝
      console.log('✅ 右股関節の回転を計算');
    }
    
    // 左膝の回転（左股関節→左膝→左足首）
    if (landmarks[23] && landmarks[25] && landmarks[27]) {
      rotations['leftKnee'] = calculateJointRotation(23, 25, 27);
      console.log('✅ 左膝の回転を計算');
    }
    
    // 右膝の回転（右股関節→右膝→右足首）
    if (landmarks[24] && landmarks[26] && landmarks[28]) {
      rotations['rightKnee'] = calculateJointRotation(24, 26, 28);
      console.log('✅ 右膝の回転を計算');
    }
    
    // 胴体（脊椎）の回転
    if (landmarks[11] && landmarks[12] && landmarks[23] && landmarks[24]) {
      const shoulderCenter = getPosition(11).clone().add(getPosition(12)).multiplyScalar(0.5);
      const hipCenter = getPosition(23).clone().add(getPosition(24)).multiplyScalar(0.5);
      const spineDirection = shoulderCenter.clone().sub(hipCenter).normalize();
      
      const defaultSpine = new THREE.Vector3(0, 1, 0); // 上向き
      rotations['spine'] = new THREE.Quaternion().setFromUnitVectors(defaultSpine, spineDirection);
      console.log('✅ 脊椎の回転を計算');
    }
    
    console.log(`🎯 計算完了: ${Object.keys(rotations).length}個の関節角度`);
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