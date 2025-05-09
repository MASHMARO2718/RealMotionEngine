'use client';

import { useState } from 'react';
import Link from 'next/link';
import HandTracker from '../components/HandTracker';
import { HandGesture } from '../lib/mediapipe-hand-tracking';
import MediaPipeErrorBoundary from '../components/MediaPipeErrorBoundary';

export default function HandTrackingDemo() {
  const [detectedGestures, setDetectedGestures] = useState<HandGesture[]>(['none']);
  const [error, setError] = useState<string | null>(null);

  // ジェスチャーに対応する絵文字を取得
  const getGestureEmoji = (gesture: HandGesture): string => {
    switch (gesture) {
      case 'fist': return '✊';
      case 'pointing': return '👆';
      case 'peace': return '✌️';
      case 'thumbs_up': return '👍';
      case 'open_hand': return '✋';
      case 'ok': return '👌';
      case 'rock': return '🤘';
      case 'unknown': return '❓';
      case 'none': return '🔍';
      default: return '❓';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="container mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-green-400">サイバーパンク・ハンドトラッキング</h1>
          <p className="text-gray-300 mb-4">カメラの前で手を動かすと、リアルタイムで手のランドマークが可視化されます。</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">← ホームに戻る</Link>
        </header>
        
        {error && (
          <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-6">
            <p className="font-semibold">エラー:</p>
            <p>{error}</p>
          </div>
        )}
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <MediaPipeErrorBoundary 
              fallback={
                <div className="flex items-center justify-center h-[480px] bg-red-900 text-white p-4">
                  <div className="text-center">
                    <h3 className="font-bold text-xl mb-2">ハンドトラッキングエラー</h3>
                    <p className="mb-4">ハンドトラッキングの初期化中にエラーが発生しました。</p>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                      onClick={() => window.location.reload()}
                    >
                      再読み込み
                    </button>
                  </div>
                </div>
              }
            >
              <HandTracker 
                showLandmarks={true}
                width={640}
                height={480}
                glowSize={20}
                onGestureDetected={setDetectedGestures}
                onError={setError}
              />
            </MediaPipeErrorBoundary>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg border border-green-500 shadow-lg" 
                 style={{ boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-green-400">検出されたジェスチャー</h2>
              <div className="grid grid-cols-2 gap-3">
                {detectedGestures.map((gesture, index) => (
                  <div key={index} className="bg-gray-700 p-3 rounded text-center border border-cyan-800">
                    <div className="text-3xl mb-1">{getGestureEmoji(gesture)}</div>
                    <div className="text-sm text-cyan-300">{gesture === 'none' ? 'なし' : gesture}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border border-green-500 shadow-lg"
                 style={{ boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-green-400">サイバーパンクスタイル</h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-pink-500 mr-2"></span>
                  <strong className="text-pink-400">ネオンピンク:</strong> 親指
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-cyan-400 mr-2"></span>
                  <strong className="text-cyan-400">シアン:</strong> 人差し指
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-2"></span>
                  <strong className="text-purple-400">ネオンパープル:</strong> 中指
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-400 mr-2"></span>
                  <strong className="text-blue-400">エレクトリックブルー:</strong> 薬指
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-fuchsia-400 mr-2"></span>
                  <strong className="text-fuchsia-400">ネオンマゼンタ:</strong> 小指
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-2"></span>
                  <strong className="text-green-400">ネオングリーン:</strong> コネクションライン
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border border-green-500 shadow-lg"
                 style={{ boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-green-400">ヒント</h2>
              <ul className="space-y-2 text-sm list-disc pl-5 text-cyan-100">
                <li>明るい環境で使用するとランドマークの検出精度が向上します</li>
                <li>手を大きく、はっきりとカメラに向けると認識しやすくなります</li>
                <li>手のひらをカメラに向けると21個のランドマークが表示されます</li>
                <li>手が検出されないときは「SCANNING FOR HAND INPUT」と表示されます</li>
                <li>指先には特殊なグロー効果が適用されています</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 