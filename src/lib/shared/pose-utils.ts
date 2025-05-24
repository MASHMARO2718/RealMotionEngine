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

  // MediaPipeの座標を3D空間に変換（スケールを調整）
  const getPosition = (landmarkIndex: number): THREE.Vector3 => {
    const landmark = landmarks[landmarkIndex];
    if (!landmark) return new THREE.Vector3(0, 0, 0);
    
    return new THREE.Vector3(
      (landmark.x - 0.5) * 2,    // -1 to 1 (幅を狭めて正規化)
      (0.5 - landmark.y) * 2,   // -1 to 1 (Y軸反転、高さも正規化)
      (landmark.z || 0) * 2      // -1 to 1 (深度も正規化)
    );
  };

  // ランドマークの可視性をチェック
  const isLandmarkVisible = (index: number): boolean => {
    const landmark = landmarks[index];
    return landmark && (landmark.visibility === undefined || landmark.visibility > 0.5);
  };

  // 3点から関節の回転を計算する関数（改善版）
  const calculateJointRotation = (
    parentIndex: number, 
    jointIndex: number, 
    childIndex: number, 
    upVector: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  ): THREE.Quaternion => {
    // 可視性チェック
    if (!isLandmarkVisible(parentIndex) || !isLandmarkVisible(jointIndex) || !isLandmarkVisible(childIndex)) {
      return new THREE.Quaternion(); // アイデンティティ
    }

    const parentPos = getPosition(parentIndex);
    const jointPos = getPosition(jointIndex);
    const childPos = getPosition(childIndex);
    
    // ベクトルを計算
    const toParent = parentPos.clone().sub(jointPos).normalize();
    const toChild = childPos.clone().sub(jointPos).normalize();
    
    // 関節の向きを計算（子の方向をメイン）
    const jointDirection = toChild;
    
    // サイドベクトルを計算（親→子と上ベクトルの外積）
    const sideVector = jointDirection.clone().cross(upVector).normalize();
    
    // より自然な上ベクトルを再計算
    const naturalUpVector = sideVector.clone().cross(jointDirection).normalize();
    
    // 回転行列を作成
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(sideVector, naturalUpVector, jointDirection);
    
    // クォータニオンに変換
    const quaternion = new THREE.Quaternion();
    quaternion.setFromRotationMatrix(rotationMatrix);
    
    return quaternion;
  };

  try {
    console.log('🧮 関節角度計算開始...');
    
    // 胴体（脊椎）の回転を最初に計算（基準となる）
    if (isLandmarkVisible(11) && isLandmarkVisible(12) && isLandmarkVisible(23) && isLandmarkVisible(24)) {
      const leftShoulder = getPosition(11);
      const rightShoulder = getPosition(12);
      const leftHip = getPosition(23);
      const rightHip = getPosition(24);
      
      const shoulderCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
      const hipCenter = leftHip.clone().add(rightHip).multiplyScalar(0.5);
      
      // 胴体の方向（腰から肩へ）
      const spineDirection = shoulderCenter.clone().sub(hipCenter).normalize();
      
      // 肩のライン（左肩から右肩へ）
      const shoulderLine = rightShoulder.clone().sub(leftShoulder).normalize();
      
      // 胴体の回転を計算
      const defaultSpine = new THREE.Vector3(0, 1, 0);
      const spineRotation = new THREE.Quaternion().setFromUnitVectors(defaultSpine, spineDirection);
      
      rotations['spine'] = spineRotation;
      console.log('✅ 脊椎の回転を計算');
    }
    
    // 左肩の回転（胴体→左肩→左肘）
    if (isLandmarkVisible(11) && isLandmarkVisible(13)) {
      const upVector = new THREE.Vector3(0, 1, 0); // 肩の上方向
      rotations['leftShoulder'] = calculateJointRotation(23, 11, 13, upVector); // 左腰→左肩→左肘
      console.log('✅ 左肩の回転を計算');
    }
    
    // 右肩の回転（胴体→右肩→右肘）
    if (isLandmarkVisible(12) && isLandmarkVisible(14)) {
      const upVector = new THREE.Vector3(0, 1, 0);
      rotations['rightShoulder'] = calculateJointRotation(24, 12, 14, upVector); // 右腰→右肩→右肘
      console.log('✅ 右肩の回転を計算');
    }
    
    // 左肘の回転（左肩→左肘→左手首）
    if (isLandmarkVisible(11) && isLandmarkVisible(13) && isLandmarkVisible(15)) {
      const sideVector = new THREE.Vector3(1, 0, 0); // 肘の横方向
      rotations['leftElbow'] = calculateJointRotation(11, 13, 15, sideVector);
      console.log('✅ 左肘の回転を計算');
    }
    
    // 右肘の回転（右肩→右肘→右手首）
    if (isLandmarkVisible(12) && isLandmarkVisible(14) && isLandmarkVisible(16)) {
      const sideVector = new THREE.Vector3(-1, 0, 0); // 肘の横方向（右は反対）
      rotations['rightElbow'] = calculateJointRotation(12, 14, 16, sideVector);
      console.log('✅ 右肘の回転を計算');
    }
    
    // 左股関節の回転（胴体→左股関節→左膝）
    if (isLandmarkVisible(23) && isLandmarkVisible(25)) {
      const forwardVector = new THREE.Vector3(0, 0, -1); // 股関節の前方向
      rotations['leftHip'] = calculateJointRotation(11, 23, 25, forwardVector); // 左肩→左腰→左膝
      console.log('✅ 左股関節の回転を計算');
    }
    
    // 右股関節の回転（胴体→右股関節→右膝）
    if (isLandmarkVisible(24) && isLandmarkVisible(26)) {
      const forwardVector = new THREE.Vector3(0, 0, -1);
      rotations['rightHip'] = calculateJointRotation(12, 24, 26, forwardVector); // 右肩→右腰→右膝
      console.log('✅ 右股関節の回転を計算');
    }
    
    // 左膝の回転（左股関節→左膝→左足首）
    if (isLandmarkVisible(23) && isLandmarkVisible(25) && isLandmarkVisible(27)) {
      const sideVector = new THREE.Vector3(1, 0, 0); // 膝の横方向
      rotations['leftKnee'] = calculateJointRotation(23, 25, 27, sideVector);
      console.log('✅ 左膝の回転を計算');
    }
    
    // 右膝の回転（右股関節→右膝→右足首）
    if (isLandmarkVisible(24) && isLandmarkVisible(26) && isLandmarkVisible(28)) {
      const sideVector = new THREE.Vector3(-1, 0, 0); // 膝の横方向（右は反対）
      rotations['rightKnee'] = calculateJointRotation(24, 26, 28, sideVector);
      console.log('✅ 右膝の回転を計算');
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