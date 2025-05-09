'use client';

import { useEffect, useRef, useState } from 'react';

interface CameraInputProps {
  onFrame?: (imageData: ImageData) => void;
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

  const containerStyle = {
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: '100%',
    position: 'relative' as const
  };

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
        
        if (video && canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            
            try {
              onFrame(imageData);
            } catch (err) {
              console.error('Error processing video frame:', err);
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
    <div style={containerStyle} className="camera-container">
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
          objectFit: 'cover'
        }}
      />
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        className="absolute top-0 left-0 invisible"
        style={{
          width: '100%',
          height: '100%'
        }}
      />
      {error && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-100 border border-red-400 text-red-700 px-2 py-1 text-xs">
          {error}
        </div>
      )}
    </div>
  );
} 