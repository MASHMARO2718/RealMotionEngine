/**
 * Avatar Loader for Three.js
 * Loads GLB models and maps bones for pose retargeting
 */

import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface BoneMapping {
  [key: string]: string; // Joint name -> Bone name mapping
}

export interface AvatarData {
  scene: THREE.Group;
  skeleton: THREE.Skeleton | null;
  skinnedMesh: THREE.SkinnedMesh | null;
  bones: Map<string, THREE.Bone>;
  boneMapping: BoneMapping;
  originalPose: Map<string, THREE.Quaternion>; // T-pose reference
}

// Standard bone mapping for humanoid avatars
export const STANDARD_BONE_MAPPING: BoneMapping = {
  // Upper body
  'leftUpperArm': 'UpperArm.L',
  'rightUpperArm': 'UpperArm.R', 
  'leftForearm': 'LowerArm.L',
  'rightForearm': 'LowerArm.R',
  'leftHand': 'Hand.L',
  'rightHand': 'Hand.R',
  
  // Lower body
  'leftThigh': 'Thigh.L',
  'rightThigh': 'Thigh.R',
  'leftShin': 'Shin.L',
  'rightShin': 'Shin.R',
  'leftFoot': 'Foot.L',
  'rightFoot': 'Foot.R',
  
  // Torso
  'hips': 'Hips',
  'spine': 'Spine',
  'chest': 'Chest',
  'neck': 'Neck',
  'head': 'Head'
};

// Alternative bone naming patterns
export const BONE_NAME_PATTERNS = {
  leftUpperArm: ['UpperArm.L', 'upperarm_l', 'LeftUpperArm', 'upper_arm_l', 'L_UpperArm'],
  rightUpperArm: ['UpperArm.R', 'upperarm_r', 'RightUpperArm', 'upper_arm_r', 'R_UpperArm'],
  leftForearm: ['LowerArm.L', 'forearm_l', 'LeftForearm', 'lower_arm_l', 'L_LowerArm'],
  rightForearm: ['LowerArm.R', 'forearm_r', 'RightForearm', 'lower_arm_r', 'R_LowerArm'],
  leftHand: ['Hand.L', 'hand_l', 'LeftHand', 'L_Hand'],
  rightHand: ['Hand.R', 'hand_r', 'RightHand', 'R_Hand'],
  
  leftThigh: ['Thigh.L', 'thigh_l', 'LeftThigh', 'upper_leg_l', 'L_Thigh'],
  rightThigh: ['Thigh.R', 'thigh_r', 'RightThigh', 'upper_leg_r', 'R_Thigh'],
  leftShin: ['Shin.L', 'shin_l', 'LeftShin', 'lower_leg_l', 'L_Shin'],
  rightShin: ['Shin.R', 'shin_r', 'RightShin', 'lower_leg_r', 'R_Shin'],
  leftFoot: ['Foot.L', 'foot_l', 'LeftFoot', 'L_Foot'],
  rightFoot: ['Foot.R', 'foot_r', 'RightFoot', 'R_Foot'],
  
  hips: ['Hips', 'hip', 'pelvis', 'root'],
  spine: ['Spine', 'spine1', 'back'],
  chest: ['Chest', 'spine2', 'upper_chest'],
  neck: ['Neck', 'neck1'],
  head: ['Head', 'head1']
};

export class AvatarLoader {
  private loader: GLTFLoader;
  private cache: Map<string, AvatarData> = new Map();

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Load avatar from GLB file
   */
  async loadAvatar(url: string, customBoneMapping?: BoneMapping): Promise<AvatarData> {
    // Check cache
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    try {
      console.log('🎭 Loading avatar:', url);
      const gltf: GLTF = await new Promise((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });

      const avatarData = this.processAvatar(gltf, customBoneMapping);
      this.cache.set(url, avatarData);
      
      console.log('✅ Avatar loaded successfully:', avatarData);
      return avatarData;
    } catch (error) {
      console.error('❌ Failed to load avatar:', error);
      throw error;
    }
  }

  /**
   * Process loaded GLTF and extract avatar data
   */
  private processAvatar(gltf: GLTF, customBoneMapping?: BoneMapping): AvatarData {
    const scene = gltf.scene;
    let skeleton: THREE.Skeleton | null = null;
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    const bones = new Map<string, THREE.Bone>();
    const originalPose = new Map<string, THREE.Quaternion>();

    // Find SkinnedMesh and Skeleton
    scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) {
        skinnedMesh = object;
        skeleton = object.skeleton;
        console.log('🦴 Found SkinnedMesh with skeleton');
      }
    });

    if (!skeleton) {
      console.warn('⚠️ No skeleton found, searching for bones manually');
      // Fallback: collect bones manually
      scene.traverse((object) => {
        if (object instanceof THREE.Bone) {
          bones.set(object.name, object);
        }
      });
    } else {
      // Map bones from skeleton
      skeleton.bones.forEach((bone) => {
        bones.set(bone.name, bone);
        // Store original pose (T-pose reference)
        originalPose.set(bone.name, bone.quaternion.clone());
      });
    }

    // Create bone mapping
    const boneMapping = this.createBoneMapping(bones, customBoneMapping);
    
    console.log('📋 Bone mapping created:', boneMapping);
    console.log('🦴 Available bones:', Array.from(bones.keys()));

    return {
      scene,
      skeleton,
      skinnedMesh,
      bones,
      boneMapping,
      originalPose
    };
  }

  /**
   * Create bone mapping by matching available bones with standard names
   */
  private createBoneMapping(bones: Map<string, THREE.Bone>, customMapping?: BoneMapping): BoneMapping {
    const mapping: BoneMapping = {};
    
    // Use custom mapping if provided
    if (customMapping) {
      Object.entries(customMapping).forEach(([joint, boneName]) => {
        if (bones.has(boneName)) {
          mapping[joint] = boneName;
        }
      });
      return mapping;
    }

    // Auto-detect bone mapping using patterns
    Object.entries(BONE_NAME_PATTERNS).forEach(([joint, patterns]) => {
      for (const pattern of patterns) {
        if (bones.has(pattern)) {
          mapping[joint] = pattern;
          console.log(`✅ Mapped ${joint} -> ${pattern}`);
          break;
        }
      }
      
      if (!mapping[joint]) {
        console.warn(`⚠️ Could not find bone for joint: ${joint}`);
      }
    });

    return mapping;
  }

  /**
   * Get bone by joint name
   */
  getBone(avatarData: AvatarData, jointName: string): THREE.Bone | null {
    const boneName = avatarData.boneMapping[jointName];
    if (!boneName) {
      return null;
    }
    return avatarData.bones.get(boneName) || null;
  }

  /**
   * Reset avatar to T-pose
   */
  resetToTPose(avatarData: AvatarData): void {
    avatarData.originalPose.forEach((originalQuaternion, boneName) => {
      const bone = avatarData.bones.get(boneName);
      if (bone) {
        bone.quaternion.copy(originalQuaternion);
      }
    });
    
    if (avatarData.skeleton) {
      avatarData.skeleton.update();
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
} 