# モーションデータ変換ライブラリ

MediaPipeのデータをUnity用の形式に変換するライブラリ。

## 機能
- 座標系の変換
- クォータニオン計算
- スケール調整
- データ形式の変換

## 使用方法
```typescript
import { convertToUnityFormat } from './motionConverter';

// データ変換
const unityData = convertToUnityFormat(mediapipeData, {
  // 変換オプション
  scale: 1.0,
  coordinateSystem: 'right-handed'
});
```

## 注意点
- 座標系の違い
- スケールの調整
- 回転の計算
- パフォーマンス 