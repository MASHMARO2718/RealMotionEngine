/**
 * Pose Driver Component
 * Main interface for driving avatar animation from pose analysis
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import type { FullPoseAnalysis } from '../lib/analytics/PoseAnalytics';
import { AvatarData, AvatarLoader } from './AvatarLoader';
import { PoseRetargeter, PoseRetargetConfig, DEFAULT_RETARGET_CONFIG } from './PoseRetarget';

export interface PoseDriverProps {
  avatar: AvatarData;
  analysis: FullPoseAnalysis | null;
  config?: Partial<PoseRetargetConfig>;
  onError?: (error: Error) => void;
}

export interface PoseDriverRef {
  retargeter: PoseRetargeter;
  avatar: AvatarData;
  reset: () => void;
  updateConfig: (config: Partial<PoseRetargetConfig>) => void;
}

/**
 * PoseDriver component for React Three Fiber integration
 */
export const PoseDriver = React.forwardRef<PoseDriverRef, PoseDriverProps>(
  ({ avatar, analysis, config, onError }, ref) => {
    const retargeterRef = useRef<PoseRetargeter | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize retargeter
    useEffect(() => {
      try {
        const finalConfig = { ...DEFAULT_RETARGET_CONFIG, ...config };
        retargeterRef.current = new PoseRetargeter(finalConfig);
        setIsReady(true);
        console.log('🎭 PoseDriver initialized');
      } catch (error) {
        console.error('❌ Failed to initialize PoseDriver:', error);
        onError?.(error as Error);
      }
    }, [config, onError]);

    // Apply pose updates
    useEffect(() => {
      if (!isReady || !retargeterRef.current || !analysis) {
        return;
      }

      try {
        retargeterRef.current.applyPoseToAvatar(avatar, analysis);
      } catch (error) {
        console.error('❌ Failed to apply pose:', error);
        onError?.(error as Error);
      }
    }, [avatar, analysis, isReady, onError]);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      retargeter: retargeterRef.current!,
      avatar,
      reset: () => {
        retargeterRef.current?.reset();
      },
      updateConfig: (newConfig: Partial<PoseRetargetConfig>) => {
        retargeterRef.current?.updateConfig(newConfig);
      }
    }), [avatar]);

    // Render the avatar scene
    return (
      <primitive 
        object={avatar.scene} 
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={[1, 1, 1]}
      />
    );
  }
);

PoseDriver.displayName = 'PoseDriver';

/**
 * Standalone PoseDriver class for non-React usage
 */
export class StandalonePoseDriver {
  private retargeter: PoseRetargeter;
  private avatar: AvatarData;
  private isInitialized = false;

  constructor(avatar: AvatarData, config?: Partial<PoseRetargetConfig>) {
    this.avatar = avatar;
    const finalConfig = { ...DEFAULT_RETARGET_CONFIG, ...config };
    this.retargeter = new PoseRetargeter(finalConfig);
    this.isInitialized = true;
    console.log('🎭 StandalonePoseDriver initialized');
  }

  /**
   * Update avatar with new pose analysis
   */
  update(analysis: FullPoseAnalysis): void {
    if (!this.isInitialized) {
      console.warn('⚠️ PoseDriver not initialized');
      return;
    }

    try {
      this.retargeter.applyPoseToAvatar(this.avatar, analysis);
    } catch (error) {
      console.error('❌ Failed to update pose:', error);
      throw error;
    }
  }

  /**
   * Reset the pose driver
   */
  reset(): void {
    this.retargeter.reset();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PoseRetargetConfig>): void {
    this.retargeter.updateConfig(config);
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      retargeterInfo: this.retargeter.getDebugInfo(),
      avatarBones: this.avatar.bones.size,
      boneMapping: this.avatar.boneMapping
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.isInitialized = false;
    console.log('🗑️ StandalonePoseDriver disposed');
  }
}

/**
 * Convenience function to create a pose driver from avatar URL
 */
export async function createPoseDriver(
  avatarUrl: string, 
  config?: Partial<PoseRetargetConfig>
): Promise<StandalonePoseDriver> {
  const loader = new AvatarLoader();
  const avatar = await loader.loadAvatar(avatarUrl);
  return new StandalonePoseDriver(avatar, config);
}

export default PoseDriver; 