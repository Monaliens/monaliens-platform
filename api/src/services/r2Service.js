/**
 * Cloudflare R2 Service
 * Handles NFT image caching to R2 bucket
 */

const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'nft-images';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Optional: custom domain for public access

class R2Service {
  constructor() {
    this.client = null;
    this.isConfigured = false;
  }

  /**
   * Initialize R2 client
   */
  init() {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      console.log('[R2] Missing credentials, service disabled');
      return false;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });

    this.isConfigured = true;
    console.log('[R2] Service initialized');
    return true;
  }

  /**
   * Check if image exists in R2
   * @param {string} collection - Collection address
   * @param {string} tokenId - Token ID
   * @returns {Promise<boolean>}
   */
  async imageExists(collection, tokenId) {
    if (!this.isConfigured) return false;

    const key = `${collection.toLowerCase()}/${tokenId}`;

    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      }));
      return true;
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      console.error(`[R2] Error checking image existence:`, err.message);
      return false;
    }
  }

  /**
   * Upload image to R2
   * @param {string} collection - Collection address
   * @param {string} tokenId - Token ID
   * @param {Buffer} imageBuffer - Image data
   * @param {string} contentType - MIME type
   * @returns {Promise<string|null>} Public URL or null on failure
   */
  async uploadImage(collection, tokenId, imageBuffer, contentType = 'image/png') {
    if (!this.isConfigured) return null;

    const key = `${collection.toLowerCase()}/${tokenId}`;

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: imageBuffer,
        ContentType: contentType
      }));

      const url = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

      console.log(`[R2] Uploaded: ${key}`);
      return url;
    } catch (err) {
      console.error(`[R2] Upload error:`, err.message);
      return null;
    }
  }

  /**
   * Get image from R2
   * @param {string} collection - Collection address
   * @param {string} tokenId - Token ID
   * @returns {Promise<{buffer: Buffer, contentType: string}|null>}
   */
  async getImage(collection, tokenId) {
    if (!this.isConfigured) return null;

    const key = `${collection.toLowerCase()}/${tokenId}`;

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      }));

      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType || 'image/png'
      };
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`[R2] Get error:`, err.message);
      return null;
    }
  }

  /**
   * Fetch image from IPFS and cache to R2
   * @param {string} collection - Collection address
   * @param {string} tokenId - Token ID
   * @param {string} ipfsUrl - IPFS URL (ipfs:// or https://)
   * @returns {Promise<{buffer: Buffer, contentType: string}|null>}
   */
  async fetchAndCache(collection, tokenId, ipfsUrl) {
    if (!ipfsUrl) return null;

    // Convert IPFS URL to gateway URL
    let fetchUrl = ipfsUrl;
    if (ipfsUrl.startsWith('ipfs://')) {
      fetchUrl = ipfsUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    try {
      console.log(`[R2] Fetching from IPFS: ${fetchUrl}`);

      const response = await axios.get(fetchUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (compatible; MonaliensAPI/1.0)'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/png';

      // Upload to R2 if configured
      if (this.isConfigured) {
        await this.uploadImage(collection, tokenId, buffer, contentType);
      }

      return { buffer, contentType };
    } catch (err) {
      console.error(`[R2] Fetch error for ${collection}/${tokenId}:`, err.message);
      return null;
    }
  }

  /**
   * Get image - first check R2 cache, then fetch from IPFS if not found
   * @param {string} collection - Collection address
   * @param {string} tokenId - Token ID
   * @param {string} ipfsUrl - IPFS URL for fallback
   * @returns {Promise<{buffer: Buffer, contentType: string, cached: boolean}|null>}
   */
  async getOrFetchImage(collection, tokenId, ipfsUrl) {
    // Try R2 first
    const cached = await this.getImage(collection, tokenId);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Fetch from IPFS and cache
    const fetched = await this.fetchAndCache(collection, tokenId, ipfsUrl);
    if (fetched) {
      return { ...fetched, cached: false };
    }

    return null;
  }

  /**
   * Get public URL for an image
   * @param {string} collection - Collection address
   * @param {string} tokenId - Token ID
   * @returns {string}
   */
  getPublicUrl(collection, tokenId) {
    const key = `${collection.toLowerCase()}/${tokenId}`;
    return R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : null; // R2 needs public access configured for direct URLs
  }

  /**
   * Upload JSON data to R2
   * @param {string} key - Object key (e.g., 'wrapped/0x123.json')
   * @param {Object} data - JSON data to upload
   * @returns {Promise<string|null>} Public URL or null on failure
   */
  async uploadJson(key, data) {
    if (!this.isConfigured) {
      console.log(`[R2] Not configured, skipping upload: ${key}`);
      return null;
    }

    try {
      const content = JSON.stringify(data, null, 2);

      await this.client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: content,
        ContentType: 'application/json',
        CacheControl: 'public, max-age=3600' // 1 hour cache
      }));

      const url = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

      console.log(`[R2] Uploaded JSON: ${key}`);
      return url;
    } catch (err) {
      console.error(`[R2] JSON upload error for ${key}:`, err.message);
      return null;
    }
  }

  /**
   * Get JSON data from R2
   * @param {string} key - Object key
   * @returns {Promise<Object|null>}
   */
  async getJson(key) {
    if (!this.isConfigured) return null;

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      }));

      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      const content = Buffer.concat(chunks).toString('utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`[R2] Get JSON error for ${key}:`, err.message);
      return null;
    }
  }

  /**
   * Check if key exists in R2
   * @param {string} key - Object key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!this.isConfigured) return false;

    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      }));
      return true;
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      console.error(`[R2] Error checking existence:`, err.message);
      return false;
    }
  }

  /**
   * Get public URL for a key
   * @param {string} key - Object key
   * @returns {string|null}
   */
  getUrl(key) {
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : null;
  }
}

const r2Service = new R2Service();
module.exports = r2Service;
