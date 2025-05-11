# モーション関連型定義

モーションキャプチャーと再生に関する型定義。

## 型定義
```typescript
// モーションデータの基本型
interface MotionData {
  timestamp: number;
  pose: PoseData;
  hands: HandsData;
  face: FaceData;
}

// ポーズデータ
interface PoseData {
  keypoints: Keypoint[];
  confidence: number;
}

// 手のデータ
interface HandsData {
  left: Keypoint[];
  right: Keypoint[];
}

// 顔のデータ
interface FaceData {
  landmarks: Keypoint[];
}

// キーポイント
interface Keypoint {
  x: number;
  y: number;
  z: number;
  confidence: number;
}
```

## 使用方法
```typescript
import type { MotionData } from './types';

// 型の使用例
const motionData: MotionData = {
  // データ
};
```

## 注意点
- 型の一貫性
- バージョン管理
- ドキュメント化
- 拡張性 