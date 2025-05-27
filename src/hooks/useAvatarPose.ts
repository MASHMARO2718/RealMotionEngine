/**
 * React Hook for Avatar Pose Animation
 * Integrates pose analysis with Three.js avatar animation
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { FullPoseAnalysis } from '../lib/analytics/PoseAnalytics';
import type { AvatarData } from '../three/AvatarLoader';
import type { PoseRetargetConfig } from '../three/PoseRetarget';
import { AvatarLoader } from '../three/AvatarLoader';
import { DEFAULT_RETARGET_CONFIG, PoseRetargeter } from '../three/PoseRetarget';

export interface UseAvatarPoseConfig extends Partial<PoseRetargetConfig> {
  avatarUrl?: string;
  autoLoad?: boolean;
  enableDebugLog?: boolean;
}

export interface UseAvatarPoseResult {
  avatar: AvatarData | null;
  retargeter: PoseRetargeter | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  
  // Methods
  loadAvatar: (url: string) => Promise<void>;
  updatePose: (analysis: FullPoseAnalysis) => void;
  reset: () => void;
  updateConfig: (config: Partial<PoseRetargetConfig>) => void;
  
  // Debug info
  debugInfo: {
    frameCount: number;
    lastUpdateTime: number;
    averageUpdateTime: number;
    retargeterInfo?: any;
  };
}

export function useAvatarPose(config: UseAvatarPoseConfig = {}): UseAvatarPoseResult {
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [retargeter, setRetargeter] = useState<PoseRetargeter | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for performance tracking
  const loaderRef = useRef<AvatarLoader | null>(null);
  const debugRef = useRef({
    frameCount: 0,
    lastUpdateTime: 0,
    totalUpdateTime: 0,
    averageUpdateTime: 0
  });

  // Initialize loader
  useEffect(() => {
    if (!loaderRef.current) {
      loaderRef.current = new AvatarLoader();
    }
  }, []);

  // Auto-load avatar if URL provided
  useEffect(() => {
    if (config.avatarUrl && config.autoLoad !== false) {
      loadAvatar(config.avatarUrl);
    }
  }, [config.avatarUrl, config.autoLoad]);

  // Initialize retargeter when avatar is loaded
  useEffect(() => {
    if (avatar && !retargeter) {
      try {
        const retargetConfig = {
          ...DEFAULT_RETARGET_CONFIG,
          ...config
        };
        
        const newRetargeter = new PoseRetargeter(retargetConfig);
        setRetargeter(newRetargeter);
        
        if (config.enableDebugLog) {
          console.log('🎭 Avatar pose hook initialized:', {
            avatar: avatar.scene.name,
            bones: avatar.bones.size,
            config: retargetConfig
          });
        }
      } catch (err) {
        setError(`Failed to initialize retargeter: ${err}`);
      }
    }
  }, [avatar, retargeter, config]);

  /**
   * Load avatar from URL
   */
  const loadAvatar = useCallback(async (url: string) => {
    if (!loaderRef.current) {
      setError('Avatar loader not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (config.enableDebugLog) {
        console.log('🎭 Loading avatar:', url);
      }

      const loadedAvatar = await loaderRef.current.loadAvatar(url);
      setAvatar(loadedAvatar);
      
      if (config.enableDebugLog) {
        console.log('✅ Avatar loaded successfully:', {
          bones: loadedAvatar.bones.size,
          boneMapping: loadedAvatar.boneMapping
        });
      }
    } catch (err) {
      const errorMessage = `Failed to load avatar: ${err}`;
      setError(errorMessage);
      console.error('❌', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [config.enableDebugLog]);

  /**
   * Update avatar pose from analysis
   */
  const updatePose = useCallback((analysis: FullPoseAnalysis) => {
    if (!avatar || !retargeter) {
      if (config.enableDebugLog) {
        console.warn('⚠️ Cannot update pose: avatar or retargeter not ready');
      }
      return;
    }

    const startTime = performance.now();
    
    try {
      retargeter.applyPoseToAvatar(avatar, analysis);
      
      // Update debug info
      const updateTime = performance.now() - startTime;
      debugRef.current.frameCount++;
      debugRef.current.lastUpdateTime = updateTime;
      debugRef.current.totalUpdateTime += updateTime;
      debugRef.current.averageUpdateTime = 
        debugRef.current.totalUpdateTime / debugRef.current.frameCount;

      if (config.enableDebugLog && debugRef.current.frameCount % 60 === 0) {
        console.log('🎭 Pose update stats:', {
          frameCount: debugRef.current.frameCount,
          averageUpdateTime: debugRef.current.averageUpdateTime.toFixed(2) + 'ms',
          confidence: analysis.confidence.toFixed(3)
        });
      }
    } catch (err) {
      setError(`Failed to update pose: ${err}`);
      console.error('❌ Pose update error:', err);
    }
  }, [avatar, retargeter, config.enableDebugLog]);

  /**
   * Reset pose and state
   */
  const reset = useCallback(() => {
    if (retargeter) {
      retargeter.reset();
    }
    
    // Reset debug info
    debugRef.current = {
      frameCount: 0,
      lastUpdateTime: 0,
      totalUpdateTime: 0,
      averageUpdateTime: 0
    };

    if (config.enableDebugLog) {
      console.log('🔄 Avatar pose hook reset');
    }
  }, [retargeter, config.enableDebugLog]);

  /**
   * Update retargeter configuration
   */
  const updateConfig = useCallback((newConfig: Partial<PoseRetargetConfig>) => {
    if (retargeter) {
      retargeter.updateConfig(newConfig);
      
      if (config.enableDebugLog) {
        console.log('⚙️ Avatar pose config updated:', newConfig);
      }
    }
  }, [retargeter, config.enableDebugLog]);

  const isReady = avatar !== null && retargeter !== null && !isLoading;

  return {
    avatar,
    retargeter,
    isLoading,
    isReady,
    error,
    
    loadAvatar,
    updatePose,
    reset,
    updateConfig,
    
    debugInfo: {
      frameCount: debugRef.current.frameCount,
      lastUpdateTime: debugRef.current.lastUpdateTime,
      averageUpdateTime: debugRef.current.averageUpdateTime,
      retargeterInfo: retargeter?.getDebugInfo()
    }
  };
}

/**
 * Hook specifically for integrating with existing pose analytics
 */
export function useAvatarPoseWithAnalytics(
  analysis: FullPoseAnalysis | null,
  config: UseAvatarPoseConfig = {}
): UseAvatarPoseResult {
  const avatarPose = useAvatarPose(config);

  // Auto-update pose when analysis changes
  useEffect(() => {
    if (analysis && avatarPose.isReady) {
      avatarPose.updatePose(analysis);
    }
  }, [analysis, avatarPose]);

  return avatarPose;
}

export default useAvatarPose; 