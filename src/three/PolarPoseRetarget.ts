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
  private angleAdjustments: Record<string, { omega: number; phi: number }> = {}; // 角度調整値

  constructor(smoothingFactor = 0.1, legCorrectionMode: 'full' | 'partial' = 'full') {
    this.smoothingFactor = smoothingFactor;
    this.legCorrectionMode = legCorrectionMode;
  }

  setSmoothingFactor(factor: number) {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
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
   * 現在の補正モードを取得
   */
  getLegCorrectionMode(): 'full' | 'partial' {
    return this.legCorrectionMode;
  }

  /**
   * 角度調整値を設定
   * @param adjustments 各関節のomega/phi調整値（度数）
   */
  setAngleAdjustments(adjustments: Record<string, { omega: number; phi: number }>) {
    this.angleAdjustments = { ...adjustments };
    console.log('🎛️ 角度調整値が更新されました:', this.angleAdjustments);
  }

  /**
   * 角度調整値を取得
   */
  getAngleAdjustments(): Record<string, { omega: number; phi: number }> {
    return { ...this.angleAdjustments };
  }

  /**
   * 角度調整値を適用
   */
  private applyAngleAdjustments(jointName: string, omega: number, phi: number): { omega: number; phi: number } {
    const adjustment = this.angleAdjustments[jointName];
    if (!adjustment) {
      return { omega, phi };
    }

    // 度数からラジアンに変換して適用
    const adjustedOmega = omega + (adjustment.omega * Math.PI / 180);
    const adjustedPhi = phi + (adjustment.phi * Math.PI / 180);

    return { 
      omega: adjustedOmega, 
      phi: adjustedPhi 
    };
  }

  /**
   * 回転調整値をクォータニオンに適用
   */
  private applyRotationAdjustments(jointName: string, rotation: THREE.Quaternion): THREE.Quaternion {
    const adjustment = this.angleAdjustments[jointName];
    
    // 🔧 応急処置: 左肩にY軸90度回転を強制適用
    if (jointName === 'leftShoulder') {
      const yAxisRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), 
        Math.PI / 2  // 90度
      );
      rotation = rotation.multiply(yAxisRotation);
      console.log('🔧 左肩に強制Y軸90度回転を適用');
    }
    
    if (!adjustment) {
      return rotation;
    }

    // Omega調整（Z軸回転として適用）
    if (adjustment.omega !== 0) {
      const omegaRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), 
        adjustment.omega * Math.PI / 180
      );
      rotation = rotation.multiply(omegaRotation);
    }

    // Phi調整（X軸回転として適用）
    if (adjustment.phi !== 0) {
      const phiRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0), 
        adjustment.phi * Math.PI / 180
      );
      rotation = rotation.multiply(phiRotation);
    }

    return rotation;
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
      console.log('🔄 関節回転計算開始...');
      
      // 角度調整が設定されているかチェック
      const hasAdjustments = Object.keys(this.angleAdjustments).length > 0;
      if (hasAdjustments) {
        console.log('🎛️ 角度調整が適用されます:', this.angleAdjustments);
      } else {
        console.log('⚠️ 角度調整が設定されていません（生の計算値を使用）');
      }

      // 肩の回転（左）
      if (landmarks[11] && landmarks[13]) {
        const shoulderDir = this.calculateJointDirection(landmarks[11], landmarks[13]);
        const defaultDir = new THREE.Vector3(-1, 0, 0); // 🔧 修正: 左向きに変更
        let rotation = this.getRotationBetweenVectors(defaultDir, shoulderDir);
        
        console.log('🔍 左肩回転計算:');
        console.log('  方向ベクトル:', shoulderDir.x.toFixed(3), shoulderDir.y.toFixed(3), shoulderDir.z.toFixed(3));
        
        // 適用前の回転をログ
        const beforeEuler = new THREE.Euler().setFromQuaternion(rotation);
        console.log('  調整前回転:', (beforeEuler.x * 180 / Math.PI).toFixed(1) + '°', 
                   (beforeEuler.y * 180 / Math.PI).toFixed(1) + '°', 
                   (beforeEuler.z * 180 / Math.PI).toFixed(1) + '°');
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('leftShoulder', rotation);
        
        // 適用後の回転をログ
        const afterEuler = new THREE.Euler().setFromQuaternion(rotation);
        console.log('  調整後回転:', (afterEuler.x * 180 / Math.PI).toFixed(1) + '°', 
                   (afterEuler.y * 180 / Math.PI).toFixed(1) + '°', 
                   (afterEuler.z * 180 / Math.PI).toFixed(1) + '°');
        
        if (hasAdjustments) {
          const adj = this.angleAdjustments['leftShoulder'];
          if (adj) {
            console.log('  適用した調整値:', `omega=${adj.omega.toFixed(1)}°, phi=${adj.phi.toFixed(1)}°`);
          }
        }
        
        rotations.leftShoulder = this.applySmoothingToRotation('leftShoulder', rotation);
      }

      // 肩の回転（右）
      if (landmarks[12] && landmarks[14]) {
        const shoulderDir = this.calculateJointDirection(landmarks[12], landmarks[14]);
        const defaultDir = new THREE.Vector3(-1, 0, 0); // 左向き
        let rotation = this.getRotationBetweenVectors(defaultDir, shoulderDir);
        
        console.log('🔍 右肩回転計算:');
        console.log('  方向ベクトル:', shoulderDir.x.toFixed(3), shoulderDir.y.toFixed(3), shoulderDir.z.toFixed(3));
        
        // 適用前の回転をログ
        const beforeEuler = new THREE.Euler().setFromQuaternion(rotation);
        console.log('  調整前回転:', (beforeEuler.x * 180 / Math.PI).toFixed(1) + '°', 
                   (beforeEuler.y * 180 / Math.PI).toFixed(1) + '°', 
                   (beforeEuler.z * 180 / Math.PI).toFixed(1) + '°');
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('rightShoulder', rotation);
        
        // 適用後の回転をログ
        const afterEuler = new THREE.Euler().setFromQuaternion(rotation);
        console.log('  調整後回転:', (afterEuler.x * 180 / Math.PI).toFixed(1) + '°', 
                   (afterEuler.y * 180 / Math.PI).toFixed(1) + '°', 
                   (afterEuler.z * 180 / Math.PI).toFixed(1) + '°');
        
        if (hasAdjustments) {
          const adj = this.angleAdjustments['rightShoulder'];
          if (adj) {
            console.log('  適用した調整値:', `omega=${adj.omega.toFixed(1)}°, phi=${adj.phi.toFixed(1)}°`);
          }
        }
        
        rotations.rightShoulder = this.applySmoothingToRotation('rightShoulder', rotation);
      }

      // 肘の回転（左）
      if (landmarks[13] && landmarks[15]) {
        const elbowDir = this.calculateJointDirection(landmarks[13], landmarks[15]);
        const defaultDir = new THREE.Vector3(-1, 0, 0); // 🔧 修正: 左向きに変更
        let rotation = this.getRotationBetweenVectors(defaultDir, elbowDir);
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('leftElbow', rotation);
        
        rotations.leftElbow = this.applySmoothingToRotation('leftElbow', rotation);
      }

      // 肘の回転（右）
      if (landmarks[14] && landmarks[16]) {
        const elbowDir = this.calculateJointDirection(landmarks[14], landmarks[16]);
        const defaultDir = new THREE.Vector3(-1, 0, 0);
        let rotation = this.getRotationBetweenVectors(defaultDir, elbowDir);
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('rightElbow', rotation);
        
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
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('leftHip', rotation);
        
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
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('rightHip', rotation);
        
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
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('leftKnee', rotation);
        
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
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('rightKnee', rotation);
        
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
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('leftAnkle', rotation);
        
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
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('rightAnkle', rotation);
        
        rotations.rightAnkle = this.applySmoothingToRotation('rightAnkle', rotation);
      }

      // 背骨の回転
      if (landmarks[11] && landmarks[12] && landmarks[23] && landmarks[24]) {
        const shoulderCenter = this.landmarkToVector3(landmarks[11]).add(this.landmarkToVector3(landmarks[12])).multiplyScalar(0.5);
        const hipCenter = this.landmarkToVector3(landmarks[23]).add(this.landmarkToVector3(landmarks[24])).multiplyScalar(0.5);
        const spineDir = shoulderCenter.sub(hipCenter).normalize();
        const defaultDir = new THREE.Vector3(0, 1, 0);
        let rotation = this.getRotationBetweenVectors(defaultDir, spineDir);
        
        // 角度調整を適用
        rotation = this.applyRotationAdjustments('spine', rotation);
        
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
          
          // 角度調整を適用
          const adjustedAngles = this.applyAngleAdjustments(joint.name, torsoCoords.omega, torsoCoords.phi);
          
          polarAngles[joint.name] = {
            theta: theta,
            phi: phi,
            position: position.clone(),
            omega: adjustedAngles.omega,
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

  // T-poseかどうかを検出
  detectTPose(landmarks: any[]): boolean {
    if (!landmarks || landmarks.length < 33) return false;

    try {
      // 左肩、右肩、左肘、右肘、左手首、右手首の座標を取得
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];

      // 基本的な可視性チェック
      if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist) {
        return false;
      }

      // 肩の幅（水平度チェック）
      const shoulderYDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      if (shoulderYDiff > 0.05) return false; // 5%以上の高低差はNG

      // 腕が水平に伸びているかチェック
      const leftArmHorizontal = Math.abs(leftElbow.y - leftShoulder.y) < 0.08; // 8%以内
      const rightArmHorizontal = Math.abs(rightElbow.y - rightShoulder.y) < 0.08;
      
      // 手首も水平ラインにあるかチェック
      const leftWristHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 0.1; // 10%以内
      const rightWristHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 0.1;

      // 腕が外側に伸びているかチェック
      const leftArmExtended = leftWrist.x < leftElbow.x && leftElbow.x < leftShoulder.x;
      const rightArmExtended = rightWrist.x > rightElbow.x && rightElbow.x > rightShoulder.x;

      const isTPose = leftArmHorizontal && rightArmHorizontal && 
                     leftWristHorizontal && rightWristHorizontal &&
                     leftArmExtended && rightArmExtended;

      return isTPose;
    } catch (error) {
      console.warn('T-pose detection error:', error);
      return false;
    }
  }

  // オートチューニング用の補正値を計算
  calculateAutoTuningAdjustments(tposeSamples: PoseLandmarkerResult[]): Record<string, { omega: number; phi: number }> {
    if (tposeSamples.length === 0) {
      console.warn('T-poseサンプルがありません');
      return {};
    }

    console.log(`🎯 ${tposeSamples.length}個のT-poseサンプルから補正値を自動計算中...`);

    // 🔧 修正: 理想的なT-pose角度を定義（ラジアン）
    const idealTPoseAngles: Record<string, { omega: number; phi: number }> = {
      leftShoulder: { omega: -Math.PI / 2, phi: 0 },       // 🔧 左腕を-90度水平に（右と同じ方向）
      rightShoulder: { omega: -Math.PI / 2, phi: 0 },      // 右腕を90度水平に
      leftElbow: { omega: 0, phi: 0 },                     // 肘は真っ直ぐ
      rightElbow: { omega: 0, phi: 0 },                    // 肘は真っ直ぐ
      leftWrist: { omega: 0, phi: 0 },                     // 手首は自然に
      rightWrist: { omega: 0, phi: 0 },                    // 手首は自然に
      leftHip: { omega: 0, phi: 0 },                       // 腰は中立
      rightHip: { omega: 0, phi: 0 },                      // 腰は中立
      leftKnee: { omega: 0, phi: 0 },                      // 膝は真っ直ぐ
      rightKnee: { omega: 0, phi: 0 },                     // 膝は真っ直ぐ
      leftAnkle: { omega: 0, phi: 0 },                     // 足首は中立
      rightAnkle: { omega: 0, phi: 0 },                    // 足首は中立
    };

    console.log('📐 理想T-pose角度（ラジアン）:', idealTPoseAngles);

    // 各サンプルから極座標を計算し、平均を取る
    const averageAngles: Record<string, { omega: number; phi: number; count: number }> = {};

    console.log('🔍 T-poseサンプル分析開始...');

    tposeSamples.forEach((sample, sampleIndex) => {
      const landmarks = sample.landmarks[0];
      if (!landmarks) return;

      console.log(`📊 サンプル${sampleIndex + 1}/${tposeSamples.length}を分析中...`);

      // 胴体平面を計算
      const torsoPlane = this.calculateTorsoPlane(landmarks);
      console.log(`  胴体平面: 原点(${torsoPlane.origin.x.toFixed(3)}, ${torsoPlane.origin.y.toFixed(3)}, ${torsoPlane.origin.z.toFixed(3)})`);
      
      // 各関節の極座標を計算
      const jointDefinitions = [
        { name: 'leftShoulder', from: 11, to: 13, description: '左肩→左肘' },
        { name: 'rightShoulder', from: 12, to: 14, description: '右肩→右肘' },
        { name: 'leftElbow', from: 13, to: 15, description: '左肘→左手首' },
        { name: 'rightElbow', from: 14, to: 16, description: '右肘→右手首' },
        { name: 'leftWrist', from: 15, to: 17, description: '左手首→左親指' },
        { name: 'rightWrist', from: 16, to: 18, description: '右手首→右親指' },
        { name: 'leftHip', from: 23, to: 25, description: '左腰→左膝' },
        { name: 'rightHip', from: 24, to: 26, description: '右腰→右膝' },
        { name: 'leftKnee', from: 25, to: 27, description: '左膝→左足首' },
        { name: 'rightKnee', from: 26, to: 28, description: '右膝→右足首' },
        { name: 'leftAnkle', from: 27, to: 29, description: '左足首→左かかと' },
        { name: 'rightAnkle', from: 28, to: 30, description: '右足首→右かかと' },
      ];

      jointDefinitions.forEach(({ name, from, to, description }) => {
        if (landmarks[from] && landmarks[to]) {
          const fromPoint = this.landmarkToVector3(landmarks[from]);
          const toPoint = this.landmarkToVector3(landmarks[to]);
          const direction = toPoint.clone().sub(fromPoint).normalize();
          
          const polarCoords = this.calculateTorsoBasedPolarCoordinates(
            fromPoint.clone().add(direction),
            torsoPlane
          );

          if (!averageAngles[name]) {
            averageAngles[name] = { omega: 0, phi: 0, count: 0 };
          }
          
          averageAngles[name].omega += polarCoords.omega;
          averageAngles[name].phi += polarCoords.phi;
          averageAngles[name].count++;

          // 🔍 詳細ログ出力
          console.log(`    ${description} (${name}):`);
          console.log(`      From: (${fromPoint.x.toFixed(3)}, ${fromPoint.y.toFixed(3)}, ${fromPoint.z.toFixed(3)})`);
          console.log(`      To: (${toPoint.x.toFixed(3)}, ${toPoint.y.toFixed(3)}, ${toPoint.z.toFixed(3)})`);
          console.log(`      Direction: (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`);
          console.log(`      極座標: omega=${(polarCoords.omega * 180 / Math.PI).toFixed(1)}°, phi=${(polarCoords.phi * 180 / Math.PI).toFixed(1)}°`);
        }
      });
    });

    // 平均を計算
    console.log('🧮 平均値計算中...');
    Object.keys(averageAngles).forEach(joint => {
      const avg = averageAngles[joint];
      if (avg.count > 0) {
        avg.omega /= avg.count;
        avg.phi /= avg.count;
        console.log(`  ${joint}: omega=${(avg.omega * 180 / Math.PI).toFixed(1)}° (${avg.count}サンプル平均)`);
        console.log(`            phi=${(avg.phi * 180 / Math.PI).toFixed(1)}°`);
      }
    });

    // 🔧 修正: 補正値を計算（理想 - 実際、度数で表示）
    const adjustments: Record<string, { omega: number; phi: number }> = {};
    console.log('🎛️ 補正値計算...');
    
    Object.keys(idealTPoseAngles).forEach(joint => {
      const ideal = idealTPoseAngles[joint];
      const actual = averageAngles[joint] || { omega: 0, phi: 0, count: 0 };
      
      // 🔧 角度差を計算（ラジアン）
      let omegaDiff = ideal.omega - actual.omega;
      let phiDiff = ideal.phi - actual.phi;

      // 🔧 角度を-π〜πの範囲に正規化
      while (omegaDiff > Math.PI) omegaDiff -= 2 * Math.PI;
      while (omegaDiff < -Math.PI) omegaDiff += 2 * Math.PI;
      while (phiDiff > Math.PI) phiDiff -= 2 * Math.PI;
      while (phiDiff < -Math.PI) phiDiff += 2 * Math.PI;
      
      adjustments[joint] = {
        omega: omegaDiff * 180 / Math.PI, // 度数で保存
        phi: phiDiff * 180 / Math.PI      // 度数で保存
      };

      // 詳細ログ
      console.log(`  ${joint}:`);
      console.log(`    理想: omega=${(ideal.omega * 180 / Math.PI).toFixed(1)}°, phi=${(ideal.phi * 180 / Math.PI).toFixed(1)}°`);
      console.log(`    実際: omega=${(actual.omega * 180 / Math.PI).toFixed(1)}°, phi=${(actual.phi * 180 / Math.PI).toFixed(1)}°`);
      console.log(`    補正: omega=${adjustments[joint].omega.toFixed(1)}°, phi=${adjustments[joint].phi.toFixed(1)}°`);
    });

    console.log('🎛️ 最終的な自動計算補正値（度数）:', adjustments);
    return adjustments;
  }

  // T-poseベースの自動チューニングを実行
  performAutoTuning(tposeSamples: PoseLandmarkerResult[]): boolean {
    try {
      // T-poseサンプルの検証
      const validSamples = tposeSamples.filter(sample => {
        const landmarks = sample.landmarks?.[0];
        return landmarks && this.detectTPose(landmarks);
      });

      if (validSamples.length === 0) {
        console.warn('有効なT-poseサンプルがありません');
        return false;
      }

      console.log(`✅ ${validSamples.length}個の有効なT-poseサンプルが見つかりました`);

      // 補正値を計算
      const autoAdjustments = this.calculateAutoTuningAdjustments(validSamples);
      
      // 補正値を適用
      this.setAngleAdjustments(autoAdjustments);

      console.log('🎉 オートチューニングが完了しました！');
      return true;
    } catch (error) {
      console.error('オートチューニング中にエラーが発生しました:', error);
      return false;
    }
  }

  /**
   * 角度調整値をクリア（デバッグ用）
   */
  clearAngleAdjustments() {
    this.angleAdjustments = {};
    console.log('🧹 角度調整値をクリアしました（生の計算値を使用）');
  }
}

export default PolarPoseRetarget; 