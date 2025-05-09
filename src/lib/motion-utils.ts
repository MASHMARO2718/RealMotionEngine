/**
 * モーション解析のためのユーティリティ関数群
 */

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
  magnitude: number;
}

/**
 * 2点間の距離を計算
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 2点間のベクトルを計算
 */
export function vector(from: Point, to: Point): Vector {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const magnitude = Math.sqrt(x * x + y * y);
  return { x, y, magnitude };
}

/**
 * 軌道の速度を計算（ピクセル/ms）
 */
export function velocity(points: Point[], timeInterval: number): number {
  if (points.length < 2) return 0;
  
  const p1 = points[points.length - 2];
  const p2 = points[points.length - 1];
  
  return distance(p1, p2) / timeInterval;
}

/**
 * 軌道の加速度を計算
 */
export function acceleration(points: Point[], timeInterval: number): number {
  if (points.length < 3) return 0;
  
  const v1 = velocity([points[points.length - 3], points[points.length - 2]], timeInterval);
  const v2 = velocity([points[points.length - 2], points[points.length - 1]], timeInterval);
  
  return (v2 - v1) / timeInterval;
}

/**
 * 軌道の滑らかさを計算（0-1、1が最も滑らか）
 */
export function smoothness(points: Point[]): number {
  if (points.length < 3) return 1;
  
  let totalAngleChange = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = vector(points[i-1], points[i]);
    const next = vector(points[i], points[i+1]);
    
    // 2つのベクトル間の角度（ラジアン）
    const dotProduct = prev.x * next.x + prev.y * next.y;
    const cosAngle = dotProduct / (prev.magnitude * next.magnitude);
    const angle = Math.acos(Math.min(Math.max(cosAngle, -1), 1));
    
    totalAngleChange += angle;
  }
  
  // 角度変化の平均を計算し、滑らかさに変換（π = 最大角度変化）
  const avgAngleChange = totalAngleChange / (points.length - 2);
  return 1 - (avgAngleChange / Math.PI);
}

/**
 * ジェスチャーのパターンマッチング（単純なテンプレートマッチング）
 */
export function matchGesture(
  points: Point[], 
  templatePoints: Point[], 
  threshold: number = 0.8
): boolean {
  if (points.length < 5 || templatePoints.length < 5) return false;
  
  // ポイントシーケンスを正規化
  const normalizedPoints = normalizePoints(points);
  const normalizedTemplate = normalizePoints(templatePoints);
  
  // 最小の長さに合わせてサンプリング
  const minLength = Math.min(normalizedPoints.length, normalizedTemplate.length);
  const sampledPoints = samplePoints(normalizedPoints, minLength);
  const sampledTemplate = samplePoints(normalizedTemplate, minLength);
  
  // ユークリッド距離で類似度を計算
  let totalDistance = 0;
  for (let i = 0; i < minLength; i++) {
    totalDistance += distance(sampledPoints[i], sampledTemplate[i]);
  }
  
  // 平均距離を類似度に変換（0-1、1が完全一致）
  const avgDistance = totalDistance / minLength;
  const similarity = 1 - Math.min(avgDistance / 2, 1); // 最大距離を2と仮定
  
  return similarity >= threshold;
}

/**
 * ポイントシーケンスの正規化（0-1の範囲に収める）
 */
function normalizePoints(points: Point[]): Point[] {
  if (points.length === 0) return [];
  
  // 最小値と最大値を見つける
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  
  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  
  // 正規化
  const rangeX = maxX - minX || 1; // ゼロ除算を防ぐ
  const rangeY = maxY - minY || 1;
  
  return points.map(point => ({
    x: (point.x - minX) / rangeX,
    y: (point.y - minY) / rangeY
  }));
}

/**
 * ポイントシーケンスを指定された長さにリサンプリング
 */
function samplePoints(points: Point[], targetLength: number): Point[] {
  if (points.length === targetLength) return points;
  if (points.length === 0) return [];
  if (targetLength <= 1) return [points[0]];
  
  const result: Point[] = [];
  
  for (let i = 0; i < targetLength; i++) {
    const index = (i / (targetLength - 1)) * (points.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    
    if (lowerIndex === upperIndex) {
      result.push(points[lowerIndex]);
    } else {
      const weight = index - lowerIndex;
      result.push({
        x: points[lowerIndex].x * (1 - weight) + points[upperIndex].x * weight,
        y: points[lowerIndex].y * (1 - weight) + points[upperIndex].y * weight
      });
    }
  }
  
  return result;
} 