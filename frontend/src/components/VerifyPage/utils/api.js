// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/discord` : "https://your-api-url/api/discord";
const NFT_API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/nft` : "https://your-api-url/api/nft";
const COLLECTION_ADDRESS = process.env.REACT_APP_MONALIENS_NFT_ADDRESS;

export const API_ENDPOINTS = {
  verify: `${API_BASE_URL}/verify`,
  wallets: `${API_BASE_URL}/wallets`,
  solanaWallets: `${API_BASE_URL}/solana-wallets`,
  walletNonce: `${API_BASE_URL}/wallet-nonce`,
  nfts: (userAddress) => `${NFT_API_BASE_URL}/users/${userAddress}/collections/${COLLECTION_ADDRESS}/nfts`,
  // Referral endpoints
  referralCode: (userId) => `${API_BASE_URL}/referral/code/${userId}`,
  referralCreateCustom: `${API_BASE_URL}/referral/create-custom`,
  referralApply: `${API_BASE_URL}/referral/apply`,
  referralStats: (userId) => `${API_BASE_URL}/referral/stats/${userId}`,
  referralUsage: (userId) => `${API_BASE_URL}/referral/usage/${userId}`,
  // Primary wallet endpoints
  primaryWallet: (userId) => `${API_BASE_URL}/primary-wallet/${userId}`,
  setPrimaryWallet: `${API_BASE_URL}/primary-wallet`,
};

// =====================================================
// Nonce & Signature Functions
// =====================================================

/**
 * Get a nonce for wallet signature verification
 * @param {string} userId - Discord user ID
 * @param {string} walletAddress - Wallet address (EVM or Solana)
 * @param {string} walletType - 'evm' or 'solana'
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with nonce string
 */
export const getWalletNonce = async (userId, walletAddress, walletType, discordToken) => {
  const response = await fetch(API_ENDPOINTS.walletNonce, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: discordToken,
    },
    body: JSON.stringify({
      userId,
      walletAddress,
      walletType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to get wallet nonce");
  }

  return response.json();
};

/**
 * Verify NFT ownership for a Discord user
 * @param {Object} userData - User data containing userName, userId, and walletAddress
 * @param {string} discordToken - Discord authorization token (Bearer token)
 * @returns {Promise<Object>} Verification response with roles
 */
export const verifyNFTOwnership = async (userData, discordToken) => {
  const response = await fetch(API_ENDPOINTS.verify, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": discordToken, // Discord Bearer token for security
    },
    body: JSON.stringify(userData),
  });

  if (response.status >= 500) {
    throw new Error("Server internal error");
  }

  if (response.status === 401) {
    throw new Error("Unauthorized - Discord token validation failed");
  }

  return response.json();
};

/**
 * Add a wallet to user's Discord account with signature verification
 * @param {string} userId - Discord user ID
 * @param {string} walletAddress - Wallet address to add
 * @param {string} signature - Wallet signature for verification
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with updated wallet list
 */
export const addWallet = async (userId, walletAddress, signature, discordToken) => {
  const response = await fetch(API_ENDPOINTS.wallets, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: discordToken,
    },
    body: JSON.stringify({
      userId,
      walletAddress,
      signature,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to add wallet");
  }

  return response.json();
};

/**
 * Get all wallets for a Discord user
 * @param {string} userId - Discord user ID
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with wallets array
 */
export const getUserWallets = async (userId, discordToken) => {
  const response = await fetch(`${API_ENDPOINTS.wallets}/${userId}`, {
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch wallets");
  }

  return response.json();
};

/**
 * Remove a wallet from user's Discord account
 * @param {string} userId - Discord user ID
 * @param {string} walletAddress - Wallet address to remove
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response confirmation
 */
export const removeWallet = async (userId, walletAddress, discordToken) => {
  const encodedAddress = encodeURIComponent(walletAddress);
  const response = await fetch(`${API_ENDPOINTS.wallets}/${userId}/${encodedAddress}`, {
    method: "DELETE",
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to remove wallet");
  }

  return response.json();
};

// =====================================================
// Solana Wallet API Functions
// =====================================================

/**
 * Add a Solana wallet to user's Discord account with signature verification
 * @param {string} userId - Discord user ID
 * @param {string} solanaAddress - Solana wallet address
 * @param {string} signature - Base58 encoded signature for verification
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with success status
 */
export const addSolanaWallet = async (userId, solanaAddress, signature, discordToken) => {
  const response = await fetch(API_ENDPOINTS.solanaWallets, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: discordToken,
    },
    body: JSON.stringify({
      userId,
      solanaAddress,
      signature,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to add Solana wallet");
  }

  return response.json();
};

/**
 * Get all Solana wallets for a Discord user
 * @param {string} userId - Discord user ID
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with wallets array
 */
export const getSolanaWallets = async (userId, discordToken) => {
  const response = await fetch(`${API_ENDPOINTS.solanaWallets}/${userId}`, {
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Solana wallets");
  }

  return response.json();
};

/**
 * Remove a Solana wallet from user's Discord account
 * @param {string} userId - Discord user ID
 * @param {string} solanaAddress - Solana wallet address to remove
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response confirmation
 */
export const removeSolanaWallet = async (userId, solanaAddress, discordToken) => {
  const encodedAddress = encodeURIComponent(solanaAddress);
  const response = await fetch(`${API_ENDPOINTS.solanaWallets}/${userId}/${encodedAddress}`, {
    method: "DELETE",
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to remove Solana wallet");
  }

  return response.json();
};

// =====================================================
// Discord API Functions
// =====================================================

/**
 * Fetch Discord user information
 * @param {string} accessToken - Discord access token
 * @param {string} tokenType - Token type (usually "Bearer")
 * @returns {Promise<Object>} Discord user object
 */
export const fetchDiscordUser = async (accessToken, tokenType) => {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      authorization: `${tokenType} ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Discord user");
  }

  return response.json();
};

/**
 * Fetch NFTs for a wallet address
 * @param {string} walletAddress - Wallet address to fetch NFTs for
 * @returns {Promise<Array>} Array of NFT objects with image and name
 */
export const fetchWalletNFTs = async (walletAddress) => {
  const response = await fetch(API_ENDPOINTS.nfts(walletAddress));

  if (!response.ok) {
    throw new Error("Failed to fetch NFTs");
  }

  const result = await response.json();
  return result.data?.nfts || [];
};

// =====================================================
// Referral API Functions
// =====================================================

/**
 * Get user's referral code (creates one if doesn't exist)
 * @param {string} userId - Discord user ID
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with referralCode and isCustom
 */
export const getReferralCode = async (userId, discordToken) => {
  const response = await fetch(API_ENDPOINTS.referralCode(userId), {
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to get referral code");
  }

  return response.json();
};

/**
 * Create a custom referral code
 * @param {string} userId - Discord user ID
 * @param {string} customCode - Desired custom code (3-20 chars, alphanumeric + -/_)
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with referralCode and isCustom
 */
export const createCustomReferralCode = async (userId, customCode, discordToken) => {
  const response = await fetch(API_ENDPOINTS.referralCreateCustom, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: discordToken,
    },
    body: JSON.stringify({
      userId,
      customCode,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to create custom code");
  }

  return data;
};

/**
 * Apply someone else's referral code
 * @param {string} userId - Discord user ID (the one applying the code)
 * @param {string} referralCode - The referral code to apply
 * @param {Object} discordUser - Discord user object with username, global_name, avatar
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with success status
 */
export const applyReferralCode = async (userId, referralCode, discordUser, discordToken) => {
  // Build avatar URL if avatar exists
  const avatarUrl = discordUser?.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${discordUser.avatar}.png`
    : null;

  const response = await fetch(API_ENDPOINTS.referralApply, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: discordToken,
    },
    body: JSON.stringify({
      userId,
      referralCode,
      username: discordUser?.username || null,
      globalName: discordUser?.global_name || null,
      avatarUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to apply referral code");
  }

  return data;
};

/**
 * Get referral statistics for a user
 * @param {string} userId - Discord user ID
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with stats and referral list
 */
export const getReferralStats = async (userId, discordToken) => {
  const response = await fetch(API_ENDPOINTS.referralStats(userId), {
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to get referral stats");
  }

  return response.json();
};

/**
 * Check if user has already used a referral code
 * @param {string} userId - Discord user ID
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with hasUsedReferral, usedCode, usedAt
 */
export const getReferralUsage = async (userId, discordToken) => {
  const response = await fetch(API_ENDPOINTS.referralUsage(userId), {
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to get referral usage");
  }

  return response.json();
};

// =====================================================
// Primary Wallet API Functions
// =====================================================

/**
 * Get user's primary wallet
 * @param {string} userId - Discord user ID
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with primaryWallet and wallets array
 */
export const getPrimaryWallet = async (userId, discordToken) => {
  const response = await fetch(API_ENDPOINTS.primaryWallet(userId), {
    headers: {
      Authorization: discordToken,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to get primary wallet");
  }

  return response.json();
};

/**
 * Set user's primary wallet for receiving rewards
 * @param {string} userId - Discord user ID
 * @param {string} walletAddress - Wallet address to set as primary
 * @param {string} discordToken - Discord authorization token
 * @returns {Promise<Object>} Response with success status
 */
export const setPrimaryWallet = async (userId, walletAddress, discordToken) => {
  const response = await fetch(API_ENDPOINTS.setPrimaryWallet, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: discordToken,
    },
    body: JSON.stringify({
      userId,
      walletAddress,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to set primary wallet");
  }

  return data;
};

/**
 * Fetch staked NFTs for a wallet address
 * @param {string} walletAddress - Wallet address to fetch staked NFTs for
 * @returns {Promise<Array>} Array of staked NFT objects with image and name
 */
export const fetchStakedNFTs = async (walletAddress) => {
  const { getStakedNFTs } = await import("../../../utils/getStakedNFTsForWallet");

  try {
    const stakedNFTs = await getStakedNFTs(walletAddress);

    if (!stakedNFTs || stakedNFTs.length === 0) {
      return [];
    }

    // Fetch metadata for each staked NFT
    const nftsWithMetadata = await Promise.all(
      stakedNFTs.map(async (stakedNft) => {
        try {
          const ownerResponse = await fetch(
            `${NFT_API_BASE_URL}/${COLLECTION_ADDRESS}/${stakedNft.tokenId}/owner`
          );

          if (ownerResponse.ok) {
            const ownerResult = await ownerResponse.json();

            if (ownerResult.success && ownerResult.data) {
              const data = ownerResult.data;

              // If metadata is null or empty, fetch from metadata_uri
              let metadata = data.metadata;
              let imageUri = data.image;

              if ((!metadata || Object.keys(metadata).length === 0) && data.metadata_uri) {
                try {
                  // Convert IPFS URI to HTTP if needed
                  const metadataUrl = data.metadata_uri.startsWith('ipfs://')
                    ? `https://ipfs.io/ipfs/${data.metadata_uri.replace('ipfs://', '')}`
                    : data.metadata_uri;

                  const metadataResponse = await fetch(metadataUrl);
                  if (metadataResponse.ok) {
                    metadata = await metadataResponse.json();
                    imageUri = metadata.image;
                  }
                } catch (err) {
                  console.warn(`Failed to fetch metadata from URI for NFT ${stakedNft.tokenId}:`, err);
                }
              }

              // Fallback to metadata.image if data.image is null
              if (!imageUri && metadata?.image) {
                imageUri = metadata.image;
              }

              // Convert IPFS URI to HTTP
              const finalImage = imageUri?.startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${imageUri.replace('ipfs://', '')}`
                : imageUri || '';

              return {
                token_id: stakedNft.tokenId,
                metadata: {
                  name: metadata?.name || `Monaliens #${stakedNft.tokenId}`,
                  image: finalImage,
                },
                isStaked: true,
              };
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch metadata for staked NFT ${stakedNft.tokenId}:`, err);
        }
        return null;
      })
    );

    // Filter out null values
    return nftsWithMetadata.filter(nft => nft !== null);
  } catch (error) {
    console.error('Error fetching staked NFTs:', error);
    return [];
  }
};
