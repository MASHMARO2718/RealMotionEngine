'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

interface AnimatedModelProps {
  poseData?: PoseLandmarkerResult | null;
}

// MediaPipeのランドマークのインデックスと名前のマッピング
const LANDMARK_NAMES: Record<number, string> = {
  0: 'nose',
  1: 'left_eye_inner',
  2: 'left_eye',
  3: 'left_eye_outer',
  4: 'right_eye_inner',
  5: 'right_eye',
  6: 'right_eye_outer',
  7: 'left_ear',
  8: 'right_ear',
  9: 'mouth_left',
  10: 'mouth_right',
  11: 'left_shoulder',
  12: 'right_shoulder',
  13: 'left_elbow',
  14: 'right_elbow',
  15: 'left_wrist',
  16: 'right_wrist',
  17: 'left_pinky',
  18: 'right_pinky',
  19: 'left_index',
  20: 'right_index',
  21: 'left_thumb',
  22: 'right_thumb',
  23: 'left_hip',
  24: 'right_hip',
  25: 'left_knee',
  26: 'right_knee',
  27: 'left_ankle',
  28: 'right_ankle',
  29: 'left_heel',
  30: 'right_heel',
  31: 'left_foot_index',
  32: 'right_foot_index'
};

// 接続するポイントのペア
const POSE_CONNECTIONS = [
  // 顔と頭
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // 胴体
  [11, 12], [11, 23], [12, 24], [23, 24],
  // 左腕
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  // 右腕
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  // 左脚
  [23, 25], [25, 27], [27, 29], [27, 31],
  // 右脚
  [24, 26], [26, 28], [28, 30], [28, 32]
];

export default function AnimatedModel({ poseData }: AnimatedModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<Record<number, THREE.Object3D | null>>({});
  const bonesRef = useRef<THREE.Group | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  // 初期化 - ランドマーク用の球を作成
  useEffect(() => {
    if (!groupRef.current) return;
    
    // 既存の子要素をクリア
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    
    // 新しい点を作成
    const points: Record<number, THREE.Object3D> = {};
    Object.keys(LANDMARK_NAMES).forEach(idxStr => {
      const idx = parseInt(idxStr);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.03), // サイズを大きめに
        new THREE.MeshStandardMaterial({ 
          color: idx < 11 ? 0xff9900 : (idx < 23 ? 0x00aaff : 0x00ff00),
          emissive: idx < 11 ? 0x994400 : (idx < 23 ? 0x0055aa : 0x009900),
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.8
        })
      );
      sphere.visible = false; // 最初は非表示
      sphere.name = `landmark_${idx}`;
      groupRef.current.add(sphere);
      points[idx] = sphere;
    });
    pointsRef.current = points;
    
    // ボーン（線）用のグループを作成
    const bonesGroup = new THREE.Group();
    bonesGroup.name = 'bones';
    groupRef.current.add(bonesGroup);
    bonesRef.current = bonesGroup;
    
    // モデルの基本位置と回転を設定
    groupRef.current.position.set(0, -1, 0);
    groupRef.current.rotation.set(0, Math.PI, 0); // モデルを正面に向ける
    
    setInitialized(true);
    console.log('スケルトン表示の初期化完了');
  }, []);
  
  // フレームごとにポーズデータを適用
  useFrame(() => {
    if (!initialized || !poseData || !poseData.landmarks || poseData.landmarks.length === 0) return;
    
    const landmarks = poseData.landmarks[0]; // 最初の検出された人物
    const points = pointsRef.current;
    
    // ランドマークのスケールと位置を調整する関数
    const normalizePosition = (x: number, y: number, z: number | undefined) => {
      return new THREE.Vector3(
        (x - 0.5) * 2 * 0.8, // X座標を-0.8〜0.8の範囲に変換
        (0.5 - y) * 2 * 1.2, // Y座標を反転して-1.2〜1.2の範囲に変換
        (z || 0) * -2 // Z座標を反転して0〜-2の範囲に変換
      );
    };
    
    // 各ランドマークの位置を更新
    Object.entries(LANDMARK_NAMES).forEach(([idxStr, name]) => {
      const idx = parseInt(idxStr);
      const point = points[idx];
      const landmark = landmarks[idx];
      
      if (point && landmark) {
        const pos = normalizePosition(landmark.x, landmark.y, landmark.z);
        point.position.copy(pos);
        point.visible = true;
        
        // 可視性に基づいて透明度を設定
        if (landmark.visibility !== undefined) {
          const material = (point as THREE.Mesh).material as THREE.MeshStandardMaterial;
          material.opacity = Math.max(0.2, landmark.visibility);
        }
      }
    });
    
    // ボーン（線）を更新
    if (bonesRef.current) {
      // 既存のボーンをクリア
      while (bonesRef.current.children.length > 0) {
        bonesRef.current.remove(bonesRef.current.children[0]);
      }
      
      // 新しいボーンを作成
      POSE_CONNECTIONS.forEach(([fromIdx, toIdx]) => {
        const fromPoint = points[fromIdx];
        const toPoint = points[toIdx];
        
        if (fromPoint && toPoint && fromPoint.visible && toPoint.visible) {
          const fromLandmark = landmarks[fromIdx];
          const toLandmark = landmarks[toIdx];
          
          // 両方のランドマークの可視性をチェック
          const visibility = Math.min(
            fromLandmark.visibility !== undefined ? fromLandmark.visibility : 1,
            toLandmark.visibility !== undefined ? toLandmark.visibility : 1
          );
          
          if (visibility > 0.1) {
            // 2点間に線を引く
            const material = new THREE.LineBasicMaterial({ 
              color: fromIdx < 11 ? 0xff9900 : (fromIdx < 23 ? 0x00aaff : 0x00ff00),
              transparent: true,
              opacity: Math.max(0.3, visibility)
            });
            
            const geometry = new THREE.BufferGeometry().setFromPoints([
              fromPoint.position,
              toPoint.position
            ]);
            
            const line = new THREE.Line(geometry, material);
            bonesRef.current.add(line);
          }
        }
      });
    }
  });

  return <group ref={groupRef} />;
} 