'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // エラー発生時に状態を更新
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // TensorFlow関連のエラーメッセージを抑制
    if (
      error.message.includes('TensorFlow') ||
      error.message.includes('INFO:') ||
      error.message.includes('Created TensorFlow Lite XNNPACK delegate')
    ) {
      console.log('Suppressed TensorFlow error:', error.message);
      // エラーとして扱わない
      this.setState({ hasError: false, error: null });
      return;
    }
    
    // エラーロギング
    console.error('エラーバウンダリーがエラーをキャッチしました:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // フォールバックUIをレンダリング
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h2 className="text-lg font-semibold mb-2">エラーが発生しました</h2>
          <p className="mb-2">予期せぬエラーが発生しました。ページを再読み込みしてください。</p>
          {this.state.error && (
            <details className="mt-2">
              <summary className="cursor-pointer">エラー詳細</summary>
              <p className="mt-1 text-sm">{this.state.error.toString()}</p>
            </details>
          )}
          <button
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => window.location.reload()}
          >
            ページを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 