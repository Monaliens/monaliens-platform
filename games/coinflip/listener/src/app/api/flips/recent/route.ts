import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Flip from '@/models/Flip';

export async function GET() {
  try {
    await connectDB();

    const flips = await Flip.find({ completed: true })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    const formattedFlips = flips.map((flip) => ({
      sequenceNumber: flip.sequenceNumber,
      player: flip.player,
      choice: flip.choice ? 'heads' : 'tails',
      result: flip.result !== undefined ? (flip.result ? 'heads' : 'tails') : null,
      winner: flip.winner,
      amount: flip.amount,
      isNative: flip.isNative,
      randomNumber: flip.randomNumber,
      blockNumber: flip.blockNumber,
      transactionHash: flip.transactionHash,
      resultTransactionHash: flip.resultTransactionHash,
      timestamp: flip.timestamp,
    }));

    return NextResponse.json({
      success: true,
      count: formattedFlips.length,
      data: formattedFlips,
    });
  } catch (error: any) {
    console.error('Error fetching recent flips:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch recent flips',
      },
      { status: 500 }
    );
  }
}





















