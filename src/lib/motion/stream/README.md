# モーションデータストリーミングライブラリ

Unityとのリアルタイム通信を行うライブラリ。

## 機能
- WebSocket通信
- データのシリアライズ
- エラーハンドリング
- 再接続処理

## 使用方法
```typescript
import { MotionStream } from './motionStream';

// ストリームの初期化
const stream = new MotionStream({
  url: 'ws://localhost:8080',
  onData: (data) => {
    // データ受信時の処理
  }
});

// データ送信
stream.send(motionData);
```

## 注意点
- 通信の安定性
- レイテンシー
- エラー処理
- 再接続ロジック 