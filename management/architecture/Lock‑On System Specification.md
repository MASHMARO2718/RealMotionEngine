# Motrix – Lock-On System Specification

## 0. Purpose

Provide a **robust “lock-on” UX** that tracks a single target person end-to-end, giving clear *visual* and *audio* feedback when the lock is acquired or lost.

---

## 1. High-level Flow

```mermaid
graph LR
    A[Camera Stream] --> B[Detector + Tracker\n(WebWorker #1)]
    B -- ROI --> C[PoseWorker\n(WebWorker #2)]
    C -- landmarks+locked --> D[React UI / Three.js]
    D -- user tap (re-acquire) --> B
```

| Layer                | Responsibility             | Tech                         |
| -------------------- | -------------------------- | ---------------------------- |
| **Detector/Tracker** | Person bounding boxes (ID) | YOLOv9 + DeepSORT / BoT-SORT |
| **PoseWorker**       | Landmarks & **lock state** | MediaPipe Pose               |
| **UI**               | Outline, HUD, beep         | React + Tailwind + Howler    |

---

## 2. State Machine

| State         | Entry Condition                  | UI                    | Audio                |
| ------------- | -------------------------------- | --------------------- | -------------------- |
| **SEARCHING** | App start / lock lost            | Yellow rectangle      | —                    |
| **LOCKING**   | `goodCount ≥ CONS_FRAMES`        | Yellow → Green fade   | —                    |
| **LOCKED**    | Landmarks healthy                | Pulsing green outline | Short **beep**       |
| **LOST**      | `goodCount = 0` for ≥ *N* frames | Blinking red outline  | Low-tone **boop ×2** |

Transition diagram:

```
SEARCHING --> LOCKING --> LOCKED --> LOST --> SEARCHING
 ^                                       |
 '---------------------------------------'
```

Parameters (defaults)

```
VIS_TH       = 0.5      # landmark visibility threshold
CONS_FRAMES  = 5        # consecutive frames to lock
LOST_TIMEOUT = 20       # frames grace before LOST
```

---

## 3. WebWorker #1 – Detector / Tracker

```ts
// detectorWorker.ts
import { YoloV9 } from "ultralytics";
import initBoTSORT from "./botSort";

const yolo   = await YoloV9.load("yolov9s-person.onnx");
const sorter = initBoTSORT({ lambdaPose: 0.3 });

onmessage = ({ data }) => {
  const { frame } = data;
  const dets   = yolo.detect(frame, "person");
  const tracks = sorter.update(dets);

  // Choose primary track: largest area or nearest to center
  const primary = pickPrimary(tracks);
  postMessage({ type: "tracker", roi: primary?.bbox ?? null, id: primary?.id });
};
```

*Pose-distance term* contributes to sorting cost
`cost_total = λ_iou + λ_reid + λ_pose · ||hipₜ – hipₜ₋₁||`.

---

## 4. WebWorker #2 – Pose + Lock Logic

Essential snippet (see full code in previous chat):

```ts
const KEY_IDX = [0,11,12,23,24,25,26,27,28,31,32];
if (KEY_IDX.every(i => lm[i].visibility > VIS_TH)) goodCount++; else goodCount = 0;
```

* Emit `postMessage({ type:"lockOn", locked:true/false })`.
* Forward landmarks only when `locked === true` to save bandwidth.

---

## 5. UI Layer

### 5.1 `<LockOnOverlay />`

Props: `roi`, `state` (`searching` | `locking` | `locked` | `lost`)

Tailwind classes

```
searching : border-yellow-400
locking   : border-yellow-400 animate-ping
locked    : border-emerald-400 animate-pulse
lost      : border-red-500   animate-blink
```

### 5.2 Audio

| File             | Event  | Generation            |
| ---------------- | ------ | --------------------- |
| `lock_beep.mp3`  | LOCKED | 880 Hz square, 200 ms |
| `lost_boops.mp3` | LOST   | 220 Hz sine ×2        |

---

## 6. Integration Hooks

```ts
// ThreeScene.tsx
useEffect(() => {
  model.visible = locked;
}, [locked]);
```

* Apply bone updates **only** while `locked`.
* When `lost`, fade model opacity → 0.4 to signal weak tracking.

---

## 7. Performance Targets

| Device           | FPS (cam→UI) | End-to-end Latency |
| ---------------- | ------------ | ------------------ |
| Desktop RTX 3050 | ≥ 55 fps     | < 70 ms            |
| Mobile SD 8 Gen2 | ≥ 25 fps     | < 120 ms           |

Optimisations: OffscreenCanvas crop, SharedArrayBuffer for landmarks, power-of-2 ROI.

---

## 8. Test Plan

1. **Solo walk-by** – expect no ID loss.
2. **Occlusion 1 s** – should stay LOCKED.
3. **Person cross** – verify no ID switch.
4. **Mirror** – ensure reflection not mistaken.
5. **Low-light (<50 lx)** – lock persists.

Log `lockState`, `trackID`, bbox IoU, FPS.

---

## 9. Future Extensions

* Multi-target cycling (`Tab` key)
* Gesture-based reacquire (raise hand)
* Server-side tracker for multi-camera fusion
