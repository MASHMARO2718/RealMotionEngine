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
  private legCorrectionMode: 'full' | 'partial' = 'full'; // 足の補正モード

  constructor(smoothingFactor = 0.1, legCorrectionMode: 'full' | 'partial' = 'full') {
    this.smoothingFactor = smoothingFactor;
    this.legCorrectionMode = legCorrectionMode;
  }

  /**
   * 床法線ベクトルを設定
   */
  setFloorNormal(normal: THREE.Vector3) {
    this.floorNormal.copy(normal).normalize();
  }

  /**
   * 脚の補正モードを設定
   * @param mode 'full' = 180度補正, 'partial' = 80度補正
   */
  setLegCorrectionMode(mode: 'full' | 'partial') {
    this.legCorrectionMode = mode;
    console.log(`🦵 脚補正モード変更: ${mode === 'full' ? '180度' : '80度'}補正`);
  }

  /**
   * MediaPipeランドマークから3D位置を計算
   */
  private landmarkToVector3(landmark: any): THREE.Vector3 {
    // スケールを調整してモデルサイズに合わせる
    const scale = 3.0; // 3Dモデルに合わせたスケール
    return new THREE.Vector3(
      (landmark.x - 0.5) * scale, // 中央揃え & スケール
      -(landmark.y - 0.5) * scale, // 中央揃え & Y軸反転 & スケール
      landmark.z * scale // Z軸もスケール
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

      // 腰の回転（左） - Z軸180度補正
      if (landmarks[23] && landmarks[25]) {
        const hipDir = this.calculateJointDirection(landmarks[23], landmarks[25]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        let rotation = this.getRotationBetweenVectors(defaultDir, hipDir);
        
        // 左足のZ軸180度補正
        const zCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        rotation = rotation.multiply(zCorrection);
        
        rotations.leftHip = this.applySmoothingToRotation('leftHip', rotation);
      }

      // 腰の回転（右） - Z軸180度補正
      if (landmarks[24] && landmarks[26]) {
        const hipDir = this.calculateJointDirection(landmarks[24], landmarks[26]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        let rotation = this.getRotationBetweenVectors(defaultDir, hipDir);
        
        // 右足のZ軸180度補正
        const zCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        rotation = rotation.multiply(zCorrection);
        
        rotations.rightHip = this.applySmoothingToRotation('rightHip', rotation);
      }

      // 膝の回転（左） - Z軸180度補正
      if (landmarks[25] && landmarks[27]) {
        const kneeDir = this.calculateJointDirection(landmarks[25], landmarks[27]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        let rotation = this.getRotationBetweenVectors(defaultDir, kneeDir);
        
        // 左膝のZ軸180度補正
        const zCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        rotation = rotation.multiply(zCorrection);
        
        rotations.leftKnee = this.applySmoothingToRotation('leftKnee', rotation);
      }

      // 膝の回転（右） - Z軸180度補正
      if (landmarks[26] && landmarks[28]) {
        const kneeDir = this.calculateJointDirection(landmarks[26], landmarks[28]);
        const defaultDir = new THREE.Vector3(0, -1, 0);
        let rotation = this.getRotationBetweenVectors(defaultDir, kneeDir);
        
        // 右膝のZ軸180度補正
        const zCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        rotation = rotation.multiply(zCorrection);
        
        rotations.rightKnee = this.applySmoothingToRotation('rightKnee', rotation);
      }

      // 足首の回転（左） - Y軸補正（180度または80度）
      if (landmarks[27] && landmarks[31]) {
        const ankleDir = this.calculateJointDirection(landmarks[27], landmarks[31]);
        const defaultDir = new THREE.Vector3(0, 0, 1); // 前方向
        let rotation = this.getRotationBetweenVectors(defaultDir, ankleDir);
        
        // 左足首のY軸補正（補正モードに応じて角度調整）
        const correctionAngle = this.legCorrectionMode === 'full' ? Math.PI : (80 * Math.PI / 180);
        const yCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), correctionAngle);
        rotation = rotation.multiply(yCorrection);
        
        rotations.leftAnkle = this.applySmoothingToRotation('leftAnkle', rotation);
      }

      // 足首の回転（右） - Y軸補正（180度または80度）
      if (landmarks[28] && landmarks[32]) {
        const ankleDir = this.calculateJointDirection(landmarks[28], landmarks[32]);
        const defaultDir = new THREE.Vector3(0, 0, 1); // 前方向
        let rotation = this.getRotationBetweenVectors(defaultDir, ankleDir);
        
        // 右足首のY軸補正（補正モードに応じて角度調整）
        const correctionAngle = this.legCorrectionMode === 'full' ? Math.PI : (80 * Math.PI / 180);
        const yCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), correctionAngle);
        rotation = rotation.multiply(yCorrection);
        
        rotations.rightAnkle = this.applySmoothingToRotation('rightAnkle', rotation);
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

  /**
   * 体幹平面を計算（青いベクトルで構成される平面）
   */
  private calculateTorsoPlane(landmarks: any[]): {
    origin: THREE.Vector3;
    normal: THREE.Vector3;
    rightVector: THREE.Vector3;
    upVector: THREE.Vector3;
  } {
    if (!landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) {
      // デフォルト体幹平面
      return {
        origin: new THREE.Vector3(0, 0, 0),
        normal: new THREE.Vector3(0, 0, 1),
        rightVector: new THREE.Vector3(1, 0, 0),
        upVector: new THREE.Vector3(0, 1, 0)
      };
    }

    // 肩と腰の中心点を計算
    const leftShoulder = this.landmarkToVector3(landmarks[11]);
    const rightShoulder = this.landmarkToVector3(landmarks[12]);
    const leftHip = this.landmarkToVector3(landmarks[23]);
    const rightHip = this.landmarkToVector3(landmarks[24]);

    const shoulderCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5);
    const hipCenter = leftHip.clone().add(rightHip).multiplyScalar(0.5);

    // 体幹平面の基準ベクトル（青いベクトル）
    const rightVector = rightShoulder.clone().sub(leftShoulder).normalize(); // 肩の横方向
    const upVector = shoulderCenter.clone().sub(hipCenter).normalize();      // 縦方向
    const normal = rightVector.clone().cross(upVector).normalize();          // 体幹平面の法線

    // 体幹の中心を原点とする
    const origin = shoulderCenter.clone().add(hipCenter).multiplyScalar(0.5);

    return {
      origin,
      normal,
      rightVector,
      upVector
    };
  }

  /**
   * 体幹平面ベースの極座標を計算（画像の通り）
   */
  private calculateTorsoBasedPolarCoordinates(
    point: THREE.Vector3,
    torsoPlane: { origin: THREE.Vector3; normal: THREE.Vector3; rightVector: THREE.Vector3; upVector: THREE.Vector3 }
  ): { omega: number; phi: number; projectedPoint: THREE.Vector3 } {
    // 体幹平面座標系での相対位置
    const relative = point.clone().sub(torsoPlane.origin);

    // 体幹平面への射影
    const projectedPoint = relative.clone().projectOnPlane(torsoPlane.normal).add(torsoPlane.origin);

    // 体幹平面内での極座標
    const planeRelative = projectedPoint.clone().sub(torsoPlane.origin);
    const rightComponent = planeRelative.dot(torsoPlane.rightVector);
    const upComponent = planeRelative.dot(torsoPlane.upVector);

    // 極座標角度
    const omega = Math.atan2(upComponent, rightComponent);     // 体幹平面内での角度
    const phi = Math.atan2(
      relative.dot(torsoPlane.normal),                         // 体幹平面からの距離
      Math.sqrt(rightComponent * rightComponent + upComponent * upComponent) // 平面内での距離
    );

    return { omega, phi, projectedPoint };
  }

  /**
   * 極座標角度と関節角度を計算（体幹平面ベース）
   */
  calculateAnglesForVisualization(poseData: PoseLandmarkerResult): {
    polarAngles: Record<string, { theta: number; phi: number; position: THREE.Vector3; omega: number; projectedPoint: THREE.Vector3 }>;
    jointAngles: Record<string, { angle: number; position: THREE.Vector3; axis: THREE.Vector3 }>;
    torsoPlane?: { origin: THREE.Vector3; normal: THREE.Vector3; rightVector: THREE.Vector3; upVector: THREE.Vector3 };
  } {
    if (!poseData.landmarks?.[0]) {
      return { polarAngles: {}, jointAngles: {} };
    }

    const landmarks = poseData.landmarks[0];
    const polarAngles: Record<string, { theta: number; phi: number; position: THREE.Vector3; omega: number; projectedPoint: THREE.Vector3 }> = {};
    const jointAngles: Record<string, { angle: number; position: THREE.Vector3; axis: THREE.Vector3 }> = {};

    try {
      // 体幹平面を計算（青いベクトルで構成される平面）
      const torsoPlane = this.calculateTorsoPlane(landmarks);

      // 重要な関節の極座標角度を計算（体幹平面ベース）
      const keyJoints = [
        { name: 'leftShoulder', index: 11 },
        { name: 'rightShoulder', index: 12 },
        { name: 'leftElbow', index: 13 },
        { name: 'rightElbow', index: 14 },
        { name: 'leftWrist', index: 15 },
        { name: 'rightWrist', index: 16 },
        { name: 'leftHip', index: 23 },
        { name: 'rightHip', index: 24 },
      ];

      keyJoints.forEach(joint => {
        if (landmarks[joint.index]) {
          const position = this.landmarkToVector3(landmarks[joint.index]);
          
          // 体幹平面ベースの極座標を計算
          const torsoCoords = this.calculateTorsoBasedPolarCoordinates(position, torsoPlane);
          
          // 従来の極座標も計算（比較用）
          const centerOfMass = this.calculateCenterOfMass(landmarks);
          const relative = position.clone().sub(centerOfMass);
          const r = relative.length();
          const theta = Math.atan2(relative.z, relative.x);
          const phi = Math.acos(Math.max(-1, Math.min(1, relative.y / r)));
          
          polarAngles[joint.name] = {
            theta: theta,
            phi: phi,
            position: position.clone(),
            omega: torsoCoords.omega,
            projectedPoint: torsoCoords.projectedPoint
          };
        }
      });

      // 関節角度を計算（変更なし）
      const jointConfigs = [
        { name: 'leftElbow', joints: [11, 13, 15] }, // 肩-肘-手首
        { name: 'rightElbow', joints: [12, 14, 16] },
        { name: 'leftKnee', joints: [23, 25, 27] }, // 腰-膝-足首
        { name: 'rightKnee', joints: [24, 26, 28] },
        { name: 'leftShoulder', joints: [11, 12, 13] }, // 右肩-左肩-左肘
        { name: 'rightShoulder', joints: [12, 11, 14] },
        { name: 'leftHip', joints: [11, 23, 25] }, // 左肩-左腰-左膝
        { name: 'rightHip', joints: [12, 24, 26] }, // 右肩-右腰-右膝
        { name: 'leftAnkle', joints: [25, 27, 31] }, // 膝-足首-つま先（もしあれば）
        { name: 'rightAnkle', joints: [26, 28, 32] },
        { name: 'neck', joints: [11, 12, 0] }, // 左肩-右肩-鼻（首の角度）
        { name: 'spine', joints: [11, 23, 24] }, // 左肩-左腰-右腰（脊椎の角度）
      ];

      jointConfigs.forEach(config => {
        const [p1, p2, p3] = config.joints;
        if (landmarks[p1] && landmarks[p2] && landmarks[p3]) {
          const pos1 = this.landmarkToVector3(landmarks[p1]);
          const pos2 = this.landmarkToVector3(landmarks[p2]);
          const pos3 = this.landmarkToVector3(landmarks[p3]);

          const vec1 = pos1.clone().sub(pos2).normalize();
          const vec2 = pos3.clone().sub(pos2).normalize();
          
          const angle = Math.acos(Math.max(-1, Math.min(1, vec1.dot(vec2))));
          const axis = vec1.clone().cross(vec2).normalize();

          jointAngles[config.name] = {
            angle: angle,
            position: pos2.clone(),
            axis: axis
          };
        }
      });

      return { polarAngles, jointAngles, torsoPlane };

    } catch (error) {
      console.warn('Angle calculation error:', error);
      return { polarAngles: {}, jointAngles: {} };
    }
  }
}

export default PolarPoseRetarget; 