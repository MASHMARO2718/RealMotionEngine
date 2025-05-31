/**
 * Coordinate Transformation System
 * Converts MediaPipe camera coordinates to unified 3D world coordinates
 */

import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface Vec3 {
  x: number;
  y: number;  
  z: number;
}

export interface PolarCoordinate {
  r: number;      // 原点からの距離 (radius)
  theta: number;  // 方位角 - 水平面での角度 (azimuth) [-π, π]
  phi: number;    // 仰角 - 垂直角度 (elevation) [-π/2, π/2]
}

export interface SphericalCoordinate {
  r: number;      // 原点からの距離 (radius)  
  theta: number;  // 方位角 (azimuth) [0, 2π]
  phi: number;    // 極角 - Z軸からの角度 (polar angle) [0, π]
}

export interface WorldOrigin {
  x: number;
  y: number;
  z: number;
  isInitialized: boolean;
  timestamp: number;
}

export interface CoordinateTransformConfig {
  scaleX: number;        // X軸のスケール係数
  scaleY: number;        // Y軸のスケール係数  
  scaleZ: number;        // Z軸のスケール係数
  originOffsetZ: number; // 体から後ろへのオフセット (メートル)
}

export const DEFAULT_TRANSFORM_CONFIG: CoordinateTransformConfig = {
  scaleX: 2.0,  // 仮想空間での横幅 (メートル)
  scaleY: 2.0,  // 仮想空間での縦幅 (メートル)
  scaleZ: 2.0,  // 仮想空間での奥行き (メートル)
  originOffsetZ: 2.0  // 体から2m後ろに原点
};

export class CoordinateTransformSystem {
  private config: CoordinateTransformConfig;
  private worldOrigin: WorldOrigin | null = null;
  
  constructor(config: CoordinateTransformConfig = DEFAULT_TRANSFORM_CONFIG) {
    this.config = { ...config };
  }

  /**
   * MediaPipe正規化座標を世界座標に変換
   */
  mediaPipeToWorld(landmark: { x: number; y: number; z?: number }): Vec3 {
    return {
      x: (landmark.x - 0.5) * this.config.scaleX,  // 中央を原点に、スケール適用
      y: -(landmark.y - 0.5) * this.config.scaleY, // Y軸反転 + 中央を原点に
      z: -(landmark.z || 0) * this.config.scaleZ    // Z軸反転 + スケール適用
    };
  }

  /**
   * 体の中央位置を計算 (腰の中点)
   */
  calculateBodyCenter(result: PoseLandmarkerResult): Vec3 | null {
    if (!result.landmarks || result.landmarks.length === 0) {
      return null;
    }

    const landmarks = result.landmarks[0];
    if (landmarks.length < 33) {
      return null;
    }

    // LEFT_HIP(23) と RIGHT_HIP(24) の中点
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    // 可視性チェック
    if ((leftHip.visibility && leftHip.visibility < 0.5) || 
        (rightHip.visibility && rightHip.visibility < 0.5)) {
      return null;
    }

    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2
    };

    return this.mediaPipeToWorld(hipCenter);
  }

  /**
   * 世界原点を初期化 (初回のみ)
   */
  initializeWorldOrigin(result: PoseLandmarkerResult): boolean {
    if (this.worldOrigin?.isInitialized) {
      return false; // 既に初期化済み
    }

    const bodyCenter = this.calculateBodyCenter(result);
    if (!bodyCenter) {
      return false; // 体の中央が検出できない
    }

    // 体から2m後ろに原点を設置
    this.worldOrigin = {
      x: bodyCenter.x,
      y: bodyCenter.y,
      z: bodyCenter.z + this.config.originOffsetZ,
      isInitialized: true,
      timestamp: Date.now()
    };

    console.log('🌍 World origin initialized:', this.worldOrigin);
    return true;
  }

  /**
   * 世界座標を原点からの相対座標に変換
   */
  worldToRelative(worldCoord: Vec3): Vec3 {
    if (!this.worldOrigin?.isInitialized) {
      return { x: 0, y: 0, z: 0 }; // 原点未初期化の場合
    }

    return {
      x: worldCoord.x - this.worldOrigin.x,
      y: worldCoord.y - this.worldOrigin.y,
      z: worldCoord.z - this.worldOrigin.z
    };
  }

  /**
   * すべてのポーズランドマークを相対座標に変換
   */
  transformPoseToRelative(result: PoseLandmarkerResult): { [key: string]: Vec3 } | null {
    if (!result.landmarks || result.landmarks.length === 0) {
      return null;
    }

    // 原点が未初期化の場合、初期化を試行
    if (!this.worldOrigin?.isInitialized) {
      this.initializeWorldOrigin(result);
      if (!this.worldOrigin?.isInitialized) {
        return null; // 初期化失敗
      }
    }

    const landmarks = result.landmarks[0];
    const transformedLandmarks: { [key: string]: Vec3 } = {};

    // 主要なランドマークを変換
    const landmarkMap = {
      // 頭部
      nose: 0,
      leftEye: 1,
      rightEye: 2,
      leftEar: 3,
      rightEar: 4,
      
      // 上半身
      leftShoulder: 11,
      rightShoulder: 12,
      leftElbow: 13,
      rightElbow: 14,
      leftWrist: 15,
      rightWrist: 16,
      
      // 下半身
      leftHip: 23,
      rightHip: 24,
      leftKnee: 25,
      rightKnee: 26,
      leftAnkle: 27,
      rightAnkle: 28,
      
      // 足
      leftHeel: 29,
      rightHeel: 30,
      leftFootIndex: 31,
      rightFootIndex: 32
    };

    Object.entries(landmarkMap).forEach(([name, index]) => {
      if (landmarks[index]) {
        const worldCoord = this.mediaPipeToWorld(landmarks[index]);
        transformedLandmarks[name] = this.worldToRelative(worldCoord);
      }
    });

    return transformedLandmarks;
  }

  /**
   * 原点をリセット (新しいセッション開始時)
   */
  resetOrigin(): void {
    this.worldOrigin = null;
    console.log('🔄 World origin reset');
  }

  /**
   * 現在の原点情報を取得
   */
  getOriginInfo(): WorldOrigin | null {
    return this.worldOrigin;
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<CoordinateTransformConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Transform config updated:', this.config);
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo() {
    return {
      config: this.config,
      origin: this.worldOrigin,
      isInitialized: this.worldOrigin?.isInitialized || false
    };
  }

  /**
   * 世界座標を極座標に変換 (数学的定義)
   * θ: 方位角 (azimuth) - XY平面でのX軸からの角度 [-π, π]
   * φ: 仰角 (elevation) - XY平面からZ軸方向への角度 [-π/2, π/2] 
   */
  worldToPolar(worldCoord: Vec3): PolarCoordinate {
    const { x, y, z } = worldCoord;
    
    // 原点からの距離
    const r = Math.sqrt(x * x + y * y + z * z);
    
    // 方位角 (azimuth): XY平面でのX軸からの角度
    const theta = Math.atan2(y, x);
    
    // 仰角 (elevation): XY平面からZ軸方向への角度
    const phi = r > 0 ? Math.asin(z / r) : 0;
    
    return { r, theta, phi };
  }

  /**
   * 世界座標を球面座標に変換 (物理学/工学定義)
   * θ: 方位角 (azimuth) - XY平面でのX軸からの角度 [0, 2π]
   * φ: 極角 (polar angle) - Z軸からの角度 [0, π]
   */
  worldToSpherical(worldCoord: Vec3): SphericalCoordinate {
    const { x, y, z } = worldCoord;
    
    // 原点からの距離
    const r = Math.sqrt(x * x + y * y + z * z);
    
    // 方位角 (azimuth): XY平面でのX軸からの角度 [0, 2π]
    let theta = Math.atan2(y, x);
    if (theta < 0) theta += 2 * Math.PI;
    
    // 極角 (polar angle): Z軸からの角度 [0, π]
    const phi = r > 0 ? Math.acos(z / r) : 0;
    
    return { r, theta, phi };
  }

  /**
   * 極座標を世界座標に変換
   */
  polarToWorld(polar: PolarCoordinate): Vec3 {
    const { r, theta, phi } = polar;
    
    return {
      x: r * Math.cos(phi) * Math.cos(theta),
      y: r * Math.cos(phi) * Math.sin(theta),
      z: r * Math.sin(phi)
    };
  }

  /**
   * 球面座標を世界座標に変換
   */
  sphericalToWorld(spherical: SphericalCoordinate): Vec3 {
    const { r, theta, phi } = spherical;
    
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi)
    };
  }

  /**
   * すべてのポーズランドマークを極座標に変換
   */
  transformPoseToPolar(result: PoseLandmarkerResult): { [key: string]: PolarCoordinate } | null {
    const relativePose = this.transformPoseToRelative(result);
    if (!relativePose) return null;

    const polarPose: { [key: string]: PolarCoordinate } = {};
    
    Object.entries(relativePose).forEach(([name, worldCoord]) => {
      polarPose[name] = this.worldToPolar(worldCoord);
    });

    return polarPose;
  }

  /**
   * すべてのポーズランドマークを球面座標に変換
   */
  transformPoseToSpherical(result: PoseLandmarkerResult): { [key: string]: SphericalCoordinate } | null {
    const relativePose = this.transformPoseToRelative(result);
    if (!relativePose) return null;

    const sphericalPose: { [key: string]: SphericalCoordinate } = {};
    
    Object.entries(relativePose).forEach(([name, worldCoord]) => {
      sphericalPose[name] = this.worldToSpherical(worldCoord);
    });

    return sphericalPose;
  }

  /**
   * 角度を度数に変換
   */
  static radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * 度数をラジアンに変換  
   */
  static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 極座標デバッグ情報を取得
   */
  getPolarDebugInfo(polarPose: { [key: string]: PolarCoordinate } | null) {
    if (!polarPose) return null;

    const debugInfo: { [key: string]: any } = {};
    
    Object.entries(polarPose).forEach(([name, polar]) => {
      debugInfo[name] = {
        r: polar.r.toFixed(3),
        theta_deg: CoordinateTransformSystem.radiansToDegrees(polar.theta).toFixed(1),
        phi_deg: CoordinateTransformSystem.radiansToDegrees(polar.phi).toFixed(1),
        theta_rad: polar.theta.toFixed(3),
        phi_rad: polar.phi.toFixed(3)
      };
    });

    return debugInfo;
  }
} 