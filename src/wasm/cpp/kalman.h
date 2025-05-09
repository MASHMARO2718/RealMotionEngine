/**
 * @file kalman.h
 * @brief Simple Kalman filter implementation for motion filtering.
 * 
 * This header defines a C-style API for the Kalman filter that can be
 * easily exposed through WebAssembly. The implementation is tailored for
 * motion data filtering with focus on low latency and minimal allocations.
 */

#ifndef KALMAN_H
#define KALMAN_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Create a new Kalman filter instance
 * 
 * @param dimensions Number of dimensions (state variables)
 * @param process_noise Process noise covariance
 * @param measurement_noise Measurement noise covariance
 * @return Handle to the created filter, or 0 on failure
 */
int kf_create(int dimensions, double process_noise, double measurement_noise);

/**
 * @brief Update the filter with new measurements
 * 
 * @param handle Filter handle from kf_create
 * @param measurements Pointer to array of measurements
 * @param count Number of measurements (must match dimensions)
 * @return Pointer to the filter's current state estimate
 */
double* kf_update(int handle, const double* measurements, int count);

/**
 * @brief Destroy a Kalman filter instance and free resources
 * 
 * @param handle Filter handle from kf_create
 */
void kf_destroy(int handle);

#ifdef __cplusplus
}
#endif

#endif /* KALMAN_H */ 