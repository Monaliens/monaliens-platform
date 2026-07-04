/**
 * TEE Memory-Only Key Cache
 *
 * - Key'ler SADECE RAM'de tutulur
 * - TTL ile otomatik temizleme (1 saat)
 */

const KEY_TTL_MS = 60 * 60 * 1000; // 1 saat

class MemoryKeyCache {
  constructor() {
    this.cache = new Map();

    // Her 5 dakikada expired key'leri temizle
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(walletAddress, privateKey) {
    const normalizedAddress = walletAddress.toLowerCase();
    this.cache.set(normalizedAddress, {
      key: privateKey,
      expiresAt: Date.now() + KEY_TTL_MS,
      createdAt: Date.now()
    });
    console.log(`[KeyCache] Key cached for ${normalizedAddress.slice(0, 10)}...`);
  }

  get(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const entry = this.cache.get(normalizedAddress);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalizedAddress);
      console.log(`[KeyCache] Key expired for ${normalizedAddress.slice(0, 10)}...`);
      return null;
    }

    return entry.key;
  }

  has(walletAddress) {
    return this.get(walletAddress) !== null;
  }

  delete(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const deleted = this.cache.delete(normalizedAddress);
    if (deleted) {
      console.log(`[KeyCache] Key deleted for ${normalizedAddress.slice(0, 10)}...`);
    }
    return deleted;
  }

  touch(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const entry = this.cache.get(normalizedAddress);
    if (entry) {
      entry.expiresAt = Date.now() + KEY_TTL_MS;
      console.log(`[KeyCache] TTL extended for ${normalizedAddress.slice(0, 10)}...`);
    }
  }

  getRemainingMinutes(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const entry = this.cache.get(normalizedAddress);
    if (!entry) return 0;

    const remaining = entry.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [address, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(address);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[KeyCache] Cleanup: removed ${cleaned} expired entries`);
    }
  }

  // Cache istatistikleri
  getStats() {
    return {
      totalEntries: this.cache.size,
      ttlMinutes: KEY_TTL_MS / 60000
    };
  }
}

module.exports = new MemoryKeyCache();
