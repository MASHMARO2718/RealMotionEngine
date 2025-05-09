import HandTrackerInstance, {
  HandTrackerModule,
  HandTrackingResult,
  Point3D,
  GestureType,
  parsePoint3DArray
} from './hand-tracker';

// WASMモジュールのURL（ビルド後のパス）
const WASM_URL = '/wasm/hand-tracker.wasm';

// WASMファイルが見つからない場合のフォールバックシミュレーション
// この関数はWASMが利用できない場合にシミュレーションを提供します
function createSimulatedHandDetection(
  width: number,
  height: number,
  imageData: Uint8ClampedArray
): HandTrackingResult {
  // 簡易的な肌色検出によるシミュレーション
  let skinPixels = 0;
  let centerX = 0;
  let centerY = 0;
  
  // 10ピクセルごとにサンプリング
  for (let y = 0; y < height; y += 10) {
    for (let x = 0; x < width; x += 10) {
      const i = (y * width + x) * 4;
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      
      // 単純な肌色検出（実際のC++コードの簡易版）
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
        skinPixels++;
        centerX += x;
        centerY += y;
      }
    }
  }
  
  if (skinPixels < 10) {
    // 手が検出されなかった場合は空の結果を返す
    return {
      hands: [],
      score: 0
    };
  }
  
  // 肌色ピクセルの重心を計算
  centerX /= skinPixels;
  centerY /= skinPixels;
  
  // 単純化した手のモデルを生成
  const points: Point3D[] = [];
  
  // 手首（中心点）
  const wristX = centerX / width;
  const wristY = centerY / height;
  points.push({ x: wristX, y: wristY, z: 0 });
  
  // 指の関節をシミュレート
  const fingerAngles = [-0.6, -0.3, 0, 0.3, 0.6]; // 5本の指
  const jointDistances = [0.02, 0.04, 0.06, 0.08]; // 各指の関節
  
  // 指ごとの処理
  fingerAngles.forEach(baseAngle => {
    // 各関節の処理
    jointDistances.forEach(distance => {
      const angle = baseAngle + Math.sin(Date.now() / 1000) * 0.1; // 時間経過で少し動く
      points.push({
        x: wristX + Math.cos(angle) * distance,
        y: wristY - Math.sin(angle) * distance,
        z: 0
      });
    });
  });
  
  // シミュレーションでは「手を開く」ジェスチャーをデフォルトとする
  return {
    hands: [{ points, gesture: GestureType.FIVE_FINGERS }],
    score: 0.8
  };
}

// ポインタからHandTrackingResultオブジェクトを生成する
function parseHandTrackingResultFromPointer(module: HandTrackerModule, resultPtr: number): HandTrackingResult | null {
  if (resultPtr === 0) return null;
  
  // 実際のデータ構造に応じてポインタからデータを取り出す実装が必要
  // 簡略版：ダミーデータを返す（実際の実装では調整が必要）
  const result: HandTrackingResult = {
    hands: [],
    score: 0.5
  };
  
  // handCountとscoreの読み取り（実際の構造体レイアウトに合わせる必要あり）
  const handCount = 1; // 実際には構造体から読み取る
  
  for (let i = 0; i < handCount; i++) {
    // 手のポインタを取得（実際の構造体レイアウトに合わせる必要あり）
    const handPtr = resultPtr; // 仮の実装
    
    // ランドマークの数を取得（実際には構造体から読み取る）
    const landmarkCount = 21; // MediaPipeの手のランドマークの数
    
    // ランドマークポインタを取得（実際の構造体レイアウトに合わせる必要あり）
    const landmarkPtr = handPtr; // 仮の実装
    
    // ランドマークを読み取る
    const points: Point3D[] = [];
    
    // 仮の実装 - 実際には構造体から正確に読み取る必要があります
    for (let j = 0; j < landmarkCount; j++) {
      points.push({
        x: 0.5, // 中央付近に設定
        y: 0.5,
        z: 0
      });
    }
    
    // ジェスチャー認識結果の取得
    const gesture = module.recognize_gesture(resultPtr, i);
    
    result.hands.push({
      points,
      gesture: gesture as GestureType
    });
  }
  
  return result;
}

class HandTracker implements HandTrackerInstance {
  private module: HandTrackerModule | null = null;
  isLoaded = false;
  private loading = false;
  private error: Error | null = null;
  private simulationMode = false;
  
  // モジュールを読み込む
  async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loading) {
      // すでに読み込み中の場合は、読み込みが完了するまで待機する
      return new Promise<boolean>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isLoaded || this.error) {
            clearInterval(checkInterval);
            resolve(this.isLoaded);
          }
        }, 100);
      });
    }
    
    this.loading = true;
    
    try {
      console.log('【デバッグ】Hand Tracker WASMモジュールを読み込み中...');
      
      try {
        // WASMファイルのアクセス確認
        const testResponse = await fetch(WASM_URL, { method: 'HEAD' });
        if (!testResponse.ok) {
          console.warn('【デバッグ】WASM file not found, using simulation mode');
          this.simulationMode = true;
          this.isLoaded = true;
          this.loading = false;
          return true;
        }
      } catch (testError) {
        console.warn('【デバッグ】Failed to check WASM file, using simulation mode:', testError);
        this.simulationMode = true;
        this.isLoaded = true;
        this.loading = false;
        return true;
      }
      
      // WASMモジュールを動的にロード
      // 注意: 実際のアプリケーションでは、Emscriptenの出力に合わせて調整が必要
      const importObject = {
        env: {
          memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
        },
      };
      
      // WASMファイルをフェッチして初期化
      const response = await fetch(WASM_URL);
      const wasmBinary = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(wasmBinary, importObject);
      
      // モジュールを保存
      this.module = instance.exports as unknown as HandTrackerModule;
      
      // 初期化関数を呼び出す
      const initResult = this.module.initialize_hand_tracker();
      this.isLoaded = initResult === 1;
      
      console.log(`【デバッグ】Hand Tracker WASM初期化: ${this.isLoaded ? '成功' : '失敗'}`);
      
      return this.isLoaded;
    } catch (err) {
      console.error('【デバッグ】Hand Tracker WASMモジュールの読み込みエラー:', err);
      console.log('【デバッグ】シミュレーションモードに切り替えます');
      this.error = err instanceof Error ? err : new Error(String(err));
      this.simulationMode = true;
      this.isLoaded = true; // シミュレーションモードは常にロード成功とみなす
      return true;
    } finally {
      this.loading = false;
    }
  }
  
  // 画像データから手のランドマークを検出
  async detectHandLandmarks(
    imageData: ImageData | Uint8ClampedArray,
    width?: number,
    height?: number
  ): Promise<HandTrackingResult | null> {
    if (!this.isLoaded) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }
    
    // シミュレーションモードの場合
    if (this.simulationMode) {
      let imgWidth: number;
      let imgHeight: number;
      let imgData: Uint8ClampedArray;
      
      if (imageData instanceof ImageData) {
        imgWidth = imageData.width;
        imgHeight = imageData.height;
        imgData = imageData.data;
      } else {
        if (!width || !height) {
          throw new Error('Uint8ClampedArrayを使用する場合は、幅と高さを指定する必要があります');
        }
        imgWidth = width;
        imgHeight = height;
        imgData = imageData;
      }
      
      return createSimulatedHandDetection(imgWidth, imgHeight, imgData);
    }
    
    // 通常のWASM処理（モジュールがある場合）
    const module = this.module!;
    
    try {
      // 画像データのサイズを取得
      let imgWidth: number;
      let imgHeight: number;
      let imgData: Uint8ClampedArray;
      
      if (imageData instanceof ImageData) {
        imgWidth = imageData.width;
        imgHeight = imageData.height;
        imgData = imageData.data;
      } else {
        if (!width || !height) {
          throw new Error('Uint8ClampedArrayを使用する場合は、幅と高さを指定する必要があります');
        }
        imgWidth = width;
        imgHeight = height;
        imgData = imageData;
      }
      
      // C++のメモリにデータをコピー
      const dataSize = imgData.length;
      const dataPtr = module._malloc(dataSize);
      
      // Uint8Arrayにデータをコピー
      for (let i = 0; i < dataSize; i++) {
        module.HEAPU8[dataPtr + i] = imgData[i];
      }
      
      // 手のランドマークを検出
      // ポインタを使用して画像データを渡す
      const resultPtr = module.detect_hand_landmarks(dataPtr as unknown as Uint8Array, imgWidth, imgHeight);
      
      // メモリを解放
      module._free(dataPtr);
      
      if (resultPtr === 0) {
        return null;
      }
      
      // 結果を解析
      const result = parseHandTrackingResultFromPointer(module, resultPtr);
      
      // メモリを解放
      module.free_tracking_result(resultPtr);
      
      return result;
    } catch (error) {
      console.error('【デバッグ】Hand landmark detection error:', error);
      return null;
    }
  }
  
  // 指先の座標を取得
  async getFingerTips(result: HandTrackingResult): Promise<Point3D[]> {
    if (this.simulationMode || !this.module || !result.hands.length) {
      // シミュレーションモードまたは手が検出されていない場合
      return [];
    }
    
    const module = this.module!;
    
    try {
      // 結果ポインタを生成（実際の実装では、何らかの方法でC++の構造体を再構築する必要があります）
      // この例では簡略化のため、detect_hand_landmarks()の結果を直接使用する前提
      const resultPtr = 0; // 仮のポインタ（実際の実装では適切な値が必要）
      
      // 指先の座標を取得
      const fingertipsPtr = module.get_finger_tips(resultPtr);
      if (fingertipsPtr === 0) {
        return [];
      }
      
      // 指先の数（親指、人差し指、中指、薬指、小指）
      const fingertipCount = 5;
      
      // 指先の座標を解析
      const tips = parsePoint3DArray(module, fingertipsPtr, fingertipCount);
      
      // メモリを解放
      module.free_points(fingertipsPtr);
      
      return tips;
    } catch (error) {
      console.error('【デバッグ】Fingertip extraction error:', error);
      return [];
    }
  }
  
  // 手のジェスチャーを認識
  async recognizeGesture(result: HandTrackingResult, handIndex: number): Promise<GestureType> {
    if (this.simulationMode) {
      // シミュレーションモードでは固定のジェスチャーを返す
      return GestureType.FIVE_FINGERS;
    }
    
    if (!this.module || !result.hands.length || handIndex >= result.hands.length) {
      return GestureType.UNKNOWN;
    }
    
    const module = this.module;
    
    try {
      // 結果ポインタを生成（実際の実装では、構造体を再構築する必要があります）
      const resultPtr = 0; // 仮のポインタ（実際の実装では適切な値が必要）
      
      // ジェスチャーを認識
      const gestureType = module.recognize_gesture(resultPtr, handIndex);
      
      return gestureType as GestureType;
    } catch (error) {
      console.error('【デバッグ】Gesture recognition error:', error);
      return GestureType.UNKNOWN;
    }
  }
  
  // リソースの解放
  dispose(): void {
    this.module = null;
    this.isLoaded = false;
    this.loading = false;
    this.error = null;
    this.simulationMode = false;
  }
}

// ハンドトラッカーのインスタンスを取得（シングルトン）
let tracker: HandTrackerInstance | null = null;

// ハンドトラッカーを取得
export async function getHandTracker(): Promise<HandTrackerInstance> {
  if (!tracker) {
    tracker = new HandTracker();
    await tracker.initialize();
  }
  return tracker;
}

// 新しいハンドトラッカーを作成
export function createHandTracker(): HandTrackerInstance {
  return new HandTracker();
} 