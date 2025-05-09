const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ビルド設定
const BUILD_DIR = path.resolve(__dirname, '../public/wasm');
const SRC_DIR = path.resolve(__dirname, '../src/wasm/cpp');
const EMSCRIPTEN_ROOT = process.env.EMSDK || '/emsdk'; // EmscriptenのルートパスをENVから取得

// ビルドディレクトリを作成
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  console.log(`Created build directory: ${BUILD_DIR}`);
}

// Emscriptenコンパイラのパス
const EMCC = path.join(EMSCRIPTEN_ROOT, 'upstream/emscripten/emcc');

// ソースファイルのパス
const HAND_TRACKER_SRC = path.join(SRC_DIR, 'hand_tracker.cpp');
const HAND_TRACKER_OUT = path.join(BUILD_DIR, 'hand-tracker.js');
const HAND_TRACKER_WASM = path.join(BUILD_DIR, 'hand-tracker.wasm');

// ハンドトラッカーモジュールのビルド
function buildHandTracker() {
  console.log('Building Hand Tracker WASM module...');
  
  try {
    // Emscriptenコンパイルコマンド
    const cmd = `${EMCC} ${HAND_TRACKER_SRC} \
      -o ${HAND_TRACKER_OUT} \
      -s WASM=1 \
      -s EXPORTED_FUNCTIONS="['_initialize_hand_tracker', '_detect_hand_landmarks', '_get_finger_tips', '_free_tracking_result', '_free_points', '_malloc', '_free']" \
      -s EXPORTED_RUNTIME_METHODS="['cwrap', 'setValue', 'getValue', 'ccall']" \
      -s ALLOW_MEMORY_GROWTH=1 \
      -s MODULARIZE=1 \
      -s ENVIRONMENT='web' \
      -s SINGLE_FILE=0 \
      -s ASSERTIONS=1 \
      -s "EXPORT_NAME='createHandTrackerModule'" \
      -s USE_ES6_IMPORT_META=0 \
      -O3`;
    
    // コンパイル実行
    execSync(cmd, { stdio: 'inherit' });
    
    console.log(`Successfully built Hand Tracker WASM module:`);
    console.log(`  JS: ${HAND_TRACKER_OUT}`);
    console.log(`  WASM: ${HAND_TRACKER_WASM}`);
    
    return true;
  } catch (error) {
    console.error('Failed to build Hand Tracker WASM module:', error);
    return false;
  }
}

// カルマンフィルターモジュールのパス
const KALMAN_SRC = path.join(SRC_DIR, 'kalman.cpp');
const KALMAN_OUT = path.join(BUILD_DIR, 'kalman.js');
const KALMAN_WASM = path.join(BUILD_DIR, 'kalman.wasm');

// カルマンフィルターモジュールのビルド
function buildKalmanFilter() {
  console.log('Building Kalman Filter WASM module...');
  
  try {
    // Emscriptenコンパイルコマンド
    const cmd = `${EMCC} ${KALMAN_SRC} \
      -o ${KALMAN_OUT} \
      -s WASM=1 \
      -s EXPORTED_FUNCTIONS="['_create_kalman_filter', '_update_kalman_filter', '_free_kalman_filter', '_malloc', '_free']" \
      -s EXPORTED_RUNTIME_METHODS="['cwrap', 'setValue', 'getValue', 'ccall']" \
      -s ALLOW_MEMORY_GROWTH=1 \
      -s MODULARIZE=1 \
      -s ENVIRONMENT='web' \
      -s SINGLE_FILE=0 \
      -s ASSERTIONS=1 \
      -s "EXPORT_NAME='createKalmanFilterModule'" \
      -s USE_ES6_IMPORT_META=0 \
      -O3`;
    
    // コンパイル実行
    execSync(cmd, { stdio: 'inherit' });
    
    console.log(`Successfully built Kalman Filter WASM module:`);
    console.log(`  JS: ${KALMAN_OUT}`);
    console.log(`  WASM: ${KALMAN_WASM}`);
    
    return true;
  } catch (error) {
    console.error('Failed to build Kalman Filter WASM module:', error);
    return false;
  }
}

// メイン関数
function main() {
  console.log('Starting WASM build process...');
  
  // Emscriptenのインストールチェック
  try {
    const emccVersion = execSync(`${EMCC} --version`, { encoding: 'utf8' });
    console.log(`Emscripten version: ${emccVersion.trim()}`);
  } catch (error) {
    console.error(`Error: Emscripten not found at ${EMCC}. Please install Emscripten or set EMSDK environment variable.`);
    process.exit(1);
  }
  
  // ハンドトラッカーモジュールのビルド
  const handTrackerBuilt = buildHandTracker();
  
  // カルマンフィルターモジュールのビルド
  const kalmanFilterBuilt = buildKalmanFilter();
  
  if (handTrackerBuilt && kalmanFilterBuilt) {
    console.log('WASM build process completed successfully!');
  } else {
    console.error('WASM build process completed with errors.');
    process.exit(1);
  }
}

// スクリプト実行
main(); 