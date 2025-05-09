#pragma once

#include <vector>
#include <emscripten.h>
#include "emscripten.h"

// 3D座標を表す構造体
struct Point3D {
    float x;
    float y;
    float z;
};

// 手のランドマークの種類を表す列挙型
enum GestureType {
    UNKNOWN = -1,
    FIST = 0,
    ONE_FINGER = 1,
    TWO_FINGERS = 2,
    THREE_FINGERS = 3,
    FOUR_FINGERS = 4,
    FIVE_FINGERS = 5,
    OK_GESTURE = 6,
    THUMB_UP = 7
};

// 手の各ランドマークを表す構造体
struct HandLandmark {
    std::vector<Point3D> points;
    GestureType gesture;
};

// ハンドトラッキングの結果を表す構造体
struct HandTrackingResult {
    std::vector<HandLandmark> hands;
    float score;
};

// C++からJavaScriptに公開する関数
extern "C" {
    // 初期化関数
    EMSCRIPTEN_KEEPALIVE int initialize_hand_tracker();
    
    // 画像データから手のランドマークを検出する関数
    EMSCRIPTEN_KEEPALIVE HandTrackingResult* detect_hand_landmarks(unsigned char* imageData, int width, int height);
    
    // 指の先端座標を取得する関数
    EMSCRIPTEN_KEEPALIVE Point3D* get_finger_tips(HandTrackingResult* result);
    
    // 手のジェスチャーを認識する関数
    EMSCRIPTEN_KEEPALIVE GestureType recognize_gesture(HandTrackingResult* result, int hand_index);
    
    // メモリ解放関数
    EMSCRIPTEN_KEEPALIVE void free_tracking_result(HandTrackingResult* result);
    EMSCRIPTEN_KEEPALIVE void free_points(Point3D* points);
} 