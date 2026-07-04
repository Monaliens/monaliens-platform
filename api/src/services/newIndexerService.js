const axios = require("axios");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { ethers } = require("ethers");

const redisService = require("./redisService");

const INDEXER_BASE_URL = process.env.INDEXER_BASE_URL || "http://localhost:7777";
const RPC_URL = process.env.RPC_URL || "http://localhost:8080";
const MONALIENS_ADDRESS = "0x7cc9ebaabd29cd36c1b2c0765307df6374016e78";
const MONALIENS_METADATA_BUCKET =
  process.env.R2_METADATA_BUCKET_NAME || "nft-metadata";
const NFT_OWNER_CACHE_TTL = 300;
const API_BASE_URL =
  process.env.API_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? process.env.API_URL || "https://your-api-url"
    : process.env.NODE_ENV === "staging"
      ? process.env.DEV_API_URL || "https://dev.your-api-url"
      : `http://localhost:${process.env.PORT || 3001}`);

const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

let monaliensMetadataClient = null;

function getMonaliensMetadataClient() {
  if (!monaliensMetadataClient && process.env.R2_ACCOUNT_ID) {
    monaliensMetadataClient = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return monaliensMetadataClient;
}

async function streamToJson(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

class NewIndexerService {
  constructor() {
    this.baseUrl = INDEXER_BASE_URL;
    this.defaultTimeout = 15000;
    this.rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }

  getERC721Contract(contractAddress) {
    return new ethers.Contract(contractAddress, ERC721_ABI, this.rpcProvider);
  }

  buildMonaliensImageUrl(tokenId) {
    return `${API_BASE_URL}/api/image/monaliens/${tokenId}`;
  }

  async fetchMetadataFromURI(uri) {
    if (!uri) return null;

    try {
      if (uri.startsWith("data:application/json;base64,")) {
        const base64Data = uri.replace("data:application/json;base64,", "");
        const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
        return JSON.parse(jsonString);
      }

      const ipfsGateways = [
        "https://ipfs.io/ipfs/",
        "https://ipfs-proxy.magiceden.dev/ipfs/",
      ];

      if (uri.startsWith("ipfs://")) {
        const ipfsHash = uri.replace("ipfs://", "");

        for (const gateway of ipfsGateways) {
          try {
            const response = await axios.get(`${gateway}${ipfsHash}`, {
              timeout: 5000,
              headers: { Accept: "application/json" },
            });
            return response.data;
          } catch (err) {
            // Try next gateway.
          }
        }

        return null;
      }

      const response = await axios.get(uri, {
        timeout: 10000,
        headers: { Accept: "application/json" },
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to fetch metadata from ${uri}:`, error.message);
      return null;
    }
  }

  async getTokenURI(contractAddress, tokenId) {
    try {
      const contract = this.getERC721Contract(contractAddress);
      return await contract.tokenURI(tokenId);
    } catch (error) {
      console.error(
        `Failed to get tokenURI for ${contractAddress}/${tokenId}:`,
        error.message,
      );
      return null;
    }
  }

  async getTokenOwner(contractAddress, tokenId) {
    try {
      const contract = this.getERC721Contract(contractAddress);
      const owner = await contract.ownerOf(tokenId);
      return owner.toLowerCase();
    } catch (error) {
      console.error(
        `Failed to get ownerOf for ${contractAddress}/${tokenId}:`,
        error.message,
      );
      return null;
    }
  }

  async getTokenBalance(contractAddress, ownerAddress) {
    try {
      const contract = this.getERC721Contract(contractAddress);
      const balance = await contract.balanceOf(ownerAddress);
      return Number(balance.toString());
    } catch (error) {
      console.error(
        `Failed to get balanceOf for ${contractAddress}/${ownerAddress}:`,
        error.message,
      );
      return null;
    }
  }

  async getCollectionName(contractAddress) {
    const normalizedAddress = contractAddress.toLowerCase();

    if (normalizedAddress === MONALIENS_ADDRESS) {
      return "Monaliens";
    }

    try {
      const contract = this.getERC721Contract(contractAddress);
      return await contract.name();
    } catch (error) {
      console.error(
        `Failed to get collection name for ${contractAddress}:`,
        error.message,
      );
      return normalizedAddress;
    }
  }

  async getUserNFTs(address) {
    try {
      const normalizedAddress = address.toLowerCase();
      const cacheKey = redisService.createKey(
        `indexer:user:nfts:${normalizedAddress}`,
      );

      const cachedData = await redisService.get(cacheKey);
      if (cachedData) {
        return {
          success: true,
          data: JSON.parse(cachedData),
          cached: true,
        };
      }

      const response = await axios.get(
        `${this.baseUrl}/api/users/${address}/nfts`,
        { timeout: this.defaultTimeout },
      );

      const responseData = {
        address: response.data.address,
        nfts: response.data.nfts || [],
        count: (response.data.nfts || []).length,
      };

      await redisService.setex(cacheKey, 300, JSON.stringify(responseData));

      return {
        success: true,
        data: responseData,
        cached: false,
      };
    } catch (error) {
      console.error(" [NewIndexer] Error fetching user NFTs:", error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }

  async getMonaliensMetadata(tokenId) {
    if (!tokenId) return null;

    const cachedMetadata = await redisService.getNFTMetadata(
      MONALIENS_ADDRESS,
      tokenId,
    );
    if (cachedMetadata) {
      return cachedMetadata;
    }

    const metadataClient = getMonaliensMetadataClient();
    if (!metadataClient) {
      return null;
    }

    try {
      const response = await metadataClient.send(
        new GetObjectCommand({
          Bucket: MONALIENS_METADATA_BUCKET,
          Key: `monaliens/${tokenId}.json`,
        }),
      );

      const metadata = await streamToJson(response.Body);
      await redisService.setNFTMetadata(MONALIENS_ADDRESS, tokenId, metadata);
      return metadata;
    } catch (error) {
      if (
        error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }

      console.error(
        ` [NewIndexer] Error fetching Monaliens metadata for ${tokenId}:`,
        error.message,
      );
      return null;
    }
  }

  async getTokenMetadata(contractAddress, tokenId, metadataUri = null) {
    const normalizedAddress = contractAddress.toLowerCase();

    if (normalizedAddress === MONALIENS_ADDRESS) {
      const monaliensMetadata = await this.getMonaliensMetadata(tokenId);
      if (monaliensMetadata) {
        return monaliensMetadata;
      }
    }

    const cachedMetadata = await redisService.getNFTMetadata(
      normalizedAddress,
      tokenId,
    );
    if (cachedMetadata) {
      return cachedMetadata;
    }

    if (!metadataUri) {
      return null;
    }

    const metadata = await this.fetchMetadataFromURI(metadataUri);
    if (metadata) {
      await redisService.setNFTMetadata(normalizedAddress, tokenId, metadata);
    }

    return metadata;
  }

  async hydrateMonaliensNFTs(nfts = []) {
    return Promise.all(
      nfts.map(async (nft) => {
        const tokenId = nft.token_id || nft.tokenId;
        if (!tokenId) {
          return nft;
        }

        const metadata = await this.getMonaliensMetadata(tokenId);

        return {
          ...nft,
          name: nft.name || metadata?.name || `Monalien #${tokenId}`,
          image: this.buildMonaliensImageUrl(tokenId),
          metadata: metadata || nft.metadata || null,
        };
      }),
    );
  }

  async getNFTByContractAndTokenId(contractAddress, tokenId) {
    const normalizedAddress = contractAddress.toLowerCase();
    const normalizedTokenId = String(tokenId);
    const cacheKey = redisService.createKey(
      `nft:owner:v1:${normalizedAddress}:${normalizedTokenId}`,
    );

    const cachedData = await redisService.get(cacheKey);
    if (cachedData) {
      return {
        success: true,
        data: JSON.parse(cachedData),
        cached: true,
      };
    }

    const [owner, metadataUri, collectionName] = await Promise.all([
      this.getTokenOwner(normalizedAddress, normalizedTokenId),
      this.getTokenURI(normalizedAddress, normalizedTokenId),
      this.getCollectionName(normalizedAddress),
    ]);

    const metadata = await this.getTokenMetadata(
      normalizedAddress,
      normalizedTokenId,
      metadataUri,
    );

    if (!owner && !metadataUri && !metadata) {
      return {
        success: false,
        notFound: true,
        error: "NFT not found",
      };
    }

    const data = {
      token_id: normalizedTokenId,
      metadata: metadata || null,
      image:
        normalizedAddress === MONALIENS_ADDRESS
          ? this.buildMonaliensImageUrl(normalizedTokenId)
          : metadata?.image || null,
      metadata_uri: metadataUri || null,
      owner,
      collection: {
        name: collectionName || normalizedAddress,
      },
    };

    await redisService.setex(cacheKey, NFT_OWNER_CACHE_TTL, JSON.stringify(data));

    return {
      success: true,
      data,
      cached: false,
    };
  }

  async getUserCollectionNFTs(address, collectionAddress) {
    try {
      const normalizedAddress = address.toLowerCase();
      const normalizedCollection = collectionAddress.toLowerCase();
      const cacheKey = redisService.createKey(
        `indexer:user:collection:nfts:v3:${normalizedAddress}:${normalizedCollection}`,
      );

      const cachedData = await redisService.get(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        return {
          success: true,
          data: parsedData,
          cached: true,
        };
      }

      const response = await axios.get(
        `${this.baseUrl}/api/users/${address}/collections/${collectionAddress}/nfts`,
        { timeout: this.defaultTimeout },
      );

      const rawNFTs = response.data.nfts || [];
      const nfts =
        normalizedCollection === MONALIENS_ADDRESS
          ? await this.hydrateMonaliensNFTs(rawNFTs)
          : rawNFTs;

      let count = Number(response.data.count ?? rawNFTs.length);
      let countSource = "indexer";

      // The local indexer can lag Hasura transfers. For Monaliens role checks, use
      // on-chain balanceOf as the authoritative count fallback while keeping the
      // indexer NFT list when available.
      if (normalizedCollection === MONALIENS_ADDRESS) {
        const onchainCount = await this.getTokenBalance(
          normalizedCollection,
          normalizedAddress,
        );
        if (onchainCount !== null && onchainCount !== count) {
          console.warn(
            `[NewIndexer] Monaliens count mismatch for ${normalizedAddress}: indexer=${count}, onchain=${onchainCount}`,
          );
          count = onchainCount;
          countSource = "onchain-balanceOf";
        }
      }

      const responseData = {
        address: response.data.address || normalizedAddress,
        collection_address:
          response.data.collection_address || normalizedCollection,
        nfts,
        count,
        countSource,
      };

      await redisService.setex(cacheKey, 300, JSON.stringify(responseData));

      return {
        success: true,
        data: responseData,
        cached: false,
      };
    } catch (error) {
      console.error(
        " [NewIndexer] Error fetching user collection NFTs:",
        error.message,
      );
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  }
}

module.exports = new NewIndexerService();
