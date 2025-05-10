'use client';

import { useState } from 'react';
import Link from 'next/link';
import PoseTracker from '../../components/pose/PoseTracker';
import { PoseType } from '../../lib/pose/mediapipe-pose-tracking';
import MediaPipeErrorBoundary from '../../components/shared/MediaPipeErrorBoundary';

export default function PoseTrackingPage() {
  const [currentPoseType, setCurrentPoseType] = useState<PoseType>('none');
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="container mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            サイバーパンク・ポーズトラッキング
          </h1>
          <p className="text-gray-300 mb-4">カメラの前で動いて、リアルタイムでポーズを検出します。立っている、座っているなどの姿勢を認識します。</p>
          <div className="flex space-x-4">
            <Link href="/" className="text-blue-400 hover:text-blue-300">← ホームに戻る</Link>
            <button
              className="text-green-400 hover:text-green-300"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? 'デバッグを非表示' : 'デバッグを表示'}
            </button>
          </div>
        </header>
        
        {error && (
          <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-6">
            <p className="font-semibold">エラー:</p>
            <p>{error}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-gray-800 rounded-lg overflow-hidden shadow-lg"
               style={{ boxShadow: '0 0 20px rgba(157, 23, 255, 0.4)' }}>
            <MediaPipeErrorBoundary>
              <PoseTracker 
                width={640}
                height={480}
                glowSize={15}
                onPoseTypeChange={setCurrentPoseType}
                onError={setError}
              />
            </MediaPipeErrorBoundary>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-500"
                 style={{ boxShadow: '0 0 10px rgba(157, 23, 255, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-purple-400">検出された姿勢</h2>
              <div className="bg-gray-700 p-4 rounded text-center border border-cyan-800">
                <div className="text-4xl mb-2">
                  {currentPoseType === 'standing' && '🧍'}
                  {currentPoseType === 'sitting' && '🪑'}
                  {currentPoseType === 'lying' && '🛌'}
                  {currentPoseType === 'walking' && '🚶'}
                  {currentPoseType === 'unknown' && '❓'}
                  {currentPoseType === 'none' && '🔍'}
                </div>
                <div className="text-lg text-cyan-300">
                  {currentPoseType === 'standing' && '立っている'}
                  {currentPoseType === 'sitting' && '座っている'}
                  {currentPoseType === 'lying' && '横になっている'}
                  {currentPoseType === 'walking' && '歩いている'}
                  {currentPoseType === 'unknown' && '不明なポーズ'}
                  {currentPoseType === 'none' && 'ポーズなし'}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-500"
                 style={{ boxShadow: '0 0 10px rgba(157, 23, 255, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-purple-400">サイバーパンクスタイル</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="inline-block w-4 h-4 rounded-full bg-yellow-500 mr-2"></span>
                  <strong className="text-yellow-400">イエロー:</strong> 顔
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-4 h-4 rounded-full bg-orange-500 mr-2"></span>
                  <strong className="text-orange-400">オレンジ:</strong> 左側の腕・脚
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-4 h-4 rounded-full bg-blue-400 mr-2"></span>
                  <strong className="text-blue-400">ブルー:</strong> 右側の腕・脚
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-4 h-4 rounded-full bg-green-500 mr-2"></span>
                  <strong className="text-green-400">ネオングリーン:</strong> グリッド
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-500"
                 style={{ boxShadow: '0 0 10px rgba(157, 23, 255, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-purple-400">ヒント</h2>
              <ul className="space-y-2 text-sm list-disc pl-5 text-cyan-100">
                <li>明るい環境で使用すると検出精度が向上します</li>
                <li>カメラに体全体が映るように立ち位置を調整してください</li>
                <li>座る動作や立ち上がる動作を試してみてください</li>
                <li>歩く動作はその場で足踏みでも検出できます</li>
                <li>姿勢が検出されない場合は、カメラから少し離れてみてください</li>
              </ul>
            </div>
          </div>
        </div>
        
        {showDebug && (
          <div className="mt-6 bg-black p-4 rounded-lg text-green-400 font-mono text-sm overflow-auto max-h-60 border border-purple-800"
               style={{ boxShadow: 'inset 0 0 10px rgba(157, 23, 255, 0.2)' }}>
            <h3 className="text-purple-300 font-semibold mb-2">デバッグ情報</h3>
            <p>検出されている姿勢: {currentPoseType}</p>
            <p>MediaPipeのポーズ検出は33個のランドマークを使用しています。</p>
            <p>ポーズ分析アルゴリズムは姿勢に基づいて、「立っている」「座っている」「横になっている」「歩いている」などを判定します。</p>
          </div>
        )}
      </div>
    </div>
  );
} 