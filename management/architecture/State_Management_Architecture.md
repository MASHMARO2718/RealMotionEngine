# State-Management Architecture

## 1  Scope
Describes **how application state is stored, mutated, and observed** inside RealMotionEngine (RME).  
Focuses on client-side (React/Next.js) concerns: global store, local component state, and cross-tab synchronisation.  
(Server-side DB schema is out of scope.)

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Provide a predictable, traceable single source of truth | • Replace Unity’s internal scene state |
| • Keep rendering snappy — avoid unnecessary re-renders | • Full analytics/event logging spec |
| • Enable time-travel debugging / replay for research | • Server persistence (handled elsewhere) |

---

## 3  High-Level Diagram
```mermaid
graph TB
    CameraInput -->|dispatch| Store[Global Store]
    SettingsPanel --> Store
    WorkerResults -->|dispatch| Store
    Store -->|select| UnityViewer
4 Library Choice & Rationale
Candidate	Pros	Cons	Decision
Zustand	minimal, hooks-first, middleware	no built-in devtools	Chosen
Redux Toolkit	rich ecosystem, time-travel devtools	boilerplate, bigger bundle	
Jotai	atomic granularity	async orchestration verbose	

5 State Tree Overview
ts
Copy
Edit
type RMEState = {
  camera: {
    permission: 'idle' | 'granted' | 'denied';
    constraints: MediaTrackConstraints;
  };
  landmarks: number[] | null;      // latest raw
  smoothed: number[] | null;       // after filter
  filter: {
    name: string;                  // active plugin
    params: Record<string, any>;
  };
  recording: {
    isActive: boolean;
    chunks: Blob[];
  };
};
6 Mutation Flow
Phase	Action Creator	Side-effects	Notes
initCamera	getUserMedia → set camera.permission	none	
setFilterParams	update params → tell Worker via postMessage	debounced	
worker/receive	on message → update smoothed	triggers Unity re-render	
startRecording	set flag → MediaRecorder start	creates new chunks[]	

All mutations funnel through Zustand’s set(); no direct object mutation outside the store.

7 Cross-Tab / Persistence Strategy
Item	Mechanism
Settings (filter, fps)	localStorage + storage event sync
Recording chunks	Session memory only (cleared on refresh)
Experiments configs	Saved YAML in /research/configs/

8 DevTools & Debugging
Integrate zustand-middleware-devtools in non-prod builds

“State” tab in browser extension allows time-travel replay

Logseq “motrix:state” events can be captured for research playback

9 Open Issues / TODO
 Evaluate useSyncExternalStore for React 19 compatibility

 Add IndexedDB fallback for >2 GB recordings

10 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial skeleton generated