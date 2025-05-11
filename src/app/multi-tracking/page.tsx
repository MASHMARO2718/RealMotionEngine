'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

// クライアントサイドのみでレンダリングする必要がある
const MultiTracker = dynamic(
  () => import('../../components/multi/MultiTracker'),
  { ssr: false }
);

export default function MultiTrackingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="container mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            サイバーパンク・複合トラッキング
          </h1>
          <p className="text-gray-300 mb-4">カメラの前で動いて、リアルタイムでポーズ・ハンド・フェイスのランドマークを検出します。チェックボックスで表示を切り替えられます。</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">← ホームに戻る</Link>
        </header>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-2/3 bg-gray-800 rounded-lg overflow-hidden shadow-lg"
               style={{ boxShadow: '0 0 20px rgba(0,255,255,0.3)' }}>
            <MultiTracker width={640} height={480} glowSize={12} />
          </div>
          <div className="md:w-1/3 space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-500"
                 style={{ boxShadow: '0 0 10px rgba(157, 23, 255, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-purple-400">ヒント</h2>
              <ul className="space-y-2 text-sm list-disc pl-5 text-cyan-100">
                <li>明るい環境で使用すると検出精度が向上します</li>
                <li>カメラに体全体が映るように立ち位置を調整してください</li>
                <li>チェックボックスで各トラッキングの表示を切り替えられます</li>
                <li>複数人でも検出できます（1人のみ表示）</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-500"
                 style={{ boxShadow: '0 0 10px rgba(157, 23, 255, 0.3)' }}>
              <h2 className="text-xl font-semibold mb-3 text-purple-400">サイバーパンクスタイル</h2>
              <p className="text-sm text-cyan-100">各ランドマークはサイバーパンク風の色とグローで表示されます。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 