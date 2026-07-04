import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Flip from '@/models/Flip';

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  try {
    await connectDB();

    const address = params.address.toLowerCase();

    // Validate address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid address format',
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const flips = await Flip.find({ player: address })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
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
      completed: flip.completed,
    }));

    return NextResponse.json({
      success: true,
      address,
      count: formattedFlips.length,
      data: formattedFlips,
    });
  } catch (error: any) {
    console.error('Error fetching user flips:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch user flips',
      },
      { status: 500 }
    );
  }
}





















