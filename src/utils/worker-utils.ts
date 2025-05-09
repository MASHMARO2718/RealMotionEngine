/**
 * Web Workerを簡単に作成するためのユーティリティ関数
 * 
 * @param workerFunction 実行したい関数
 * @returns Workerインスタンス
 */
export function createWorker<T extends (...args: any[]) => any>(
  workerFunction: T
): Worker {
  // 関数をテキストに変換
  const funcStr = `
    self.onmessage = async function(e) {
      const result = (${workerFunction.toString()})(e.data);
      if (result instanceof Promise) {
        result.then(data => self.postMessage(data))
              .catch(error => self.postMessage({ error: error.message }));
      } else {
        self.postMessage(result);
      }
    }
  `;
  
  // Blob URLを作成
  const blob = new Blob([funcStr], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  
  // Workerを作成して返す
  return new Worker(url);
}

/**
 * Workerを使用して非同期タスクを実行
 * 
 * @param worker 実行するWorker
 * @param data Workerに送信するデータ
 * @returns 処理結果
 */
export function runWorkerTask<TData, TResult>(
  worker: Worker,
  data: TData
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      worker.removeEventListener('message', onMessage);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data as TResult);
      }
    };
    
    worker.addEventListener('message', onMessage);
    worker.postMessage(data);
  });
} 