/**
 * 3D Vector utilities for pose analysis
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Create a Vec3 from MediaPipe landmark
 */
export function createVec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/**
 * Vector addition
 */
export function add(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

/**
 * Vector subtraction
 */
export function subtract(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}

/**
 * Vector scalar multiplication
 */
export function multiply(v: Vec3, scalar: number): Vec3 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar
  };
}

/**
 * Dot product of two vectors
 */
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Cross product of two vectors
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/**
 * Vector magnitude (length)
 */
export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize vector to unit length
 */
export function normalize(v: Vec3): Vec3 {
  const mag = magnitude(v);
  if (mag === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag
  };
}

/**
 * Project vector a onto plane defined by normal vector n
 */
export function projectToPlane(v: Vec3, normal: Vec3): Vec3 {
  const normalUnit = normalize(normal);
  const projection = multiply(normalUnit, dot(v, normalUnit));
  return subtract(v, projection);
}

/**
 * Calculate angle between two vectors in radians
 */
export function angleBetween(a: Vec3, b: Vec3): number {
  const dotProduct = dot(normalize(a), normalize(b));
  // Clamp to handle floating point errors
  const clampedDot = Math.max(-1, Math.min(1, dotProduct));
  return Math.acos(clampedDot);
}

/**
 * Calculate signed angle around an axis
 */
export function signedAngleAround(a: Vec3, b: Vec3, axis: Vec3): number {
  const angle = angleBetween(a, b);
  const crossProduct = cross(a, b);
  const sign = Math.sign(dot(crossProduct, axis));
  return angle * sign;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Linear interpolation between two vectors
 */
export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

/**
 * Check if vector is approximately zero
 */
export function isZero(v: Vec3, epsilon: number = 1e-6): boolean {
  return magnitude(v) < epsilon;
}

/**
 * Distance between two points
 */
export function distance(a: Vec3, b: Vec3): number {
  return magnitude(subtract(a, b));
}

/**
 * Create a vector from two points
 */
export function vectorFromPoints(start: Vec3, end: Vec3): Vec3 {
  return subtract(end, start);
} 