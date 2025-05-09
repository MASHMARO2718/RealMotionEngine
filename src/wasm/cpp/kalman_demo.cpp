#include "kalman.h"
#include <emscripten.h>
#include <cmath>

// Add some noise to a sine wave to demonstrate filtering
EMSCRIPTEN_KEEPALIVE
extern "C" double* generate_noisy_sine(int count, double frequency, double amplitude, double noise_level) {
    // Allocate memory for the result that will persist beyond this function call
    // Note: In a real app, this memory should be freed elsewhere to avoid leaks
    double* result = (double*)malloc(count * sizeof(double));
    
    for (int i = 0; i < count; i++) {
        double t = i / 60.0;  // Assuming 60Hz sample rate
        double clean_value = amplitude * sin(2.0 * M_PI * frequency * t);
        double noise = ((double)rand() / RAND_MAX * 2.0 - 1.0) * noise_level;
        result[i] = clean_value + noise;
    }
    
    return result;
}

// Demo function to apply the Kalman filter to a noisy sine wave
EMSCRIPTEN_KEEPALIVE
extern "C" double* demo_kalman_filter(int count) {
    // Generate a noisy sine wave
    double* noisy_data = generate_noisy_sine(count, 1.0, 1.0, 0.3);
    
    // Create a Kalman filter
    int handle = kf_create(1, 0.001, 0.1);
    
    // Allocate memory for the filtered result
    double* filtered_data = (double*)malloc(count * sizeof(double));
    
    // Apply the filter to each sample
    for (int i = 0; i < count; i++) {
        double input = noisy_data[i];
        double* output = kf_update(handle, &input, 1);
        if (output) {
            filtered_data[i] = *output;
        } else {
            filtered_data[i] = input;  // Fallback if filter fails
        }
    }
    
    // Clean up
    kf_destroy(handle);
    free(noisy_data);
    
    return filtered_data;
}

// Free memory allocated by functions above
EMSCRIPTEN_KEEPALIVE
extern "C" void free_data(double* data) {
    free(data);
} 