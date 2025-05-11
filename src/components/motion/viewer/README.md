# 3Dビューアーコンポーネント

Three.jsを使用した3Dモデル表示コンポーネント群。

## 機能
- 3Dモデルの表示
- カメラコントロール
- アニメーション再生
- ライティング制御

## 使用方法
```tsx
import { ModelViewer } from './ModelViewer';

// 基本的な使用方法
<ModelViewer
  modelPath="/models/example.glb"
  onLoad={() => {
    // モデル読み込み完了時の処理
  }}
/>
```

## 注意点
- WebGLの互換性
- パフォーマンス最適化
- メモリ管理
- モバイル対応 