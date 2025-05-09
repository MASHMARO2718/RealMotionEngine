/**
 * TensorFlow関連のエラーメッセージをフィルタリングする
 * 
 * Next.jsは標準のコンソールエラーをエラーバウンダリーにキャプチャするため、
 * TensorFlowが出力する情報メッセージもエラーとして扱われてしまう問題を解決する
 */

let originalConsoleError: typeof console.error | null = null;

/**
 * TensorFlow関連のエラーメッセージを抑制する
 */
export function suppressTensorFlowErrors(): void {
  if (typeof window === 'undefined') return; // サーバーサイドでは実行しない
  
  if (originalConsoleError === null) {
    originalConsoleError = console.error;
    
    console.error = (...args: any[]) => {
      // TensorFlow関連のメッセージをフィルタリング
      if (
        args[0] && 
        typeof args[0] === 'string' && 
        (
          args[0].includes('TensorFlow') || 
          args[0].includes('INFO:') || 
          args[0].includes('Created TensorFlow Lite XNNPACK delegate') ||
          args[0].includes('vision_wasm_internal')
        )
      ) {
        // 代わりに情報として出力
        console.log('Filtered TensorFlow message:', args[0]);
        return;
      }
      
      // その他のエラーは通常通り処理
      originalConsoleError!(...args);
    };
    
    // windowエラーハンドラーも置き換え
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      // TensorFlow関連のエラーを抑制
      if (
        message && 
        typeof message === 'string' && 
        (
          message.includes('TensorFlow') || 
          message.includes('INFO:') || 
          message.includes('Created TensorFlow') ||
          (source && source.includes('vision_wasm_internal'))
        )
      ) {
        // エラーを処理済みとしてマーク
        return true;
      }
      
      // 元のハンドラーを呼び出す
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };
  }
}

/**
 * 元のコンソールエラー挙動を復元する
 */
export function restoreConsoleError(): void {
  if (typeof window === 'undefined') return; // サーバーサイドでは実行しない
  
  if (originalConsoleError !== null) {
    console.error = originalConsoleError;
    originalConsoleError = null;
  }
} 