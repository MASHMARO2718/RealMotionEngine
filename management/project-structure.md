# プロジェクトフォルダ構成

```
RealMotionEngine/
├── src/                      # Next.jsのソースコード
│   ├── app/                  # Next.jsのページ
│   ├── components/           # Reactコンポーネント
│   │   ├── motion/          # モーション関連コンポーネント
│   │   │   ├── capture/     # モーションキャプチャー関連
│   │   │   ├── player/      # モーションプレイヤー関連
│   │   │   └── viewer/      # 3Dビューアー関連
│   │   └── ui/              # 共通UIコンポーネント
│   ├── lib/                  # ユーティリティ関数
│   │   ├── motion/          # モーション処理関連
│   │   │   ├── capture/     # キャプチャー処理
│   │   │   ├── convert/     # データ変換処理
│   │   │   └── stream/      # ストリーミング処理
│   │   └── unity/           # Unity連携関連
│   └── types/               # TypeScript型定義
│       └── motion/          # モーション関連の型定義
│
├── unity/                    # Unityプロジェクト
│   ├── Assets/
│   │   ├── Scripts/         # Unityスクリプト
│   │   │   ├── Motion/      # モーション処理
│   │   │   ├── Network/     # 通信処理
│   │   │   └── UI/          # Unity UI
│   │   ├── Models/          # 3Dモデル
│   │   ├── Animations/      # アニメーション
│   │   └── Prefabs/         # プレハブ
│   └── ProjectSettings/     # Unity設定
│
├── public/                   # 静的ファイル
│   ├── models/              # 3Dモデルファイル
│   └── animations/          # アニメーションファイル
│
├── management/              # プロジェクト管理
│   ├── docs/               # 技術文書
│   ├── specs/              # 仕様書
│   └── tasks/              # タスク管理
│
└── scripts/                # ビルドスクリプトなど
    ├── build/              # ビルド関連
    └── tools/              # 開発ツール
```

## フォルダの説明

### 1. src/
- **motion/** - モーション関連のコンポーネント
  - `capture/` - MediaPipeからのデータ取得
  - `player/` - モーションデータの再生
  - `viewer/` - 3Dモデル表示

- **lib/motion/** - モーション処理のロジック
  - `capture/` - キャプチャー処理
  - `convert/` - データ変換（MediaPipe → Unity）
  - `stream/` - WebSocket/API通信

### 2. unity/
- **Scripts/Motion/** - モーション処理
- **Scripts/Network/** - 通信処理
- **Models/** - アバターモデル
- **Animations/** - アニメーションデータ

### 3. management/
- **docs/** - 技術文書
- **specs/** - 仕様書
- **tasks/** - タスク管理

## 実装の優先順位

1. 基本フォルダ構造の作成
2. モーションキャプチャー関連の実装
   - `src/components/motion/capture/`
   - `src/lib/motion/capture/`
3. Unity連携の実装
   - `src/lib/unity/`
   - `unity/Scripts/Motion/`
4. 3Dビューアーの実装
   - `src/components/motion/viewer/`

## 注意点

- 各フォルダには`README.md`を配置し、目的と使用方法を記載
- 型定義は`src/types/`に集約
- 共通のユーティリティは`src/lib/`に配置
- 設定ファイルは適切な場所に配置（環境変数など） 