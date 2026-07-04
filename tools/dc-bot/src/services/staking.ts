import axios from "axios";

// Staking API response interface
interface StakingApiResponse {
  success: boolean;
  data: {
    success: boolean;
    stakers: Array<{
      address: string;
      tokenCount: number;
      tokens: string[];
      stakeDurations: number[];
    }>;
    totalStakers: number;
    totalStaked: number;
    stakingContract: string;
    cached: boolean;
  };
}

// Staking data service
class StakingService {
  private stakingData: Map<string, { tokenCount: number; tokens: string[] }> =
    new Map();
  private lastUpdate: Date = new Date();
  private readonly stakingApiUrl = process.env.STAKING_API_URL || "https://your-api-url/api/nft/stakers";

  constructor() {
    console.log(" Staking data enabled - using API endpoint");
    // Get initial snapshot
    this.updateSnapshot();


    setInterval(
      () => {
        this.updateSnapshot();
      },
      10 * 60 * 1000,
    );
  }

  async updateSnapshot(): Promise<void> {
    try {
      console.log(" Fetching staking snapshot from API...");


      const response = await axios.get<StakingApiResponse>(this.stakingApiUrl, {
        timeout: 180000, // 3 minutes timeout
      });

      console.log(` Staking API Response status: ${response.status}`);
      console.log(` Staking API success: ${response.data?.success}`);

      if (!response.data.success) {
        console.error(" Staking API returned success=false:", response.data);
        throw new Error("Failed to fetch stakers from API");
      }

      const stakers = response.data.data.stakers;
      console.log(` Staking API returned ${stakers.length} stakers`);

      // Eski listeyi temizle
      this.stakingData.clear();


      for (const staker of stakers) {
        if (staker.tokenCount > 0) {
          this.stakingData.set(staker.address.toLowerCase(), {
            tokenCount: staker.tokenCount,
            tokens: staker.tokens.map((t) => t.toString()),
          });
        }
      }

      this.lastUpdate = new Date();
      console.log(` Found ${this.stakingData.size} staking wallets from API`);
      console.log(` Total staked tokens: ${response.data.data.totalStaked}`);
    } catch (error: any) {
      console.error(" Error fetching staking snapshot from API:", error.message);
      console.error(" Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        code: error?.code,
        response: error?.response?.data,
        status: error?.response?.status,
      });
    }
  }

  // Get detailed staking data for merging with holders
  async getStakingTokenData(): Promise<{
    [address: string]: { tokenCount: number; tokens: string[] };
  }> {
    const result: {
      [address: string]: { tokenCount: number; tokens: string[] };
    } = {};

    for (const [address, data] of this.stakingData.entries()) {
      result[address] = { ...data };
    }

    return result;
  }

  getStats() {
    const totalTokensStaked = Array.from(this.stakingData.values()).reduce(
      (sum, data) => sum + data.tokenCount,
      0,
    );

    return {
      totalStakers: this.stakingData.size,
      totalTokensStaked,
      lastUpdate: this.lastUpdate,
    };
  }
}

export const stakingService = new StakingService();
