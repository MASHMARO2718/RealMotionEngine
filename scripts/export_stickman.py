#!/usr/bin/env python3
"""
Blender stickman.blend to GLB exporter script
Usage: blender --background --python export_stickman.py
"""

import bpy
import os
import sys

def export_stickman_to_glb():
    """stickman.blendをGLB形式でエクスポート"""
    
    # プロジェクトのパス設定
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    blend_file = os.path.join(project_root, "blender", "models", "stickman.blend")
    output_file = os.path.join(project_root, "public", "models", "stickman.glb")
    
    print(f"🚀 Blenderファイルを読み込み中: {blend_file}")
    print(f"📤 エクスポート先: {output_file}")
    
    # 既存のデータをクリア
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Blenderファイルを開く
    if not os.path.exists(blend_file):
        print(f"❌ エラー: Blenderファイルが見つかりません: {blend_file}")
        sys.exit(1)
    
    try:
        bpy.ops.wm.open_mainfile(filepath=blend_file)
        print("✅ Blenderファイルを正常に読み込みました")
    except Exception as e:
        print(f"❌ エラー: Blenderファイルの読み込みに失敗: {e}")
        sys.exit(1)
    
    # 出力ディレクトリを作成
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # すべてのオブジェクトを選択
    bpy.ops.object.select_all(action='SELECT')
    
    # GLBエクスポート設定
    export_settings = {
        'filepath': output_file,
        'export_format': 'GLB',  # GLBバイナリ形式
        'export_selected': False,  # 全オブジェクトをエクスポート
        'export_apply': True,  # モディファイアを適用
        'export_yup': True,  # Y-up座標系
        'export_animations': True,  # アニメーションを含める
        'export_morph': True,  # モーフターゲットを含める
        'export_lights': True,  # ライトを含める
        'export_cameras': False,  # カメラは除外
        'export_materials': 'EXPORT',  # マテリアルをエクスポート
        'export_colors': True,  # 頂点カラーを含める
        'export_normals': True,  # 法線を含める
        'export_tangents': False,  # タンジェントは除外
        'export_texcoords': True,  # UV座標を含める
        'export_draco_mesh_compression_enable': False,  # Draco圧縮は無効
        'export_draco_mesh_compression_level': 6,
        'export_draco_position_quantization': 14,
        'export_draco_normal_quantization': 10,
        'export_draco_texcoord_quantization': 12,
        'export_draco_color_quantization': 10,
        'export_draco_generic_quantization': 12,
    }
    
    try:
        # GLBエクスポート実行
        bpy.ops.export_scene.gltf(**export_settings)
        print(f"✅ GLBエクスポート完了: {output_file}")
        
        # ファイルサイズを確認
        if os.path.exists(output_file):
            file_size = os.path.getsize(output_file)
            print(f"📊 ファイルサイズ: {file_size / 1024:.1f} KB")
        
        return True
        
    except Exception as e:
        print(f"❌ エラー: GLBエクスポートに失敗: {e}")
        return False

def main():
    """メイン関数"""
    print("=" * 60)
    print("🎯 Stickman Blender → GLB エクスポートツール")
    print("=" * 60)
    
    success = export_stickman_to_glb()
    
    if success:
        print("\n🎉 エクスポート成功！")
        print("次のステップ:")
        print("1. public/models/stickman.glb が作成されました")
        print("2. ModelViewer.tsx でモデルパスを更新してください")
        print("3. MediaPipe連携をテストしてください")
    else:
        print("\n💥 エクスポート失敗")
        sys.exit(1)

if __name__ == "__main__":
    main() 