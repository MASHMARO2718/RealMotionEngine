'use client';

import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import Box from '@mui/material/Box';
import { Environment, Grid, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { calculateJointRotations } from '../../lib/shared/pose-utils';
import StickmanModel from './StickmanModel';
import CoordinateAxes3D from './CoordinateAxes3D';
import FixedCoordinateAxes from './FixedCoordinateAxes';

function HumanBoneModel({ poseData }: { poseData?: PoseLandmarkerResult | null }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/stickman.glb') as any;
  const [modelLoaded, setModelLoaded] = useState(false);
  const boneVisualizationRef = useRef<THREE.Group | null>(null);
  const bonesRef = useRef<THREE.Bone[]>([]);  // ボーンの参照を保存

  // モデルの構造を詳細に調査して表示する関数
  const analyzeAndFixModel = (scene: THREE.Object3D) => {
    console.log('=== 3Dモデル解析開始 ===');
    console.log('ルートシーン:', scene);
    
    let meshCount = 0;
    let skinnedMeshCount = 0;
    let boneCount = 0;
    let materialCount = 0;
    let bones: THREE.Bone[] = [];
    const processedBones = new Set<THREE.Bone>(); // 重複防止
    
    // すべてのオブジェクトを走査
    scene.traverse((object: THREE.Object3D) => {
      console.log(`\n📦 オブジェクト: ${object.type}`);
      console.log(`   名前: "${object.name}"`);
      console.log(`   位置: (${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)})`);
      console.log(`   スケール: (${object.scale.x.toFixed(2)}, ${object.scale.y.toFixed(2)}, ${object.scale.z.toFixed(2)})`);
      console.log(`   可視: ${object.visible}`);
      
      // Meshの場合
      if (object instanceof THREE.Mesh) {
        meshCount++;
        console.log(`🔷 Mesh[${meshCount}]の詳細:`);
        console.log(`   ジオメトリ:`, object.geometry);
        console.log(`   マテリアル:`, object.material);
        
        // ジオメトリの詳細
        if (object.geometry) {
          const geometry = object.geometry;
          const bbox = new THREE.Box3().setFromObject(object);
          console.log(`   頂点数: ${geometry.attributes.position?.count || 0}`);
          console.log(`   バウンディングボックス:`, bbox);
        }
        
        // マテリアルの修正
        if (!object.material) {
          object.material = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,  // 緑色で目立たせる
            metalness: 0.1,
            roughness: 0.8
          });
          console.log(`   ✅ デフォルトマテリアル（緑）を適用`);
        } else {
          materialCount++;
          // 透明度の問題を修正
          if (Array.isArray(object.material)) {
            object.material.forEach((mat, idx) => {
              if (mat.transparent && mat.opacity < 0.5) {
                mat.opacity = 1.0;
                mat.transparent = false;
                console.log(`   ✅ マテリアル[${idx}]の透明度を修正`);
              }
            });
          } else {
            if (object.material.transparent && object.material.opacity < 0.5) {
              object.material.opacity = 1.0;
              object.material.transparent = false;
              console.log(`   ✅ マテリアルの透明度を修正`);
            }
          }
        }
        
        // 確実に表示されるようにする
        object.visible = true;
        object.castShadow = true;
        object.receiveShadow = true;
      }
      
      // SkinnedMeshの場合
      if (object instanceof THREE.SkinnedMesh) {
        skinnedMeshCount++;
        console.log(`🦴 SkinnedMesh[${skinnedMeshCount}]を発見!`);
        console.log(`   スケルトン:`, object.skeleton);
        if (object.skeleton) {
          console.log(`   ボーン数: ${object.skeleton.bones.length}`);
          object.skeleton.bones.forEach((bone, idx) => {
            if (!processedBones.has(bone)) {
              bones.push(bone);
              processedBones.add(bone);
              console.log(`     ボーン[${idx}]: "${bone.name}" (SkinnedMeshから追加)`);
            } else {
              console.log(`     ボーン[${idx}]: "${bone.name}" (既に処理済み - スキップ)`);
            }
          });
        }
      }
      
      // Boneの場合（SkinnedMeshに含まれていない独立したボーンのみ）
      if (object instanceof THREE.Bone) {
        boneCount++;
        if (!processedBones.has(object)) {
          bones.push(object);
          processedBones.add(object);
          console.log(`🦴 Bone[${boneCount}]: "${object.name}" (独立ボーンとして追加)`);
        } else {
          console.log(`🦴 Bone[${boneCount}]: "${object.name}" (既に処理済み - スキップ)`);
        }
      }
    });
    
    // モデル全体のバウンディングボックスを計算
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    
    console.log(`\n📊 解析結果:`);
    console.log(`   Mesh: ${meshCount}`);
    console.log(`   SkinnedMesh: ${skinnedMeshCount}`);
    console.log(`   Bone: ${boneCount}`);
    console.log(`   Material: ${materialCount}`);
    console.log(`   実際に処理するボーン数: ${bones.length}`);
    console.log(`   モデルサイズ: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);
    console.log(`   モデル中心: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
    
    return { meshCount, skinnedMeshCount, boneCount, size, center, bones };
  };

  // ボーンをオレンジ色で可視化する関数
  const createBoneVisualization = (bones: THREE.Bone[]) => {
    const visualGroup = new THREE.Group();
    visualGroup.name = 'BoneVisualization';
    
    console.log(`🎨 ${bones.length}個のボーンを自然な骨格として可視化中...`);
    
    bones.forEach((bone, index) => {
      // ボーンの世界座標を取得
      const worldPosition = new THREE.Vector3();
      bone.getWorldPosition(worldPosition);
      
      // 関節部分（小さめの球体）
      const jointSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 16, 16),
        new THREE.MeshStandardMaterial({ 
          color: 0xff5500,  // 少し濃いオレンジ
          metalness: 0.4,
          roughness: 0.5,
          emissive: 0x221100  // わずかな発光
        })
      );
      jointSphere.position.copy(worldPosition);
      jointSphere.name = `bone_sphere_${bone.name || index}`;
      visualGroup.add(jointSphere);
      
      console.log(`   🟠 関節[${index}] "${bone.name}" 位置: (${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)})`);
      
      // 親ボーンがある場合、骨のような形状で接続
      if (bone.parent && bone.parent instanceof THREE.Bone) {
        const parentWorldPosition = new THREE.Vector3();
        bone.parent.getWorldPosition(parentWorldPosition);
        
        const direction = new THREE.Vector3().subVectors(worldPosition, parentWorldPosition);
        const distance = direction.length();
        
        if (distance > 0.01) {
          // 骨のような形状（両端が細くなる円錐台）
          const boneGeometry = new THREE.CylinderGeometry(
            0.025,  // 上端の半径（細め）
            0.05,   // 下端の半径（太め）
            distance, 
            12,     // セグメント数
            1,      // 高さセグメント
            false   // オープンエンド
          );
          
          const boneMesh = new THREE.Mesh(
            boneGeometry,
            new THREE.MeshStandardMaterial({ 
              color: 0xff7722,  // 温かみのあるオレンジ
              metalness: 0.3,
              roughness: 0.6,
              emissive: 0x110500  // わずかな発光
            })
          );
          
          // 骨の配置と回転
          const midpoint = new THREE.Vector3().addVectors(worldPosition, parentWorldPosition).multiplyScalar(0.5);
          boneMesh.position.copy(midpoint);
          boneMesh.lookAt(worldPosition);
          boneMesh.rotateX(Math.PI / 2);
          boneMesh.name = `bone_connection_${bone.parent.name}_${bone.name}`;
          visualGroup.add(boneMesh);
          
          console.log(`   🦴 骨: ${bone.parent.name} → ${bone.name} (長さ: ${distance.toFixed(2)})`);
        }
      }
    });
    
    return visualGroup;
  };

  // モデルの初期設定
  useEffect(() => {
    if (group.current && scene) {
      console.log('🚀 3Dモデル初期化開始...');
      
      // モデル構造を解析
      const analysis = analyzeAndFixModel(scene);
      
      // ボーンの可視化を作成
      if (analysis.bones.length > 0) {
        // 既存の可視化をクリア
        if (boneVisualizationRef.current) {
          group.current.remove(boneVisualizationRef.current);
          boneVisualizationRef.current = null;
        }
        
        const boneVisualization = createBoneVisualization(analysis.bones);
        group.current.add(boneVisualization);
        boneVisualizationRef.current = boneVisualization;
        bonesRef.current = analysis.bones;  // ボーンを保存してアニメーション用に使用
        console.log(`✅ ${analysis.bones.length}個のボーンをオレンジ色で可視化しました`);
      } else {
        console.log('⚠️ ボーンが見つかりませんでした');
      }
      
      // モデルの位置とスケールを調整
      let scale = 1;
      if (analysis.size.length() > 0) {
        // モデルが小さすぎる場合は拡大、大きすぎる場合は縮小
        const maxSize = Math.max(analysis.size.x, analysis.size.y, analysis.size.z);
        if (maxSize < 1) {
          scale = 5 / maxSize;  // 小さすぎる場合は拡大
        } else if (maxSize > 10) {
          scale = 5 / maxSize;  // 大きすぎる場合は縮小
        }
      }
      
      if (group.current) {
        group.current.scale.set(scale, scale, scale);
        console.log(`🔧 スケール調整: ${scale}`);
        
        // 足が地面につくように調整（モデルの最低点をY=0に）
        const bbox = new THREE.Box3().setFromObject(scene);
        const minY = bbox.min.y * scale;  // スケール適用後の最低点（足）
        const yOffset = -minY;  // 最低点をY=0に配置
        group.current.position.setY(yOffset);
        console.log(`🦵 足を地面に配置: 最低点 ${minY.toFixed(2)} → Y位置調整 ${yOffset.toFixed(2)} (足のY座標=0に設定)`);
      }
      
      setModelLoaded(true);
      console.log('✅ 3Dモデル初期化完了');
    }
    
    // クリーンアップ関数
    return () => {
      if (boneVisualizationRef.current && group.current) {
        group.current.remove(boneVisualizationRef.current);
        boneVisualizationRef.current = null;
      }
      bonesRef.current = [];
    };
  }, [scene]);

  // リアルタイムボーンアニメーション
  useFrame((state, delta) => {
    if (!modelLoaded || !poseData || !poseData.landmarks || poseData.landmarks.length === 0) {
      return;
    }

    try {
      // MediaPipeのポーズデータから関節角度を計算
      const rotations = calculateJointRotations(poseData);
      
      if (rotations && bonesRef.current.length > 0) {        console.log('🎯 ボーンアニメーション開始:', Object.keys(rotations));                // 利用可能なボーン名を一度だけ出力（初回のみ）        if (bonesRef.current.length > 0 && Object.keys(rotations).length === 8) { // 計算完了時のみ          console.log('🦴 利用可能なボーン名:');          bonesRef.current.forEach((bone, index) => {            console.log(`  [${index}] "${bone.name}"`);          });        }
        
        // 計算された回転をボーンに適用
        bonesRef.current.forEach((bone, index) => {
          const boneName = bone.name.toLowerCase();
          let rotationApplied = false;
          
          // より包括的なボーン名マッピング
          for (const [jointName, rotation] of Object.entries(rotations)) {
            if (rotation instanceof THREE.Quaternion) {
              let shouldApply = false;
              
              // 詳細なマッピングルール
              switch (jointName) {
                case 'leftShoulder':
                  shouldApply = boneName.includes('left') && 
                    (boneName.includes('shoulder') || boneName.includes('arm') || boneName.includes('upper'));
                  break;
                case 'rightShoulder':
                  shouldApply = boneName.includes('right') && 
                    (boneName.includes('shoulder') || boneName.includes('arm') || boneName.includes('upper'));
                  break;
                case 'leftElbow':
                  shouldApply = boneName.includes('left') && 
                    (boneName.includes('elbow') || boneName.includes('forearm') || boneName.includes('lower'));
                  break;
                case 'rightElbow':
                  shouldApply = boneName.includes('right') && 
                    (boneName.includes('elbow') || boneName.includes('forearm') || boneName.includes('lower'));
                  break;
                case 'leftHip':
                  shouldApply = boneName.includes('left') && 
                    (boneName.includes('hip') || boneName.includes('thigh') || boneName.includes('leg'));
                  break;
                case 'rightHip':
                  shouldApply = boneName.includes('right') && 
                    (boneName.includes('hip') || boneName.includes('thigh') || boneName.includes('leg'));
                  break;
                case 'leftKnee':
                  shouldApply = boneName.includes('left') && 
                    (boneName.includes('knee') || boneName.includes('shin') || boneName.includes('calf'));
                  break;
                case 'rightKnee':
                  shouldApply = boneName.includes('right') && 
                    (boneName.includes('knee') || boneName.includes('shin') || boneName.includes('calf'));
                  break;
                case 'spine':
                  shouldApply = boneName.includes('spine') || boneName.includes('torso') || 
                    boneName.includes('back') || boneName.includes('chest');
                  break;
                default:
                  // フォールバック：部分的な名前マッチング
                  shouldApply = boneName.includes(jointName.toLowerCase()) || 
                    jointName.toLowerCase().includes(boneName);
              }
              
              if (shouldApply) {
                // 回転をスムーズに適用（線形補間）
                bone.quaternion.slerp(rotation, 0.1);
                console.log(`✅ 回転適用: ボーン"${bone.name}" ← 関節"${jointName}"`);
                rotationApplied = true;
                break;
              }
            }
          }
          
          if (!rotationApplied) {
            console.log(`⚠️ 回転未適用: ボーン"${bone.name}" - マッピングが見つからない`);
          }
        });
        
        // ボーン可視化も更新
        if (boneVisualizationRef.current) {
          // 可視化オブジェクトの位置を更新
          bonesRef.current.forEach((bone, index) => {
            const worldPosition = new THREE.Vector3();
            bone.getWorldPosition(worldPosition);
            
            // 球体の位置を更新
            const sphereName = `bone_sphere_${bone.name || index}`;
            const sphere = boneVisualizationRef.current?.getObjectByName(sphereName);
            if (sphere) {
              sphere.position.copy(worldPosition);
            }
            
            // 接続線（円柱）の位置と回転も更新
            if (bone.parent && bone.parent instanceof THREE.Bone) {
              const parentWorldPosition = new THREE.Vector3();
              bone.parent.getWorldPosition(parentWorldPosition);
              
              const connectionName = `bone_connection_${bone.parent.name}_${bone.name}`;
              const connection = boneVisualizationRef.current?.getObjectByName(connectionName);
              if (connection) {
                // 接続線の長さと方向を再計算
                const direction = new THREE.Vector3().subVectors(worldPosition, parentWorldPosition);
                const distance = direction.length();
                
                if (distance > 0.01) {
                  // 中点を計算
                  const midpoint = new THREE.Vector3().addVectors(worldPosition, parentWorldPosition).multiplyScalar(0.5);
                  connection.position.copy(midpoint);
                  
                  // 接続線の向きを更新
                  connection.lookAt(worldPosition);
                  connection.rotateX(Math.PI / 2);
                  
                  // 長さも更新（円柱のスケール調整）
                  if (connection instanceof THREE.Mesh && connection.geometry instanceof THREE.CylinderGeometry) {
                    connection.scale.setY(distance / 1); // 元の長さで正規化
                  }
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ ボーンアニメーションエラー:', error);
    }
  });

  return <primitive ref={group} object={scene} />;
}

function Scene({ poseData, showAxes = true }: { poseData?: PoseLandmarkerResult | null; showAxes?: boolean }) {
  return (
    <>
      {/* 改善されたライティング */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
      <directionalLight position={[-10, 5, -5]} intensity={0.6} />
      <directionalLight position={[0, -5, 0]} intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={0.3} color={0xffffff} />
      
      {/* 🎯 XYZ座標軸 - 世界座標系 */}
      {showAxes && <CoordinateAxes3D position={[0, 0.05, 0]} size={3} />}
      
      {/* グリッド */}
      <Grid
        args={[20, 20]}
        position={[0, -0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#999999"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#666666"
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      
      {/* 3Dモデル */}
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[1, 2, 0.5]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      }>
        <StickmanModel poseData={poseData} />
      </Suspense>
      
      <OrbitControls 
        makeDefault 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />
      <Environment preset="sunset" />
      
      {/* 🎯 固定座標軸 - 画面隅に常時表示 */}
      {showAxes && <FixedCoordinateAxes size={0.6} position="bottom-left" />}
    </>
  );
}

interface ModelViewerProps {
  width?: number;
  height?: number;
  poseData?: PoseLandmarkerResult | null;
  showAxes?: boolean;
}

export default function ModelViewer({ width = 560, height = 420, poseData, showAxes }: ModelViewerProps) {
  return (
    <Box sx={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ 
          position: [5, 3, 5], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        style={{ background: '#f5f5f5' }}
        shadows
      >
        <Scene poseData={poseData} showAxes={showAxes} />
      </Canvas>
    </Box>
  );
} 