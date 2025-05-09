# API Architecture

## 1  Scope
Describe exactly **what parts of RealMotionEngine this API layer covers** and who the intended consumers are (e.g. front-end React code, Worker, backend services).

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| – e.g. Provide a stable, versioned contract for filter plugins | – Not covering low-level WASM ABI details |
| – … | – … |

## 3  High-Level Diagram
> _(Insert Mermaid / ASCII or link to an image)_

```mermaid
sequenceDiagram
    FrontEnd ->> MediaPipe: send rawFrame(ImageBitmap)
    MediaPipe -->> FilterAPI: landmarks[]
    FilterAPI -->> Visualiser: smoothedLandmarks[]
4 Responsibilities & Interfaces
4.1 Public TypeScript Interfaces
ts
Copy
Edit
export interface FilterAPI {
  init(name: string, params: Record<string, any>): Promise<Handle>;
  update(handle: Handle, landmarks: number[]): Promise<number[]>;
  destroy(handle: Handle): Promise<void>;
}
4.2 REST / WebSocket Endpoints (if any)
Path	Method	Payload	Response	Notes
/api/pose	POST	Landmarks[]	200 OK	Optional backend ingestion

5 Data / Control Flow
Explain how data moves through API boundaries (e.g. custom events, postMessage, fetch).
Include latency targets or message sizes if relevant.

6 Key Design Decisions
Decision	Rationale	Alternatives considered
Use custom EventBus over Redux	lightweight & decoupled	RxJS, Redux Toolkit

7 Open Issues / TODO
 Define error codes & retry strategy

 Add version negotiation header

8 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial skeleton created

sql
Copy
Edit

Feel free to paste this into `management/architecture/API_Architecture.md` and start filling in each section!