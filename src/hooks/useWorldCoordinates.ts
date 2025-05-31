/**
 * World Coordinate System Management Hook
 * Manages coordinate transformation and world origin for pose tracking
 */

import { useState, useCallback, useRef } from 'react';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { 
  CoordinateTransformSystem, 
  DEFAULT_TRANSFORM_CONFIG,
  type CoordinateTransformConfig,
  type Vec3,
  type WorldOrigin,
  type PolarCoordinate,
  type SphericalCoordinate
} from '../utils/coordinateTransform';

export interface WorldCoordinatesState {
  isInitialized: boolean;
  currentPose: { [key: string]: Vec3 } | null;
  currentPolarPose: { [key: string]: PolarCoordinate } | null;
  currentSphericalPose: { [key: string]: SphericalCoordinate } | null;
  bodyCenter: Vec3 | null;
  origin: WorldOrigin | null;
  frameCount: number;
  lastUpdateTime: number;
}

export interface UseWorldCoordinatesReturn {
  // State
  state: WorldCoordinatesState;
  
  // Actions
  processPoseResult: (result: PoseLandmarkerResult) => { [key: string]: Vec3 } | null;
  resetOrigin: () => void;
  updateConfig: (config: Partial<CoordinateTransformConfig>) => void;
  
  // Utils
  getDebugInfo: () => any;
  isReady: () => boolean;
}

export function useWorldCoordinates(
  initialConfig: CoordinateTransformConfig = DEFAULT_TRANSFORM_CONFIG
): UseWorldCoordinatesReturn {
  
  // 座標変換システムのインスタンス
  const transformSystemRef = useRef(new CoordinateTransformSystem(initialConfig));
  
  // State
  const [state, setState] = useState<WorldCoordinatesState>({
    isInitialized: false,
    currentPose: null,
    currentPolarPose: null,
    currentSphericalPose: null,
    bodyCenter: null,
    origin: null,
    frameCount: 0,
    lastUpdateTime: 0
  });

  /**
   * ポーズ結果を処理して相対座標に変換
   */
  const processPoseResult = useCallback((result: PoseLandmarkerResult): { [key: string]: Vec3 } | null => {
    const transformSystem = transformSystemRef.current;
    
    // 体の中央を計算
    const bodyCenter = transformSystem.calculateBodyCenter(result);
    
    // 原点が未初期化で、体が検出できる場合は初期化
    if (!transformSystem.getOriginInfo()?.isInitialized && bodyCenter) {
      transformSystem.initializeWorldOrigin(result);
    }
    
    // 相対座標に変換
    const relativePose = transformSystem.transformPoseToRelative(result);
    
    // 極座標に変換
    const polarPose = transformSystem.transformPoseToPolar(result);
    const sphericalPose = transformSystem.transformPoseToSpherical(result);
    
    // State更新
    setState(prevState => ({
      ...prevState,
      isInitialized: transformSystem.getOriginInfo()?.isInitialized || false,
      currentPose: relativePose,
      currentPolarPose: polarPose,
      currentSphericalPose: sphericalPose,
      bodyCenter: bodyCenter,
      origin: transformSystem.getOriginInfo(),
      frameCount: prevState.frameCount + 1,
      lastUpdateTime: Date.now()
    }));
    
    return relativePose;
  }, []);

  /**
   * 原点をリセット
   */
  const resetOrigin = useCallback(() => {
    transformSystemRef.current.resetOrigin();
    setState(prevState => ({
      ...prevState,
      isInitialized: false,
      currentPose: null,
      currentPolarPose: null,
      currentSphericalPose: null,
      bodyCenter: null,
      origin: null,
      frameCount: 0
    }));
    console.log('🔄 World coordinates reset');
  }, []);

  /**
   * 設定を更新
   */
  const updateConfig = useCallback((newConfig: Partial<CoordinateTransformConfig>) => {
    transformSystemRef.current.updateConfig(newConfig);
    console.log('⚙️ World coordinates config updated');
  }, []);

  /**
   * デバッグ情報を取得
   */
  const getDebugInfo = useCallback(() => {
    return {
      ...transformSystemRef.current.getDebugInfo(),
      hookState: state
    };
  }, [state]);

  /**
   * システムが準備完了かチェック
   */
  const isReady = useCallback(() => {
    return state.isInitialized && state.currentPose !== null;
  }, [state.isInitialized, state.currentPose]);

  return {
    state,
    processPoseResult,
    resetOrigin,
    updateConfig,
    getDebugInfo,
    isReady
  };
} 