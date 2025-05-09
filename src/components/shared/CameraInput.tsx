'use client';

import { useEffect, useRef, useState } from 'react';

interface CameraInputProps {
  onFrame?: (imageData: ImageData, videoElement?: HTMLVideoElement) => void;
  width?: number;
  height?: number;
  fps?: number;
}

export default function CameraInput({ 
  onFrame, 
  width = 640, 
  height = 480,
  fps = 15
}: CameraInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameProcessingRef = useRef(false);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: width },
            height: { ideal: height },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.width = width;
          videoRef.current.height = height;
          setIsStreaming(true);
        }
      } catch (err) {
        setError('カメラへのアクセスができませんでした。');
        console.error('Camera access error:', err);
      }
    }
    
    setupCamera();
    
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [width, height]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleVideoLoaded = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        console.log(`【デバッグ】ビデオサイズ: ${video.videoWidth}x${video.videoHeight}`);
        setIsStreaming(true);
      } else {
        console.error('【デバッグ】ビデオサイズが無効です:', video.videoWidth, video.videoHeight);
        setError('カメラのサイズが無効です。ブラウザの設定を確認してください。');
      }
    };
    
    video.addEventListener('loadedmetadata', handleVideoLoaded);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleVideoLoaded);
    };
  }, []);

  useEffect(() => {
    if (!onFrame || !isStreaming) return;
    
    let animationFrameId: number;
    let lastProcessTime = 0;
    const frameInterval = 1000 / fps;
    
    const processFrame = (timestamp: number) => {
      if (timestamp - lastProcessTime >= frameInterval) {
        lastProcessTime = timestamp;
        
        if (frameProcessingRef.current) {
          animationFrameId = requestAnimationFrame(processFrame);
          return;
        }
        
        frameProcessingRef.current = true;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video && canvas && video.readyState === 4) {
          if (video.videoWidth <= 0 || video.videoHeight <= 0) {
            console.warn('【デバッグ】ビデオサイズが無効です:', video.videoWidth, video.videoHeight);
            frameProcessingRef.current = false;
            animationFrameId = requestAnimationFrame(processFrame);
            return;
          }
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            
            if (imageData.width > 0 && imageData.height > 0) {
              try {
                onFrame(imageData, video);
              } catch (err) {
                console.error('Error processing video frame:', err);
              }
            } else {
              console.warn('【デバッグ】画像データのサイズが無効です:', imageData.width, imageData.height);
            }
          }
        }
        
        frameProcessingRef.current = false;
      }
      
      animationFrameId = requestAnimationFrame(processFrame);
    };
    
    animationFrameId = requestAnimationFrame(processFrame);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isStreaming, onFrame, fps, width, height]);

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: '100%',
        position: 'relative'
      }}
      className="camera-container"
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      />
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />
      {error && (
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(244, 67, 54, 0.8)',
            color: 'white',
            padding: '4px 8px',
            fontSize: '12px',
            zIndex: 3
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
} 