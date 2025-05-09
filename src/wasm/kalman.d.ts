declare module './kalman' {
  export function createKalmanModule(): Promise<{
    _kf_create: (dimensions: number, processNoise: number, measurementNoise: number) => number;
    _kf_update: (handle: number, measurementsPtr: number, count: number) => number;
    _kf_destroy: (handle: number) => void;
    
    _generate_noisy_sine: (count: number, frequency: number, amplitude: number, noiseLevel: number) => number;
    _demo_kalman_filter: (count: number) => number;
    _free_data: (ptr: number) => void;
    
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    
    ccall: (funcName: string, returnType: string, argTypes: string[], args: any[]) => any;
    
    HEAP8: Int8Array;
    HEAP16: Int16Array;
    HEAP32: Int32Array;
    HEAPU8: Uint8Array;
    HEAPU16: Uint16Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
    HEAPF64: Float64Array;
  }>;
} 