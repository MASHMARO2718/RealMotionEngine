'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// コンポーネントのプロパティ
interface CameraTestComponentProps {
  width?: number;
  height?: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function CameraTestComponent({
  width = 320,
  height = 240,
  onSuccess,
  onError
}: CameraTestComponentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStatus, setCameraStatus] = useState<
    'checking' | 'available' | 'error' | 'success'
  >('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  
  // カメラデバイスの列挙
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('利用可能なカメラデバイス:', videoDevices);
      setCameraDevices(videoDevices);
      
      if (videoDevices.length > 0) {
        setCameraStatus('available');
        setSelectedCamera(videoDevices[0].deviceId);
      } else {
        setCameraStatus('error');
        setErrorMessage('カメラデバイスが見つかりませんでした');
        if (onError) onError('カメラデバイスが見つかりません');
      }
    } catch (err) {
      console.error('カメラデバイスの列挙に失敗しました:', err);
      setCameraStatus('error');
      setErrorMessage(`デバイス列挙エラー: ${err instanceof Error ? err.message : String(err)}`);
      if (onError) onError(`デバイス列挙エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [onError]);
  
  // 初期化時にカメラを確認
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);
  
  // カメラストリームを開始
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    // 既存のストリームを停止
    if (videoRef.current.srcObject) {
      const oldStream = videoRef.current.srcObject as MediaStream;
      oldStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreamActive(false);
    }
    
    try {
      // カメラアクセス権限を確認
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('カメラ権限ステータス:', status.state);
          
          if (status.state === 'denied') {
            setCameraStatus('error');
            setErrorMessage('カメラへのアクセスが拒否されています。ブラウザの設定から許可してください。');
            if (onError) onError('カメラへのアクセスが拒否されています');
            return;
          }
        } catch (err) {
          console.warn('カメラ権限チェックエラー（無視可）:', err);
        }
      }
      
      // まずシンプルな設定で試す
      const constraints: MediaStreamConstraints = {
        video: selectedCamera 
          ? { deviceId: { exact: selectedCamera } }
          : true
      };
      
      console.log('カメラストリームを要求:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('カメラストリームを取得しました:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log('カメラテスト成功');
                setCameraStatus('success');
                setIsStreamActive(true);
                if (onSuccess) onSuccess();
              })
              .catch(err => {
                console.error('ビデオ再生エラー:', err);
                setCameraStatus('error');
                setErrorMessage(`ビデオ再生エラー: ${err.message}`);
                if (onError) onError(`ビデオ再生エラー: ${err.message}`);
              });
          }
        };
      }
    } catch (err: any) {
      console.error('カメラアクセスエラー:', err);
      setCameraStatus('error');
      
      let errorDetail = '';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorDetail = 'カメラへのアクセスが拒否されました。ブラウザの設定から許可してください。';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorDetail = 'カメラが見つかりません。カメラが接続されているか確認してください。';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorDetail = '他のアプリケーションがカメラを使用している可能性があります。他のアプリケーションを閉じてください。';
      } else {
        errorDetail = `${err.name || 'Unknown'}: ${err.message || 'Unknown error'}`;
      }
      
      setErrorMessage(`カメラエラー: ${errorDetail}`);
      if (onError) onError(`カメラエラー: ${errorDetail}`);
    }
  }, [selectedCamera, onSuccess, onError]);
  
  // カメラデバイス変更時に自動的にカメラを開始
  useEffect(() => {
    if (selectedCamera) {
      startCamera();
    }
  }, [selectedCamera, startCamera]);
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  return (
    <div className="camera-test-component bg-gray-800 p-4 rounded-lg">
      <h3 className="text-xl font-semibold mb-3 text-white">カメラ診断ツール</h3>
      
      {cameraStatus === 'checking' && (
        <div className="text-center p-4 bg-gray-700 rounded">
          <p className="text-white">カメラの確認中...</p>
        </div>
      )}
      
      {cameraStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-600 text-white rounded">
          <p className="font-semibold">カメラエラー</p>
          <p>{errorMessage}</p>
          <button
            className="mt-2 px-3 py-1 bg-white text-red-600 rounded"
            onClick={enumerateDevices}
          >
            デバイスを再確認
          </button>
        </div>
      )}
      
      {cameraDevices.length > 0 && (
        <div className="mb-4">
          <label className="block text-white mb-2">カメラを選択:</label>
          <select
            className="w-full p-2 bg-gray-700 text-white rounded"
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
          >
            {cameraDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `カメラ ${cameraDevices.indexOf(device) + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div className="relative overflow-hidden rounded bg-black">
        <video
          ref={videoRef}
          className="w-full h-auto"
          width={width}
          height={height}
          autoPlay
          playsInline
          muted
        />
        
        {!isStreamActive && cameraStatus !== 'checking' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={startCamera}
            >
              カメラをテスト
            </button>
          </div>
        )}
      </div>
      
      {cameraStatus === 'success' && (
        <div className="mt-3 p-3 bg-green-600 text-white rounded">
          <p>カメラは正常に動作しています！</p>
        </div>
      )}
      
      <div className="mt-4">
        <h4 className="text-lg font-medium text-white mb-2">トラブルシューティング:</h4>
        <ul className="list-disc pl-5 text-gray-300 space-y-1">
          <li>ブラウザでカメラへのアクセスを許可してください</li>
          <li>他のアプリでカメラが使用されていないか確認してください</li>
          <li>カメラが正しく接続されているか確認してください</li>
          <li>ブラウザを再起動するか、別のブラウザを試してください</li>
        </ul>
      </div>
    </div>
  );
} 