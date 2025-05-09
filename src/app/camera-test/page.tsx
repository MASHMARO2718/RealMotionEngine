'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// クライアントサイドのみでレンダリングする必要がある
const CameraTestComponent = dynamic(
  () => import('../../components/CameraTestComponent'),
  { ssr: false }
);

export default function CameraTestPage() {
  const [testResult, setTestResult] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  
  const handleSuccess = () => {
    setTestResult('success');
  };
  
  const handleError = (error: string) => {
    setTestResult('error');
    setErrorMessage(error);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-3xl">
        <div className="flex items-center mb-6">
          <Link href="/" className="text-blue-400 hover:text-blue-300 mr-3">
            ← ホームに戻る
          </Link>
          <h1 className="text-3xl font-bold">カメラ診断ツール</h1>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
          <p className="mb-4">
            このツールは、ハンドトラッキングに必要なカメラへのアクセスをテストします。
            正常に動作すれば、カメラ映像が表示されます。
          </p>
          
          <CameraTestComponent 
            onSuccess={handleSuccess}
            onError={handleError}
            width={640}
            height={480}
          />
        </div>
        
        {testResult === 'success' && (
          <div className="bg-green-700 p-4 rounded-lg mb-6">
            <h2 className="text-xl font-bold mb-2">✅ カメラテスト成功</h2>
            <p>カメラは正常に動作しています。ハンドトラッキングを試すことができます。</p>
            <Link 
              href="/" 
              className="inline-block mt-3 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium"
            >
              ハンドトラッキングを試す
            </Link>
          </div>
        )}
        
        {testResult === 'error' && (
          <div className="bg-red-700 p-4 rounded-lg mb-6">
            <h2 className="text-xl font-bold mb-2">❌ カメラテスト失敗</h2>
            <p className="mb-2">エラー: {errorMessage}</p>
            <p>
              ブラウザの設定でカメラへのアクセスを許可し、他のアプリケーションがカメラを
              使用していないことを確認してください。
            </p>
          </div>
        )}
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-3">一般的な問題と解決策</h2>
          
          <div className="space-y-4">
            <div className="p-3 bg-gray-700 rounded-lg">
              <h3 className="font-medium">カメラへのアクセスが拒否されました</h3>
              <p className="text-gray-300 mt-1">
                ブラウザの設定でカメラへのアクセス許可を確認してください。
                通常はアドレスバーの左側にあるアイコンをクリックすると設定できます。
              </p>
            </div>
            
            <div className="p-3 bg-gray-700 rounded-lg">
              <h3 className="font-medium">カメラが他のアプリで使用中</h3>
              <p className="text-gray-300 mt-1">
                Zoom、Teams、Skypeなどのアプリを閉じてから再試行してください。
                同時に複数のアプリでカメラを使用できない場合があります。
              </p>
            </div>
            
            <div className="p-3 bg-gray-700 rounded-lg">
              <h3 className="font-medium">ブラウザがカメラをサポートしていない</h3>
              <p className="text-gray-300 mt-1">
                最新のChromeまたはFirefoxブラウザの使用をお勧めします。
                ブラウザを更新するか、別のブラウザで試してください。
              </p>
            </div>
            
            <div className="p-3 bg-gray-700 rounded-lg">
              <h3 className="font-medium">セキュリティ設定の問題</h3>
              <p className="text-gray-300 mt-1">
                HTTPSまたはlocalhostでのみカメラへのアクセスが許可されます。
                他の環境ではセキュリティ上の理由でアクセスが制限されることがあります。
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 