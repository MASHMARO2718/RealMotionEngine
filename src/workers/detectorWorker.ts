/**
 * WebWorker #1 - Detector/Tracker
 * Handles person detection and tracking for the lock-on system
 */

interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface TrackResult {
  id: number;
  bbox: DetectionBox;
  confidence: number;
}

interface DetectorMessage {
  type: 'init' | 'detect';
  frame?: ImageData;
  timestamp?: number;
}

interface DetectorResponse {
  type: 'tracker';
  roi: DetectionBox | null;
  id: number | null;
  tracks: TrackResult[];
  timestamp: number;
}

class PersonTracker {
  private nextId = 1;
  private tracks: Map<number, TrackResult> = new Map();
  private maxDistance = 150; // Maximum distance for track association
  private maxAge = 30; // Maximum frames to keep a track without detection

  /**
   * Simplified person detection using template matching
   * In production, this would use YOLOv9 or similar
   */
  private detectPersons(imageData: ImageData): DetectionBox[] {
    const { width, height, data } = imageData;
    const detections: DetectionBox[] = [];
    
    // Simplified detection algorithm
    // In reality, this would use a proper ML model
    const blockSize = 40;
    const threshold = 0.3;
    
    for (let y = 0; y < height - blockSize; y += blockSize / 2) {
      for (let x = 0; x < width - blockSize; x += blockSize / 2) {
        const confidence = this.calculatePersonLikelihood(data, x, y, blockSize, width);
        
        if (confidence > threshold) {
          // Non-maximum suppression (simplified)
          const overlapping = detections.find(det => 
            this.calculateOverlap(
              { x, y, width: blockSize, height: blockSize * 1.5, confidence },
              det
            ) > 0.3
          );
          
          if (!overlapping || confidence > overlapping.confidence) {
            if (overlapping) {
              const index = detections.indexOf(overlapping);
              detections.splice(index, 1);
            }
            
            detections.push({
              x,
              y,
              width: blockSize,
              height: blockSize * 1.5,
              confidence
            });
          }
        }
      }
    }
    
    return detections.slice(0, 5); // Limit to top 5 detections
  }

  /**
   * Simple person likelihood calculation based on aspect ratio and motion
   */
  private calculatePersonLikelihood(
    data: Uint8ClampedArray, 
    x: number, 
    y: number, 
    size: number, 
    width: number
  ): number {
    let motionScore = 0;
    let edgeScore = 0;
    let colorVariance = 0;
    
    const samplePoints = 16;
    
    for (let i = 0; i < samplePoints; i++) {
      const px = x + (i % 4) * (size / 4);
      const py = y + Math.floor(i / 4) * (size / 4);
      
      if (px >= width - 1 || py >= data.length / 4 / width - 1) continue;
      
      const idx = (py * width + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Simple edge detection
      const rightIdx = (py * width + px + 1) * 4;
      const bottomIdx = ((py + 1) * width + px) * 4;
      
      if (rightIdx < data.length && bottomIdx < data.length) {
        const edgeX = Math.abs(data[rightIdx] - r);
        const edgeY = Math.abs(data[bottomIdx] - r);
        edgeScore += (edgeX + edgeY) / 255;
        
        // Color variance (skin tone detection simplified)
        const intensity = (r + g + b) / 3;
        colorVariance += Math.abs(intensity - 128) / 128;
      }
    }
    
    return Math.min(1, (edgeScore / samplePoints + (1 - colorVariance / samplePoints)) / 2);
  }

  /**
   * Calculate overlap between two bounding boxes
   */
  private calculateOverlap(box1: DetectionBox, box2: DetectionBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  /**
   * Update tracks with new detections (simplified BoT-SORT)
   */
  private updateTracks(detections: DetectionBox[]): TrackResult[] {
    const results: TrackResult[] = [];
    const usedDetections = new Set<number>();
    
    // Associate existing tracks with detections
    for (const [id, track] of Array.from(this.tracks.entries())) {
      let bestMatch = -1;
      let bestDistance = this.maxDistance;
      
      for (let i = 0; i < detections.length; i++) {
        if (usedDetections.has(i)) continue;
        
        const detection = detections[i];
        const centerTrack = {
          x: track.bbox.x + track.bbox.width / 2,
          y: track.bbox.y + track.bbox.height / 2
        };
        const centerDetection = {
          x: detection.x + detection.width / 2,
          y: detection.y + detection.height / 2
        };
        
        const distance = Math.sqrt(
          Math.pow(centerTrack.x - centerDetection.x, 2) +
          Math.pow(centerTrack.y - centerDetection.y, 2)
        );
        
        if (distance < bestDistance) {
          bestMatch = i;
          bestDistance = distance;
        }
      }
      
      if (bestMatch >= 0) {
        // Update existing track
        const detection = detections[bestMatch];
        const updatedTrack: TrackResult = {
          id,
          bbox: detection,
          confidence: detection.confidence
        };
        
        this.tracks.set(id, updatedTrack);
        results.push(updatedTrack);
        usedDetections.add(bestMatch);
      }
    }
    
    // Create new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (!usedDetections.has(i)) {
        const detection = detections[i];
        const newTrack: TrackResult = {
          id: this.nextId++,
          bbox: detection,
          confidence: detection.confidence
        };
        
        this.tracks.set(newTrack.id, newTrack);
        results.push(newTrack);
      }
    }
    
    return results;
  }

  /**
   * Choose primary track (largest area or nearest to center)
   */
  private pickPrimary(tracks: TrackResult[], frameWidth: number, frameHeight: number): TrackResult | null {
    if (tracks.length === 0) return null;
    
    const centerX = frameWidth / 2;
    const centerY = frameHeight / 2;
    
    return tracks.reduce((best, track) => {
      const trackCenterX = track.bbox.x + track.bbox.width / 2;
      const trackCenterY = track.bbox.y + track.bbox.height / 2;
      const distanceToCenter = Math.sqrt(
        Math.pow(trackCenterX - centerX, 2) + 
        Math.pow(trackCenterY - centerY, 2)
      );
      
      const bestCenterX = best.bbox.x + best.bbox.width / 2;
      const bestCenterY = best.bbox.y + best.bbox.height / 2;
      const bestDistanceToCenter = Math.sqrt(
        Math.pow(bestCenterX - centerX, 2) + 
        Math.pow(bestCenterY - centerY, 2)
      );
      
      // Prefer tracks closer to center with higher confidence
      const trackScore = track.confidence * 0.7 + (1 - distanceToCenter / Math.sqrt(centerX * centerX + centerY * centerY)) * 0.3;
      const bestScore = best.confidence * 0.7 + (1 - bestDistanceToCenter / Math.sqrt(centerX * centerX + centerY * centerY)) * 0.3;
      
      return trackScore > bestScore ? track : best;
    });
  }

  public detect(frame: ImageData, timestamp: number): DetectorResponse {
    const detections = this.detectPersons(frame);
    const tracks = this.updateTracks(detections);
    const primary = this.pickPrimary(tracks, frame.width, frame.height);
    
    return {
      type: 'tracker',
      roi: primary?.bbox ?? null,
      id: primary?.id ?? null,
      tracks,
      timestamp
    };
  }
}

// Worker initialization
let tracker: PersonTracker;

self.onmessage = function(e: MessageEvent<DetectorMessage>) {
  const { type, frame, timestamp = Date.now() } = e.data;
  
  switch (type) {
    case 'init':
      tracker = new PersonTracker();
      self.postMessage({ type: 'initialized' });
      break;
      
    case 'detect':
      if (tracker && frame) {
        const result = tracker.detect(frame, timestamp);
        self.postMessage(result);
      }
      break;
  }
};

export {}; 