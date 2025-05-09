# RealMotionEngine (RME)

**Browser-first real-time motion-tracking and research platform**

RealMotionEngine enables low-latency capture of human motion via any webcam, advanced filtering/learning pipelines, and high-fidelity 3D visualization - all inside a modern web stack.

## Key Features

- **Sub-100 ms end-to-end latency** using C++ → WASM filters on a dedicated Worker thread
- **Research-ready** — reproducible experiments, metrics, versioning (DVC / MLflow)
- **Plugin architecture** for filters, ML models, and render engines
- **Cross-engine 3D** — Unity WebGL primary, Three.js fallback

## Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher)
- pnpm (recommended) or npm
- For WASM builds: [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
- For Unity integration: Unity 2022.3+ with WebGL module

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Building WASM components

```bash
# Build WebAssembly modules
pnpm build:wasm
```

## Project Structure

```
RealMotionEngine/
├ src/                    ← Next.js + React front-end
│  ├ app/                 ← App router components
│  ├ components/          ← Shared React components
│  └ wasm/                ← WebAssembly modules and loaders
├ worker/                 ← Web Workers for off-main-thread processing
├ unity/                  ← Unity WebGL integration
├ scripts/                ← Build scripts and utilities
├ research/               ← ML experiments and research pipeline
└ management/             ← Architecture documentation
```

## Contributing

See our [contributing guidelines](CONTRIBUTING.md) for more information.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 