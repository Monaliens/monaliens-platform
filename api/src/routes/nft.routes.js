const express = require("express");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const newIndexerService = require("../services/newIndexerService");

const router = express.Router();

let r2MetadataClient = null;

function getR2MetadataClient() {
  if (!r2MetadataClient && process.env.R2_ACCOUNT_ID) {
    r2MetadataClient = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return r2MetadataClient;
}

router.get(
  "/users/:address/collections/:collectionAddress/nfts",
  async (req, res) => {
    try {
      const { address, collectionAddress } = req.params;

      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: "Invalid Ethereum address format",
        });
      }

      if (
        !collectionAddress ||
        !/^0x[a-fA-F0-9]{40}$/.test(collectionAddress)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid collection address format",
        });
      }

      const result = await newIndexerService.getUserCollectionNFTs(
        address,
        collectionAddress,
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || "Failed to fetch user collection NFTs",
        });
      }

      return res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Error fetching user collection NFTs:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch user collection NFTs",
        message: error.message,
      });
    }
  },
);

router.get("/users/:address/nfts", async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: "Invalid Ethereum address format",
      });
    }

    const result = await newIndexerService.getUserNFTs(address);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || "Failed to fetch user NFTs",
      });
    }

    return res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching user NFTs:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch user NFTs",
      message: error.message,
    });
  }
});

router.get("/:contractAddress/:tokenId/owner", async (req, res) => {
  try {
    const { contractAddress, tokenId } = req.params;

    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid contract address format",
      });
    }

    if (!tokenId || !/^\d+$/.test(tokenId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid token ID format",
      });
    }

    const result = await newIndexerService.getNFTByContractAndTokenId(
      contractAddress,
      tokenId,
    );

    if (!result.success) {
      const statusCode = result.notFound ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        error: result.error || "Failed to fetch NFT owner details",
      });
    }

    return res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching NFT owner details:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch NFT owner details",
      message: error.message,
    });
  }
});

router.post("/monaliens/batch", async (req, res) => {
  try {
    const { tokenIds } = req.body;

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "tokenIds must be a non-empty array",
      });
    }

    if (tokenIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: "Maximum 100 tokens allowed per request",
      });
    }

    for (const id of tokenIds) {
      if (isNaN(Number(id)) || Number(id) < 1 || Number(id) > 1528) {
        return res.status(400).json({
          success: false,
          error: `Invalid token ID: ${id}. Must be between 1 and 1528`,
        });
      }
    }

    const r2Client = getR2MetadataClient();
    if (!r2Client) {
      return res.status(503).json({
        success: false,
        error: "Metadata service unavailable",
      });
    }

    const results = await Promise.all(
      tokenIds.map(async (tokenId) => {
        try {
          const response = await r2Client.send(
            new GetObjectCommand({
              Bucket: "nft-metadata",
              Key: `monaliens/${tokenId}.json`,
            }),
          );

          const chunks = [];
          for await (const chunk of response.Body) {
            chunks.push(chunk);
          }

          const metadata = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          return { tokenId: Number(tokenId), metadata, found: true };
        } catch (err) {
          console.error(`[Batch] Error fetching tokenId ${tokenId}:`, err.message);
          return {
            tokenId: Number(tokenId),
            metadata: null,
            found: false,
            error: err.message,
          };
        }
      }),
    );

    const found = results.filter((result) => result.found);
    const notFound = results.filter((result) => !result.found);

    return res.json({
      success: true,
      data: {
        metadata: found.map((result) => result.metadata),
        count: found.length,
        notFound:
          notFound.length > 0
            ? notFound.map((result) => ({
                tokenId: result.tokenId,
                error: result.error,
              }))
            : undefined,
      },
    });
  } catch (error) {
    console.error("Error fetching batch metadata:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch batch metadata",
      message: error.message,
    });
  }
});

module.exports = router;
