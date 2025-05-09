# Data / Control-Flow Architecture

## 1  Scope
This document describes **how data and control signals travel through RealMotionEngine (RME)** from camera capture to final recording & research logs.  
It focuses on *runtime* message paths, latency hotspots, and frame cadences—*not* on low-level module internals (see Module_Architecture.md for that).

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Provide an end-to-end “big-picture” map of every hop (thread, worker, network) | • Micro-optimisation of individual WASM routines |
| • Identify where back-pressure or batching occurs | • Unity scene graph details |
| • Act as a latency-budget reference | • Choice of ML algorithms |

## 3  End-to-End Flow Diagram
> Insert Mermaid / sequence / activity diagram here

```mermaid
flowchart LR
    subgraph Browser
        Cam(WebCam) -->|ImageBitmap| MP(MediaPipe)
        MP -->|raw landmarks| WK[Filter Worker]
        WK -->|smoothed landmarks| Viz(Unity WebGL)
        Viz -->|CanvasCaptureStream| Rec(MediaRecorder)
        Rec -->|Blob| Down[Download]
        WK -->|CSV row| Log[Logger]
    end

    Log -->|Parquet| Research[Research Pipeline]
Add FPS / size annotations near each arrow if possible.

4 Hop-by-Hop Responsibilities
#	From → To	Transport	Frequency / Batch	Latency Target
1	Camera → MediaPipe	ImageBitmap	30 fps	≤ 3 ms
2	MediaPipe → Filter Worker	postMessage (transferable)	per frame	≤ 1 ms
3	Worker → Visualisation	postMessage	per frame	≤ 1 ms
4	Visualisation → Recorder	canvas.captureStream(30)	stream	N/A (encoder bound)
5	Worker → Logger	in-mem queue → CSV	debounced 30 Hz	< 5 ms
6	Logger → Research	fetch / DVC push	batch every 5 s	best-effort

5 Latency Budget & Bottlenecks
MediaPipe processing ~7 ms on average laptop

WASM filter ~0.3 ms (Kalman)

Unity frame render ~4–10 ms (device-dependent)

Budget total: < 30 ms target → allows sub-100 ms wall-clock latency after encoding.

6 Back-Pressure / Error Handling
Layer	Strategy
Camera → MediaPipe	Drop frames if pose.send() queue length > 2
Worker queue	Ring-buffer (size = 3); overwrite oldest
Logger	Debounce + flush on page hide/unload

7 Open Issues / TODO
 Decide whether to move MediaPipe to a dedicated Worker (off-main-thread)

 Evaluate SharedArrayBuffer for zero-copy landmark transfer

 Add WebSocket path for multi-user sync

8 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial skeleton created