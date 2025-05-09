'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { suppressTensorFlowErrors, restoreConsoleError } from '../utils/error-handling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * MediaPipe専用のエラーバウンダリーコンポーネント
 * 
 * TensorFlow/MediaPipeが生成する特定のエラーメッセージを無視し、
 * アプリケーションの動作を妨げないようにします。
 */
export default class MediaPipeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  componentDidMount() {
    // コンポーネントのマウント時にエラー抑制を有効化
    suppressTensorFlowErrors();
  }
  
  componentWillUnmount() {
    // 不要になったらエラー抑制を解除
    restoreConsoleError();
  }

  static getDerivedStateFromError(error: Error): State {
    // TensorFlow関連のエラーは無視
    if (
      error.message.includes('TensorFlow') ||
      error.message.includes('INFO:') ||
      error.message.includes('Created TensorFlow Lite XNNPACK delegate') ||
      error.message.includes('vision_wasm_internal')
    ) {
      // エラーとして扱わない
      return { hasError: false, error: null };
    }
    
    // それ以外のエラーはエラー状態に設定
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // TensorFlow関連のエラーメッセージをフィルタリング
    if (
      error.message.includes('TensorFlow') ||
      error.message.includes('INFO:') ||
      error.message.includes('Created TensorFlow Lite XNNPACK delegate') ||
      error.message.includes('vision_wasm_internal')
    ) {
      console.log('無視されたMediaPipeエラー:', error.message);
      return;
    }
    
    // エラーロギング
    console.error('MediaPipeエラーバウンダリーがエラーをキャッチしました:', error, errorInfo);
    
    // エラーコールバックを呼び出し
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // フォールバックUIをレンダリング
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-4 bg-red-900 text-white rounded">
          <h2 className="text-lg font-semibold mb-2">MediaPipeエラー</h2>
          <p className="mb-2">ハンドトラッキングの初期化中にエラーが発生しました。</p>
          {this.state.error && (
            <details className="mt-2">
              <summary className="cursor-pointer">エラー詳細</summary>
              <p className="mt-1 text-sm">{this.state.error.toString()}</p>
            </details>
          )}
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 