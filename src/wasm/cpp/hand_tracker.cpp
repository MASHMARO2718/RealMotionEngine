#include "hand_tracker.h"
#include <cmath>
#include <algorithm>
#include <cstring>
#include <emscripten.h>

// MediaPipe hand tracking constants
const int NUM_LANDMARKS = 21; // MediaPipe's hand landmark count
const int NUM_FINGER_TIPS = 5; // Thumb, index, middle, ring, pinky
bool g_initialized = false;

// Low-pass filter for smoothing hand landmarks
class LowPassFilter {
private:
    float alpha;
    float prev_value;
    bool initialized;

public:
    LowPassFilter(float alpha = 0.3f) : alpha(alpha), prev_value(0), initialized(false) {}
    
    float apply(float value) {
        if (!initialized) {
            initialized = true;
            prev_value = value;
            return value;
        }
        
        float filtered = alpha * value + (1.0f - alpha) * prev_value;
        prev_value = filtered;
        return filtered;
    }
    
    void reset() {
        initialized = false;
    }
};

// Filters for each landmark coordinate
std::vector<std::vector<LowPassFilter>> landmark_filters;

// Calculate angle between two vectors
float calculate_angle(float x1, float y1, float x2, float y2) {
    float dot = x1 * x2 + y1 * y2;
    float mag1 = std::sqrt(x1 * x1 + y1 * y1);
    float mag2 = std::sqrt(x2 * x2 + y2 * y2);
    
    if (mag1 * mag2 == 0) return 0.0f;
    
    float cosAngle = std::min(1.0f, std::max(-1.0f, dot / (mag1 * mag2)));
    return std::acos(cosAngle) * 180.0f / M_PI;
}

// Initialize the hand tracker
EMSCRIPTEN_KEEPALIVE int initialize_hand_tracker() {
    if (g_initialized) {
        return 1; // Already initialized
    }
    
    // Initialize filters for up to 2 hands
    landmark_filters.resize(2);
    for (int i = 0; i < 2; i++) {
        landmark_filters[i].resize(NUM_LANDMARKS * 3); // x, y, z coordinates
    }
    
    g_initialized = true;
    return 1;
}

// Simple skin color detection algorithm
bool is_skin_color(unsigned char r, unsigned char g, unsigned char b) {
    // Simple skin color detection
    return (r > 95 && g > 40 && b > 20 && 
            r > g && r > b && 
            std::abs(r - g) > 15);
}

// Detect hand landmarks from image data
EMSCRIPTEN_KEEPALIVE HandTrackingResult* detect_hand_landmarks(unsigned char* imageData, int width, int height) {
    // Initialize if not already
    if (!g_initialized) {
        initialize_hand_tracker();
    }
    
    // Create result structure
    HandTrackingResult* result = new HandTrackingResult();
    result->score = 0.0f;
    
    // Basic skin detection to locate hand regions
    int total_pixels = width * height;
    int skin_pixels = 0;
    float center_x = 0;
    float center_y = 0;
    
    // Sample image every 10 pixels for performance
    for (int y = 0; y < height; y += 10) {
        for (int x = 0; x < width; x += 10) {
            int i = (y * width + x) * 4; // RGBA channels
            unsigned char r = imageData[i];
            unsigned char g = imageData[i + 1];
            unsigned char b = imageData[i + 2];
            
            if (is_skin_color(r, g, b)) {
                skin_pixels++;
                center_x += x;
                center_y += y;
            }
        }
    }
    
    // If no skin pixels detected, return empty result
    if (skin_pixels < 10) {
        return result;
    }
    
    // Calculate center of skin region
    center_x /= skin_pixels;
    center_y /= skin_pixels;
    
    // Generate hand landmarks based on skin region center
    HandLandmark hand;
    hand.gesture = UNKNOWN;
    
    // MediaPipe hand landmark indices:
    // 0: Wrist
    // 1-4: Thumb joints
    // 5-8: Index finger joints
    // 9-12: Middle finger joints
    // 13-16: Ring finger joints
    // 17-20: Pinky finger joints
    
    // Create wrist landmark (base of hand)
    Point3D wrist = {center_x / width, center_y / height, 0.0f};
    
    // Apply filter to wrist position
    if (landmark_filters.size() > 0) {
        wrist.x = landmark_filters[0][0].apply(wrist.x);
        wrist.y = landmark_filters[0][1].apply(wrist.y);
        wrist.z = landmark_filters[0][2].apply(wrist.z);
    }
    
    hand.points.push_back(wrist);
    
    // Generate finger landmarks based on hand geometry
    const float finger_spacing = 0.04f;
    const float joint_spacing = 0.03f;
    
    // Thumb landmarks (indices 1-4)
    const float thumb_angles[4] = {-0.7f, -0.5f, -0.3f, -0.1f};
    for (int i = 0; i < 4; i++) {
        float angle = thumb_angles[i];
        Point3D p = {
            wrist.x + std::cos(angle) * (i+1) * joint_spacing,
            wrist.y - std::sin(angle) * (i+1) * joint_spacing,
            0.01f * i // Small z variation
        };
        
        // Apply filter
        int idx = i + 1;
        p.x = landmark_filters[0][idx * 3].apply(p.x);
        p.y = landmark_filters[0][idx * 3 + 1].apply(p.y);
        p.z = landmark_filters[0][idx * 3 + 2].apply(p.z);
        
        hand.points.push_back(p);
    }
    
    // Create finger bases with proper spacing
    std::vector<Point3D> finger_bases;
    for (int finger = 0; finger < 4; finger++) {
        float angle = -0.2f + finger * 0.2f;
        Point3D base = {
            wrist.x + std::cos(angle) * 0.15f,
            wrist.y - std::sin(angle) * 0.15f,
            0.0f
        };
        
        // Apply filter
        int idx = 5 + finger * 4;
        base.x = landmark_filters[0][idx * 3].apply(base.x);
        base.y = landmark_filters[0][idx * 3 + 1].apply(base.y);
        base.z = landmark_filters[0][idx * 3 + 2].apply(base.z);
        
        finger_bases.push_back(base);
        hand.points.push_back(base);
    }
    
    // Generate joints for each finger (4 fingers, excluding thumb)
    for (int finger = 0; finger < 4; finger++) {
        Point3D base = finger_bases[finger];
        float baseAngle = -0.1f + finger * 0.1f;
        
        // Add 3 joints per finger
        for (int joint = 1; joint < 4; joint++) {
            Point3D p = {
                base.x + std::cos(baseAngle) * joint * joint_spacing,
                base.y - std::sin(baseAngle) * joint * joint_spacing,
                0.01f * joint // Small z variation
            };
            
            // Apply filter
            int idx = 5 + finger * 4 + joint;
            p.x = landmark_filters[0][idx * 3].apply(p.x);
            p.y = landmark_filters[0][idx * 3 + 1].apply(p.y);
            p.z = landmark_filters[0][idx * 3 + 2].apply(p.z);
            
            hand.points.push_back(p);
        }
    }
    
    // Recognize the gesture
    hand.gesture = recognize_gesture(result, 0);
    
    result->hands.push_back(hand);
    result->score = static_cast<float>(skin_pixels) / (total_pixels / 100);
    
    return result;
}

// Get fingertip coordinates
EMSCRIPTEN_KEEPALIVE Point3D* get_finger_tips(HandTrackingResult* result) {
    if (!result || result->hands.empty()) {
        return nullptr;
    }
    
    // MediaPipe fingertip indices
    const int fingertip_indices[NUM_FINGER_TIPS] = {4, 8, 12, 16, 20};
    
    // Array to store fingertip coordinates
    Point3D* tips = new Point3D[NUM_FINGER_TIPS];
    
    const HandLandmark& hand = result->hands[0];
    for (int i = 0; i < NUM_FINGER_TIPS; i++) {
        if (fingertip_indices[i] < hand.points.size()) {
            tips[i] = hand.points[fingertip_indices[i]];
        } else {
            // Initialize with zeros if landmark not available
            tips[i] = {0.0f, 0.0f, 0.0f};
        }
    }
    
    return tips;
}

// Recognize hand gesture
EMSCRIPTEN_KEEPALIVE GestureType recognize_gesture(HandTrackingResult* result, int hand_index) {
    if (!result || hand_index >= result->hands.size()) {
        return UNKNOWN;
    }
    
    const HandLandmark& hand = result->hands[hand_index];
    
    // Need at least 21 landmarks for proper gesture recognition
    if (hand.points.size() < 21) {
        return UNKNOWN;
    }
    
    // MediaPipe hand landmark indices
    // Wrist: 0
    // Thumb: 1-4
    // Index: 5-8
    // Middle: 9-12
    // Ring: 13-16
    // Pinky: 17-20
    
    const Point3D& wrist = hand.points[0];
    
    // Get key points for each finger
    const Point3D& thumb_tip = hand.points[4];
    const Point3D& index_tip = hand.points[8];
    const Point3D& middle_tip = hand.points[12];
    const Point3D& ring_tip = hand.points[16];
    const Point3D& pinky_tip = hand.points[20];
    
    const Point3D& thumb_base = hand.points[2];
    const Point3D& index_base = hand.points[5];
    const Point3D& middle_base = hand.points[9];
    const Point3D& ring_base = hand.points[13];
    const Point3D& pinky_base = hand.points[17];
    
    // Calculate angles for each finger
    float thumb_angle = calculate_angle(
        wrist.x - thumb_base.x, wrist.y - thumb_base.y,
        thumb_tip.x - thumb_base.x, thumb_tip.y - thumb_base.y
    );
    
    float index_angle = calculate_angle(
        wrist.x - index_base.x, wrist.y - index_base.y,
        index_tip.x - index_base.x, index_tip.y - index_base.y
    );
    
    float middle_angle = calculate_angle(
        wrist.x - middle_base.x, wrist.y - middle_base.y,
        middle_tip.x - middle_base.x, middle_tip.y - middle_base.y
    );
    
    float ring_angle = calculate_angle(
        wrist.x - ring_base.x, wrist.y - ring_base.y,
        ring_tip.x - ring_base.x, ring_tip.y - ring_base.y
    );
    
    float pinky_angle = calculate_angle(
        wrist.x - pinky_base.x, wrist.y - pinky_base.y,
        pinky_tip.x - pinky_base.x, pinky_tip.y - pinky_base.y
    );
    
    // Determine finger extension
    const float extension_threshold = 60.0f;
    bool thumb_extended = thumb_angle > extension_threshold;
    bool index_extended = index_angle > extension_threshold;
    bool middle_extended = middle_angle > extension_threshold;
    bool ring_extended = ring_angle > extension_threshold;
    bool pinky_extended = pinky_angle > extension_threshold;
    
    // Check for specific gestures
    
    // FIST: No fingers extended
    if (!thumb_extended && !index_extended && !middle_extended && !ring_extended && !pinky_extended) {
        return FIST;
    }
    
    // ONE_FINGER: Only index finger extended
    if (!thumb_extended && index_extended && !middle_extended && !ring_extended && !pinky_extended) {
        return ONE_FINGER;
    }
    
    // TWO_FINGERS: Index and middle fingers extended
    if (!thumb_extended && index_extended && middle_extended && !ring_extended && !pinky_extended) {
        return TWO_FINGERS;
    }
    
    // THREE_FINGERS: Index, middle, and ring fingers extended
    if (!thumb_extended && index_extended && middle_extended && ring_extended && !pinky_extended) {
        return THREE_FINGERS;
    }
    
    // FOUR_FINGERS: All except thumb extended
    if (!thumb_extended && index_extended && middle_extended && ring_extended && pinky_extended) {
        return FOUR_FINGERS;
    }
    
    // FIVE_FINGERS: All fingers extended
    if (thumb_extended && index_extended && middle_extended && ring_extended && pinky_extended) {
        return FIVE_FINGERS;
    }
    
    // OK_GESTURE: Thumb and index form a circle
    float thumb_index_distance = std::sqrt(
        std::pow(thumb_tip.x - index_tip.x, 2) + 
        std::pow(thumb_tip.y - index_tip.y, 2)
    );
    if (thumb_index_distance < 0.1f && middle_extended && ring_extended && pinky_extended) {
        return OK_GESTURE;
    }
    
    // THUMB_UP: Only thumb extended, hand vertical
    if (thumb_extended && !index_extended && !middle_extended && !ring_extended && !pinky_extended &&
        thumb_tip.y < wrist.y) {
        return THUMB_UP;
    }
    
    return UNKNOWN;
}

// Free memory for results
EMSCRIPTEN_KEEPALIVE void free_tracking_result(HandTrackingResult* result) {
    if (result) {
        delete result;
    }
}

// Free memory for points
EMSCRIPTEN_KEEPALIVE void free_points(Point3D* points) {
    if (points) {
        delete[] points;
    }
} 