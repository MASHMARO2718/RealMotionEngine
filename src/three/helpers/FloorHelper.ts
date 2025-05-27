/**
 * Floor Helper for Three.js
 * Visualizes floor plane and debug information for pose analysis
 */

import * as THREE from 'three';

import type { FloorDetectionResult } from '../../lib/floor/FloorDetection';
import type { FullPoseAnalysis } from '../../lib/analytics/PoseAnalytics';
import { Vec3 } from '../../utils/vec3';

export interface FloorHelperConfig {
  gridSize: number;
  gridDivisions: number;
  showFloorPlane: boolean;
  showCenterOfMass: boolean;
  showFootPositions: boolean;
  showBodyDirection: boolean;
  floorOpacity: number;
  colorScheme: 'default' | 'cyberpunk' | 'minimal';
}

export const DEFAULT_FLOOR_HELPER_CONFIG: FloorHelperConfig = {
  gridSize: 10,
  gridDivisions: 20,
  showFloorPlane: true,
  showCenterOfMass: true,
  showFootPositions: true,
  showBodyDirection: true,
  floorOpacity: 0.3,
  colorScheme: 'default'
};

export const COLOR_SCHEMES = {
  default: {
    floor: 0x888888,
    centerOfMass: 0x00ff00,
    leftFoot: 0xff0000,
    rightFoot: 0x0000ff,
    bodyDirection: 0xffff00,
    grid: 0x444444
  },
  cyberpunk: {
    floor: 0x00ffff,
    centerOfMass: 0xff00ff,
    leftFoot: 0xff0080,
    rightFoot: 0x0080ff,
    bodyDirection: 0x80ff00,
    grid: 0x004444
  },
  minimal: {
    floor: 0xffffff,
    centerOfMass: 0x333333,
    leftFoot: 0x666666,
    rightFoot: 0x999999,
    bodyDirection: 0x000000,
    grid: 0xcccccc
  }
};

export class FloorHelper extends THREE.Group {
  private config: FloorHelperConfig;
  private colors: typeof COLOR_SCHEMES.default;
  
  // Visual elements
  private floorPlane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private centerOfMassSphere: THREE.Mesh | null = null;
  private leftFootMarker: THREE.Mesh | null = null;
  private rightFootMarker: THREE.Mesh | null = null;
  private bodyDirectionArrow: THREE.ArrowHelper | null = null;
  private coordinateAxes: THREE.AxesHelper | null = null;

  constructor(config: Partial<FloorHelperConfig> = {}) {
    super();
    this.config = { ...DEFAULT_FLOOR_HELPER_CONFIG, ...config };
    this.colors = COLOR_SCHEMES[this.config.colorScheme];
    this.name = 'FloorHelper';
    
    this.initializeVisuals();
  }

  /**
   * Initialize visual elements
   */
  private initializeVisuals(): void {
    this.createFloorPlane();
    this.createGridHelper();
    this.createCenterOfMassMarker();
    this.createFootMarkers();
    this.createCoordinateAxes();
    
    console.log('🏠 FloorHelper initialized');
  }

  /**
   * Create floor plane visualization
   */
  private createFloorPlane(): void {
    if (!this.config.showFloorPlane) return;

    const geometry = new THREE.PlaneGeometry(this.config.gridSize, this.config.gridSize);
    const material = new THREE.MeshBasicMaterial({
      color: this.colors.floor,
      transparent: true,
      opacity: this.config.floorOpacity,
      side: THREE.DoubleSide,
      wireframe: false
    });

    this.floorPlane = new THREE.Mesh(geometry, material);
    this.floorPlane.rotation.x = -Math.PI / 2; // Horizontal
    this.floorPlane.name = 'FloorPlane';
    this.add(this.floorPlane);
  }

  /**
   * Create grid helper
   */
  private createGridHelper(): void {
    this.gridHelper = new THREE.GridHelper(
      this.config.gridSize,
      this.config.gridDivisions,
      this.colors.grid,
      this.colors.grid
    );
    this.gridHelper.name = 'FloorGrid';
    this.add(this.gridHelper);
  }

  /**
   * Create center of mass marker
   */
  private createCenterOfMassMarker(): void {
    if (!this.config.showCenterOfMass) return;

    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: this.colors.centerOfMass,
      transparent: true,
      opacity: 0.8
    });

    this.centerOfMassSphere = new THREE.Mesh(geometry, material);
    this.centerOfMassSphere.name = 'CenterOfMass';
    this.centerOfMassSphere.visible = false; // Initially hidden
    this.add(this.centerOfMassSphere);
  }

  /**
   * Create foot position markers
   */
  private createFootMarkers(): void {
    if (!this.config.showFootPositions) return;

    // Left foot marker
    const leftGeometry = new THREE.ConeGeometry(0.03, 0.1, 8);
    const leftMaterial = new THREE.MeshBasicMaterial({
      color: this.colors.leftFoot,
      transparent: true,
      opacity: 0.8
    });
    this.leftFootMarker = new THREE.Mesh(leftGeometry, leftMaterial);
    this.leftFootMarker.name = 'LeftFootMarker';
    this.leftFootMarker.visible = false;
    this.add(this.leftFootMarker);

    // Right foot marker
    const rightGeometry = new THREE.ConeGeometry(0.03, 0.1, 8);
    const rightMaterial = new THREE.MeshBasicMaterial({
      color: this.colors.rightFoot,
      transparent: true,
      opacity: 0.8
    });
    this.rightFootMarker = new THREE.Mesh(rightGeometry, rightMaterial);
    this.rightFootMarker.name = 'RightFootMarker';
    this.rightFootMarker.visible = false;
    this.add(this.rightFootMarker);
  }

  /**
   * Create coordinate axes helper
   */
  private createCoordinateAxes(): void {
    this.coordinateAxes = new THREE.AxesHelper(0.5);
    this.coordinateAxes.name = 'CoordinateAxes';
    this.add(this.coordinateAxes);
  }

  /**
   * Convert MediaPipe Vec3 to Three.js coordinates
   */
  private mpVecToThree(v: Vec3): THREE.Vector3 {
    return new THREE.Vector3(v.x, -v.y, -v.z);
  }

  /**
   * Update floor visualization from analysis data
   */
  updateFromAnalysis(analysis: FullPoseAnalysis): void {
    if (!analysis.isValid) {
      this.hideAllMarkers();
      return;
    }

    // Update floor plane orientation
    this.updateFloorPlane(analysis.floorDetection);
    
    // Update center of mass
    if (this.config.showCenterOfMass) {
      this.updateCenterOfMass(analysis);
    }
    
    // Update foot positions
    if (this.config.showFootPositions) {
      this.updateFootPositions(analysis);
    }
    
    // Update body direction
    if (this.config.showBodyDirection) {
      this.updateBodyDirection(analysis);
    }
  }

  /**
   * Update floor plane orientation
   */
  private updateFloorPlane(floorDetection: FloorDetectionResult): void {
    if (!this.floorPlane || !floorDetection.isValid) return;

    // Convert floor normal to Three.js coordinates
    const floorNormal = this.mpVecToThree(floorDetection.floorNormal);
    
    // Calculate rotation to align plane with detected floor
    const upVector = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, floorNormal);
    
    this.floorPlane.setRotationFromQuaternion(quaternion);
    
    // Update opacity based on confidence
    const material = this.floorPlane.material as THREE.MeshBasicMaterial;
    material.opacity = this.config.floorOpacity * floorDetection.confidence;
  }

  /**
   * Update center of mass visualization
   */
  private updateCenterOfMass(analysis: FullPoseAnalysis): void {
    if (!this.centerOfMassSphere) return;

    const comPos = this.mpVecToThree(analysis.centerOfMass.projectedPosition);
    this.centerOfMassSphere.position.copy(comPos);
    this.centerOfMassSphere.visible = analysis.centerOfMass.confidence > 0.3;

    // Scale based on confidence
    const scale = 0.5 + analysis.centerOfMass.confidence * 0.5;
    this.centerOfMassSphere.scale.setScalar(scale);
  }

  /**
   * Update foot position markers
   */
  private updateFootPositions(analysis: FullPoseAnalysis): void {
    if (!this.leftFootMarker || !this.rightFootMarker) return;

    // Left foot
    const leftFootPos = this.mpVecToThree(analysis.footwork.leftFootPosition);
    this.leftFootMarker.position.copy(leftFootPos);
    this.leftFootMarker.visible = true;

    // Right foot
    const rightFootPos = this.mpVecToThree(analysis.footwork.rightFootPosition);
    this.rightFootMarker.position.copy(rightFootPos);
    this.rightFootMarker.visible = true;
  }

  /**
   * Update body direction arrow
   */
  private updateBodyDirection(analysis: FullPoseAnalysis): void {
    if (analysis.bodyDirection.confidence < 0.3) {
      if (this.bodyDirectionArrow) {
        this.bodyDirectionArrow.visible = false;
      }
      return;
    }

    // Remove previous arrow
    if (this.bodyDirectionArrow) {
      this.remove(this.bodyDirectionArrow);
    }

    // Create new arrow
    const direction = this.mpVecToThree(analysis.bodyDirection.vector);
    const origin = this.mpVecToThree(analysis.centerOfMass.projectedPosition);
    
    this.bodyDirectionArrow = new THREE.ArrowHelper(
      direction.normalize(),
      origin,
      0.5, // Length
      this.colors.bodyDirection,
      0.1, // Head length
      0.05 // Head width
    );
    
    this.bodyDirectionArrow.name = 'BodyDirectionArrow';
    this.add(this.bodyDirectionArrow);
  }

  /**
   * Hide all markers
   */
  private hideAllMarkers(): void {
    if (this.centerOfMassSphere) this.centerOfMassSphere.visible = false;
    if (this.leftFootMarker) this.leftFootMarker.visible = false;
    if (this.rightFootMarker) this.rightFootMarker.visible = false;
    if (this.bodyDirectionArrow) this.bodyDirectionArrow.visible = false;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FloorHelperConfig>): void {
    const oldColorScheme = this.config.colorScheme;
    this.config = { ...this.config, ...newConfig };
    
    // Update colors if scheme changed
    if (oldColorScheme !== this.config.colorScheme) {
      this.colors = COLOR_SCHEMES[this.config.colorScheme];
      this.updateColors();
    }
    
    // Rebuild if necessary
    if (newConfig.gridSize !== undefined || newConfig.gridDivisions !== undefined) {
      this.rebuildVisuals();
    }
  }

  /**
   * Update colors of existing elements
   */
  private updateColors(): void {
    if (this.floorPlane) {
      (this.floorPlane.material as THREE.MeshBasicMaterial).color.setHex(this.colors.floor);
    }
    if (this.centerOfMassSphere) {
      (this.centerOfMassSphere.material as THREE.MeshBasicMaterial).color.setHex(this.colors.centerOfMass);
    }
    if (this.leftFootMarker) {
      (this.leftFootMarker.material as THREE.MeshBasicMaterial).color.setHex(this.colors.leftFoot);
    }
    if (this.rightFootMarker) {
      (this.rightFootMarker.material as THREE.MeshBasicMaterial).color.setHex(this.colors.rightFoot);
    }
  }

  /**
   * Rebuild visual elements
   */
  private rebuildVisuals(): void {
    this.clear();
    this.initializeVisuals();
  }

  /**
   * Toggle visibility of specific elements
   */
  setElementVisibility(element: keyof FloorHelperConfig, visible: boolean): void {
    switch (element) {
      case 'showFloorPlane':
        if (this.floorPlane) this.floorPlane.visible = visible;
        break;
      case 'showCenterOfMass':
        if (this.centerOfMassSphere) this.centerOfMassSphere.visible = visible;
        break;
      case 'showFootPositions':
        if (this.leftFootMarker) this.leftFootMarker.visible = visible;
        if (this.rightFootMarker) this.rightFootMarker.visible = visible;
        break;
      case 'showBodyDirection':
        if (this.bodyDirectionArrow) this.bodyDirectionArrow.visible = visible;
        break;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    this.clear();
    console.log('🗑️ FloorHelper disposed');
  }
} 