'use client';

import { useEffect, ReactNode } from 'react';

/**
 * TensorFlowのINFOメッセージをエラーとして表示されないようにするためのコンポーネント
 */
export default function ErrorSuppressor({ children }: { children: ReactNode }) {
  useEffect(() => {
    // オリジナルのコンソールエラー関数を保存
    const originalError = console.error;
    
    // エラーハンドラーを上書き
    console.error = function(...args) {
      // TensorFlow関連のメッセージをフィルタリング
      if (args[0] && typeof args[0] === 'string' && (
        args[0].includes('TensorFlow') || 
        args[0].includes('INFO:') || 
        args[0].includes('Created TensorFlow Lite XNNPACK delegate')
      )) {
        // 代わりにログとして出力（デバッグ時に便利）
        console.log('Filtered TensorFlow message:', args[0]);
        return;
      }
      
      // その他のエラーは通常通り処理
      return originalError.apply(console, args);
    };
    
    // グローバルエラーハンドラーも同様に処理
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      // TensorFlow関連のエラーを抑制
      if (message && typeof message === 'string' && (
        message.includes('TensorFlow') || 
        message.includes('INFO:') || 
        message.includes('Created TensorFlow')
      )) {
        return true; // エラーを処理済みとしてマーク
      }
      
      // 元のハンドラーを呼び出す
      return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
    };
    
    // クリーンアップ関数
    return () => {
      console.error = originalError;
      window.onerror = originalOnError;
    };
  }, []);
  
  // 子コンポーネントをそのまま表示
  return <>{children}</>;
} 