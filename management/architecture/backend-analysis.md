# RealMotionEngine バックエンド構成分析レポート

## 📋 概要
RealMotionEngineのバックエンド処理は、フロントエンド中心のアーキテクチャーながら、高度な3D処理・リアルタイムトラッキング・WebAssembly最適化を組み込んだ多層構造になっています。

## 🏗️ バックエンド構成要素

### 1. 🌐 Next.js API Routes（軽量バックエンドAPI）

#### **📍 `/api/motion` エンドポイント**
**目的**: MediaPipeモーションデータの受信・配信
**実装**: `src/app/api/motion/route.ts`

```typescript
interface MotionData {
  timestamp: number;
  joints: {
    [key: string]: {
      x: number; y: number; z: number;
    };
  };
}
```

**機能**:
- **POST**: モーションデータの受信と検証
- **GET**: 最新モーションデータの配信
- **メモリ内ストレージ**: `latestMotionData`変数でリアルタイム保持

#### **📍 `/api/hello` エンドポイント**
**目的**: サーバー状態確認（ヘルスチェック）
**レスポンス**: `"Hello from Motrix backend!"`

### 2. 🔧 WebAssembly（高性能計算バックエンド）

#### **📊 WASM処理パイプライン**
```
MediaPipe データ → WASM モジュール → 最適化された計算 → フロントエンド
```

#### **🎯 実装済みWASMモジュール**

##### **A. Hand Tracker WASM** (`hand-tracker.wasm`)
```cpp
// エクスポート関数
_initialize_hand_tracker    // 初期化
_detect_hand_landmarks     // ランドマーク検出
_get_finger_tips          // 指先座標取得
_free_tracking_result     // メモリ解放
```

##### **B. Kalman Filter WASM** (`kalman.wasm`) 
```cpp
// エクスポート関数
_create_kalman_filter     // フィルター作成
_update_kalman_filter     // データ更新
_free_kalman_filter       // メモリ解放
```

#### **⚙️ ビルド設定**
- **Emscripten**: C++からWebAssemblyへコンパイル
- **最適化**: `-O3`レベル
- **メモリ管理**: `ALLOW_MEMORY_GROWTH=1`
- **エクスポート**: ES6モジュール形式

### 3. 🧵 Web Worker（並列処理バックエンド）

#### **📁 Filter Worker** (`worker/filter.worker.ts`)
**目的**: メインスレッドをブロックしない重い計算処理

```typescript
type WorkerMessage = {
  type: 'init' | 'update' | 'destroy';
  pluginName?: string;
  handle?: number;
  params?: Record<string, any>;
  data?: number[];
};
```

**機能**:
- **プラグイン管理**: WASM モジュールの動的ロード
- **非同期処理**: フィルタリング・トラッキング処理
- **メモリ管理**: ハンドルベースのリソース管理

### 4. 🎮 Unity連携バックエンド

#### **📂 Unity プロジェクト構造**
```
unity/My project/
├── Assets/           # Unity アセット
├── ProjectSettings/  # プロジェクト設定
├── Packages/         # 依存パッケージ
└── Scripts/          # C# バックエンドロジック
```

#### **🔗 WebGL連携**
- **GLTFUtility**: 3Dモデルインポート・エクスポート
- **Assembly-CSharp**: Unity メインロジック
- **WebGL出力**: ブラウザ統合可能なビルド

### 5. 📦 ビルド・配信バックエンド

#### **🔧 自動化スクリプト**

##### **A. MediaPipe モデルダウンロード**
**スクリプト**: `scripts/download-mediapipe-models.js`
```javascript
const MODEL_URLS = {
  'hand_landmarker.task': 'https://storage.googleapis.com/...',
  'gesture_recognizer.task': 'https://storage.googleapis.com/...'
};
```

**プロセス**:
1. Google Storage からモデルダウンロード
2. `public/models/`へ自動配置
3. postinstall フックで自動実行

##### **B. WASM ビルドパイプライン**
**スクリプト**: `scripts/build-wasm.js`
```bash
# ビルドコマンド例
npm run build:wasm     # C++ → WASM
npm run build:worker   # Worker bundle
npm run build:all      # 全体ビルド
```

## 🔄 データフロー分析

### **リアルタイム処理パイプライン**
```
1. Camera/MediaPipe
   ↓
2. Frontend (React/Three.js)
   ↓ POST /api/motion
3. Next.js API (データ検証・保存)
   ↓
4. Web Worker (WASM処理)
   ↓
5. 3D Model Animation
   ↓
6. Unity/WebGL (オプション)
```

### **並列処理アーキテクチャ**
```
Main Thread:    UI + Rendering + MediaPipe
                    ↕
Worker Thread:  WASM + Heavy Computation
                    ↕  
WASM Module:    C++ Optimized Algorithms
```

## 📊 性能特性

### **メモリ管理**
- **API**: インメモリ最新データ保持（軽量）
- **WASM**: ネイティブメモリ管理（高効率）
- **Worker**: 独立メモリ空間（安定性）

### **計算性能**
- **MediaPipe**: GPU加速（ブラウザネイティブ）
- **WASM**: ネイティブ速度（~90%）
- **Worker**: 並列実行（ノンブロッキング）

### **通信オーバーヘッド**
- **API**: JSON (軽量)
- **Worker**: ArrayBuffer転送（高速）
- **Unity**: WebGL統合（シームレス）

## 🛠️ 技術的特徴

### **✅ 利点**
1. **ハイブリッド構成**: フロントエンド + 高性能計算
2. **スケーラブル**: Worker・WASM で負荷分散
3. **モジュラー**: 独立したコンポーネント設計
4. **リアルタイム**: 低レイテンシー処理
5. **クロスプラットフォーム**: Web・Unity連携

### **⚠️ 制約**
1. **永続化なし**: データベース・ファイル保存未実装
2. **シングルセッション**: 複数ユーザー未対応
3. **メモリ制限**: インメモリ保存による制約
4. **デプロイ複雑性**: WASM・Unity依存

## 🎯 バックエンドの役割

### **1. リアルタイムデータハブ**
- MediaPipeからのモーションデータ受信
- フロントエンドへのデータ配信
- APIエンドポイントでの状態管理

### **2. 高性能計算エンジン**
- C++/WASMでの最適化処理
- カルマンフィルターによるノイズ除去
- ハンドトラッキング精度向上

### **3. 並列処理コーディネーター**
- Web Workerでのバックグラウンド処理
- メインスレッドのパフォーマンス保護
- 複数処理の効率的なスケジューリング

### **4. 3D統合ブリッジ**
- Three.js ↔ Unity間のデータ変換
- 3Dモデル形式の統一管理
- レンダリングパイプラインの最適化

## 🚀 将来の拡張性

### **短期的改善案**
- [ ] WebSocket実装（リアルタイム双方向通信）
- [ ] データベース連携（PostgreSQL・Redis）
- [ ] セッション管理（複数ユーザー対応）
- [ ] ログ・監視システム

### **中期的拡張案**
- [ ] サーバーサイドレンダリング（Next.js SSR）
- [ ] マイクロサービス分割（Docker・Kubernetes）
- [ ] AI推論エンジン（TensorFlow.js Server）
- [ ] ストリーミング配信（WebRTC）

### **長期的ビジョン**
- [ ] クラウドネイティブ（AWS・GCP）
- [ ] エッジコンピューティング対応
- [ ] リアルタイムコラボレーション
- [ ] 企業向けAPI・SDK提供

## 📚 技術スタック詳細

### **ランタイム環境**
- **Node.js**: 18+ (Next.js要件)
- **Emscripten**: C++→WASM コンパイラ
- **Unity**: 2021.3+ (WebGL対応)

### **依存関係**
```json
{
  "backend-core": [
    "next", "react",
    "@mediapipe/tasks-vision"
  ],
  "computation": [
    "@tensorflow/tfjs",
    "three", "@react-three/fiber"
  ],
  "build-tools": [
    "esbuild", "emscripten"
  ]
}
```

### **ビルド成果物**
```
public/
├── models/           # MediaPipeモデル
├── wasm/            # WebAssemblyモジュール
└── unity/           # Unity WebGLビルド

dist/
└── worker/          # Worker JSバンドル
```

---

**📅 調査日**: 2025年1月  
**🔍 調査範囲**: ファイル構造・API・WASM・Unity連携  
**📊 結論**: フロントエンド中心でありながら、高度なバックエンド処理を効率的に統合した先進的アーキテクチャ 