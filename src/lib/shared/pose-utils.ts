import * as THREE from 'three';
import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * MediaPipeのポーズランドマークから主要な関節角度を計算
 * 返り値は各関節の回転を表すQuaternion
 */
export function calculateJointRotations(poseData: PoseLandmarkerResult) {
  if (!poseData || !poseData.landmarks || poseData.landmarks.length === 0) {
    return null;
  }

  const landmarks = poseData.landmarks[0];
  const rotations: { [key: string]: THREE.Quaternion } = {};

  // ベクトルを作成する関数
  const createVector = (landmark1: number, landmark2: number) => {
    const start = landmarks[landmark1];
    const end = landmarks[landmark2];
    return new THREE.Vector3(
      end.x - start.x,
      end.y - start.y,
      (end.z || 0) - (start.z || 0)
    ).normalize();
  };

  // 3点から角度を計算する関数
  const calculateRotation = (joint: number, parent: number, child: number) => {
    // 基準となる親->関節ベクトル
    const parentVector = createVector(parent, joint);
    // 計算対象の関節->子ベクトル
    const childVector = createVector(joint, child);
    
    // 回転を計算（親ベクトルを基準として子ベクトルの方向を向かせる）
    const quaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0); // デフォルトの上方向
    
    // 2つのベクトル間の回転を計算
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.lookAt(
      new THREE.Vector3(0, 0, 0), // 原点
      childVector,                // 向きたい方向
      upVector                    // 上方向
    );
    
    quaternion.setFromRotationMatrix(rotationMatrix);
    return quaternion;
  };

  try {
    // 肩の回転（胴体を基準）
    rotations['leftShoulder'] = calculateRotation(
      11, // 左肩
      12, // 右肩（胴体の向きを決める）
      13  // 左肘
    );
    
    rotations['rightShoulder'] = calculateRotation(
      12, // 右肩
      11, // 左肩（胴体の向きを決める）
      14  // 右肘
    );
    
    // 肘の回転
    rotations['leftElbow'] = calculateRotation(
      13, // 左肘
      11, // 左肩
      15  // 左手首
    );
    
    rotations['rightElbow'] = calculateRotation(
      14, // 右肘
      12, // 右肩
      16  // 右手首
    );
    
    // 股関節の回転
    rotations['leftHip'] = calculateRotation(
      23, // 左腰
      24, // 右腰
      25  // 左膝
    );
    
    rotations['rightHip'] = calculateRotation(
      24, // 右腰
      23, // 左腰
      26  // 右膝
    );
    
    // 膝の回転
    rotations['leftKnee'] = calculateRotation(
      25, // 左膝
      23, // 左腰
      27  // 左足首
    );
    
    rotations['rightKnee'] = calculateRotation(
      26, // 右膝
      24, // 右腰
      28  // 右足首
    );
    
    // 胴体の回転（左右の肩と腰から計算）
    const shoulderCenter = new THREE.Vector3(
      (landmarks[11].x + landmarks[12].x) / 2,
      (landmarks[11].y + landmarks[12].y) / 2,
      ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2
    );
    
    const hipCenter = new THREE.Vector3(
      (landmarks[23].x + landmarks[24].x) / 2,
      (landmarks[23].y + landmarks[24].y) / 2,
      ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2
    );
    
    const spineVector = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
    const forwardVector = new THREE.Vector3(0, 0, 1);
    
    rotations['spine'] = new THREE.Quaternion().setFromUnitVectors(forwardVector, spineVector);
    
    return rotations;
  } catch (error) {
    console.error('角度計算エラー:', error);
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