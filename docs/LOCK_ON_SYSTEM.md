# Lock-On System Implementation

## Overview

The Lock-On System provides robust person tracking with visual and audio feedback, following the specifications in `management/architecture/Lock‑On System Specification.md`. The system uses a two-worker architecture with MediaPipe pose detection and a state machine for reliable target acquisition and tracking.

## Architecture

### Components

1. **WebWorker #1 - Detector/Tracker** (`src/workers/detectorWorker.ts`)
   - Person detection using simplified computer vision algorithms
   - Multi-object tracking with ID assignment
   - Primary target selection based on proximity to center and confidence

2. **WebWorker #2 - Pose + Lock Logic** (`src/workers/poseWorker.ts`)
   - MediaPipe pose landmark detection
   - Lock state machine implementation
   - ROI-based processing for performance optimization

3. **UI Components**
   - `LockOnOverlay.tsx` - Visual feedback overlay
   - `LockOnAudio.tsx` - Audio feedback system
   - `MultiTrackerWithLockOn.tsx` - Enhanced tracker with lock-on integration

4. **State Management**
   - `useLockOnSystem.ts` - Main coordination hook

### State Machine

The lock-on system follows a 4-state machine:

```
SEARCHING → LOCKING → LOCKED → LOST
    ↑                           ↓
    ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

| State | Description | Visual | Audio |
|-------|-------------|--------|-------|
| **SEARCHING** | Looking for targets | Yellow rectangle | - |
| **LOCKING** | Acquiring lock (5 consecutive good frames) | Yellow pinging rectangle | - |
| **LOCKED** | Successfully locked onto target | Green pulsing rectangle | Lock beep (880Hz) |
| **LOST** | Lost target (20 frames timeout) | Red blinking rectangle | Lost boops (220Hz x2) |

### Configuration Parameters

```typescript
const VIS_TH = 0.5;      // landmark visibility threshold
const CONS_FRAMES = 5;   // consecutive frames to lock
const LOST_TIMEOUT = 20; // frames grace before LOST
```

## Usage

### Basic Integration

```tsx
import { useLockOnSystem } from '../hooks/useLockOnSystem';
import LockOnOverlay from '../components/lockOn/LockOnOverlay';
import LockOnAudio from '../components/lockOn/LockOnAudio';

function MyComponent() {
  const {
    lockState,
    startTracking,
    stopTracking,
    reacquireTarget
  } = useLockOnSystem({
    enabled: true,
    onPoseDetected: (result) => {
      // Handle pose data when locked
      console.log('Pose detected:', result);
    }
  });

  return (
    <div style={{ position: 'relative' }}>
      <video ref={videoRef} />
      <canvas ref={canvasRef} />
      
      <LockOnOverlay
        roi={lockState.roi}
        state={lockState.lockState}
        width={640}
        height={480}
      />
      
      <LockOnAudio 
        state={lockState.lockState} 
        enabled={true} 
      />
    </div>
  );
}
```

### Enhanced MultiTracker

The `MultiTrackerWithLockOn` component combines MediaPipe tracking with the lock-on system:

```tsx
<MultiTrackerWithLockOn 
  width={640} 
  height={480} 
  onPoseDetected={handlePoseData}
  lockOnEnabled={true}
/>
```

## Testing

### Test Page

Visit `/lock-on-test` to test the system:

1. **SEARCHING**: Stand in front of camera
2. **LOCKING**: Stay still for 5 frames
3. **LOCKED**: System tracks you with green overlay
4. **LOST**: Move out of frame to trigger lost state

### Performance Targets

| Device | FPS | Latency |
|--------|-----|---------|
| Desktop RTX 3050 | ≥55 fps | <70ms |
| Mobile SD 8 Gen2 | ≥25 fps | <120ms |

## Implementation Details

### Person Detection Algorithm

The detector worker uses a simplified person detection algorithm:

1. **Block-based scanning**: Divides frame into overlapping blocks
2. **Feature extraction**: Edge detection and color variance analysis
3. **Non-maximum suppression**: Removes overlapping detections
4. **Tracking association**: Links detections across frames using distance

### Pose Validation

Key landmarks for lock validation (MediaPipe indices):
```typescript
const KEY_IDX = [0, 11, 12, 23, 24, 25, 26, 27, 28, 31, 32];
// 0: nose, 11-12: shoulders, 23-24: hips, 25-28: knees/ankles, 31-32: feet
```

### Audio Feedback

- **Lock beep**: 880Hz square wave, 200ms duration
- **Lost boops**: 220Hz sine wave x2, 300ms each

## File Structure

```
src/
├── workers/
│   ├── detectorWorker.ts     # Person detection & tracking
│   └── poseWorker.ts         # MediaPipe pose + lock logic
├── components/
│   └── lockOn/
│       ├── LockOnOverlay.tsx # Visual feedback overlay
│       └── LockOnAudio.tsx   # Audio feedback system
├── hooks/
│   └── useLockOnSystem.ts    # Main coordination hook
└── app/
    ├── multi-tracking/       # Enhanced multi-tracking page
    └── lock-on-test/         # Dedicated test page
```

## Future Enhancements

1. **Multi-target cycling** - Tab key to switch between targets
2. **Gesture-based reacquire** - Raise hand to reacquire lock
3. **Server-side tracking** - Multi-camera fusion
4. **Performance optimization** - SharedArrayBuffer for landmarks
5. **Advanced ML models** - YOLOv9 + DeepSORT integration

## Troubleshooting

### Common Issues

1. **Workers not loading**: Ensure proper module type configuration
2. **MediaPipe initialization fails**: Check model files in `/public/models/`
3. **Audio not playing**: Browser autoplay policies may block audio
4. **Poor detection**: Adjust lighting and ensure clear view of person

### Debug Logging

Enable debug logging in workers:
```typescript
console.log('Lock state:', lockState, 'ROI:', roi, 'Tracks:', tracks.length);
```

## Performance Optimization

1. **OffscreenCanvas**: Used for ROI cropping
2. **Bandwidth optimization**: Only send landmarks when locked
3. **Frame skipping**: Adaptive frame rate based on performance
4. **Memory management**: Proper cleanup of workers and contexts 