const BATCH_API_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/nft/monaliens/batch` : "https://your-api-url/api/nft/monaliens/batch";
const BATCH_TIMEOUT = 10000; // 10 seconds
const MAX_BATCH_SIZE = 100;

/**
 * Convert IPFS URI to HTTP gateway URL
 */
const convertIPFStoHTTP = (uri) => {
  if (!uri) return '';
  if (uri.startsWith('http')) return uri;
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  }
  return uri;
};

/**
 * Fetch with timeout helper
 */
const fetchWithTimeout = async (url, options = {}, timeout = BATCH_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

/**
 * Fetch metadata for multiple NFTs in a single batch request
 * @param {number[]} tokenIds - Array of token IDs to fetch
 * @returns {Promise<Array>} Array of metadata objects
 */
export const fetchBatchNFTMetadata = async (tokenIds) => {
  if (!tokenIds || tokenIds.length === 0) {
    return [];
  }

  // Convert all tokenIds to numbers
  const numericTokenIds = tokenIds.map(id => Number(id));

  try {
    // If more than MAX_BATCH_SIZE, split into chunks
    if (numericTokenIds.length > MAX_BATCH_SIZE) {
      const chunks = [];
      for (let i = 0; i < numericTokenIds.length; i += MAX_BATCH_SIZE) {
        chunks.push(numericTokenIds.slice(i, i + MAX_BATCH_SIZE));
      }

      // Fetch all chunks in parallel
      const chunkResults = await Promise.all(
        chunks.map(chunk => fetchBatchNFTMetadata(chunk))
      );

      // Flatten results
      return chunkResults.flat();
    }

    const response = await fetchWithTimeout(
      BATCH_API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenIds: numericTokenIds }),
      },
      BATCH_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`Batch API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data && result.data.metadata) {
      // Format metadata to match existing structure
      return result.data.metadata.map((nft) => ({
        tokenId: nft.tokenId,
        name: nft.name || `Monaliens #${nft.tokenId}`,
        image: nft.image || '', // Already HTTP URL from API
        ipfsImage: nft.ipfsImage || '',
        attributes: nft.attributes || [],
        description: nft.description || '',
        collection: 'Monaliens',
        contractAddress: process.env.REACT_APP_MONALIENS_NFT_ADDRESS,
      }));
    }

    // Fallback: return empty metadata for each tokenId
    console.warn('Batch API returned unexpected format:', result);
    return numericTokenIds.map(tokenId => ({
      tokenId,
      name: `Monaliens #${tokenId}`,
      image: '',
      attributes: [],
      description: '',
      collection: 'Monaliens',
      contractAddress: process.env.REACT_APP_MONALIENS_NFT_ADDRESS,
    }));
  } catch (error) {
    console.error('Error fetching batch NFT metadata:', error);
    // Return fallback metadata for each tokenId on error
    return numericTokenIds.map(tokenId => ({
      tokenId,
      name: `Monaliens #${tokenId}`,
      image: '',
      attributes: [],
      description: '',
      collection: 'Monaliens',
      contractAddress: process.env.REACT_APP_MONALIENS_NFT_ADDRESS,
    }));
  }
};

export const fetchUserNFTs = async (userAddress) => {
  try {
    // Use the collections endpoint for Monaliens
    const contractAddress = process.env.REACT_APP_MONALIENS_NFT_ADDRESS;
    const response = await fetch(
      `${process.env.API_URL || "https://your-api-url"}/api/nft/users/${userAddress}/collections/${contractAddress}/nfts`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch NFTs: ${response.status}`);
    }

    const result = await response.json();

    // Handle the API response format: { success: true, data: { nfts: [...] } }
    if (result && result.success && result.data && result.data.nfts) {
      return result.data.nfts.map((nft) => {
        const metadata = nft.metadata || {};
        const imageUri = nft.image || metadata.image || "";
        const imageUrl = convertIPFStoHTTP(imageUri);

        return {
          tokenId: parseInt(nft.token_id),
          name: metadata.name || `Monaliens #${nft.token_id}`,
          image: imageUrl,
          attributes: metadata.attributes || [],
          contractAddress: nft.token_address || process.env.REACT_APP_MONALIENS_NFT_ADDRESS,
          collection: "Monaliens",
          description: metadata.description || "",
        };
      });
    }

    return [];
  } catch (error) {
    console.error("Error fetching user NFTs:", error);
    throw error;
  }
};

export const fetchNFTMetadata = async (
  tokenId,
  contractAddress = process.env.REACT_APP_MONALIENS_NFT_ADDRESS,
) => {
  try {
    const response = await fetch(
      `${process.env.API_URL || "https://your-api-url"}/api/nft/${contractAddress}/${tokenId}/owner`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch NFT metadata: ${response.status}`);
    }

    const result = await response.json();

    if (result && result.success && result.data) {
      const data = result.data;
      let nftMetadata = data.metadata || {};

      // If metadata is missing but metadata_uri exists, fetch from IPFS
      if ((!nftMetadata || Object.keys(nftMetadata).length === 0) && data.metadata_uri) {
        try {
          const metadataUrl = convertIPFStoHTTP(data.metadata_uri);
          const metadataResponse = await fetch(metadataUrl);
          if (metadataResponse.ok) {
            nftMetadata = await metadataResponse.json();
            console.log(`✅ Fetched metadata from IPFS for token ${tokenId}`);
          }
        } catch (error) {
          console.warn(`Failed to fetch metadata from IPFS:`, error);
        }
      }

      // Extract collection name
      let collectionName = 'Unknown Collection';
      if (data.collection?.name) {
        collectionName = data.collection.name;
      } else if (nftMetadata.name && nftMetadata.name.includes('#')) {
        collectionName = nftMetadata.name.split('#')[0].trim();
      }

      // Convert image URI to HTTP
      const imageUri = data.image || nftMetadata.image || '';
      const imageUrl = convertIPFStoHTTP(imageUri);

      return {
        tokenId: parseInt(data.token_id || tokenId),
        name: nftMetadata.name || data.name || `NFT #${tokenId}`,
        image: imageUrl,
        attributes: nftMetadata.attributes || data.attributes || [],
        description: nftMetadata.description || data.description || "",
        owner: data.owner,
        collection: collectionName,
      };
    }

    // Fallback to old endpoint if new one fails
    return {
      tokenId: parseInt(tokenId),
      name: `NFT #${tokenId}`,
      image: "",
      attributes: [],
      description: "",
    };
  } catch (error) {
    console.error(`Error fetching metadata for token ${tokenId}:`, error);
    // Return a default metadata object if fetch fails
    return {
      tokenId: parseInt(tokenId),
      name: `NFT #${tokenId}`,
      image: "",
      attributes: [],
      description: "",
    };
  }
};
