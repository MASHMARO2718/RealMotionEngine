#include "kalman.h"
#include <cstdlib>
#include <cstring>
#include <unordered_map>
#include <vector>
#include "emscripten.h"

// A simple matrix class for the Kalman filter
class Matrix {
public:
    Matrix(int rows, int cols) : rows_(rows), cols_(cols), data_(rows * cols, 0.0) {}
    
    double& operator()(int row, int col) {
        return data_[row * cols_ + col];
    }
    
    double operator()(int row, int col) const {
        return data_[row * cols_ + col];
    }
    
    // Matrix multiplication
    Matrix operator*(const Matrix& other) const {
        if (cols_ != other.rows_) {
            // Dimensions don't match, return empty matrix
            return Matrix(0, 0);
        }
        
        Matrix result(rows_, other.cols_);
        for (int i = 0; i < rows_; i++) {
            for (int j = 0; j < other.cols_; j++) {
                double sum = 0.0;
                for (int k = 0; k < cols_; k++) {
                    sum += (*this)(i, k) * other(k, j);
                }
                result(i, j) = sum;
            }
        }
        return result;
    }
    
    // Matrix addition
    Matrix operator+(const Matrix& other) const {
        if (rows_ != other.rows_ || cols_ != other.cols_) {
            // Dimensions don't match, return empty matrix
            return Matrix(0, 0);
        }
        
        Matrix result(rows_, cols_);
        for (int i = 0; i < rows_; i++) {
            for (int j = 0; j < cols_; j++) {
                result(i, j) = (*this)(i, j) + other(i, j);
            }
        }
        return result;
    }
    
    // Matrix subtraction
    Matrix operator-(const Matrix& other) const {
        if (rows_ != other.rows_ || cols_ != other.cols_) {
            // Dimensions don't match, return empty matrix
            return Matrix(0, 0);
        }
        
        Matrix result(rows_, cols_);
        for (int i = 0; i < rows_; i++) {
            for (int j = 0; j < cols_; j++) {
                result(i, j) = (*this)(i, j) - other(i, j);
            }
        }
        return result;
    }
    
    // Matrix transpose
    Matrix transpose() const {
        Matrix result(cols_, rows_);
        for (int i = 0; i < rows_; i++) {
            for (int j = 0; j < cols_; j++) {
                result(j, i) = (*this)(i, j);
            }
        }
        return result;
    }
    
    // Identity matrix
    static Matrix identity(int size) {
        Matrix result(size, size);
        for (int i = 0; i < size; i++) {
            result(i, i) = 1.0;
        }
        return result;
    }
    
    int rows() const { return rows_; }
    int cols() const { return cols_; }
    
private:
    int rows_;
    int cols_;
    std::vector<double> data_;
};

// The Kalman filter implementation
class KalmanFilter {
public:
    KalmanFilter(int dimensions, double process_noise, double measurement_noise)
        : dimensions_(dimensions),
          state_(dimensions, 1),        // State vector (x)
          process_noise_(dimensions, dimensions),  // Process noise covariance (Q)
          measurement_noise_(dimensions, dimensions),  // Measurement noise covariance (R)
          state_covariance_(dimensions, dimensions),  // Error covariance matrix (P)
          transition_matrix_(dimensions, dimensions),  // State transition matrix (F)
          measurement_matrix_(dimensions, dimensions),  // Measurement matrix (H)
          estimated_state_(dimensions)  // Output buffer for the estimated state
    {
        // Initialize matrices
        transition_matrix_ = Matrix::identity(dimensions);
        measurement_matrix_ = Matrix::identity(dimensions);
        
        // Set up process noise matrix (Q)
        for (int i = 0; i < dimensions; i++) {
            process_noise_(i, i) = process_noise;
        }
        
        // Set up measurement noise matrix (R)
        for (int i = 0; i < dimensions; i++) {
            measurement_noise_(i, i) = measurement_noise;
        }
        
        // Initialize state covariance matrix (P) with high uncertainty
        for (int i = 0; i < dimensions; i++) {
            state_covariance_(i, i) = 1.0;
        }
    }
    
    // Update the filter with new measurements
    const double* update(const double* measurements, int count) {
        if (count != dimensions_) {
            return nullptr;  // Measurement dimension mismatch
        }
        
        // Convert measurements to matrix
        Matrix z(dimensions_, 1);
        for (int i = 0; i < dimensions_; i++) {
            z(i, 0) = measurements[i];
        }
        
        // 1. Predict step
        // x = F * x
        // P = F * P * F^T + Q
        Matrix predicted_state = transition_matrix_ * state_;
        Matrix transition_transpose = transition_matrix_.transpose();
        Matrix predicted_covariance = transition_matrix_ * state_covariance_ * transition_transpose + process_noise_;
        
        // 2. Update step
        // K = P * H^T * (H * P * H^T + R)^-1  (Kalman gain)
        // Here we use a simplification since H is identity matrix in our case
        Matrix innovation_covariance = predicted_covariance + measurement_noise_;
        
        // Simplified inverse for diagonal matrix (assuming diagonal innovation_covariance)
        Matrix inv_innovation_covariance(dimensions_, dimensions_);
        for (int i = 0; i < dimensions_; i++) {
            inv_innovation_covariance(i, i) = 1.0 / innovation_covariance(i, i);
        }
        
        Matrix kalman_gain = predicted_covariance * inv_innovation_covariance;
        
        // x = x + K * (z - H * x)
        // Here we simplify since H is identity: (z - H * x) = (z - x)
        Matrix innovation = z - predicted_state;
        state_ = predicted_state + kalman_gain * innovation;
        
        // P = (I - K * H) * P
        // Simplify since H is identity: (I - K * H) = (I - K)
        Matrix identity = Matrix::identity(dimensions_);
        Matrix temp = identity - kalman_gain;
        state_covariance_ = temp * predicted_covariance;
        
        // Copy the state to the output buffer
        for (int i = 0; i < dimensions_; i++) {
            estimated_state_[i] = state_(i, 0);
        }
        
        return estimated_state_.data();
    }
    
private:
    int dimensions_;
    Matrix state_;              // Current state (x)
    Matrix process_noise_;      // Process noise covariance (Q)
    Matrix measurement_noise_;  // Measurement noise covariance (R)
    Matrix state_covariance_;   // Error covariance matrix (P)
    Matrix transition_matrix_;  // State transition matrix (F)
    Matrix measurement_matrix_; // Measurement matrix (H)
    
    std::vector<double> estimated_state_;  // Output buffer
};

// Global registry of Kalman filters
static std::unordered_map<int, KalmanFilter*> g_filters;
static int g_next_handle = 1;

// C-style API implementation exposed to WebAssembly
extern "C" {

EMSCRIPTEN_KEEPALIVE
int kf_create(int dimensions, double process_noise, double measurement_noise) {
    if (dimensions <= 0) {
        return 0;  // Invalid dimensions
    }
    
    KalmanFilter* filter = new KalmanFilter(dimensions, process_noise, measurement_noise);
    int handle = g_next_handle++;
    g_filters[handle] = filter;
    return handle;
}

EMSCRIPTEN_KEEPALIVE
double* kf_update(int handle, const double* measurements, int count) {
    auto it = g_filters.find(handle);
    if (it == g_filters.end()) {
        return nullptr;  // Invalid handle
    }
    
    return const_cast<double*>(it->second->update(measurements, count));
}

EMSCRIPTEN_KEEPALIVE
void kf_destroy(int handle) {
    auto it = g_filters.find(handle);
    if (it != g_filters.end()) {
        delete it->second;
        g_filters.erase(it);
    }
}

} // extern "C" 