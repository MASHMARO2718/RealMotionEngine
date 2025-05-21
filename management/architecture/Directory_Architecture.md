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
├ .github/                ← GitHub Actions & templates
├ .vscode/               ← workspace defaults
├ .cursorrules           ← machine-readable rules
├ management/
│   └ architecture/      ← all *_Architecture.md docs
├ src/                   ← Next.js + React front-end
│   ├ app/              ← Next.js App Router
│   ├ components/       ← React components
│   ├ features/         ← Feature modules
│   ├ hooks/            ← Custom React hooks
│   ├ lib/              ← Shared utilities
│   ├ pages/            ← Legacy pages (migrating to app/)
│   ├ types/            ← TypeScript type definitions
│   ├ utils/            ← Utility functions
│   ├ wasm/             ← compiled .wasm + loader JS
│   ├ workers/          ← Web Worker implementations
│   └ globals.css       ← Global styles
├ worker/               ← Legacy worker code (migrating to src/workers)
├ unity/                ← Unity WebGL project
├ blender/              ← Blender integration assets
├ research/             ← experiments, notebooks, configs
├ scripts/              ← CI / deploy / utility scripts
├ public/               ← Static assets
├ build/                ← Build output
└ config files          ← Various config files
```

## 4  Directory Responsibilities & Guidelines
| Dir | Purpose | When to add new files |
|-----|---------|----------------------|
| .github/ | Issue & PR templates, Actions | Any repo-level GitHub automation |
| management/architecture/ | Human-readable design docs | Every new architecture area |
| src/ | Front-end TypeScript | All React / Next.js runtime code |
| src/app/ | Next.js App Router pages | New page components |
| src/workers/ | Web Worker implementations | Off-main-thread processing code |
| src/wasm/ | Emscripten outputs & loader wrappers | After CI builds *.wasm |
| unity/ | Unity project assets | Do not edit generated Build/ by hand |
| blender/ | Blender integration files | 3D model processing assets |
| research/ | YAML configs, .ipynb, Parquet logs | Any experiment artefacts |
| scripts/ | Bash / Node automation | Build, lint-fix, clean tasks |
| public/ | Static assets | Images, fonts, other static files |

## 5  Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| React component | PascalCase file = component name | CameraInput.tsx |
| Hook | useXyz.ts | useKalman.ts |
| Worker | <name>.worker.ts | filter.worker.ts |
| WASM output | <module>.wasm + <module>.js | kalman.wasm, kalman.js |
| Doc | <Topic>_Architecture.md | API_Architecture.md |
| Config | <tool>.config.js | tailwind.config.js |

## 6  Package Management
- Using pnpm as the primary package manager
- Lock files: pnpm-lock.yaml (primary), package-lock.json (legacy)
- Dependencies are managed in package.json

## 7  Build & Configuration Files
| File | Purpose |
|------|---------|
| next.config.js | Next.js configuration |
| postcss.config.js | PostCSS configuration |
| tailwind.config.js | Tailwind CSS configuration |
| tsconfig.json | TypeScript configuration |
| .eslintrc.js | ESLint rules |
| .gitignore | Git ignore patterns |

## 8  Open Issues / TODO
- Complete migration from pages/ to app/ directory
- Move remaining worker code from worker/ to src/workers/
- Update CI/CD to handle pnpm-specific requirements
- Consider adding Turborepo for monorepo management

## 9  Revision History
| Date | Version | Notes |
|------|---------|-------|
| 2025-05-09 | 0.1 | Initial directory skeleton drafted |
| 2025-05-10 | 0.2 | Updated for current structure, added new directories and config files |