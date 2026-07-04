import { RAFFLE_API_BASE_URL, CONFIG, API_ENDPOINTS } from './constants';

// API Client with timeout and retry logic
class ApiClient {
  constructor(baseURL = RAFFLE_API_BASE_URL) {
    this.baseURL = baseURL;
    this.timeout = CONFIG.DEFAULT_TIMEOUT;
    this.cache = new Map();
  }

  // Helper method for making requests with timeout
  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // GET request with caching
  async get(endpoint, useCache = true) {
    
    if (useCache && this.cache.has(endpoint)) {
      const cached = this.cache.get(endpoint);
      if (Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const response = await this.makeRequest(endpoint);
      const data = await response.json();


      if (useCache) {
        this.cache.set(endpoint, {
          data,
          timestamp: Date.now()
        });
      }

      return data;
    } catch (error) {
      console.error(`GET ${endpoint} error:`, error);
      throw error;
    }
  }

  // POST request
  async post(endpoint, data) {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      // Clear related cache entries after successful POST
      this.clearRelatedCache(endpoint);
      
      return result;
    } catch (error) {
      console.error(`POST ${endpoint} error:`, error);
      throw error;
    }
  }

  // PUT request
  async put(endpoint, data) {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      // Clear related cache entries after successful PUT
      this.clearRelatedCache(endpoint);
      
      return result;
    } catch (error) {
      console.error(`PUT ${endpoint} error:`, error);
      throw error;
    }
  }

  // DELETE request
  async delete(endpoint) {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      // Clear related cache entries after successful DELETE
      this.clearRelatedCache(endpoint);
      
      return result;
    } catch (error) {
      console.error(`DELETE ${endpoint} error:`, error);
      throw error;
    }
  }

  // Clear cache for related endpoints
  clearRelatedCache(endpoint) {
    // Clear cache entries that might be affected by this operation
    const keysToDelete = [];
    
    this.cache.forEach((_, key) => {
      if (key.includes('/raffles') || key.includes('/users')) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Clear all cache
  clearCache() {
    this.cache.clear();
  }
}

// Create API client instance
const apiClient = new ApiClient();

// Make apiClient globally accessible for debugging and cache management
if (typeof window !== 'undefined') {
  window.apiClient = apiClient;
}

// ================== RAFFLE API FUNCTIONS ==================

/**
 * Get all raffles with optional filters
 */
export const getRaffles = async (filters = {}, useCache = false) => {
  // Remove pagination parameters as API doesn't support them
  const { page, limit, ...supportedFilters } = filters;
  
  const params = new URLSearchParams();
  
  Object.entries(supportedFilters).forEach(([key, value]) => {
    if (value && value !== '') {
      params.append(key, value);
    }
  });

  const endpoint = `${API_ENDPOINTS.RAFFLES}${params.toString() ? `?${params}` : ''}`;

  
  return await apiClient.get(endpoint, useCache);
};

/**
 * Get active raffles only
 */
export const getActiveRaffles = async () => {
  return await apiClient.get(API_ENDPOINTS.RAFFLES_ACTIVE);
};

/**
 * Get ended raffles only
 */
export const getEndedRaffles = async () => {
  return await apiClient.get(API_ENDPOINTS.RAFFLES_ENDED);
};

/**
 * Get raffle by ID
 */
export const getRaffleById = async (raffleId) => {
  return await apiClient.get(API_ENDPOINTS.RAFFLE_DETAILS(raffleId));
};

/**
 * Get raffle statistics
 */
export const getRaffleStats = async (raffleId) => {
  return await apiClient.get(API_ENDPOINTS.RAFFLE_STATS(raffleId));
};

/**
 * Get raffle participants
 */
export const getRaffleParticipants = async (raffleId) => {
  return await apiClient.get(API_ENDPOINTS.RAFFLE_PARTICIPANTS(raffleId));
};

/**
 * Create new raffle
 */
export const createRaffle = async (raffleData) => {
  return await apiClient.post(API_ENDPOINTS.RAFFLES, raffleData);
};

/**
 * Update raffle
 */
export const updateRaffle = async (raffleId, raffleData) => {
  return await apiClient.put(API_ENDPOINTS.RAFFLE_DETAILS(raffleId), raffleData);
};

/**
 * Delete raffle
 */
export const deleteRaffle = async (raffleId) => {
  return await apiClient.delete(API_ENDPOINTS.RAFFLE_DETAILS(raffleId));
};

/**
 * Participate in raffle
 */
export const participateInRaffle = async (raffleId, participationData) => {
  return await apiClient.post(`${API_ENDPOINTS.RAFFLE_DETAILS(raffleId)}/participate`, participationData);
};

/**
 * Get raffles by user address
 */
export const getUserRaffles = async (address) => {
  return await apiClient.get(API_ENDPOINTS.RAFFLES_USER(address));
};

/**
 * Get platform stats
 */
export const getPlatformStats = async () => {
  return await apiClient.get(API_ENDPOINTS.RAFFLES_STATS);
};

// ================== USER API FUNCTIONS ==================

/**
 * Get user profile
 */
export const getUserProfile = async (address) => {
  return await apiClient.get(API_ENDPOINTS.USER_PROFILE(address));
};

/**
 * Update user profile
 */
export const updateUserProfile = async (address, profileData) => {
  return await apiClient.put(API_ENDPOINTS.USER_PROFILE(address), profileData);
};

/**
 * Get user tickets
 */
export const getUserTickets = async (address) => {
  return await apiClient.get(API_ENDPOINTS.USER_TICKETS(address));
};

/**
 * Get user wins
 */
export const getUserWins = async (address) => {
  return await apiClient.get(API_ENDPOINTS.USER_WINS(address));
};

/**
 * Get user stats
 */
export const getUserStats = async (address) => {
  return await apiClient.get(API_ENDPOINTS.USER_STATS(address));
};

/**
 * Get leaderboard
 */
export const getLeaderboard = async () => {
  return await apiClient.get(API_ENDPOINTS.LEADERBOARD);
};

// ================== STAKING API FUNCTIONS ==================

/**
 * Get staking pools
 */
export const getStakingPools = async () => {
  return await apiClient.get(API_ENDPOINTS.STAKING_POOLS);
};

/**
 * Get active staking pools
 */
export const getActiveStakingPools = async () => {
  return await apiClient.get(API_ENDPOINTS.STAKING_POOLS_ACTIVE);
};

/**
 * Get staking pool details
 */
export const getStakingPoolDetails = async (poolId) => {
  return await apiClient.get(API_ENDPOINTS.STAKING_POOL_DETAILS(poolId));
};

/**
 * Get user staking info
 */
export const getUserStaking = async (address) => {
  return await apiClient.get(API_ENDPOINTS.STAKING_USER(address));
};

/**
 * Get user staking history
 */
export const getUserStakingHistory = async (address) => {
  return await apiClient.get(API_ENDPOINTS.STAKING_USER_HISTORY(address));
};

/**
 * Get staking leaderboard
 */
export const getStakingLeaderboard = async () => {
  return await apiClient.get(API_ENDPOINTS.STAKING_LEADERBOARD);
};

/**
 * Get staking stats
 */
export const getStakingStats = async () => {
  return await apiClient.get(API_ENDPOINTS.STAKING_STATS);
};

// ================== REFERRAL API FUNCTIONS ==================

/**
 * Get user referral info
 */
export const getUserReferral = async (address) => {
  return await apiClient.get(API_ENDPOINTS.REFERRAL_USER(address));
};

/**
 * Get user referral history
 */
export const getUserReferralHistory = async (address) => {
  return await apiClient.get(API_ENDPOINTS.REFERRAL_USER_HISTORY(address));
};

/**
 * Get referral leaderboard
 */
export const getReferralLeaderboard = async () => {
  return await apiClient.get(API_ENDPOINTS.REFERRAL_LEADERBOARD);
};

/**
 * Get referral stats
 */
export const getReferralStats = async () => {
  return await apiClient.get(API_ENDPOINTS.REFERRAL_STATS);
};

/**
 * Get referral tiers
 */
export const getReferralTiers = async () => {
  return await apiClient.get(API_ENDPOINTS.REFERRAL_TIERS);
};

// ================== UTILITY FUNCTIONS ==================

/**
 * Check system health
 */
export const checkHealth = async () => {
  return await apiClient.get(API_ENDPOINTS.HEALTH);
};

/**
 * Get platform fees
 */
export const getPlatformFees = async () => {
  return await apiClient.get(API_ENDPOINTS.PLATFORM_FEES);
};

/**
 * Get event listener status
 */
export const getEventListenerStatus = async () => {
  return await apiClient.get(API_ENDPOINTS.EVENT_LISTENER_STATUS);
};

/**
 * Restart event listener
 */
export const restartEventListener = async () => {
  return await apiClient.post(API_ENDPOINTS.EVENT_LISTENER_RESTART);
};

// ================== ERROR HANDLING ==================

/**
 * Handle API errors with user-friendly messages
 */
export const handleApiError = (error) => {
  console.error('API Error:', error);
  
  if (error.message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  if (error.message.includes('Network')) {
    return 'Network error. Please check your connection.';
  }
  
  if (error.message.includes('404')) {
    return 'Resource not found.';
  }
  
  if (error.message.includes('500')) {
    return 'Server error. Please try again later.';
  }
  
  return 'An error occurred. Please try again.';
};

// ================== EXPORT API CLIENT ==================

export { apiClient };
export default apiClient; 