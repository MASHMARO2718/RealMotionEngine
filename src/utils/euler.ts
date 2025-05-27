/**
 * Euler angle calculation utilities for pose analysis
 */

import { Vec3, angleBetween, cross, dot, normalize, projectToPlane, signedAngleAround, toDegrees } from './vec3';

export interface EulerAngles {
  yaw: number;    // Horizontal rotation (degrees)
  pitch: number;  // Vertical rotation (degrees)
  roll: number;   // Twist rotation (degrees)
}

/**
 * Calculate yaw angle (horizontal rotation) from a vector projected onto floor plane
 * @param vector The vector to calculate yaw for
 * @param floorNormal The floor normal vector (typically pointing up)
 * @returns Yaw angle in degrees (-180 to 180)
 */
export function calculateYaw(vector: Vec3, floorNormal: Vec3): number {
  // Project vector onto the floor plane
  const projectedVec = projectToPlane(vector, floorNormal);
  
  // Calculate yaw using atan2 (x, z) for standard coordinate system
  // In MediaPipe, x is horizontal (left-right), z is depth
  const yaw = Math.atan2(projectedVec.x, projectedVec.z);
  return toDegrees(yaw);
}

/**
 * Calculate pitch angle (vertical rotation)
 * @param vector The vector to calculate pitch for
 * @param floorNormal The floor normal vector
 * @returns Pitch angle in degrees (-90 to 90)
 */
export function calculatePitch(vector: Vec3, floorNormal: Vec3): number {
  const normalizedVec = normalize(vector);
  const normalizedFloor = normalize(floorNormal);
  
  // Pitch is the angle between the vector and the floor plane
  // We calculate this as 90° - angle between vector and floor normal
  const angleToNormal = angleBetween(normalizedVec, normalizedFloor);
  const pitch = Math.PI / 2 - angleToNormal;
  
  return toDegrees(pitch);
}

/**
 * Calculate roll angle (twist around the vector's axis)
 * @param vector The primary vector (e.g., forearm direction)
 * @param referenceVector A reference vector perpendicular to the primary (e.g., palm normal)
 * @param floorNormal The floor normal vector
 * @returns Roll angle in degrees (-180 to 180)
 */
export function calculateRoll(vector: Vec3, referenceVector: Vec3, floorNormal: Vec3): number {
  const normalizedVec = normalize(vector);
  const normalizedRef = normalize(referenceVector);
  const normalizedFloor = normalize(floorNormal);
  
  // Create a reference plane perpendicular to the vector
  const projectedFloor = projectToPlane(normalizedFloor, normalizedVec);
  
  if (Math.abs(dot(normalizedFloor, normalizedVec)) > 0.99) {
    // Vector is nearly parallel to floor normal, use a default reference
    const defaultRef = { x: 1, y: 0, z: 0 };
    const planeRef = projectToPlane(defaultRef, normalizedVec);
    return toDegrees(signedAngleAround(planeRef, normalizedRef, normalizedVec));
  }
  
  const planeRef = normalize(projectedFloor);
  return toDegrees(signedAngleAround(planeRef, normalizedRef, normalizedVec));
}

/**
 * Calculate all Euler angles for a vector
 * @param vector The vector to analyze
 * @param floorNormal The floor normal vector
 * @param referenceVector Optional reference vector for roll calculation
 * @returns Complete Euler angles
 */
export function calculateEulerAngles(
  vector: Vec3, 
  floorNormal: Vec3, 
  referenceVector?: Vec3
): EulerAngles {
  const yaw = calculateYaw(vector, floorNormal);
  const pitch = calculatePitch(vector, floorNormal);
  
  let roll = 0;
  if (referenceVector) {
    roll = calculateRoll(vector, referenceVector, floorNormal);
  }
  
  return { yaw, pitch, roll };
}

/**
 * Calculate angle between a vector and the floor
 * @param vector The vector to measure
 * @param floorNormal The floor normal vector
 * @returns Angle to floor in degrees (0 = parallel to floor, 90 = perpendicular)
 */
export function angleToFloor(vector: Vec3, floorNormal: Vec3): number {
  const normalizedVec = normalize(vector);
  const normalizedFloor = normalize(floorNormal);
  
  // Angle to floor is 90° minus the angle to the floor normal
  const angleToNormal = angleBetween(normalizedVec, normalizedFloor);
  return 90 - toDegrees(angleToNormal);
}

/**
 * Calculate the absolute direction angle in world coordinates
 * @param vector The vector (typically hip to shoulder for body direction)
 * @param floorNormal The floor normal vector
 * @returns Direction angle in degrees (0 = forward, 90 = right, etc.)
 */
export function calculateAbsoluteDirection(vector: Vec3, floorNormal: Vec3): number {
  const projectedVec = projectToPlane(vector, floorNormal);
  
  // Calculate angle from forward direction (positive Z)
  const forwardVec = { x: 0, y: 0, z: 1 };
  const angle = Math.atan2(projectedVec.x, projectedVec.z);
  
  // Convert to 0-360 degrees
  let degrees = toDegrees(angle);
  if (degrees < 0) {
    degrees += 360;
  }
  
  return degrees;
}

/**
 * Smooth angle transitions to avoid discontinuities
 * @param currentAngle Current angle in degrees
 * @param previousAngle Previous angle in degrees
 * @returns Smoothed angle
 */
export function smoothAngle(currentAngle: number, previousAngle: number): number {
  let diff = currentAngle - previousAngle;
  
  // Handle angle wrapping
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  return previousAngle + diff;
}

/**
 * Average multiple angles, handling wraparound
 * @param angles Array of angles in degrees
 * @returns Average angle in degrees
 */
export function averageAngles(angles: number[]): number {
  if (angles.length === 0) return 0;
  
  // Convert to unit vectors, average, then convert back
  let sumX = 0;
  let sumY = 0;
  
  angles.forEach(angle => {
    const radians = angle * Math.PI / 180;
    sumX += Math.cos(radians);
    sumY += Math.sin(radians);
  });
  
  const avgX = sumX / angles.length;
  const avgY = sumY / angles.length;
  
  const avgAngle = Math.atan2(avgY, avgX);
  return toDegrees(avgAngle);
} 