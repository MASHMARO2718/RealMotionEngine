# Directory Architecture

## 1  Scope
Documents the **top-level folder layout** of RealMotionEngine (RME), the intent of each directory, naming conventions, and where new files should live.  
(Does not cover internal module boundaries—see *Module_Architecture.md*).

---

## 2  Goals & Non-Goals
| Goals | Non-Goals |
| ----- | --------- |
| • Give contributors a mental map of the repo | • Exhaustive file-by-file listing |
| • Enforce consistent placement of new code / docs | • Build scripts (see Build_Architecture.md) |
| • Reduce merge conflicts by clear ownership areas | • Third-party asset licencing details |

---

## 3  High-Level Tree
```text
RealMotionEngine/
├ .github/
│   ├ ISSUE_TEMPLATE.md
│   └ PULL_REQUEST_TEMPLATE.md
├ .vscode/                ← workspace defaults
├ .cursorrules            ← machine-readable rules
├ management/
│   └ architecture/       ← all *_Architecture.md docs
├ src/                    ← Next.js + React front-end
│   ├ pages/
│   ├ components/
│   ├ hooks/
│   ├ lib/
│   ├ features/
│   └ wasm/               ← compiled .wasm + loader JS
├ worker/                 ← Filter Worker source (TypeScript)
├ unity/                  ← Unity WebGL project (separate repo subtree)
├ research/               ← experiments, notebooks, configs
├ scripts/                ← CI / deploy / utility scripts
└ README.md
4 Directory Responsibilities & Guidelines
Dir	Purpose	When to add new files
.github/	Issue & PR templates, Actions	Any repo-level GitHub automation
management/architecture/	Human-readable design docs	Every new architecture area
src/	Front-end TypeScript	All React / Next.js runtime code
src/wasm/	Emscripten outputs & loader wrappers	After CI builds *.wasm
worker/	filter.worker.ts + helper libs	Long-running off-main-thread code
unity/	Unity project assets	Do not edit generated Build/ by hand
research/	YAML configs, .ipynb, Parquet logs	Any experiment artefacts
scripts/	Bash / Node automation	Build, lint-fix, clean tasks

5 Naming Conventions
Type	Convention	Example
React component	PascalCase file = component name	CameraInput.tsx
Hook	useXyz.ts	useKalman.ts
Worker	<name>.worker.ts	filter.worker.ts
WASM output	<module>.wasm + <module>.js	kalman.wasm, kalman.js
Doc	<Topic>_Architecture.md	API_Architecture.md

6 Ownership & Code Owners (future)
text
Copy
Edit
# CODEOWNERS (placeholder)
src/           @frontend-team
unity/         @gamedev-team
management/    @docs-team
7 Open Issues / TODO
 Decide if worker/ should move under src/ for Next.js 14 app router

 Automate .wasm → src/wasm/ copy in CI

8 Revision History
Date	Version	Notes
2025-05-09	0.1	Initial directory skeleton drafted