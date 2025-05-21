# Module Architecture

## 1  Scope
Defines **logical module boundaries** within the RealMotionEngine (RME) codebase, their public APIs, and allowed dependency directions.  
This complements *Directory_Architecture.md* (physical layout) by describing *logical* layering and interaction rules.

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Prevent cyclic or ad-hoc dependencies between feature areas | • Detailed class diagrams (see code) |
| • Facilitate testability by clear seams | • Runtime data-flow timing (see Flow_Architecture.md) |
| • Enable parallel work via ownership of modules | • Build tooling (see CI doc) |

---

## 3  Layered Module Graph
```mermaid
graph TD
  UI[UI Components] --> State
  State[Global State] --> Feature
  Feature --> Infra
  Infra --> WASM
  Feature --> Worker
  Worker --> WASM
  State --> Lib
  Lib[lib/ utilities] --> WASM[wasm plugins]
  App[App Router] --> UI
  App --> State
  Types[Type Definitions] --> All
  All[All Modules] --> Types
Allowed directions: downward only (no arrows upwards).
```

## 4  Module Responsibilities & Public Contracts
| Module | Path | Responsibilities | Public Surface |
|--------|------|------------------|----------------|
| UI | src/components/ | Presentational React components | Props only (pure) |
| State | src/store/ | Global app state, selectors | useStore() hook |
| Feature | src/features/<name>/ | Domain logic (e.g. Pose, Recorder) | Facade hooks |
| Worker | src/workers/ | Off-main-thread compute orchestration | postMessage API |
| WASM | src/wasm/ | High-perf filtering & math | JS loader functions |
| Infra / Lib | src/lib/, scripts/ | Shared utils (fetch, logger) | Named ES exports |
| App Router | src/app/ | Next.js page routing | Route handlers |
| Types | src/types/ | Shared type definitions | Type exports |

## 5  Dependency Rules (enforced by ESLint)
| Rule ID | Description | Example |
|---------|-------------|---------|
| MD-1 | UI → State → Feature → Worker/Infra → WASM (no reverse) | UI must not import from Worker |
| MD-2 | Feature modules cannot import each other directly — use State events | features/pose cannot import from features/recorder |
| MD-3 | WASM layer exports only functions (no stateful singletons) | ok: export function initKalman() |
| MD-4 | App Router pages can import from UI and State | app/page.tsx can import from components/ and store/ |
| MD-5 | Types can be imported by any module | Any module can import from types/ |

## 6  Plug-in Extension Points
| Extension | Registration Point | Contract |
|-----------|-------------------|----------|
| Filter plugins | src/wasm/plugins/* + PluginManager.register() | FilterPlugin interface |
| ML models | motion-learning/server/models/ | ONNX signature "input_landmarks" |
| Render engines | src/visualisation/ strategy pattern | Must implement IRenderer |
| Blender plugins | blender/plugins/ | Must implement BlenderPlugin interface |

## 7  State Management
- Using Zustand for global state management
- State is organized by feature domain
- Each feature module can define its own state slice
- State updates are handled through actions

## 8  Open Issues / TODO
- Evaluate Nx or TurboRepo for module boundary graph visualization
- Automate ESLint boundary rules in pre-commit
- Add type checking for worker message interfaces
- Implement proper error boundaries for each module

## 9  Revision History
| Date | Version | Notes |
|------|---------|-------|
| 2025-05-09 | 0.1 | Initial skeleton created |
| 2025-05-10 | 0.2 | Updated for current structure, added App Router and Types modules |





