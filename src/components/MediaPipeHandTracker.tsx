'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  HandLandmarkerResult, 
  GestureRecognizerResult 
} from '@mediapipe/tasks-vision';
import { 
  initializeMediaPipeHandTracking, 
  detectHandLandmarks, 
  recognizeGesture,
  analyzeHandGesture,
  HandGesture,
  disposeMediaPipeHandTracking
} from '../lib/mediapipe-hand-tracking';
import { suppressTensorFlowErrors, restoreConsoleError } from '../utils/error-handling';

// コンポーネントのプロパティ
interface MediaPipeHandTrackerProps {
  onHandsDetected?: (result: HandLandmarkerResult) => void;
  onGestureDetected?: (gestures: HandGesture[]) => void;
  onError?: (error: string) => void;
  useGestureRecognizer?: boolean;
  showLandmarks?: boolean;
  width?: number;
  height?: number;
}

// ランドマークの描画設定
const LANDMARK_COLORS = {
  thumb: 'rgba(255, 41, 117, 0.8)',       // ネオンピンク
  indexFinger: 'rgba(0, 255, 255, 0.8)',  // シアン
  middleFinger: 'rgba(149, 0, 255, 0.8)', // ネオンパープル
  ringFinger: 'rgba(0, 234, 255, 0.8)',   // エレクトリックブルー
  pinky: 'rgba(255, 102, 255, 0.8)',      // ネオンマゼンタ
  palmBase: 'rgba(0, 255, 179, 0.8)'      // ネオングリーン
};

// 指先用のグロー効果カラー（より明るい色）
const TIP_GLOW_COLORS = {
  thumb: 'rgba(255, 41, 117, 0.6)',       // 透明度を高めたネオンピンク
  indexFinger: 'rgba(0, 255, 255, 0.6)',  // 透明度を高めたシアン 
  middleFinger: 'rgba(149, 0, 255, 0.6)', // 透明度を高めたネオンパープル
  ringFinger: 'rgba(0, 234, 255, 0.6)',   // 透明度を高めたエレクトリックブルー
  pinky: 'rgba(255, 102, 255, 0.6)',      // 透明度を高めたネオンマゼンタ
  palmBase: 'rgba(0, 255, 179, 0.6)'      // 透明度を高めたネオングリーン
};

// 手の各部分の接続関係（インデックス番号）
const CONNECTIONS = [
  // 親指
  [0, 1], [1, 2], [2, 3], [3, 4],
  // 人差し指
  [0, 5], [5, 6], [6, 7], [7, 8],
  // 中指
  [0, 9], [9, 10], [10, 11], [11, 12],
  // 薬指
  [0, 13], [13, 14], [14, 15], [15, 16],
  // 小指
  [0, 17], [17, 18], [18, 19], [19, 20],
  // 手のひらの接続
  [0, 5], [5, 9], [9, 13], [13, 17]
];

/**
 * MediaPipeを使用してリアルタイムハンドトラッキングを行うコンポーネント
 */
export default function MediaPipeHandTracker({
  onHandsDetected,
  onGestureDetected,
  onError,
  useGestureRecognizer = false,
  showLandmarks = true,
  width = 640,
  height = 480
}: MediaPipeHandTrackerProps) {
  // ビデオとキャンバスの参照
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 状態
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  // 検出結果
  const [gestures, setGestures] = useState<HandGesture[]>(['none']);
  // 手が検出されているかどうか
  const [handsDetected, setHandsDetected] = useState(false);

  // カメラのセットアップを直接実行できるボタン用
  const [isCameraSetupAttempted, setIsCameraSetupAttempted] = useState(false);
  
  // MediaPipeの初期化
  useEffect(() => {
    async function init() {
      // エラー抑制を有効化
      suppressTensorFlowErrors();
      
      try {
        console.log('MediaPipe初期化を開始します...');
        const success = await initializeMediaPipeHandTracking();
        console.log('MediaPipe初期化結果:', success);
        setIsInitialized(success);
        if (!success) {
          const errorMsg = 'MediaPipeの初期化に失敗しました';
          console.error(errorMsg);
          setError(errorMsg);
          if (onError) onError(errorMsg);
          return;
        }
      } catch (err) {
        const errorMsg = `初期化エラー: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMsg, err);
        setError(errorMsg);
        if (onError) onError(errorMsg);
      }
    }
    
    init();
    
    // クリーンアップ
    return () => {
      console.log('MediaPipeHandTrackerコンポーネントをクリーンアップ中...');
      
      // アニメーションフレームをキャンセル
      if (requestRef.current) {
        console.log('アニメーションフレームをキャンセル');
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      
      // ビデオストリームを停止
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          console.log('ビデオストリームを停止します');
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`トラック ${track.kind} を停止しました`);
          });
          videoRef.current.srcObject = null;
        } catch (err) {
          console.warn('ビデオストリームの停止中にエラーが発生しました:', err);
        }
      }
      
      // MediaPipe リソースを安全に解放
      // 少し遅延させて直前の処理が完了するのを待つ
      setTimeout(() => {
        try {
          console.log('MediaPipeリソースを解放します');
          
          // エラーコンソールの一時的な抑制
          const originalConsoleError = console.error;
          console.error = (...args) => {
            // TensorFlow関連のINFOメッセージを抑制
            if (args[0] && typeof args[0] === 'string' && 
                (args[0].includes('TensorFlow') || args[0].includes('INFO:'))) {
              console.log('INFO (抑制):', args[0]);
              return;
            }
            originalConsoleError(...args);
          };
          
          try {
            disposeMediaPipeHandTracking();
          } finally {
            // 元のエラーハンドラを復元
            console.error = originalConsoleError;
          }
        } catch (err) {
          console.warn('MediaPipeリソース解放中にエラーが発生しました:', err);
        }
      }, 300);
    };
  }, [onError]);
  
  // カメラのセットアップ
  const setupCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    setIsCameraSetupAttempted(true);
    
    try {
      console.log('カメラのセットアップを開始します...');
      
      // 既存のビデオストリームがあれば停止
      if (videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        console.log('既存のビデオストリームを停止しました');
      }
      
      // すべての使用可能なカメラ情報を列挙（デバッグ用）
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('利用可能なカメラデバイス:', videoDevices);
      } catch (enumErr) {
        console.warn('カメラデバイスの列挙に失敗しました:', enumErr);
      }
      
      // より明示的な制約で確実に正しいサイズを要求
      const constraints = {
        audio: false,
        video: {
          width: { min: 320, ideal: width, max: 1920 },
          height: { min: 240, ideal: height, max: 1080 },
          facingMode: 'user', // フロントカメラを優先
          aspectRatio: 16/9 // アスペクト比を固定（必要に応じて）
        }
      };
      
      // カメラの権限をチェック
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          
          permissionStatus.onchange = () => {
            setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          };
        } catch (permError) {
          console.warn('カメラ権限ステータスを取得できません:', permError);
        }
      }
      
      console.log('カメラストリームを要求しています...', constraints);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('カメラストリームを取得しました:', stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // ビデオが読み込まれたらトラッキングを開始
          videoRef.current.onloadedmetadata = () => {
            console.log('ビデオメタデータが読み込まれました:', 
                        videoRef.current?.videoWidth, 
                        videoRef.current?.videoHeight);
            
            if (videoRef.current) {
              // キャンバスのサイズを実際のビデオサイズに合わせる
              if (canvasRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                console.log('キャンバスサイズをビデオに合わせました:', canvasRef.current.width, canvasRef.current.height);
                
                // 強制的に再描画を促す
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
                  ctx.fillRect(0, 0, 100, 100); // 左上に小さな赤い四角形を描画（デバッグ用）
                }
              }
              
              console.log('ビデオ再生を開始します');
              videoRef.current.play().then(() => {
                console.log('ビデオ再生成功');
                setIsRunning(true);
                setError(null); // エラーをクリア
              }).catch(e => {
                console.error('ビデオ再生に失敗しました:', e);
                setError(`ビデオ再生エラー: ${e.message}`);
              });
            }
          };
        }
      } catch (err: any) {
        console.error('カメラアクセスエラー:', err);
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラへのアクセスを許可してください。');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('カメラが見つかりません。カメラが接続されているか確認してください。');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('カメラエラー: 他のアプリケーションがカメラを使用している可能性があります。他のアプリケーションを閉じてください。');
        } else {
          const errorMsg = `カメラエラー: ${err.name || ''} - ${err.message || 'Unknown error'}`;
          setError(errorMsg);
          if (onError) onError(errorMsg);
        }
      }
    } catch (outerErr) {
      const errorMsg = `カメラセットアップエラー: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`;
      console.error(errorMsg, outerErr);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [height, width, onError]);
  
  // 初期化が成功したらカメラをセットアップ
  useEffect(() => {
    if (isInitialized && !isCameraSetupAttempted) {
      setupCamera();
    }
  }, [isInitialized, isCameraSetupAttempted, setupCamera]);
  
  // 手のランドマークを描画
  const drawHandLandmarks = useCallback((ctx: CanvasRenderingContext2D, result: HandLandmarkerResult) => {
    try {
      if (!result || !result.landmarks || result.landmarks.length === 0) {
        console.log('描画するランドマークがありません');
        return;
      }
      
      // キャンバスのサイズを確認
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      
      if (width <= 0 || height <= 0) {
        console.warn('キャンバスサイズが無効です:', width, height);
        return;
      }
      
      console.log(`描画開始: ${result.landmarks.length}個の手、キャンバスサイズ:`, width, height);
      
      // キャンバスをクリア (この1回だけで十分)
      ctx.clearRect(0, 0, width, height);
      
      // ビデオがミラーリングされている場合の調整
      if (!result.landmarks || result.landmarks.length === 0) return;
      
      // 描画スタイルを設定 - 線をより太く
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      
      console.log(`描画開始: ${result.landmarks.length}個の手を検出`);
      
      // ビデオがミラーリングされている場合の調整 (修正: 座標系の反転をシンプルに)
      // ctx.save();
      // ctx.translate(width, 0);
      // ctx.scale(-1, 1);
      
      result.landmarks.forEach((landmarks, handIndex) => {
        console.log(`手 ${handIndex + 1} のランドマーク: ${landmarks.length}ポイント`);
        
        // 接続線を描画
        CONNECTIONS.forEach(([start, end]) => {
          const startPoint = landmarks[start];
          const endPoint = landmarks[end];
          
          if (!startPoint || !endPoint) return;
          
          ctx.beginPath();
          // 座標変換を修正（X座標を反転）- ミラーリングに対応
          ctx.moveTo((1 - startPoint.x) * width, startPoint.y * height);
          ctx.lineTo((1 - endPoint.x) * width, endPoint.y * height);
          // サイバーパンク風の線の色と太さ
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)'; // 明るいシアン
          ctx.lineWidth = 2; // 細めの線
          ctx.stroke();
        });
        
        // ランドマークを描画
        landmarks.forEach((point, index) => {
          if (!point) return;
          
          let color = 'rgba(255, 255, 255, 0.7)'; // デフォルトは白
          let isFingerTip = false;
          
          // 指先は特別な色で表示
          if (index === 4) {
            color = LANDMARK_COLORS.thumb;
            isFingerTip = true;
          }
          else if (index === 8) {
            color = LANDMARK_COLORS.indexFinger;
            isFingerTip = true;
          }
          else if (index === 12) {
            color = LANDMARK_COLORS.middleFinger;
            isFingerTip = true;
          }
          else if (index === 16) {
            color = LANDMARK_COLORS.ringFinger;
            isFingerTip = true;
          }
          else if (index === 20) {
            color = LANDMARK_COLORS.pinky;
            isFingerTip = true;
          }
          else if (index === 0) color = LANDMARK_COLORS.palmBase;
          else if (index >= 1 && index <= 4) color = 'rgba(255, 41, 117, 0.4)'; // 薄いピンク（親指）
          else if (index >= 5 && index <= 8) color = 'rgba(0, 255, 255, 0.4)';  // 薄いシアン（人差し指）
          else if (index >= 9 && index <= 12) color = 'rgba(149, 0, 255, 0.4)'; // 薄いパープル（中指）
          else if (index >= 13 && index <= 16) color = 'rgba(0, 234, 255, 0.4)'; // 薄いブルー（薬指）
          else if (index >= 17 && index <= 20) color = 'rgba(255, 102, 255, 0.4)'; // 薄いマゼンタ（小指）
          
          // 指先にはグロー効果を追加
          if (isFingerTip) {
            const glowColor = index === 4 ? TIP_GLOW_COLORS.thumb :
                              index === 8 ? TIP_GLOW_COLORS.indexFinger :
                              index === 12 ? TIP_GLOW_COLORS.middleFinger :
                              index === 16 ? TIP_GLOW_COLORS.ringFinger :
                              TIP_GLOW_COLORS.pinky;
                                
            // グロー効果（大きな透明な円）
            ctx.beginPath();
            ctx.arc(
              (1 - point.x) * width, 
              point.y * height,
              25, // グロー効果用の大きな円
              0, 
              2 * Math.PI
            );
            ctx.fillStyle = glowColor;
            ctx.fill();
          }
          
          // ランドマークを描画 - より大きく
          ctx.beginPath();
          // 座標変換を修正（X座標を反転）- ミラーリングに対応
          ctx.arc(
            (1 - point.x) * width, 
            point.y * height,
            isFingerTip ? 12 : 6, // 指先はより大きく
            0, 
            2 * Math.PI
          );
          ctx.fillStyle = color;
          ctx.fill();
          
          // 枠線は削除
          // ctx.strokeStyle = 'black';
          // ctx.lineWidth = 2;
          // ctx.stroke();
        });
      });
      
      // ctx.restore();
    } catch (err) {
      console.error('ランドマーク描画エラー:', err);
    }
  }, []);
  
  // フレーム処理関数
  const processFrame = useCallback(async (timestamp: number) => {
    if (!videoRef.current || !isRunning || !isInitialized) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // ビデオが有効かチェック
    if (videoRef.current.videoWidth <= 0 || videoRef.current.videoHeight <= 0) {
      console.warn("ビデオサイズが無効です:", videoRef.current.videoWidth, videoRef.current.videoHeight);
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // 一定間隔でのみ処理（30fps程度）
    if (timestamp - lastTimeRef.current < 33.33) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    lastTimeRef.current = timestamp;
    
    // グリッドパターン描画はコメントアウト（削除）
    /*
    // キャンバスにダイレクトに描画テスト
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', { alpha: false });
      if (ctx) {
        // テスト用のパターンを描画
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // 背景を半透明黒に
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // グリッドパターン
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)'; // 完全不透明の赤
        ctx.lineWidth = 5; // 線を太く
        
        // 縦線
        for (let x = 0; x < canvasRef.current.width; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasRef.current.height);
          ctx.stroke();
        }
        
        // 横線
        for (let y = 0; y < canvasRef.current.height; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasRef.current.width, y);
          ctx.stroke();
        }
        
        // 中央に大きな円
        ctx.fillStyle = 'rgba(0, 255, 0, 1)'; // 完全不透明の緑
        ctx.beginPath();
        ctx.arc(
          canvasRef.current.width / 2, 
          canvasRef.current.height / 2, 
          100, // サイズを大きく
          0, 
          2 * Math.PI
        );
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 10;
        ctx.stroke();
        
        // キャンバスの左上と右下に大きな対角線（座標系の確認用）
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(canvasRef.current.width, canvasRef.current.height);
        ctx.stroke();
        
        console.log('デバッグ用グリッドパターンを描画しました', 
                    canvasRef.current.width, 
                    canvasRef.current.height);
      }
    }
    */
    
    try {
      // 手のランドマークを検出
      const handLandmarkerResult = await detectHandLandmarks(
        videoRef.current,
        timestamp
      );
      
      // ランドマーク処理とキャンバス描画
      if (handLandmarkerResult) {
        // キャンバスをクリア
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      
        // ランドマークが検出されたかログ出力
        const isHandsVisible = handLandmarkerResult.landmarks && handLandmarkerResult.landmarks.length > 0;
        setHandsDetected(isHandsVisible);
        
        if (isHandsVisible) {
          console.log(`検出された手の数: ${handLandmarkerResult.landmarks.length}`);
          
          // ランドマークが検出された場合のみ描画
          if (showLandmarks && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              console.log('ランドマーク描画関数を呼び出します');
              drawHandLandmarks(ctx, handLandmarkerResult);
              console.log('ランドマーク描画完了');
            } else {
              console.error('キャンバスコンテキストが取得できません');
            }
          }
        }
        
        // 結果をコールバックで通知
        if (onHandsDetected) {
          onHandsDetected(handLandmarkerResult);
        }
        
        // ジェスチャー検出
        let currentGestures: HandGesture[] = ['none'];
        
        if (handLandmarkerResult.landmarks && handLandmarkerResult.landmarks.length > 0) {
          if (useGestureRecognizer) {
            // MediaPipeのGestureRecognizerを使用
            const gestureResult = await recognizeGesture(videoRef.current, timestamp);
            if (gestureResult && gestureResult.gestures && gestureResult.gestures.length > 0) {
              currentGestures = gestureResult.gestures.map(g => g[0].categoryName.toLowerCase() as HandGesture);
            }
          } else {
            // 独自のジェスチャー解析を使用
            currentGestures = analyzeHandGesture(handLandmarkerResult);
          }
          
          if (currentGestures[0] !== 'none') {
            setGestures(currentGestures);
            
            // 結果をコールバックで通知
            if (onGestureDetected) {
              onGestureDetected(currentGestures);
            }
          }
        }
      }
    } catch (err) {
      console.error('フレーム処理エラー:', err);
    }
    
    // 次のフレームを処理
    requestRef.current = requestAnimationFrame(processFrame);
  }, [isRunning, isInitialized, drawHandLandmarks, onHandsDetected, onGestureDetected, showLandmarks, useGestureRecognizer]);
  
  // アニメーションフレームのセットアップ
  useEffect(() => {
    if (isRunning && isInitialized) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isRunning, isInitialized, processFrame]);
  
  return (
    <div className="relative">
      {error && (
        <div className="absolute top-0 left-0 w-full bg-red-500 text-white p-2 z-10">
          {error}
          {(error.includes('カメラエラー') || error.includes('初期化エラー')) && (
            <button
              className="ml-2 px-2 py-1 bg-white text-red-600 rounded text-sm font-bold"
              onClick={setupCamera}
            >
              カメラを再試行
            </button>
          )}
        </div>
      )}
      
      <div className="relative">
        {/* カメラ権限が拒否されている場合のメッセージ */}
        {cameraPermission === 'denied' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20 text-white p-4 text-center">
            <div>
              <p className="mb-4">カメラへのアクセスが拒否されています。</p>
              <p className="mb-4">ブラウザの設定からカメラへのアクセスを許可してください。</p>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={setupCamera}
              >
                カメラアクセスを再度リクエスト
              </button>
            </div>
          </div>
        )}
        
        {!isInitialized && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20 text-white">
            <p>MediaPipeを初期化中...</p>
          </div>
        )}
        
        <video
          ref={videoRef}
          className="w-full h-auto"
          width={width}
          height={height}
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }} // ミラーリング
        />
        
        {/* 固定されたオーバーレイ要素 - 手が検出されていない場合のみ表示 */}
        {!handsDetected && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 30 }}>
            {/* 中央にテキスト表示 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="text-white p-5 rounded-lg text-xl font-bold text-center"
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  boxShadow: '0 0 20px rgba(0, 255, 255, 0.7), 0 0 30px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)',
                  border: '1px solid rgba(0, 255, 255, 0.5)',
                  color: '#00f0ff',
                  textShadow: '0 0 10px rgba(0, 255, 255, 0.8)'
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>SCANNING FOR HAND INPUT</div>
                <div style={{ fontSize: '1rem', opacity: 0.8 }}>手をカメラに向けてください</div>
              </div>
            </div>
          </div>
        )}
        
        {showLandmarks && (
          <>
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              width={width}
              height={height}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                // ミラーリングを削除（座標変換で対応）
                // transform: 'scaleX(-1)', 
                transformOrigin: 'center center',
                zIndex: 40,
                opacity: 1,
                background: 'rgba(0, 0, 0, 0.3)' // 背景を暗めに
              }}
            />
          </>
        )}
      </div>
      
      <div 
        className="p-2 mt-2 rounded"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(10,10,30,0.9) 100%)',
          borderTop: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 -5px 15px rgba(0, 240, 255, 0.15)'
        }}
      >
        <p 
          className="font-mono tracking-wider" 
          style={{ 
            color: '#00f0ff', 
            textShadow: '0 0 5px rgba(0, 255, 255, 0.5)'
          }}
        >
          GESTURE: <span style={{ color: '#ff29c0' }}>{gestures.join(', ')}</span>
        </p>
        
        {/* 手動カメラ起動ボタン */}
        {!isRunning && (
          <button
            className="mt-2 px-4 py-2 text-white rounded block w-full"
            style={{
              background: 'linear-gradient(90deg, rgba(0,180,255,0.8) 0%, rgba(132,0,255,0.8) 100%)',
              border: 'none',
              boxShadow: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 255, 0.3)',
              textShadow: '0 0 5px rgba(255, 255, 255, 0.7)'
            }}
            onClick={setupCamera}
          >
            START CAMERA SYSTEM
          </button>
        )}
      </div>
    </div>
  );
} 