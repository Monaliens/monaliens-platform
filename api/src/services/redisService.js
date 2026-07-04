const redis = require('redis');
const fs = require('fs');
const path = require('path');

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        // Environment-based prefix for Redis keys
        this.envPrefix = this.getEnvironmentPrefix();
        // Lua script SHA cache
        this.luaScripts = new Map();
    }

    getEnvironmentPrefix() {
        const env = process.env.NODE_ENV || 'development';
        // Map environment to prefix
        const envMap = {
            'development': 'dev',
            'production': 'prod',
            'staging': 'staging',
            'test': 'test'
        };
        return envMap[env] || 'dev';
    }

    // Helper method to create environment-prefixed keys
    createKey(key) {
        return `${this.envPrefix}:${key}`;
    }

    async connect() {
        try {
            this.client = redis.createClient({
                url: process.env.REDIS
            });

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            await this.client.connect();
            // Set flag AFTER await resolves, not via event (race condition fix)
            this.isConnected = true;
            console.log(`Redis Client Connected (Environment: ${this.envPrefix})`);
        } catch (error) {
            console.error('Redis connection failed:', error);
            this.isConnected = false;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.isConnected = false;
        }
    }

    // ============= Lua Script Methods =============

    /**
     * Load a Lua script from file and register it with Redis
     * @param {string} scriptName - Name to reference the script
     * @param {string} scriptPath - Path to the .lua file
     * @returns {Promise<string>} - Script SHA for evalsha
     */
    async loadLuaScript(scriptName, scriptPath) {
        if (!this.isConnected) {
            throw new Error('Redis not connected');
        }

        try {
            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            const sha = await this.client.scriptLoad(scriptContent);
            this.luaScripts.set(scriptName, sha);
            console.log(`[Redis] Loaded Lua script '${scriptName}' (SHA: ${sha.slice(0, 8)}...)`);
            return sha;
        } catch (error) {
            console.error(`[Redis] Failed to load Lua script '${scriptName}':`, error.message);
            throw error;
        }
    }

    async loadLuaScripts(scripts) {
        const luaDir = path.join(__dirname, '..', 'lua');

        for (const script of scripts) {
            const scriptPath = path.join(luaDir, script.file);
            if (fs.existsSync(scriptPath)) {
                await this.loadLuaScript(script.name, scriptPath);
            } else {
                console.warn(`[Redis] Lua script not found: ${scriptPath}`);
            }
        }
    }

    /**
     * Load all tournament Lua scripts
     * @returns {Promise<void>}
     */
    async loadTournamentScripts() {
        await this.loadLuaScripts([
            { name: 'tournament_update', file: 'tournament_update.lua' },
            { name: 'tournament_batch_update', file: 'tournament_batch_update.lua' }
        ]);
    }

    /**
     * Load all house PnL Lua scripts
     * @returns {Promise<void>}
     */
    async loadHousePnlScripts() {
        await this.loadLuaScripts([
            { name: 'house_pnl_update', file: 'house_pnl_update.lua' },
            { name: 'house_pnl_reset_period', file: 'house_pnl_reset_period.lua' }
        ]);
    }

    /**
     * Get a loaded Lua script's SHA
     * @param {string} scriptName - Name of the script
     * @returns {string|null} - Script SHA or null
     */
    getLuaScriptSha(scriptName) {
        return this.luaScripts.get(scriptName) || null;
    }

    /**
     * Execute a Lua script by name using evalsha
     * @param {string} scriptName - Name of the loaded script
     * @param {object} options - { keys: [], args: [] }
     * @returns {Promise<any>} - Script result
     */
    async evalLuaScript(scriptName, { keys = [], args = [] }) {
        if (!this.isConnected) {
            throw new Error('Redis not connected');
        }

        const sha = this.luaScripts.get(scriptName);
        if (!sha) {
            throw new Error(`Lua script '${scriptName}' not loaded`);
        }

        try {
            return await this.client.evalSha(sha, {
                keys,
                arguments: args
            });
        } catch (error) {
            // Handle NOSCRIPT error (script not in cache, reload it)
            if (error.message && error.message.includes('NOSCRIPT')) {
                console.log(`[Redis] Script '${scriptName}' not in cache, reloading...`);
                const luaDir = path.join(__dirname, '..', 'lua');
                const scriptPath = path.join(luaDir, `${scriptName}.lua`);
                await this.loadLuaScript(scriptName, scriptPath);
                
                // Retry
                return await this.client.evalSha(this.luaScripts.get(scriptName), {
                    keys,
                    arguments: args
                });
            }
            throw error;
        }
    }

    /**
     * Execute tournament update atomically using Lua script
     * @param {object} params - Update parameters
     * @returns {Promise<object>} - Updated stats
     */
    async tournamentUpdateAtomic({
        playerId,
        pnlDelta,
        volumeDelta,
        weightedVolumeDelta,
        gamesCount = 1,
        winsCount = 0,
        game,
        discordId = '',
        walletAddress = '',
        isHolder = false,
        multiplier = 1.0,
        activeCollection = '',
        collectionImage = ''
    }) {
        const playerKey = this.createKey(`tournament:player:${playerId}`);
        const totalPnlLbKey = this.createKey('tournament:leaderboard:total:pnl');
        const totalVolLbKey = this.createKey('tournament:leaderboard:total:volume');
        const gamePnlLbKey = this.createKey(`tournament:leaderboard:${game}:pnl`);
        const gameVolLbKey = this.createKey(`tournament:leaderboard:${game}:volume`);

        const result = await this.evalLuaScript('tournament_update', {
            keys: [playerKey, totalPnlLbKey, totalVolLbKey, gamePnlLbKey, gameVolLbKey],
            args: [
                playerId,
                pnlDelta.toString(),
                volumeDelta.toString(),
                weightedVolumeDelta.toString(),
                gamesCount.toString(),
                winsCount.toString(),
                game,
                discordId || '',
                walletAddress || '',
                isHolder ? '1' : '0',
                multiplier.toString(),
                activeCollection || '',
                collectionImage || ''
            ]
        });

        return {
            totalPnl: result[0],
            weightedVolume: result[1],
            totalGames: result[2],
            gamePnl: result[3],
            gameWeightedVolume: result[4]
        };
    }

    /**
     * Execute batch tournament update using Lua script
     * @param {Array} updates - Array of player updates
     * @returns {Promise<number>} - Count of updated players
     */
    async tournamentBatchUpdate(updates) {
        if (!updates || updates.length === 0) return 0;

        const totalPnlLbKey = this.createKey('tournament:leaderboard:total:pnl');
        const totalVolLbKey = this.createKey('tournament:leaderboard:total:volume');

        // Build args array
        const args = [updates.length.toString()];
        
        for (const update of updates) {
            const playerKey = this.createKey(`tournament:player:${update.playerId}`);
            args.push(
                update.playerId,
                playerKey,
                update.pnlDelta.toString(),
                update.volumeDelta.toString(),
                update.weightedVolumeDelta.toString(),
                update.gamesCount.toString(),
                update.winsCount.toString()
            );
        }

        const result = await this.evalLuaScript('tournament_batch_update', {
            keys: [totalPnlLbKey, totalVolLbKey],
            args
        });

        return result;
    }

    async housePnlUpdateAtomic({
        periodKey,
        gameKey,
        dedupeKey,
        cacheKeys = [],
        resultId,
        game,
        housePnlWei,
        betAmountWei,
        payoutWei,
        feeWei = '0',
        timestampIso,
        dedupeTtlSeconds = 60 * 60 * 24 * 90
    }) {
        const result = await this.evalLuaScript('house_pnl_update', {
            keys: [periodKey, gameKey, dedupeKey, ...cacheKeys],
            args: [
                resultId || '',
                game,
                housePnlWei.toString(),
                betAmountWei.toString(),
                payoutWei.toString(),
                timestampIso,
                dedupeTtlSeconds.toString(),
                feeWei.toString()
            ]
        });

        return {
            applied: result[0] === 1 || result[0] === '1',
            totalHousePnlWei: result[1],
            gameHousePnlWei: result[2]
        };
    }

    async housePnlResetPeriodAtomic({ periodKey, keysToDelete = [], timestampIso }) {
        const result = await this.evalLuaScript('house_pnl_reset_period', {
            keys: [periodKey, ...keysToDelete],
            args: [timestampIso]
        });

        return result === 1 || result === '1';
    }

    // ============= End Lua Script Methods =============

    async setCollection(address, collectionData) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`collection:${address}`);
            await this.client.setEx(key, 3600 * 24 * 7 * 4 * 12, JSON.stringify(collectionData));
            return true;
        } catch (error) {
            console.error('Redis set error:', error);
            return false;
        }
    }

    async getCollection(address) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`collection:${address}`);
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    async getAllCollections() {
        if (!this.isConnected) return [];
        
        try {
            const pattern = this.createKey('collection:*');
            const keys = await this.client.keys(pattern);
            const collections = [];
            
            for (const key of keys) {
                const data = await this.client.get(key);
                if (data) {
                    collections.push(JSON.parse(data));
                }
            }
            
            return collections;
        } catch (error) {
            console.error('Redis get all collections error:', error);
            return [];
        }
    }

    async deleteCollection(address) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`collection:${address}`);
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis delete error:', error);
            return false;
        }
    }

    async setNFT(collectionAddress, tokenId, nftData) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`nft:${collectionAddress}:${tokenId}`);
            await this.client.setEx(key, 3600 * 24 * 7 * 4 * 12, JSON.stringify(nftData));
            return true;
        } catch (error) {
            console.error('Redis set NFT error:', error);
            return false;
        }
    }

    async getNFT(collectionAddress, tokenId) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`nft:${collectionAddress}:${tokenId}`);
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get NFT error:', error);
            return null;
        }
    }

    async deleteNFT(collectionAddress, tokenId) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`nft:${collectionAddress}:${tokenId}`);
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis delete NFT error:', error);
            return false;
        }
    }

    async getAllNFTsFromCollection(collectionAddress) {
        if (!this.isConnected) return [];
        
        try {
            const pattern = this.createKey(`nft:${collectionAddress}:*`);
            const keys = await this.client.keys(pattern);
            const nfts = [];
            
            for (const key of keys) {
                const data = await this.client.get(key);
                if (data) {
                    nfts.push(JSON.parse(data));
                }
            }
            
            return nfts;
        } catch (error) {
            console.error('Redis get collection NFTs error:', error);
            return [];
        }
    }

    // Helper method to clear all keys for current environment (useful for debugging)
    // preservePatterns: array of patterns to NOT delete (e.g., ['tournament:*'])
    async clearEnvironmentCache(preservePatterns = ['tournament:*', 'games:pnl:*']) {
        if (!this.isConnected) return false;

        try {
            const pattern = `${this.envPrefix}:*`;
            const allKeys = await this.client.keys(pattern);

            // Filter out keys that match preserve patterns
            const keysToDelete = allKeys.filter(key => {
                const keyWithoutPrefix = key.replace(`${this.envPrefix}:`, '');
                return !preservePatterns.some(pattern => {
                    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
                    return regex.test(keyWithoutPrefix);
                });
            });

            if (keysToDelete.length > 0) {
                await this.client.del(keysToDelete);
                console.log(`Cleared ${keysToDelete.length} keys for environment: ${this.envPrefix} (preserved ${allKeys.length - keysToDelete.length} tournament keys)`);
            } else {
                console.log(`No keys to clear for environment: ${this.envPrefix} (preserved ${allKeys.length} keys)`);
            }

            return true;
        } catch (error) {
            console.error('Redis clear environment cache error:', error);
            return false;
        }
    }

    // Total Rewards Tracking Methods
    
    /**
     * Set total rewards amount in Redis
     * @param {string} totalRewards - Total rewards amount in simplified format
     * @returns {Promise<boolean>} - Success status
     */
    async setTotalRewards(totalRewards) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey('total_rewards');
            await this.client.set(key, totalRewards.toString());
            console.log(` Set total rewards: ${totalRewards} (key: ${key})`);
            return true;
        } catch (error) {
            console.error('Redis set total rewards error:', error);
            return false;
        }
    }

    /**
     * Get total rewards amount from Redis
     * @returns {Promise<string|null>} - Total rewards amount in simplified format or null
     */
    async getTotalRewards() {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey('total_rewards');
            const totalRewards = await this.client.get(key);
            return totalRewards;
        } catch (error) {
            console.error('Redis get total rewards error:', error);
            return null;
        }
    }

    /**
     * Increment total rewards amount by a specific amount
     * @param {string} incrementAmount - Amount to increment in simplified format
     * @returns {Promise<string|null>} - New total rewards amount or null
     */
    async incrementTotalRewards(incrementAmount) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey('total_rewards');
            const incrementNum = parseFloat(incrementAmount);
            
            // Use Redis INCRBYFLOAT for atomic increment
            const newTotal = await this.client.incrByFloat(key, incrementNum);
            console.log(` Incremented total rewards by ${incrementAmount}, new total: ${newTotal}`);
            
            return newTotal.toString();
        } catch (error) {
            console.error('Redis increment total rewards error:', error);
            return null;
        }
    }

    /**
     * Get total rewards with metadata
     * @returns {Promise<Object>} - Total rewards with metadata
     */
    async getTotalRewardsWithMetadata() {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey('total_rewards');
            const totalRewards = await this.client.get(key);
            
            if (totalRewards === null) {
                return {
                    totalRewards: '0',
                    environment: this.envPrefix,
                    key: key,
                    timestamp: new Date().toISOString()
                };
            }
            
            return {
                totalRewards: totalRewards,
                environment: this.envPrefix,
                key: key,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Redis get total rewards with metadata error:', error);
            return null;
        }
    }

    /**
     * Get rewards by type (native or token)
     * @param {string} type - 'native' or 'token'
     * @returns {Promise<string|null>} - Rewards amount or null
     */
    async getRewardsByType(type) {
        if (!this.isConnected) return null;

        try {
            const keyName = type === 'token' ? 'total_rewards_token' : 'total_rewards_native';
            const key = this.createKey(keyName);
            const rewards = await this.client.get(key);
            return rewards;
        } catch (error) {
            console.error(`Redis get ${type} rewards error:`, error);
            return null;
        }
    }

    /**
     * Set rewards by type (native or token)
     * @param {string} type - 'native' or 'token'
     * @param {string} amount - Rewards amount
     * @returns {Promise<boolean>} - Success status
     */
    async setRewardsByType(type, amount) {
        if (!this.isConnected) return false;

        try {
            const keyName = type === 'token' ? 'total_rewards_token' : 'total_rewards_native';
            const key = this.createKey(keyName);
            await this.client.set(key, amount.toString());
            console.log(` Set ${type} rewards: ${amount} (key: ${key})`);
            return true;
        } catch (error) {
            console.error(`Redis set ${type} rewards error:`, error);
            return false;
        }
    }

    // User Rewards Tracking Methods

    /**
     * Set user rewards amount in Redis
     * @param {string} address - User wallet address
     * @param {string} userRewards - User rewards amount in simplified format
     * @returns {Promise<boolean>} - Success status
     */
    async setUserRewards(address, userRewards) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`user_rewards:${address.toLowerCase()}`);
            await this.client.set(key, userRewards.toString());
            console.log(` Set user rewards for ${address}: ${userRewards} (key: ${key})`);
            return true;
        } catch (error) {
            console.error('Redis set user rewards error:', error);
            return false;
        }
    }

    /**
     * Get user rewards amount from Redis
     * @param {string} address - User wallet address
     * @returns {Promise<string|null>} - User rewards amount in simplified format or null
     */
    async getUserRewards(address) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`user_rewards:${address.toLowerCase()}`);
            const userRewards = await this.client.get(key);
            return userRewards;
        } catch (error) {
            console.error('Redis get user rewards error:', error);
            return null;
        }
    }

    /**
     * Increment user rewards amount by a specific amount
     * @param {string} address - User wallet address
     * @param {string} incrementAmount - Amount to increment in simplified format
     * @returns {Promise<string|null>} - New user rewards amount or null
     */
    async incrementUserRewards(address, incrementAmount) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`user_rewards:${address.toLowerCase()}`);
            const incrementNum = parseFloat(incrementAmount);
            
            // Use Redis INCRBYFLOAT for atomic increment
            const newTotal = await this.client.incrByFloat(key, incrementNum);
            console.log(` Incremented user rewards for ${address} by ${incrementAmount}, new total: ${newTotal}`);
            
            return newTotal.toString();
        } catch (error) {
            console.error('Redis increment user rewards error:', error);
            return null;
        }
    }

    /**
     * Check if user rewards key exists in Redis
     * @param {string} address - User wallet address
     * @returns {Promise<boolean>} - True if key exists
     */
    async userRewardsExists(address) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`user_rewards:${address.toLowerCase()}`);
            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            console.error('Redis check user rewards exists error:', error);
            return false;
        }
    }

    /**
     * Get user rewards with metadata
     * @param {string} address - User wallet address
     * @returns {Promise<Object>} - User rewards with metadata
     */
    async getUserRewardsWithMetadata(address) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`user_rewards:${address.toLowerCase()}`);
            const userRewards = await this.client.get(key);
            
            return {
                address: address.toLowerCase(),
                userRewards: userRewards || '0',
                environment: this.envPrefix,
                key: key,
                timestamp: new Date().toISOString(),
                cached: userRewards !== null
            };
        } catch (error) {
            console.error('Redis get user rewards with metadata error:', error);
            return null;
        }
    }

    // NFT Metadata Caching Methods
    
    /**
     * Set NFT metadata in Redis
     * @param {string} contractAddress - NFT contract address
     * @param {string} tokenId - Token ID
     * @param {Object} metadata - NFT metadata object
     * @returns {Promise<boolean>} - Success status
     */
    async setNFTMetadata(contractAddress, tokenId, metadata) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`nft_metadata:${contractAddress.toLowerCase()}:${tokenId}`);
            await this.client.setEx(key, 600, JSON.stringify(metadata)); // 10 dakika cache
            console.log(` Set NFT metadata: ${contractAddress}:${tokenId} (key: ${key}, TTL: 10 minutes)`);
            return true;
        } catch (error) {
            console.error('Redis set NFT metadata error:', error);
            return false;
        }
    }

    /**
     * Get NFT metadata from Redis
     * @param {string} contractAddress - NFT contract address
     * @param {string} tokenId - Token ID
     * @returns {Promise<Object|null>} - NFT metadata object or null
     */
    async getNFTMetadata(contractAddress, tokenId) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`nft_metadata:${contractAddress.toLowerCase()}:${tokenId}`);
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get NFT metadata error:', error);
            return null;
        }
    }

    /**
     * Delete NFT metadata from Redis
     * @param {string} contractAddress - NFT contract address
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} - Success status
     */
    async deleteNFTMetadata(contractAddress, tokenId) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`nft_metadata:${contractAddress.toLowerCase()}:${tokenId}`);
            await this.client.del(key);
            console.log(` Deleted NFT metadata: ${contractAddress}:${tokenId}`);
            return true;
        } catch (error) {
            console.error('Redis delete NFT metadata error:', error);
            return false;
        }
    }

    /**
     * Check if NFT metadata exists in Redis
     * @param {string} contractAddress - NFT contract address
     * @param {string} tokenId - Token ID
     * @returns {Promise<boolean>} - True if metadata exists
     */
    async nftMetadataExists(contractAddress, tokenId) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`nft_metadata:${contractAddress.toLowerCase()}:${tokenId}`);
            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            console.error('Redis check NFT metadata exists error:', error);
            return false;
        }
    }

    // Generic Redis methods
    async get(key) {
        if (!this.isConnected) return null;
        
        try {
            const data = await this.client.get(key);
            return data;
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    async set(key, value) {
        if (!this.isConnected) return false;
        
        try {
            await this.client.set(key, value);
            return true;
        } catch (error) {
            console.error('Redis set error:', error);
            return false;
        }
    }

    async setex(key, seconds, value) {
        if (!this.isConnected) return false;
        
        try {
            await this.client.setEx(key, seconds, value);
            return true;
        } catch (error) {
            console.error('Redis setex error:', error);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected) return false;
        
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis del error:', error);
            return false;
        }
    }

    async exists(key) {
        if (!this.isConnected) return false;
        
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis exists error:', error);
            return false;
        }
    }

    // Batch operations for NFT metadata
    async mgetNFTMetadata(keys) {
        if (!this.isConnected || !keys || keys.length === 0) return [];

        try {
            const values = await this.client.mGet(keys);
            return values.map((value, index) => {
                if (value) {
                    try {
                        return JSON.parse(value);
                    } catch (parseError) {
                        console.error(`Failed to parse cached data for key ${keys[index]}:`, parseError);
                        return null;
                    }
                }
                return null;
            });
        } catch (error) {
            console.error('Redis mget error:', error);
            return keys.map(() => null);
        }
    }

    async msetNFTMetadata(keyValuePairs, ttl = 2592000) {
        if (!this.isConnected || !keyValuePairs || keyValuePairs.length === 0) return false;

        try {
            // Use pipeline for batch set with TTL
            const pipeline = this.client.multi();

            for (const { key, value } of keyValuePairs) {
                pipeline.setEx(key, ttl, JSON.stringify(value));
            }

            await pipeline.exec();
            return true;
        } catch (error) {
            console.error('Redis mset error:', error);
            return false;
        }
    }

    // Helper method to get current environment info
    getEnvironmentInfo() {
        return {
            environment: process.env.NODE_ENV || 'development',
            prefix: this.envPrefix,
            isConnected: this.isConnected
        };
    }

    // NFT Holders Cache Methods
    
    /**
     * Set NFT holders data in Redis with TTL
     * @param {string} contractAddress - NFT contract address
     * @param {Object} holdersData - Holders data object containing holders array and count
     * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
     * @returns {Promise<boolean>} - Success status
     */
    async setHolders(contractAddress, holdersData, ttl = 300) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`holders:${contractAddress.toLowerCase()}`);
            await this.client.setEx(key, ttl, JSON.stringify(holdersData));
            console.log(` Cached holders for ${contractAddress} (key: ${key}, TTL: ${ttl}s)`);
            return true;
        } catch (error) {
            console.error('Redis set holders error:', error);
            return false;
        }
    }

    /**
     * Get NFT holders data from Redis
     * @param {string} contractAddress - NFT contract address
     * @returns {Promise<Object|null>} - Holders data or null if not cached
     */
    async getHolders(contractAddress) {
        if (!this.isConnected) return null;
        
        try {
            const key = this.createKey(`holders:${contractAddress.toLowerCase()}`);
            const data = await this.client.get(key);
            if (data) {
                console.log(` Cache hit for holders: ${contractAddress}`);
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('Redis get holders error:', error);
            return null;
        }
    }

    /**
     * Check if holders data is currently being fetched
     * @param {string} contractAddress - NFT contract address
     * @returns {Promise<boolean>} - True if fetching is in progress
     */
    async isHoldersFetching(contractAddress) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`holders_fetching:${contractAddress.toLowerCase()}`);
            const exists = await this.client.exists(key);
            return exists === 1;
        } catch (error) {
            console.error('Redis check holders fetching error:', error);
            return false;
        }
    }

    /**
     * Set holders fetching flag with TTL
     * @param {string} contractAddress - NFT contract address
     * @param {number} ttl - Time to live in seconds (default: 60)
     * @returns {Promise<boolean>} - Success status
     */
    async setHoldersFetching(contractAddress, ttl = 60) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`holders_fetching:${contractAddress.toLowerCase()}`);
            // Use SET NX (only set if not exists) to prevent race conditions
            const result = await this.client.set(key, '1', {
                NX: true,
                EX: ttl
            });
            return result === 'OK';
        } catch (error) {
            console.error('Redis set holders fetching error:', error);
            return false;
        }
    }

    /**
     * Clear holders fetching flag
     * @param {string} contractAddress - NFT contract address
     * @returns {Promise<boolean>} - Success status
     */
    async clearHoldersFetching(contractAddress) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`holders_fetching:${contractAddress.toLowerCase()}`);
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis clear holders fetching error:', error);
            return false;
        }
    }

    /**
     * Delete holders cache
     * @param {string} contractAddress - NFT contract address
     * @returns {Promise<boolean>} - Success status
     */
    async deleteHolders(contractAddress) {
        if (!this.isConnected) return false;
        
        try {
            const key = this.createKey(`holders:${contractAddress.toLowerCase()}`);
            await this.client.del(key);
            console.log(` Deleted holders cache for ${contractAddress}`);
            return true;
        } catch (error) {
            console.error('Redis delete holders error:', error);
            return false;
        }
    }
}

module.exports = new RedisService();
