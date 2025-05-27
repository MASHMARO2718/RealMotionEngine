/**
 * Kalman Filter implementations for smoothing pose data
 */

import { Vec3, add, multiply } from './vec3';

/**
 * 1D Kalman Filter for scalar values
 */
export class KalmanFilter1D {
  private x: number;      // State estimate
  private P: number;      // Error covariance
  private Q: number;      // Process noise covariance
  private R: number;      // Measurement noise covariance
  private initialized: boolean;

  constructor(processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.x = 0;
    this.P = 1;
    this.Q = processNoise;
    this.R = measurementNoise;
    this.initialized = false;
  }

  /**
   * Update the filter with a new measurement
   */
  update(measurement: number): number {
    if (!this.initialized) {
      this.x = measurement;
      this.initialized = true;
      return this.x;
    }

    // Prediction step
    // x = x (no motion model)
    // P = P + Q
    this.P += this.Q;

    // Update step
    // K = P / (P + R)
    const K = this.P / (this.P + this.R);
    
    // x = x + K * (measurement - x)
    this.x += K * (measurement - this.x);
    
    // P = (1 - K) * P
    this.P = (1 - K) * this.P;

    return this.x;
  }

  /**
   * Get current state estimate
   */
  getState(): number {
    return this.x;
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.x = 0;
    this.P = 1;
    this.initialized = false;
  }
}

/**
 * 3D Kalman Filter for Vec3 values
 */
export class KalmanFilter3D {
  private x: Vec3;        // State estimate
  private P: number;      // Error covariance (simplified as scalar)
  private Q: number;      // Process noise covariance
  private R: number;      // Measurement noise covariance
  private initialized: boolean;

  constructor(processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.x = { x: 0, y: 0, z: 0 };
    this.P = 1;
    this.Q = processNoise;
    this.R = measurementNoise;
    this.initialized = false;
  }

  /**
   * Update the filter with a new measurement
   */
  update(measurement: Vec3): Vec3 {
    if (!this.initialized) {
      this.x = { ...measurement };
      this.initialized = true;
      return this.x;
    }

    // Prediction step
    this.P += this.Q;

    // Update step
    const K = this.P / (this.P + this.R);
    
    // x = x + K * (measurement - x)
    const innovation = {
      x: measurement.x - this.x.x,
      y: measurement.y - this.x.y,
      z: measurement.z - this.x.z
    };
    
    this.x = add(this.x, multiply(innovation, K));
    
    // P = (1 - K) * P
    this.P = (1 - K) * this.P;

    return { ...this.x };
  }

  /**
   * Get current state estimate
   */
  getState(): Vec3 {
    return { ...this.x };
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.x = { x: 0, y: 0, z: 0 };
    this.P = 1;
    this.initialized = false;
  }
}

/**
 * Moving average filter for simple smoothing
 */
export class MovingAverage {
  private values: number[];
  private maxSize: number;
  private sum: number;

  constructor(windowSize: number = 5) {
    this.values = [];
    this.maxSize = windowSize;
    this.sum = 0;
  }

  /**
   * Add a new value and get the moving average
   */
  update(value: number): number {
    this.values.push(value);
    this.sum += value;

    if (this.values.length > this.maxSize) {
      const removed = this.values.shift()!;
      this.sum -= removed;
    }

    return this.sum / this.values.length;
  }

  /**
   * Get current average
   */
  getAverage(): number {
    return this.values.length > 0 ? this.sum / this.values.length : 0;
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.values = [];
    this.sum = 0;
  }

  /**
   * Get the number of samples
   */
  getCount(): number {
    return this.values.length;
  }
}

/**
 * 3D Moving average filter for Vec3 values
 */
export class MovingAverage3D {
  private xFilter: MovingAverage;
  private yFilter: MovingAverage;
  private zFilter: MovingAverage;

  constructor(windowSize: number = 5) {
    this.xFilter = new MovingAverage(windowSize);
    this.yFilter = new MovingAverage(windowSize);
    this.zFilter = new MovingAverage(windowSize);
  }

  /**
   * Add a new Vec3 value and get the moving average
   */
  update(value: Vec3): Vec3 {
    return {
      x: this.xFilter.update(value.x),
      y: this.yFilter.update(value.y),
      z: this.zFilter.update(value.z)
    };
  }

  /**
   * Get current average
   */
  getAverage(): Vec3 {
    return {
      x: this.xFilter.getAverage(),
      y: this.yFilter.getAverage(),
      z: this.zFilter.getAverage()
    };
  }

  /**
   * Reset the filter
   */
  reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
    this.zFilter.reset();
  }

  /**
   * Get the number of samples
   */
  getCount(): number {
    return this.xFilter.getCount();
  }
}

/**
 * Exponential smoothing filter
 */
export class ExponentialSmoother {
  private value: number | null;
  private alpha: number;

  constructor(alpha: number = 0.1) {
    this.value = null;
    this.alpha = Math.max(0, Math.min(1, alpha)); // Clamp between 0 and 1
  }

  /**
   * Update with new value
   */
  update(newValue: number): number {
    if (this.value === null) {
      this.value = newValue;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  /**
   * Get current value
   */
  getValue(): number | null {
    return this.value;
  }

  /**
   * Reset the smoother
   */
  reset(): void {
    this.value = null;
  }
}

/**
 * 3D Exponential smoothing filter
 */
export class ExponentialSmoother3D {
  private xSmoother: ExponentialSmoother;
  private ySmoother: ExponentialSmoother;
  private zSmoother: ExponentialSmoother;

  constructor(alpha: number = 0.1) {
    this.xSmoother = new ExponentialSmoother(alpha);
    this.ySmoother = new ExponentialSmoother(alpha);
    this.zSmoother = new ExponentialSmoother(alpha);
  }

  /**
   * Update with new Vec3 value
   */
  update(newValue: Vec3): Vec3 {
    return {
      x: this.xSmoother.update(newValue.x),
      y: this.ySmoother.update(newValue.y),
      z: this.zSmoother.update(newValue.z)
    };
  }

  /**
   * Get current value
   */
  getValue(): Vec3 | null {
    const x = this.xSmoother.getValue();
    const y = this.ySmoother.getValue();
    const z = this.zSmoother.getValue();
    
    if (x === null || y === null || z === null) {
      return null;
    }
    
    return { x, y, z };
  }

  /**
   * Reset the smoother
   */
  reset(): void {
    this.xSmoother.reset();
    this.ySmoother.reset();
    this.zSmoother.reset();
  }
} 