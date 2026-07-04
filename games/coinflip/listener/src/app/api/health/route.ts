import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    await connectDB();

    // Check MongoDB connection state
    const isConnected = mongoose.connection.readyState === 1;

    if (!isConnected) {
      throw new Error('MongoDB not connected');
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mongodb: 'connected'
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      mongodb: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
