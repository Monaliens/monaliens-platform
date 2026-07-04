import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { getHttpProvider } from '@/lib/contract';

dotenv.config();

const COINFLIP_ABI = [
  'function contractBalance() external view returns (uint256)',
  'function getStatistics() external view returns (uint256 gamesPlayed, uint256 wins, uint256 losses, uint256 payoutNative, uint256 payoutLMON, uint256 volumeNative, uint256 volumeLMON)',
];

export async function GET() {
  try {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONTRACT_ADDRESS not configured',
        },
        { status: 500 }
      );
    }

    // Use HTTP provider for API calls
    const provider = getHttpProvider();

    const contract = new ethers.Contract(contractAddress, COINFLIP_ABI, provider);

    // Fetch all data in parallel
    const [balanceNative, statistics] = await Promise.all([
      contract.contractBalance(),
      contract.getStatistics(),
    ]);

    // Format response
    const response = {
      success: true,
      gamesPlayed: Number(statistics.gamesPlayed),
      contractBalance: {
        native: {
          wei: balanceNative.toString(),
          ether: ethers.formatEther(balanceNative),
          symbol: 'MON',
        },
      },
      totalVolume: {
        native: {
          wei: statistics.volumeNative.toString(),
          ether: ethers.formatEther(statistics.volumeNative),
          symbol: 'MON',
        },
        lmon: {
          wei: statistics.volumeLMON.toString(),
          ether: ethers.formatEther(statistics.volumeLMON),
          symbol: 'LMON',
        },
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching contract stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contract statistics',
      },
      { status: 500 }
    );
  }
}

