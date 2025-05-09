'use client';

import { useEffect, useState, useRef } from 'react';
import CameraInput from './CameraInput';
import { useKalman } from '../hooks/useKalman';

interface Point {
  x: number;
  y: number;
}

interface MotionTrackerProps {
  width?: number;
  height?: number;
  threshold?: number;
  onPositionUpdate?: (position: Point) => void;
}

export default function MotionTracker({
  width = 640,
  height = 480,
  threshold = 20,
  onPositionUpdate
}: MotionTrackerProps) {
  const [positions, setPositions] = useState<Point[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Initialize Kalman filter with 2 dimensions (x, y)
  const { isLoaded, error, update } = useKalman({
    dimensions: 2,
    processNoise: 0.01,
    measurementNoise: 0.1
  });

  // Process video frames for motion detection
  const handleFrame = async (imageData: ImageData) => {
    if (!isLoaded) return;

    // Simple motion detection algorithm - detect brightest point
    // In a real app, this would be more sophisticated
    const data = imageData.data;
    let maxBrightness = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness > maxBrightness && brightness > threshold) {
        maxBrightness = brightness;
        maxIndex = i;
      }
    }
    
    if (maxBrightness > threshold) {
      const pixelIndex = maxIndex / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      try {
        // Apply Kalman filter to smooth position data
        const filtered = await update([x, y]);
        const filteredPoint = { x: filtered[0], y: filtered[1] };
        
        // Update positions array
        setPositions(prev => [...prev.slice(-20), filteredPoint]);
        
        // Call callback with updated position
        onPositionUpdate?.(filteredPoint);
        setIsTracking(true);
      } catch (err) {
        console.error('Kalman filter update error:', err);
        setIsTracking(false);
      }
    } else {
      setIsTracking(false);
    }
  };

  // Draw tracking visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || positions.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw tracking line
    ctx.beginPath();
    ctx.moveTo(positions[0].x, positions[0].y);
    positions.forEach((point, i) => {
      if (i > 0) ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw current position
    const current = positions[positions.length - 1];
    ctx.beginPath();
    ctx.arc(current.x, current.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = isTracking ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
    ctx.fill();
  }, [positions, isTracking]);

  return (
    <div className="relative">
      <CameraInput 
        width={width} 
        height={height} 
        onFrame={handleFrame} 
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      {error && (
        <div className="absolute bottom-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Kalman filter error: {error}
        </div>
      )}
      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded">
        {isTracking ? 'Tracking' : 'No motion detected'}
      </div>
    </div>
  );
} 