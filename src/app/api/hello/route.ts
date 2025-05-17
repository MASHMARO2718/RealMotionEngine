// src/app/api/hello/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const message = "Hello from Motrix backend!";
  return NextResponse.json({ message });
}
