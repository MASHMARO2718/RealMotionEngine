import { useEffect, useRef, useState } from 'react';
import type { Handle } from '../wasm/kalman.d';

interface KalmanOptions {
  dimensions: number;
  processNoise?: number;
  measurementNoise?: number;
}

/**
 * React hook for using Kalman filter from WebAssembly module
 */
export function useKalman({
  dimensions,
  processNoise = 0.01,
  measurementNoise = 0.1
}: KalmanOptions) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const handleRef = useRef<Handle | null>(null);

  // Create worker and initialize Kalman filter
  useEffect(() => {
    async function setupKalman() {
      try {
        // Create worker
        const worker = new Worker(new URL('../../worker/filter.worker.ts', import.meta.url));
        workerRef.current = worker;

        // Initialize filter
        const initPromise = new Promise<Handle>((resolve, reject) => {
          const messageHandler = (event: MessageEvent) => {
            if (event.data.type === 'init-result') {
              worker.removeEventListener('message', messageHandler);
              if (event.data.error) {
                reject(new Error(event.data.error));
              } else {
                resolve(event.data.handle);
              }
            }
          };
          
          worker.addEventListener('message', messageHandler);
          
          worker.postMessage({
            type: 'init',
            filter: 'kalman',
            params: {
              dimensions,
              processNoise,
              measurementNoise
            }
          });
        });

        const handle = await initPromise;
        handleRef.current = handle;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to initialize Kalman filter:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    setupKalman();

    // Cleanup worker and filter on unmount
    return () => {
      const worker = workerRef.current;
      const handle = handleRef.current;
      
      if (worker && handle !== null) {
        worker.postMessage({
          type: 'destroy',
          handle
        });
        worker.terminate();
      }
    };
  }, [dimensions, processNoise, measurementNoise]);

  // Function to update the filter with new measurements
  const update = async (measurements: number[]): Promise<number[]> => {
    const worker = workerRef.current;
    const handle = handleRef.current;
    
    if (!worker || handle === null || !isLoaded) {
      throw new Error('Kalman filter not initialized');
    }

    if (measurements.length !== dimensions) {
      throw new Error(`Expected ${dimensions} measurements, got ${measurements.length}`);
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'update-result' && event.data.handle === handle) {
          worker.removeEventListener('message', messageHandler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };
      
      worker.addEventListener('message', messageHandler);
      
      worker.postMessage({
        type: 'update',
        handle,
        input: measurements
      });
    });
  };

  return {
    isLoaded,
    error,
    update
  };
} 