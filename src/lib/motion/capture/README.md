# モーションキャプチャーライブラリ

MediaPipeを使用したモーションデータの取得と処理を行うライブラリ。

## 機能
- MediaPipeの初期化と設定
- トラッキングデータの取得
- データの正規化
- エラーハンドリング

## 使用方法
```typescript
import { initializeMotionCapture } from './motionCapture';

// 初期化
const motionCapture = await initializeMotionCapture({
  // 設定オプション
});

// データ取得
motionCapture.onData((data) => {
  // データ処理
});
```

## 注意点
- ブラウザの互換性
- パフォーマンス最適化
- エラー処理
- メモリ管理 