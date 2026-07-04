const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Local IPFS Mock Service
 * Simulates IPFS for local testing
 */

const IPFS_DIR = path.join(__dirname, "../../.ipfs-local");

// Ensure directory exists
if (!fs.existsSync(IPFS_DIR)) {
  fs.mkdirSync(IPFS_DIR, { recursive: true });
}

class IPFSService {
  /**
   * Fetch JSON from a URL with timeout
   */
  async fetchFromUrl(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        // Try to parse as JSON anyway
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.log(`    IPFS: Response is not JSON from ${url}`);
        }
      } else {
        console.log(`    IPFS: HTTP ${response.status} from ${url}`);
      }
    } catch (error) {
      console.log(`    IPFS: Fetch error for ${url}: ${error.message}`);
    }
    return null;
  }

  /**
   * Generate fake IPFS CID
   */
  generateCID(content) {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex");
    return `Qm${hash.substring(0, 44)}`;
  }

  /**
   * Upload content to mock IPFS
   */
  upload(content) {
    const cid = this.generateCID(content);
    const filePath = path.join(IPFS_DIR, `${cid}.json`);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    return `ipfs://${cid}`;
  }

  /**
   * Get content from mock IPFS or resolve IPFS URI
   */
  async get(uri) {
    if (!uri) return null;

    // Handle ipfs:// URIs - convert to gateway URL
    if (uri.startsWith("ipfs://")) {
      const ipfsPath = uri.replace("ipfs://", "");
      // Try fetching from gateway first (preserves full path)
      const gatewayUrl = `https://ipfs.io/ipfs/${ipfsPath}`;
      const result = await this.fetchFromUrl(gatewayUrl);
      if (result) return result;
      // Fallback to local storage for simple CIDs
      return this.getByCID(ipfsPath.split('/')[0]);
    }

    // Handle HTTP/HTTPS URLs (including IPFS gateway URLs) - fetch directly to preserve path
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      return this.fetchFromUrl(uri);
    }

    // Unknown URI format
    console.log(`    IPFS: Unknown URI format: ${uri}`);
    return null;
  }

  /**
   * Get content by CID from local storage or IPFS gateway
   */
  async getByCID(cid) {
    // 1. Try local storage first (for local dev)
    const filePath = path.join(IPFS_DIR, `${cid}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    // 2. Try IPFS gateway (for production)
    try {
      const gatewayUrl = `https://ipfs.io/ipfs/${cid}`;
      const response = await fetch(gatewayUrl, { timeout: 10000 });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // Try Pinata gateway as fallback
      try {
        const pinataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        const response = await fetch(pinataUrl, { timeout: 10000 });
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        // Ignore
      }
    }

    // For placeholder CIDs, return placeholder metadata
    if (cid.startsWith("Qmplaceholder") || cid.includes("placeholder")) {
      return {
        name: "Placeholder",
        description: "Placeholder metadata",
        image: "https://via.placeholder.com/500",
      };
    }

    return null;
  }

  /**
   * Resolve IPFS URI to HTTP gateway URL
   */
  resolveURI(uri) {
    if (!uri) return null;

    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      // Use public gateway for display
      return `https://ipfs.io/ipfs/${cid}`;
    }

    return uri;
  }

  /**
   * Create collection metadata
   */
  createCollectionMetadata({ name, description, image, banner, externalUrl, twitter, discord }) {
    const metadata = {
      name,
      description,
      image: image || "ipfs://placeholder-collection-image",
      banner: banner || "ipfs://placeholder-banner",
      external_url: externalUrl || "",
      social_links: {
        twitter: twitter || "",
        discord: discord || "",
      },
      created_at: new Date().toISOString(),
    };
    return this.upload(metadata);
  }

  /**
   * Create NFT metadata
   */
  createNFTMetadata({ name, description, image, attributes = [], animationUrl, externalUrl }) {
    const metadata = {
      name,
      description,
      image: image || "ipfs://placeholder-nft-image",
      attributes,
      animation_url: animationUrl || undefined,
      external_url: externalUrl || undefined,
      created_at: new Date().toISOString(),
    };
    return this.upload(metadata);
  }

  /**
   * Create profile metadata
   */
  createProfileMetadata({ bio, avatar, banner, twitter, discord, website }) {
    const metadata = {
      bio: bio || "",
      avatar: avatar || "ipfs://placeholder-avatar",
      banner: banner || "ipfs://placeholder-banner",
      social_links: {
        twitter: twitter || "",
        discord: discord || "",
        website: website || "",
      },
      updated_at: new Date().toISOString(),
    };
    return this.upload(metadata);
  }

  /**
   * List all stored content
   */
  list() {
    const files = fs.readdirSync(IPFS_DIR);
    return files.map((file) => {
      const cid = file.replace(".json", "");
      const content = JSON.parse(fs.readFileSync(path.join(IPFS_DIR, file), "utf8"));
      return { cid, uri: `ipfs://${cid}`, content };
    });
  }

  /**
   * Clear all stored content
   */
  clear() {
    const files = fs.readdirSync(IPFS_DIR);
    files.forEach((file) => {
      fs.unlinkSync(path.join(IPFS_DIR, file));
    });
    return files.length;
  }
}

module.exports = new IPFSService();
