# Three.js Avatar Animation Integration

This document describes the complete pose analytics to Three.js avatar animation pipeline that converts MediaPipe pose data into real-time 3D avatar movement.

## Architecture Overview

```
MediaPipe Pose → Pose Analytics → Three.js Avatar Animation
     ↓               ↓                    ↓
  PoseLandmarks → FullPoseAnalysis → Avatar Movement
```

### Core Components

1. **AvatarLoader** - Loads and processes GLB/GLTF avatar models
2. **PoseRetargeter** - Converts pose data to Three.js quaternions
3. **PoseDriver** - Main controller for avatar animation
4. **FloorHelper** - Visualizes floor plane and debug info
5. **useAvatarPose** - React hook for easy integration

## Quick Start

### Simple Integration

```typescript
import { useAvatarPoseWithAnalytics } from '../hooks/useAvatarPose';
import EnhancedAvatarViewer from '../components/three/EnhancedAvatarViewer';

function MyComponent() {
  const analysis = /* your FullPoseAnalysis from pose analytics */;
  
  return (
    <EnhancedAvatarViewer
      width={800}
      height={600}
      analysis={analysis}
      avatarUrl="/models/stickman.glb"
      enableDebug={true}
    />
  );
}
```

### Standalone Usage (No React)

```typescript
import { createPoseDriver } from '../three/PoseDriver';
import { PoseAnalyticsEngine } from '../lib/analytics/PoseAnalytics';

// Create the system
const poseAnalytics = new PoseAnalyticsEngine();
const poseDriver = await createPoseDriver('/models/stickman.glb', {
  smoothingFactor: 0.3,
  enableFloorAlignment: true,
  enableBodyDirection: true
});

// Use with MediaPipe results
poseStream.on('frame', (poseResult) => {
  const analysis = poseAnalytics.analyzeFrame(poseResult);
  poseDriver.update(analysis);
});
```

## Coordinate System Conversion

The system handles MediaPipe to Three.js coordinate conversion automatically:

```typescript
// MediaPipe → Three.js coordinate mapping
function mpVecToThree(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(
    v.x,     // X: same (left ↔ right)
    -v.y,    // Y: flipped (MediaPipe down is +Y, Three.js up is +Y)
    -v.z     // Z: flipped (MediaPipe forward is +Z, Three.js back is +Z)
  );
}
```

## Bone Mapping

The system automatically maps pose joints to avatar bones:

| Joint | Three.js Bone | T-Pose Reference |
|-------|---------------|------------------|
| `leftUpperArm` | `UpperArm.L` | `(1, 0, 0)` |
| `rightUpperArm` | `UpperArm.R` | `(-1, 0, 0)` |
| `leftForearm` | `LowerArm.L` | `(1, 0, 0)` |
| `rightForearm` | `LowerArm.R` | `(-1, 0, 0)` |
| `leftThigh` | `Thigh.L` | `(0, -1, 0)` |
| `rightThigh` | `Thigh.R` | `(0, -1, 0)` |
| `leftShin` | `Shin.L` | `(0, -1, 0)` |
| `rightShin` | `Shin.R` | `(0, -1, 0)` |
| `spine` | `Spine` | `(0, 1, 0)` |

## Configuration Options

### PoseRetargetConfig

```typescript
interface PoseRetargetConfig {
  smoothingFactor: number;         // 0.0-1.0, SLERP smoothing factor
  enableFloorAlignment: boolean;   // Adjust avatar position to floor
  enableBodyDirection: boolean;    // Apply body rotation from spine
  coordinateScale: number;         // Scale factor for coordinates
  confidenceThreshold: number;     // Minimum confidence to apply pose
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
  smoothingFactor: 0.3,           // 30% new pose, 70% previous
  enableFloorAlignment: true,     // Keep feet on ground
  enableBodyDirection: true,      // Apply body rotation
  coordinateScale: 1.0,          // No scaling
  confidenceThreshold: 0.5       // 50% minimum confidence
};
```

## Integration with Existing Code

### Adding to MultiTrackerWithLockOn

```typescript
// 1. Import the system
import { PoseAnalyticsEngine } from '../../lib/analytics/PoseAnalytics';
import { createPoseDriver } from '../../three/PoseDriver';

// 2. Add to component state
const [poseAnalytics] = useState(() => new PoseAnalyticsEngine());
const [avatarDriver, setAvatarDriver] = useState(null);

// 3. Initialize avatar driver
useEffect(() => {
  createPoseDriver('/models/stickman.glb').then(setAvatarDriver);
}, []);

// 4. In your pose detection success handler
if (result && result.landmarks && result.landmarks.length > 0) {
  // Existing pose detection code...
  
  // Add avatar animation
  if (poseAnalytics && avatarDriver) {
    const analysis = poseAnalytics.analyzeFrame(result, undefined, timestamp);
    avatarDriver.update(analysis);
  }
}
```

## Advanced Features

### Floor Alignment

The system can automatically adjust the avatar's position to keep feet on the detected floor plane:

```typescript
const config = {
  enableFloorAlignment: true,
  // Avatar will be positioned so feet touch the floor
};
```

### Body Direction

Apply overall body rotation based on spine orientation:

```typescript
const config = {
  enableBodyDirection: true,
  // Avatar will rotate to face the detected body direction
};
```

### Custom Smoothing

Adjust smoothing to balance responsiveness vs. stability:

```typescript
const config = {
  smoothingFactor: 0.1,  // Very responsive, jittery
  smoothingFactor: 0.5,  // Balanced (recommended)
  smoothingFactor: 0.9,  // Very smooth, laggy
};
```

## Floor Visualization

The FloorHelper provides real-time debug visualization:

```typescript
import { FloorHelper } from '../three/helpers/FloorHelper';

// Create floor helper
const floorHelper = new FloorHelper({
  gridSize: 10,
  showCenterOfMass: true,
  showFootPositions: true,
  showBodyDirection: true,
  colorScheme: 'cyberpunk'  // 'default' | 'cyberpunk' | 'minimal'
});

// Update with analysis data
floorHelper.updateFromAnalysis(analysis);
```

## Performance Considerations

### Target Performance
- **60 FPS** pose updates
- **<5ms** pose processing latency
- **<2ms** avatar update time

### Optimization Tips

1. **Reduce smoothing** for better performance:
   ```typescript
   { smoothingFactor: 0.1 }  // Less smoothing = faster
   ```

2. **Adjust confidence threshold**:
   ```typescript
   { confidenceThreshold: 0.7 }  // Skip low-confidence frames
   ```

3. **Disable expensive features** when not needed:
   ```typescript
   {
     enableFloorAlignment: false,  // Skip floor calculations
     enableBodyDirection: false    // Skip body rotation
   }
   ```

## Debugging

### Enable Debug Logging

```typescript
const avatarPose = useAvatarPose({
  enableDebugLog: true,  // Enables detailed console output
});
```

### Debug Information

```typescript
const debugInfo = avatarPose.debugInfo;
console.log({
  frameCount: debugInfo.frameCount,
  averageUpdateTime: debugInfo.averageUpdateTime,
  retargeterInfo: debugInfo.retargeterInfo
});
```

### Visual Debugging

```typescript
<EnhancedAvatarViewer
  enableDebug={true}      // Shows performance stats
  analysis={analysis}     // Real-time analysis data display
/>
```

## Error Handling

### Common Issues

1. **Avatar not loading**:
   ```typescript
   // Check avatar URL and file format
   avatarUrl="/models/stickman.glb"  // Ensure GLB/GLTF format
   ```

2. **No bone mapping**:
   ```typescript
   // Provide custom bone mapping
   const customMapping = {
     leftUpperArm: 'Left_UpperArm',  // Match your model's bone names
     rightUpperArm: 'Right_UpperArm'
   };
   ```

3. **Poor pose quality**:
   ```typescript
   // Increase confidence threshold
   { confidenceThreshold: 0.8 }  // Only use high-quality poses
   ```

### Error Recovery

```typescript
const avatarPose = useAvatarPose({
  onError: (error) => {
    console.error('Avatar error:', error);
    // Handle error (show fallback, retry, etc.)
  }
});
```

## API Reference

### Core Classes

- **`AvatarLoader`** - Loads and processes avatar models
- **`PoseRetargeter`** - Converts pose to avatar animation
- **`StandalonePoseDriver`** - Non-React avatar controller
- **`FloorHelper`** - Floor visualization and debug tools

### React Components

- **`PoseDriver`** - React Three Fiber avatar component
- **`EnhancedAvatarViewer`** - Complete avatar viewer with controls

### Hooks

- **`useAvatarPose`** - Main avatar pose hook
- **`useAvatarPoseWithAnalytics`** - Automatic analytics integration

### Utilities

- **`createPoseDriver`** - Convenience function for standalone setup
- **`mpVecToThree`** - Coordinate conversion
- **`vecToQuat`** - Vector to quaternion conversion

## Example Projects

See the complete examples in:
- `src/examples/AvatarPoseExample.tsx` - Basic usage examples
- `src/components/three/EnhancedAvatarViewer.tsx` - Full-featured viewer
- Integration guide for `MultiTrackerWithLockOn.tsx`

## Requirements

- Three.js (already installed)
- @react-three/fiber (already installed)
- @react-three/drei (already installed)
- Your existing pose analytics system

## Next Steps

1. **Try the basic example**: Start with `SimpleAvatarPoseExample`
2. **Integrate with your pose stream**: Add avatar animation to `MultiTrackerWithLockOn`
3. **Customize appearance**: Modify bone mapping and smoothing settings
4. **Add floor visualization**: Use `FloorHelper` for debugging
5. **Optimize performance**: Adjust confidence thresholds and smoothing

The system is designed to work seamlessly with your existing pose analytics and provides a complete pipeline from MediaPipe pose detection to realistic 3D avatar animation. 