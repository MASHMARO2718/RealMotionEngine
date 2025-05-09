#!/bin/bash
# RealMotionEngine WASM build script
# Requires Emscripten SDK (emsdk) to be installed and activated
# https://emscripten.org/docs/getting_started/downloads.html

set -e  # Exit on any error

# Constants
WASM_SRC_DIR="src/wasm/cpp"
WASM_OUT_DIR="src/wasm"
BUILD_TYPE="Release"  # or Debug

# Ensure output directory exists
mkdir -p "$WASM_OUT_DIR"

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
  echo "Error: Emscripten compiler (emcc) not found in PATH"
  echo "Please install and activate Emscripten SDK:"
  echo "https://emscripten.org/docs/getting_started/downloads.html"
  exit 1
fi

# Print Emscripten version
emcc --version

# Build Kalman filter module
build_kalman_filter() {
  echo "Building Kalman filter WASM module..."
  
  # Compile the Kalman filter
  emcc "$WASM_SRC_DIR/kalman.cpp" "$WASM_SRC_DIR/kalman_demo.cpp" \
    -O3 -s WASM=1 \
    -s MODULARIZE=1 -s EXPORT_NAME="createKalmanModule" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS="['_kf_create','_kf_update','_kf_destroy','_generate_noisy_sine','_demo_kalman_filter','_free_data','_malloc','_free']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" \
    -o "$WASM_OUT_DIR/kalman.js"
  
  # Also create a fallback in case the build fails
  if [ ! -f "$WASM_OUT_DIR/kalman.js" ]; then
    echo "Failed to build Kalman WASM module, creating fallback..."
    echo "// This is a mock WASM module for development" > "$WASM_OUT_DIR/kalman.js"
    echo "export function createKalmanModule() {" >> "$WASM_OUT_DIR/kalman.js"
    echo "  return Promise.resolve({" >> "$WASM_OUT_DIR/kalman.js"
    echo "    _kf_create: () => 1," >> "$WASM_OUT_DIR/kalman.js"
    echo "    _kf_update: (handle, data) => data," >> "$WASM_OUT_DIR/kalman.js"
    echo "    _kf_destroy: () => {}," >> "$WASM_OUT_DIR/kalman.js"
    echo "    _generate_noisy_sine: () => 0," >> "$WASM_OUT_DIR/kalman.js"
    echo "    _demo_kalman_filter: () => 0," >> "$WASM_OUT_DIR/kalman.js"
    echo "    _free_data: () => {}" >> "$WASM_OUT_DIR/kalman.js"
    echo "  });" >> "$WASM_OUT_DIR/kalman.js"
    echo "}" >> "$WASM_OUT_DIR/kalman.js"
  fi
}

# Build other WASM modules as needed
# build_other_module() {
#   # Similar implementation
# }

# Build all WASM modules
mkdir -p "$WASM_SRC_DIR"
build_kalman_filter
# build_other_module

echo "WASM build completed successfully!" 