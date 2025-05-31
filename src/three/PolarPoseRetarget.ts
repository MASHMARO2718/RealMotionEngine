import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

/**
 * Polar座標系ベースのポーズリターゲティングシステム
 * MediaPipeの姿勢データを3Dアバターにマッピング
 */
export class PolarPoseRetarget {
  private floorNormal = new THREE.Vector3(0, 1, 0);
  private smoothingFactor = 0.1;
  private previousRotations = new Map<string, THREE.Quaternion>();

  constructor(smoothingFactor = 0.1) {
    this.smoothingFactor = smoothingFactor;
  }

  /**
   * 床法線ベクトルを設定
   */
  setFloorNormal(normal: THREE.Vector3) {
    this.floorNormal.copy(normal).normalize();
  }

  /**
   * MediaPipeランドマークから3D位置を計算
   */
  private landmarkToVector3(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      -landmark.x, // MediaPipeのX軸を反転
      -landmark.y, // MediaPipeのY軸を反転
      landmark.z
    );
  }

  /**
   * 2つのベクトル間の回転クォータニオンを計算
   */
  private getRotationBetweenVectors(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(from.normalize(), to.normalize());
    return quaternion;
  }

  /**
   * 関節の向きベクトルを計算
   */
  private calculateJointDirection(fromLandmark: any, toLandmark: any): THREE.Vector3 {
    const from = this.landmarkToVector3(fromLandmark);
    const to = this.landmarkToVector3(toLandmark);
    return to.sub(from).normalize();
  }

  /**
   * スムージング適用
   */
  private applySmoothingToRotation(jointName: string, newRotation: THREE.Quaternion): THREE.Quaternion {
    const previous = this.previousRotations.get(jointName);
    if (!previous) {
      this.previousRotations.set(jointName, newRotation.clone());
      return newRotation;
    }

    const smoothed = previous.slerp(newRotation, this.smoothingFactor);
    this.previousRotations.set(jointName, smoothed.clone());
    return smoothed;
  }

  /**
   * 関節回転を計算
   */
  calculateJointRotations(poseData: PoseLandmarkerResult): Record<string, THREE.Quaternion> {
    if (!poseData.landmarks?.[0]) {
      return {};
    }

    const landmarks = poseData.landmarks[0];
    const rotations: Record<string, THREE.Quaternion> = {};

    try {
      // 肩の回転（左）
      if (landmarks[11] && landmarks[13]) {
        const shoulderDir = this.calculateJointDirection(landmarks[11], landmarks[13]);
        const defaultDir = new THREE.Vector3(1, 0, 0); // 右向き
        const rotation = this.getRotationBetweenVectors(defaultDir, shoulderDir);
        rotations.leftShoulder = this.applySmoothingToRotation('leftShoulder', rotation);
      }

      // 肩の回転（右）
      if (landmarks[12] && landmarks[14]) {
        const shoulderDir = this.calculateJointDirection(landmarks[12], landmarks[14]);
        const defaultDir = new THREE.Vector3(-1, 0, 0); // 左向き
        const rotation = this.getRotationBetweenVectors(defaultDir, shoulderDir);
        rotations.rightShoulder = this.applySmoothingToRotation('rightShoulder', rotation);
      }

      // 肘の回転（左）
      if (landmarks[13] && landmarks[15]) {
        const elbowDir = this.calculateJointDirection(landmarks[13], landmarks[15]);
        const defaultDir = new THREE.Vector3(1, 0, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, elbowDir);
        rotations.leftElbow = this.applySmoothingToRotation('leftElbow', rotation);
      }

      // 肘の回転（右）
      if (landmarks[14] && landmarks[16]) {
        const elbowDir = this.calculateJointDirection(landmarks[14], landmarks[16]);
        const defaultDir = new THREE.Vector3(-1, 0, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, elbowDir);
        rotations.rightElbow = this.applySmoothingToRotation('rightElbow', rotation);
      }

      // 腰の回転（左）
      if (landmarks[23] && landmarks[25]) {
        const hipDir = this.calculateJointDirection(landmarks[23], landmarks[25]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, hipDir);
        rotations.leftHip = this.applySmoothingToRotation('leftHip', rotation);
      }

      // 腰の回転（右）
      if (landmarks[24] && landmarks[26]) {
        const hipDir = this.calculateJointDirection(landmarks[24], landmarks[26]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, hipDir);
        rotations.rightHip = this.applySmoothingToRotation('rightHip', rotation);
      }

      // 膝の回転（左）
      if (landmarks[25] && landmarks[27]) {
        const kneeDir = this.calculateJointDirection(landmarks[25], landmarks[27]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, kneeDir);
        rotations.leftKnee = this.applySmoothingToRotation('leftKnee', rotation);
      }

      // 膝の回転（右）
      if (landmarks[26] && landmarks[28]) {
        const kneeDir = this.calculateJointDirection(landmarks[26], landmarks[28]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, kneeDir);
        rotations.rightKnee = this.applySmoothingToRotation('rightKnee', rotation);
      }

      // 背骨の回転
      if (landmarks[11] && landmarks[12] && landmarks[23] && landmarks[24]) {
        const shoulderCenter = this.landmarkToVector3(landmarks[11]).add(this.landmarkToVector3(landmarks[12])).multiplyScalar(0.5);
        const hipCenter = this.landmarkToVector3(landmarks[23]).add(this.landmarkToVector3(landmarks[24])).multiplyScalar(0.5);
        const spineDir = shoulderCenter.sub(hipCenter).normalize();
        const defaultDir = new THREE.Vector3(0, 1, 0);
        const rotation = this.getRotationBetweenVectors(defaultDir, spineDir);
        rotations.spine = this.applySmoothingToRotation('spine', rotation);
      }

    } catch (error) {
      console.warn('Joint rotation calculation error:', error);
    }

    return rotations;
  }

  /**
   * 全身の姿勢を分析
   */
  analyzePose(poseData: PoseLandmarkerResult) {
    if (!poseData.landmarks?.[0]) {
      return null;
    }

    const landmarks = poseData.landmarks[0];
    
    return {
      confidence: poseData.landmarks[0].reduce((sum, landmark) => sum + (landmark.visibility || 0), 0) / landmarks.length,
      centerOfMass: this.calculateCenterOfMass(landmarks),
      rotations: this.calculateJointRotations(poseData),
      timestamp: Date.now()
    };
  }

  /**
   * 重心を計算
   */
  private calculateCenterOfMass(landmarks: any[]): THREE.Vector3 {
    if (landmarks.length === 0) return new THREE.Vector3();
    
    const sum = landmarks.reduce((acc, landmark) => {
      const pos = this.landmarkToVector3(landmark);
      return acc.add(pos);
    }, new THREE.Vector3());
    
    return sum.divideScalar(landmarks.length);
  }

  /**
   * 設定をリセット
   */
  reset() {
    this.previousRotations.clear();
  }
}

export default PolarPoseRetarget; 