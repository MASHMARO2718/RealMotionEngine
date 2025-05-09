'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Import HandTracker with dynamic import to avoid SSR issues with camera
const HandTracker = dynamic(() => import('../components/HandTracker'), {
  ssr: false,
});

export default function Home() {
  const [gesture, setGesture] = useState<string | null>(null);
  const [gestureHistory, setGestureHistory] = useState<string[]>([]);

  const handleGestureDetected = (detectedGesture: string) => {
    // 同じジェスチャーが連続して検出された場合は無視（ノイズ低減）
    if (gesture === detectedGesture) return;
    
    setGesture(detectedGesture);
    setGestureHistory(prev => {
      // 最新の5つのジェスチャーだけを保持
      const newHistory = [...prev, detectedGesture];
      return newHistory.slice(-5);
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="z-10 w-full items-center justify-between font-mono text-sm mb-4">
        <p className="flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-3 pt-4 dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit">
          RealMotionEngine&nbsp;
          <code className="font-mono font-bold">v0.1.0</code>
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-6 w-full max-w-7xl">
        {/* カメラビュー - 左側に配置 */}
        <div className="w-full md:w-[320px] shrink-0">
          <div className="relative border border-gray-300 rounded-lg overflow-hidden mb-4 shadow-md">
            <HandTracker 
              width={320} 
              height={240}
              onGestureDetected={handleGestureDetected}
            />
          </div>
          <div className="text-center text-sm text-gray-500 mb-4">
            ↑ カメラビュー（320×240）
          </div>
        </div>
        
        {/* 右側のコンテンツエリア */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-4">MediaPipe ハンドトラッキング</h1>
          
          {gesture && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 w-full">
              <h2 className="text-lg font-semibold mb-2">検出されたハンドジェスチャー</h2>
              <div className="flex justify-center items-center p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <span className="text-2xl font-bold">{gesture}</span>
              </div>
              
              {gestureHistory.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-md font-medium mb-2">履歴</h3>
                  <div className="flex flex-wrap gap-2">
                    {gestureHistory.map((g, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-2">MediaPipe</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Googleの機械学習ベースのハンドポーズ認識技術
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-2">21点のランドマーク</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                各指の関節と手のひらを含む精密なトラッキング
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-2">リアルタイム認識</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                WebAssemblyとWorkerスレッドによる高速処理
              </p>
            </div>
          </div>
          
          <div className="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-2">使い方</h2>
            <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>手をカメラに向けて、ジェスチャーを行ってください</li>
              <li>サムズアップ(thumbs_up)、ピース(peace)、指差し(pointing)などのジェスチャーが認識されます</li>
              <li>検出されたジェスチャーは上部に表示されます</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
} 