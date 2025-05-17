import { NextResponse } from 'next/server';

// モーションデータの型定義
interface MotionData {
  timestamp: number;
  joints: {
    [key: string]: {
      x: number;
      y: number;
      z: number;
    };
  };
}

// 最新のモーションデータを保持
let latestMotionData: MotionData | null = null;

// POST: モーションデータの受信
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // データの検証
    if (!data.timestamp || !data.joints) {
      return NextResponse.json(
        { error: 'Invalid motion data format' },
        { status: 400 }
      );
    }

    // データの更新
    latestMotionData = data;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing motion data:', error);
    return NextResponse.json(
      { error: 'Failed to process motion data' },
      { status: 500 }
    );
  }
}

// GET: 最新のモーションデータの取得
export async function GET() {
  if (!latestMotionData) {
    return NextResponse.json(
      { error: 'No motion data available' },
      { status: 404 }
    );
  }

  return NextResponse.json(latestMotionData);
} 