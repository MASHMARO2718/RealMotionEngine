'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { HandGesture } from '../lib/mediapipe-hand-tracking';

// クライアントサイドのみでレンダリングする必要がある
const MediaPipeHandTracker = dynamic(
  () => import('../components/MediaPipeHandTracker'),
  { ssr: false }
);

export default function Home() {
  const [currentGesture, setCurrentGesture] = useState<HandGesture[]>(['none']);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // ジェスチャーが検出されたときのハンドラ
  const handleGestureDetected = (gestures: HandGesture[]) => {
    setCurrentGesture(gestures);
    console.log('検出されたジェスチャー:', gestures);
  };
  
  // エラー処理ハンドラ
  const handleError = useCallback((error: string) => {
    console.error('ハンドトラッキングエラー:', error);
    setErrorMessage(error);
  }, []);
  
  // 再試行ハンドラ
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setErrorMessage(null);
    
    // 状態をリセットして再読み込み
    setTimeout(() => {
      setIsRetrying(false);
    }, 500);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-8">RealMotion Engine</h1>
      
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold mb-2">MediaPipe ハンドトラッキング</h2>
        <p className="text-gray-300 mb-4">あなたの手を動かして、リアルタイムでジェスチャーを検出してみましょう</p>
      </div>
      
      {errorMessage && (
        <div className="w-full max-w-3xl mb-4 p-4 bg-red-600 text-white rounded-lg">
          <p className="font-semibold">エラーが発生しました:</p>
          <p className="mb-2">{errorMessage}</p>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold"
              onClick={handleRetry}
            >
              再試行
            </button>
            <Link 
              href="/camera-test"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold"
            >
              カメラ診断を実行
            </Link>
          </div>
        </div>
      )}
      
      <div className="w-full max-w-3xl bg-gray-800 rounded-lg overflow-hidden shadow-xl">
        {!isRetrying && (
          <MediaPipeHandTracker 
            onGestureDetected={handleGestureDetected}
            onError={handleError}
            showLandmarks={true}
            width={640}
            height={480}
          />
        )}
        {isRetrying && (
          <div className="flex items-center justify-center bg-gray-800 h-[480px]">
            <p className="text-white">再読み込み中...</p>
          </div>
        )}
      </div>
      
      <div className="mt-8 w-full max-w-3xl">
        <h3 className="text-xl font-semibold mb-4">現在検出されたジェスチャー</h3>
        <div className="grid grid-cols-2 gap-4">
          {currentGesture.map((gesture, index) => (
            <div 
              key={index} 
              className="bg-gray-700 p-4 rounded-lg text-center"
            >
              <div className="text-3xl mb-2">
                {getGestureEmoji(gesture)}
              </div>
              <div className="font-medium text-lg">
                {getGestureName(gesture)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-8 w-full max-w-3xl bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">トラブルシューティング</h3>
          <Link 
            href="/camera-test"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
          >
            カメラ診断を実行
          </Link>
        </div>
        <ul className="list-disc pl-5 space-y-2">
          <li>カメラへのアクセスをブラウザで許可してください</li>
          <li>他のアプリ（Zoom、Teamsなど）がカメラを使用していないことを確認してください</li>
          <li>ブラウザを更新するか、別のブラウザ（Chrome、Firefox最新版）を試してください</li>
          <li>一部の環境では、カメラへのアクセスが制限されている場合があります</li>
        </ul>
      </div>
      
      <div className="mt-12 w-full max-w-3xl">
        <h3 className="text-xl font-semibold mb-4">認識可能なジェスチャー</h3>
        <div className="grid grid-cols-4 gap-4">
          {['fist', 'pointing', 'peace', 'thumbs_up', 'open_hand', 'ok', 'rock', 'unknown'].map((gesture) => (
            <div 
              key={gesture} 
              className="bg-gray-700 p-3 rounded-lg text-center"
            >
              <div className="text-2xl mb-1">
                {getGestureEmoji(gesture as HandGesture)}
              </div>
              <div className="font-medium text-sm">
                {getGestureName(gesture as HandGesture)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ジェスチャーに対応する絵文字を取得
function getGestureEmoji(gesture: HandGesture): string {
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
}

// ジェスチャーの名前を取得
function getGestureName(gesture: HandGesture): string {
  switch (gesture) {
    case 'fist': return 'グー';
    case 'pointing': return '指差し';
    case 'peace': return 'ピース';
    case 'thumbs_up': return 'いいね';
    case 'open_hand': return '開いた手';
    case 'ok': return 'OK';
    case 'rock': return 'ロック';
    case 'unknown': return '不明';
    case 'none': return '検出中...';
    default: return '不明';
  }
} 