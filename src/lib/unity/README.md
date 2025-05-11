# Unity連携ライブラリ

Unityとの連携を管理するライブラリ。

## 機能
- Unityプロジェクトの管理
- アセットの管理
- ビルド設定
- デプロイメント

## 使用方法
```typescript
import { UnityManager } from './unityManager';

// Unityマネージャーの初期化
const unityManager = new UnityManager({
  projectPath: './unity',
  buildPath: './public/unity-build'
});

// ビルド実行
await unityManager.build();
```

## 注意点
- ビルド設定
- アセット管理
- バージョン管理
- デプロイメント 