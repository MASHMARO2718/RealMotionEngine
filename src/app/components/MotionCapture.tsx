import { useEffect, useRef } from 'react';
import { Pose } from '@mediapipe/pose';

interface MotionCaptureProps {
  onError?: (error: string) => void;
}

export default function MotionCapture({ onError }: MotionCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const poseRef = useRef<Pose | null>(null);

  useEffect(() => {
    const initializePose = async () => {
      try {
        if (!videoRef.current) return;

        // MediaPipe Poseの初期化
        poseRef.current = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        poseRef.current.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        // ポーズ検出のコールバック
        poseRef.current.onResults((results) => {
          if (results.poseLandmarks) {
            // 座標データの変換
            const motionData = {
              timestamp: Date.now(),
              joints: Object.fromEntries(
                results.poseLandmarks.map((landmark, index) => [
                  `joint_${index}`,
                  {
                    x: landmark.x,
                    y: landmark.y,
                    z: landmark.z
                  }
                ])
              )
            };

            // APIにデータを送信
            fetch('/api/motion', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(motionData),
            }).catch((error) => {
              console.error('Error sending motion data:', error);
              onError?.('Failed to send motion data');
            });
          }
        });

        // カメラの初期化
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // ポーズ検出の開始
        const detectPose = async () => {
          if (videoRef.current && poseRef.current) {
            await poseRef.current.send({ image: videoRef.current });
            requestAnimationFrame(detectPose);
          }
        };
        detectPose();

      } catch (error) {
        console.error('Error initializing pose detection:', error);
        onError?.('Failed to initialize pose detection');
      }
    };

    initializePose();

    // クリーンアップ
    return () => {
      if (poseRef.current) {
        poseRef.current.close();
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onError]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <video
        ref={videoRef}
        className="w-full rounded-lg shadow-lg"
        playsInline
      />
    </div>
  );
} 