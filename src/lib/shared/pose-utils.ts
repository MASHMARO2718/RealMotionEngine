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

  // ランドマークの可視性をチェック（より寛容に）
  const isLandmarkVisible = (index: number): boolean => {
    const landmark = landmarks[index];
    if (!landmark) {
      console.log(`⚠️ ランドマーク ${index} が存在しません`);
      return false;
    }
    
    const visible = landmark.visibility === undefined || landmark.visibility > 0.3; // 0.5 → 0.3に緩和
    if (!visible) {
      console.log(`⚠️ ランドマーク ${index} の可視性が低い: ${landmark.visibility}`);
    }
    return visible;
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
      console.log(`⚠️ 関節計算スキップ: 親${parentIndex}, 関節${jointIndex}, 子${childIndex} の可視性不足`);
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
    
    console.log(`✅ 関節回転計算成功: 親${parentIndex}→関節${jointIndex}→子${childIndex}`);
    return quaternion;
  };

  try {
    console.log('🧮 関節角度計算開始...');
    console.log(`📊 受信したランドマーク数: ${landmarks.length}`);
    
    // 重要なランドマークの可視性を確認
    const importantLandmarks = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    console.log('🔍 重要なランドマークの状態:');
    importantLandmarks.forEach(index => {
      const landmark = landmarks[index];
      if (landmark) {
        console.log(`  [${index}] visibility: ${landmark.visibility?.toFixed(3) || 'undefined'}, x: ${landmark.x.toFixed(3)}, y: ${landmark.y.toFixed(3)}`);
      } else {
        console.log(`  [${index}] 欠損`);
      }
    });
    
    // 可視性を無視して強制的に基本的な関節を計算（テスト用）
    console.log('🧪 強制的に基本関節を計算中...');
    
    // 左肩の回転（強制）- ランドマーク11（左肩）が存在する場合
    if (landmarks[11] && landmarks[13]) {
      console.log('🔧 左肩の回転を強制計算中...');
      const leftShoulderPos = getPosition(11);
      const leftElbowPos = getPosition(13);
      
      // 基本的な回転を計算（とりあえず腕を下ろした状態から始める）
      const armDirection = leftElbowPos.clone().sub(leftShoulderPos).normalize();
      const defaultDirection = new THREE.Vector3(1, 0, 0); // X軸方向
      
      const leftShoulderRotation = new THREE.Quaternion().setFromUnitVectors(defaultDirection, armDirection);
      rotations['leftShoulder'] = leftShoulderRotation;
      console.log('✅ 左肩の回転を計算（強制）');
    }
    
    // 右肩の回転（強制）
    if (landmarks[12] && landmarks[14]) {
      console.log('🔧 右肩の回転を強制計算中...');
      const rightShoulderPos = getPosition(12);
      const rightElbowPos = getPosition(14);
      
      const armDirection = rightElbowPos.clone().sub(rightShoulderPos).normalize();
      const defaultDirection = new THREE.Vector3(-1, 0, 0); // -X軸方向（右腕）
      
      const rightShoulderRotation = new THREE.Quaternion().setFromUnitVectors(defaultDirection, armDirection);
      rotations['rightShoulder'] = rightShoulderRotation;
      console.log('✅ 右肩の回転を計算（強制）');
    }
    
    // 左肘の回転（強制）
    if (landmarks[11] && landmarks[13] && landmarks[15]) {
      console.log('🔧 左肘の回転を強制計算中...');
      const leftShoulderPos = getPosition(11);
      const leftElbowPos = getPosition(13);
      const leftWristPos = getPosition(15);
      
      const upperArmDirection = leftElbowPos.clone().sub(leftShoulderPos).normalize();
      const forearmDirection = leftWristPos.clone().sub(leftElbowPos).normalize();
      
      const leftElbowRotation = new THREE.Quaternion().setFromUnitVectors(upperArmDirection, forearmDirection);
      rotations['leftElbow'] = leftElbowRotation;
      console.log('✅ 左肘の回転を計算（強制）');
    }
    
    // 右肘の回転（強制）
    if (landmarks[12] && landmarks[14] && landmarks[16]) {
      console.log('🔧 右肘の回転を強制計算中...');
      const rightShoulderPos = getPosition(12);
      const rightElbowPos = getPosition(14);
      const rightWristPos = getPosition(16);
      
      const upperArmDirection = rightElbowPos.clone().sub(rightShoulderPos).normalize();
      const forearmDirection = rightWristPos.clone().sub(rightElbowPos).normalize();
      
      const rightElbowRotation = new THREE.Quaternion().setFromUnitVectors(upperArmDirection, forearmDirection);
      rotations['rightElbow'] = rightElbowRotation;
      console.log('✅ 右肘の回転を計算（強制）');
    }
    
    // 胴体（脊椎）の回転を追加
    if (landmarks[11] && landmarks[12] && landmarks[23] && landmarks[24]) {
      console.log('🔧 胴体の回転を強制計算中...');
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
      console.log('✅ 胴体の回転を計算（強制）');
    }
    
    // 左太もも（ヒップ）の回転を追加
    if (landmarks[23] && landmarks[25]) {
      console.log('🔧 左太ももの回転を強制計算中...');
      const leftHip = getPosition(23);
      const leftKnee = getPosition(25);
      
      const thighDirection = leftKnee.clone().sub(leftHip).normalize();
      const defaultThigh = new THREE.Vector3(0, -1, 0);
      
      const leftThighRotation = new THREE.Quaternion().setFromUnitVectors(defaultThigh, thighDirection);
      rotations['leftHip'] = leftThighRotation;
      console.log('✅ 左太ももの回転を計算（強制）');
    }
    
    // 右太もも（ヒップ）の回転を追加
    if (landmarks[24] && landmarks[26]) {
      console.log('🔧 右太ももの回転を強制計算中...');
      const rightHip = getPosition(24);
      const rightKnee = getPosition(26);
      
      const thighDirection = rightKnee.clone().sub(rightHip).normalize();
      const defaultThigh = new THREE.Vector3(0, -1, 0);
      
      const rightThighRotation = new THREE.Quaternion().setFromUnitVectors(defaultThigh, thighDirection);
      rotations['rightHip'] = rightThighRotation;
      console.log('✅ 右太ももの回転を計算（強制）');
    }
    
    // 左膝の回転を追加
    if (landmarks[23] && landmarks[25] && landmarks[27]) {
      console.log('🔧 左膝の回転を強制計算中...');
      const leftHip = getPosition(23);
      const leftKnee = getPosition(25);
      const leftAnkle = getPosition(27);
      
      const thighDirection = leftKnee.clone().sub(leftHip).normalize();
      const shinDirection = leftAnkle.clone().sub(leftKnee).normalize();
      
      const leftKneeRotation = new THREE.Quaternion().setFromUnitVectors(thighDirection, shinDirection);
      rotations['leftKnee'] = leftKneeRotation;
      console.log('✅ 左膝の回転を計算（強制）');
    }
    
    // 右膝の回転を追加
    if (landmarks[24] && landmarks[26] && landmarks[28]) {
      console.log('🔧 右膝の回転を強制計算中...');
      const rightHip = getPosition(24);
      const rightKnee = getPosition(26);
      const rightAnkle = getPosition(28);
      
      const thighDirection = rightKnee.clone().sub(rightHip).normalize();
      const shinDirection = rightAnkle.clone().sub(rightKnee).normalize();
      
      const rightKneeRotation = new THREE.Quaternion().setFromUnitVectors(thighDirection, shinDirection);
      rotations['rightKnee'] = rightKneeRotation;
      console.log('✅ 右膝の回転を計算（強制）');
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