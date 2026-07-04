import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ethers } from 'ethers';

export async function GET() {
  const checks: Record<string, any> = {};
  let overallStatus = 'healthy';
  let criticalFailure = false;

  // 1. MongoDB Check
  try {
    await connectDB();
    const mongoState = mongoose.connection.readyState;

    if (mongoState === 1) {
      const start = Date.now();
      await mongoose.connection.db?.admin().ping();
      checks.mongodb = {
        status: 'up',
        latency: Date.now() - start,
        state: 'connected'
      };
    } else {
      const states: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      checks.mongodb = { status: 'down', state: states[mongoState] || 'unknown' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.mongodb = { status: 'down', error: err instanceof Error ? err.message : 'Unknown error' };
    criticalFailure = true;
  }

  // 2. RPC Check
  try {
    const rpcUrl = process.env.HTTP_RPC_URL || process.env.RPC_URL;
    if (rpcUrl) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const start = Date.now();
      const blockNumber = await provider.getBlockNumber();
      checks.rpc = {
        status: 'up',
        latency: Date.now() - start,
        blockNumber
      };
    } else {
      checks.rpc = { status: 'down', error: 'RPC_URL not configured' };
      criticalFailure = true;
    }
  } catch (err) {
    checks.rpc = { status: 'down', error: err instanceof Error ? err.message : 'Unknown error' };
    criticalFailure = true;
  }

  if (criticalFailure) overallStatus = 'unhealthy';
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json({
    success: overallStatus !== 'unhealthy',
    status: overallStatus,
    service: 'flip',
    timestamp: new Date().toISOString(),
    checks
  }, { status: statusCode });
}
