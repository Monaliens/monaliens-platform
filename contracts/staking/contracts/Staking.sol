// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Pausable, Ownable {
    // ============ Constants ============
    // PRODUCTION MODE: 5 days
    uint256 public constant COOLDOWN_PERIOD = 5 days; // 432,000 seconds
    string public constant CONTRACT_VERSION = "4.1.0"; // Added 3x boost for first week

    // Boost settings
    uint256 public constant BOOST_PERIOD = 7 days; // First week boost
    uint256 public constant BOOST_MULTIPLIER = 3; // 3x rewards

    // ============ State Variables ============
    IERC721 public immutable nftCollection;
    uint256 public immutable deploymentTime; // Track contract deployment time

    mapping(uint256 => address) public tokenIdToStaker;
    mapping(uint256 => uint256) public tokenIdToStakeTimestamp;
    mapping(address => uint256[]) public userToStakedTokenIds;
    mapping(address => uint256) public totalRewardsReceived;
    mapping(uint256 => uint256) public tokenIdToArrayIndex;
    mapping(address => uint256) public lastRewardDistribution;

    // Cooldown tracking
    mapping(uint256 => uint256) public tokenIdToCooldownStart;
    mapping(uint256 => bool) public tokenIdOnCooldown;

    uint256 public totalRewardsDistributed;
    uint256 public lastDistributionTimestamp;
    uint256 public totalStaked;

    uint256[] public allStakedTokens;
    mapping(uint256 => uint256) public tokenIdToAllStakedIndex;

    // ============ Events ============
    event NFTStaked(address indexed staker, uint256[] tokenIds, uint256 timestamp);
    event NFTUnstaked(address indexed staker, uint256[] tokenIds, uint256 timestamp);
    event CooldownStarted(address indexed staker, uint256[] tokenIds, uint256 timestamp);
    event RewardsDistributed(uint256 amount, uint256 totalStakeSeconds, uint256 recipients, uint256 timestamp);
    event IndividualReward(address indexed staker, uint256 amount, uint256 stakeDuration);
    event EmergencyWithdraw(address indexed by, uint256[] tokenIds, address to);
    event EmergencyWithdrawAll(uint256 count, uint256 timestamp);

    // Admin events
    event AdminMigration(address indexed admin, address indexed user, uint256[] tokenIds);
    event StakingTimeUpdated(uint256 tokenId, uint256 newTime);
    event ContractMigration(address indexed newContract, uint256[] tokenIds);

    // ============ Custom Errors ============
    error ZeroAddress();
    error NotTokenOwner();
    error TokenAlreadyStaked();
    error TokenNotStaked();
    error NotStaker();
    error InvalidArrayLength();
    error CooldownNotMet();
    error CooldownNotStarted();
    error CooldownAlreadyStarted();
    error NoStakedTokens();
    error InsufficientRewards();
    error InvalidAmount();
    error TransferFailed();
    error ArrayLengthMismatch();
    error InvalidTimestamp();

    // ============ Constructor ============
    // @param _nftCollection NFT collection address
    // @param _customDeploymentTime Optional: Custom deployment time for migration (0 = use current time)
    constructor(address _nftCollection, uint256 _customDeploymentTime) {
        if (_nftCollection == address(0)) revert ZeroAddress();
        nftCollection = IERC721(_nftCollection);

        // If custom deployment time provided (for migration), use it. Otherwise use current time.
        deploymentTime = _customDeploymentTime > 0 ? _customDeploymentTime : block.timestamp;
    }

    // ============ Main Functions ============

    /**
     * @dev Stake multiple NFTs (requires pre-approval)
     * @param tokenIds Array of token IDs to stake
     */
    function stake(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        if (tokenIds.length == 0) revert InvalidArrayLength();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Check ownership
            if (nftCollection.ownerOf(tokenId) != msg.sender) {
                revert NotTokenOwner();
            }

            // Check if already staked
            if (tokenIdToStaker[tokenId] != address(0)) {
                revert TokenAlreadyStaked();
            }

            // Transfer NFT to contract
            nftCollection.transferFrom(msg.sender, address(this), tokenId);

            // Update mappings
            tokenIdToStaker[tokenId] = msg.sender;
            tokenIdToStakeTimestamp[tokenId] = block.timestamp;

            // Add to user's staked array
            tokenIdToArrayIndex[tokenId] = userToStakedTokenIds[msg.sender].length;
            userToStakedTokenIds[msg.sender].push(tokenId);

            // Add to global array
            tokenIdToAllStakedIndex[tokenId] = allStakedTokens.length;
            allStakedTokens.push(tokenId);
        }

        totalStaked += tokenIds.length;
        emit NFTStaked(msg.sender, tokenIds, block.timestamp);
    }

    /**
     * @dev Approve and stake specific NFTs in one transaction
     * @param tokenIds Array of token IDs to approve and stake
     */
    function approveAndStake(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        if (tokenIds.length == 0) revert InvalidArrayLength();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Check ownership
            if (nftCollection.ownerOf(tokenId) != msg.sender) {
                revert NotTokenOwner();
            }

            // Check if already staked
            if (tokenIdToStaker[tokenId] != address(0)) {
                revert TokenAlreadyStaked();
            }

            // Approve this specific NFT to contract
            nftCollection.approve(address(this), tokenId);

            // Transfer NFT to contract
            nftCollection.transferFrom(msg.sender, address(this), tokenId);

            // Update mappings
            tokenIdToStaker[tokenId] = msg.sender;
            tokenIdToStakeTimestamp[tokenId] = block.timestamp;

            // Add to user's staked array
            tokenIdToArrayIndex[tokenId] = userToStakedTokenIds[msg.sender].length;
            userToStakedTokenIds[msg.sender].push(tokenId);

            // Add to global array
            tokenIdToAllStakedIndex[tokenId] = allStakedTokens.length;
            allStakedTokens.push(tokenId);
        }

        totalStaked += tokenIds.length;
        emit NFTStaked(msg.sender, tokenIds, block.timestamp);
    }

    /**
     * @dev Start cooldown for NFTs before unstaking.
     * @param tokenIds Array of token IDs to start cooldown.
     */
    function startCooldown(uint256[] calldata tokenIds) external nonReentrant {
        if (tokenIds.length == 0) revert InvalidArrayLength();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Check if sender is the staker
            if (tokenIdToStaker[tokenId] != msg.sender) {
                revert NotStaker();
            }

            // Check if cooldown already started
            if (tokenIdOnCooldown[tokenId]) {
                revert CooldownAlreadyStarted();
            }

            // Start cooldown
            tokenIdToCooldownStart[tokenId] = block.timestamp;
            tokenIdOnCooldown[tokenId] = true;
        }

        emit CooldownStarted(msg.sender, tokenIds, block.timestamp);
    }

    /**
     * @dev Unstake NFTs after cooldown period
     * @param tokenIds Array of token IDs to unstake
     */
    function unstake(uint256[] calldata tokenIds) external nonReentrant {
        if (tokenIds.length == 0) revert InvalidArrayLength();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Check if sender is the staker
            if (tokenIdToStaker[tokenId] != msg.sender) {
                revert NotStaker();
            }

            // Check if cooldown was started
            if (!tokenIdOnCooldown[tokenId]) {
                revert CooldownNotStarted();
            }

            // Check if cooldown period has passed
            if (block.timestamp < tokenIdToCooldownStart[tokenId] + COOLDOWN_PERIOD) {
                revert CooldownNotMet();
            }

            // Remove from staking
            _removeStakedToken(msg.sender, tokenId);

            // Clear cooldown data
            delete tokenIdToCooldownStart[tokenId];
            delete tokenIdOnCooldown[tokenId];

            // Transfer NFT back to user
            nftCollection.transferFrom(address(this), msg.sender, tokenId);
        }

        totalStaked -= tokenIds.length;
        emit NFTUnstaked(msg.sender, tokenIds, block.timestamp);
    }

    // ============ Admin Migration Functions (NEW) ============

    /**
     * @dev Admin function to migrate NFTs with custom timestamps for a user
     * @param user Address of the user to migrate for
     * @param tokenIds Array of token IDs to migrate
     * @param stakeTimestamps Array of staking timestamps (in seconds)
     * @param cooldownStarts Array of cooldown start times (0 if not on cooldown)
     */
    function adminMigrateUser(
        address user,
        uint256[] calldata tokenIds,
        uint256[] calldata stakeTimestamps,
        uint256[] calldata cooldownStarts
    ) external onlyOwner nonReentrant {
        if (user == address(0)) revert ZeroAddress();
        if (tokenIds.length == 0) revert InvalidArrayLength();
        if (tokenIds.length != stakeTimestamps.length || tokenIds.length != cooldownStarts.length) {
            revert ArrayLengthMismatch();
        }

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Check if NFT is already staked
            if (tokenIdToStaker[tokenId] != address(0)) {
                revert TokenAlreadyStaked();
            }

            // SECURITY: Validate timestamp
            if (stakeTimestamps[i] > block.timestamp) {
                revert InvalidTimestamp(); // Future timestamp not allowed
            }
            if (stakeTimestamps[i] < block.timestamp - 365 days) {
                revert InvalidTimestamp(); // More than 1 year ago not allowed
            }

            // SECURITY: Handle NFT location for migration
            address currentOwner = nftCollection.ownerOf(tokenId);

            if (currentOwner == user) {
                // NFT is with user - normal migration
                nftCollection.transferFrom(user, address(this), tokenId);
            } else if (currentOwner == address(this)) {
                // NFT is already in contract - migration from another contract
                // No transfer needed, just set up staking data
            } else {
                // NFT is somewhere else - not allowed for security
                revert NotTokenOwner();
            }

            // Set up staking data with custom timestamp
            tokenIdToStaker[tokenId] = user;
            tokenIdToStakeTimestamp[tokenId] = stakeTimestamps[i];

            // Set up cooldown if applicable
            if (cooldownStarts[i] > 0) {
                tokenIdToCooldownStart[tokenId] = cooldownStarts[i];
                tokenIdOnCooldown[tokenId] = true;
            }

            // Add to user's staked array
            tokenIdToArrayIndex[tokenId] = userToStakedTokenIds[user].length;
            userToStakedTokenIds[user].push(tokenId);

            // Add to global array
            tokenIdToAllStakedIndex[tokenId] = allStakedTokens.length;
            allStakedTokens.push(tokenId);
        }

        totalStaked += tokenIds.length;
        emit AdminMigration(msg.sender, user, tokenIds);
    }

    /**
     * @dev Admin function to update staking timestamp for a specific NFT
     * @param tokenId Token ID to update
     * @param newTimestamp New staking timestamp
     */
    function adminUpdateStakingTime(uint256 tokenId, uint256 newTimestamp) external onlyOwner {
        address staker = tokenIdToStaker[tokenId];
        if (staker == address(0)) revert TokenNotStaked();

        // SECURITY: Validate new timestamp
        if (newTimestamp > block.timestamp) {
            revert InvalidTimestamp(); // Future timestamp not allowed
        }
        if (newTimestamp < block.timestamp - 365 days) {
            revert InvalidTimestamp(); // More than 1 year ago not allowed
        }

        tokenIdToStakeTimestamp[tokenId] = newTimestamp;

        emit StakingTimeUpdated(tokenId, newTimestamp);
    }

    /**
     * @dev Admin function to update cooldown status for a specific NFT
     * @param tokenId Token ID to update
     * @param isOnCooldown Whether the NFT should be on cooldown
     * @param cooldownStart Cooldown start timestamp (if on cooldown)
     */
    function adminUpdateCooldown(
        uint256 tokenId,
        bool isOnCooldown,
        uint256 cooldownStart
    ) external onlyOwner {
        if (tokenIdToStaker[tokenId] == address(0)) revert TokenNotStaked();

        tokenIdOnCooldown[tokenId] = isOnCooldown;

        if (isOnCooldown) {
            tokenIdToCooldownStart[tokenId] = cooldownStart;
        } else {
            delete tokenIdToCooldownStart[tokenId];
        }
    }

    // ============ View Functions ============

    /**
     * @dev Get staked NFTs for a user - FIXED: Ghost NFT protection + BOOSTED durations!
     * @param user Address of the user
     * @return tokenIds Array of ACTUALLY staked token IDs
     * @return stakeDurations Array of BOOSTED staking durations in seconds
     */
    function getStakedNFTs(address user) external view returns (
        uint256[] memory tokenIds,
        uint256[] memory stakeDurations
    ) {
        uint256[] storage userTokens = userToStakedTokenIds[user];

        // First pass: count valid tokens
        uint256 validCount = 0;
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (tokenIdToStaker[userTokens[i]] == user) {
                validCount++;
            }
        }

        // Second pass: collect valid tokens
        tokenIds = new uint256[](validCount);
        stakeDurations = new uint256[](validCount);
        uint256 index = 0;

        for (uint256 i = 0; i < userTokens.length; i++) {
            uint256 tokenId = userTokens[i];

            // Only include if actually staked
            if (tokenIdToStaker[tokenId] == user) {
                tokenIds[index] = tokenId;
                stakeDurations[index] = _calculateBoostedDuration(tokenIdToStakeTimestamp[tokenId]); // BOOSTED!
                index++;
            }
        }

        return (tokenIds, stakeDurations);
    }

    /**
     * @dev Get cooldown info for a token
     * @param tokenId Token ID to check
     * @return isOnCooldown Whether cooldown is active
     * @return cooldownStart When cooldown started (0 if not started)
     * @return remainingTime Seconds until unstake available (0 if ready)
     */
    function getCooldownInfo(uint256 tokenId) external view returns (
        bool isOnCooldown,
        uint256 cooldownStart,
        uint256 remainingTime
    ) {
        isOnCooldown = tokenIdOnCooldown[tokenId];
        cooldownStart = tokenIdToCooldownStart[tokenId];

        if (isOnCooldown && cooldownStart > 0) {
            uint256 elapsed = block.timestamp - cooldownStart;
            if (elapsed < COOLDOWN_PERIOD) {
                remainingTime = COOLDOWN_PERIOD - elapsed;
            }
        }

        return (isOnCooldown, cooldownStart, remainingTime);
    }

    /**
     * @dev Get detailed staking info for admin view
     * @param tokenId Token ID to check
     * @return staker Address of the staker
     * @return stakeTimestamp When it was staked
     * @return isOnCooldown Whether on cooldown
     * @return cooldownStart When cooldown started
     */
    function getDetailedStakingInfo(uint256 tokenId) external view returns (
        address staker,
        uint256 stakeTimestamp,
        bool isOnCooldown,
        uint256 cooldownStart
    ) {
        staker = tokenIdToStaker[tokenId];
        stakeTimestamp = tokenIdToStakeTimestamp[tokenId];
        isOnCooldown = tokenIdOnCooldown[tokenId];
        cooldownStart = tokenIdToCooldownStart[tokenId];
    }



    /**
     * @dev Get contract statistics - OPTIMIZED for large arrays
     * @return totalNFTsStaked Total number of NFTs currently staked
     * @return uniqueStakersCount Number of unique addresses with staked NFTs (capped at 1000 for gas)
     * @return totalRewardsDistributedAmount Total rewards distributed in wei
     */
    function getContractStats() external view returns (
        uint256 totalNFTsStaked,
        uint256 uniqueStakersCount,
        uint256 totalRewardsDistributedAmount
    ) {
        totalNFTsStaked = totalStaked;
        totalRewardsDistributedAmount = totalRewardsDistributed;

        // For large arrays (>1000), return approximate count to prevent gas issues
        if (allStakedTokens.length > 1000) {
            // Estimate unique stakers: sample first 1000 tokens
            uniqueStakersCount = _estimateUniqueStakers(1000);
        } else {
            // Count unique stakers using reliable method for smaller arrays
            address[] memory uniqueAddresses = new address[](allStakedTokens.length);
            uint256 uniqueCount = 0;

            for (uint256 i = 0; i < allStakedTokens.length; i++) {
                address staker = tokenIdToStaker[allStakedTokens[i]];
                if (staker != address(0)) {
                    // Check if we've already counted this staker
                    bool alreadyCounted = false;
                    for (uint256 j = 0; j < uniqueCount; j++) {
                        if (uniqueAddresses[j] == staker) {
                            alreadyCounted = true;
                            break;
                        }
                    }

                    if (!alreadyCounted) {
                        uniqueAddresses[uniqueCount] = staker;
                        uniqueCount++;
                    }
                }
            }
            uniqueStakersCount = uniqueCount;
        }
    }

    /**
     * @dev Estimate unique stakers by sampling (gas-efficient for large arrays)
     * @param sampleSize Number of tokens to sample
     * @return Estimated number of unique stakers
     */
    function _estimateUniqueStakers(uint256 sampleSize) private view returns (uint256) {
        if (allStakedTokens.length == 0) return 0;
        if (sampleSize > allStakedTokens.length) sampleSize = allStakedTokens.length;

        address[] memory uniqueAddresses = new address[](sampleSize);
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < sampleSize; i++) {
            address staker = tokenIdToStaker[allStakedTokens[i]];
            if (staker != address(0)) {
                bool alreadyCounted = false;
                for (uint256 j = 0; j < uniqueCount; j++) {
                    if (uniqueAddresses[j] == staker) {
                        alreadyCounted = true;
                        break;
                    }
                }

                if (!alreadyCounted) {
                    uniqueAddresses[uniqueCount] = staker;
                    uniqueCount++;
                }
            }
        }

        // Scale up the result based on total array size
        return (uniqueCount * allStakedTokens.length) / sampleSize;
    }

    /**
     * @dev Get contract version
     * @return Version string
     */
    function getContractVersion() external pure returns (string memory) {
        return CONTRACT_VERSION;
    }

    /**
     * @dev Get boost information
     * @return boostActive Whether boost period is still active
     * @return boostEndsAt Timestamp when boost period ends
     * @return remainingBoostTime Seconds remaining in boost period (0 if ended)
     */
    function getBoostInfo() external view returns (
        bool boostActive,
        uint256 boostEndsAt,
        uint256 remainingBoostTime
    ) {
        boostEndsAt = deploymentTime + BOOST_PERIOD;
        boostActive = block.timestamp < boostEndsAt;

        if (boostActive) {
            remainingBoostTime = boostEndsAt - block.timestamp;
        }

        return (boostActive, boostEndsAt, remainingBoostTime);
    }

    /**
     * @dev Get snapshot of all stakers with their NFTs and stake durations
     * @return stakers Array of staker addresses
     * @return tokenIds Array of arrays - each sub-array contains token IDs for corresponding staker
     * @return stakeDurations Array of arrays - each sub-array contains stake durations for corresponding staker's tokens
     */
    function getStakersSnapshot() external view returns (
        address[] memory stakers,
        uint256[][] memory tokenIds,
        uint256[][] memory stakeDurations
    ) {
        // First pass: collect unique stakers
        address[] memory uniqueStakers = new address[](allStakedTokens.length);
        uint256 uniqueStakerCount = 0;

        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            address staker = tokenIdToStaker[allStakedTokens[i]];

            if (staker != address(0)) {
                bool found = false;
                for (uint256 j = 0; j < uniqueStakerCount; j++) {
                    if (uniqueStakers[j] == staker) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    uniqueStakers[uniqueStakerCount] = staker;
                    uniqueStakerCount++;
                }
            }
        }

        // Resize arrays to actual size
        stakers = new address[](uniqueStakerCount);
        tokenIds = new uint256[][](uniqueStakerCount);
        stakeDurations = new uint256[][](uniqueStakerCount);

        for (uint256 i = 0; i < uniqueStakerCount; i++) {
            stakers[i] = uniqueStakers[i];
        }

        // Second pass: collect tokens and durations for each staker
        for (uint256 i = 0; i < uniqueStakerCount; i++) {
            address staker = stakers[i];
            uint256[] storage userTokens = userToStakedTokenIds[staker];

            // Count valid tokens for this staker
            uint256 validTokenCount = 0;
            for (uint256 j = 0; j < userTokens.length; j++) {
                if (tokenIdToStaker[userTokens[j]] == staker) {
                    validTokenCount++;
                }
            }

            // Initialize arrays for this staker
            tokenIds[i] = new uint256[](validTokenCount);
            stakeDurations[i] = new uint256[](validTokenCount);

            // Fill arrays with valid data
            uint256 index = 0;
            for (uint256 j = 0; j < userTokens.length; j++) {
                uint256 tokenId = userTokens[j];

                if (tokenIdToStaker[tokenId] == staker) {
                    tokenIds[i][index] = tokenId;
                    stakeDurations[i][index] = _calculateBoostedDuration(tokenIdToStakeTimestamp[tokenId]); // BOOSTED!
                    index++;
                }
            }
        }

        return (stakers, tokenIds, stakeDurations);
    }

    /**
     * @dev Clean ghost data from user arrays (emergency function)
     * @param users Array of user addresses to clean
     */
    function cleanGhostData(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256[] storage userTokens = userToStakedTokenIds[user];

            // Remove all ghost entries
            uint256 writeIndex = 0;
            for (uint256 j = 0; j < userTokens.length; j++) {
                uint256 tokenId = userTokens[j];

                // Keep only if actually staked
                if (tokenIdToStaker[tokenId] == user) {
                    userTokens[writeIndex] = tokenId;
                    tokenIdToArrayIndex[tokenId] = writeIndex;
                    writeIndex++;
                }
            }

            // Remove excess elements
            while (userTokens.length > writeIndex) {
                userTokens.pop();
            }
        }
    }

    // ============ Admin Functions ============

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdraw specific NFTs - ONLY to their original stakers
     * @param tokenIds Array of token IDs to withdraw
     */
    function emergencyWithdrawToOwners(uint256[] calldata tokenIds) external onlyOwner {
        if (tokenIds.length == 0) revert InvalidArrayLength();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            address staker = tokenIdToStaker[tokenId];

            // Can only withdraw if there's a valid staker
            if (staker != address(0)) {
                // Remove from staking data
                _removeStakedToken(staker, tokenId);
                totalStaked--;

                // Clear cooldown data if exists
                delete tokenIdToCooldownStart[tokenId];
                delete tokenIdOnCooldown[tokenId];

                // Transfer NFT back to its original staker
                nftCollection.transferFrom(address(this), staker, tokenId);
            }
        }

        emit EmergencyWithdraw(msg.sender, tokenIds, address(0)); // address(0) indicates returned to owners
    }

    /**
     * @dev Emergency withdraw all NFTs back to stakers - FIXED: Proper array cleanup
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 withdrawCount = 0;
        uint256[] memory withdrawnTokens = new uint256[](allStakedTokens.length);

        // Store all unique stakers to clean their arrays
        address[] memory uniqueStakers = new address[](allStakedTokens.length);
        uint256 uniqueStakerCount = 0;

        // Process all staked tokens
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            address staker = tokenIdToStaker[tokenId];

            if (staker != address(0)) {
                // Transfer NFT back to original staker
                nftCollection.transferFrom(address(this), staker, tokenId);

                // Track unique stakers
                bool found = false;
                for (uint256 j = 0; j < uniqueStakerCount; j++) {
                    if (uniqueStakers[j] == staker) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    uniqueStakers[uniqueStakerCount] = staker;
                    uniqueStakerCount++;
                }

                // Clear individual mappings
                delete tokenIdToStaker[tokenId];
                delete tokenIdToStakeTimestamp[tokenId];
                delete tokenIdToCooldownStart[tokenId];
                delete tokenIdOnCooldown[tokenId];
                delete tokenIdToArrayIndex[tokenId];
                delete tokenIdToAllStakedIndex[tokenId];

                withdrawnTokens[withdrawCount] = tokenId;
                withdrawCount++;
            }
        }

        // Clean user arrays for all stakers
        for (uint256 i = 0; i < uniqueStakerCount; i++) {
            delete userToStakedTokenIds[uniqueStakers[i]];
        }

        // Clear global arrays
        delete allStakedTokens;
        totalStaked = 0;

        emit EmergencyWithdrawAll(withdrawCount, block.timestamp);
    }

    // ============ Safe Contract Migration ============

    /**
     * @dev Safely transfer NFTs to a new contract (KEEPS ORIGINAL DATA FOR SAFETY)
     * @param newContract Address of the new staking contract
     * @param tokenIds Array of token IDs to transfer (max 10 at once)
     */
    function safeTransferToNewContract(
        address newContract,
        uint256[] calldata tokenIds
    ) external onlyOwner nonReentrant {
        if (newContract == address(0)) revert ZeroAddress();
        if (tokenIds.length == 0 || tokenIds.length > 10) revert InvalidArrayLength();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            address staker = tokenIdToStaker[tokenId];

            if (staker != address(0)) {
                // SECURITY: Only transfer NFT, KEEP all staking data intact
                // This allows emergency withdrawal if migration fails
                nftCollection.transferFrom(address(this), newContract, tokenId);

                // NOTE: We intentionally DO NOT call _removeStakedToken or delete data
                // Original staking data remains intact for safety
                // If migration succeeds, target contract will have the data
                // If migration fails, users can still emergency withdraw from here
            }
        }

        emit ContractMigration(newContract, tokenIds);
    }


    // ============ Internal Functions ============

    /**
     * @dev Remove a staked token from tracking arrays
     * @param staker Address of the staker
     * @param tokenId Token ID to remove
     */
    function _removeStakedToken(address staker, uint256 tokenId) private {
        // CRITICAL: Bounds checks
        uint256[] storage userTokens = userToStakedTokenIds[staker];
        if (userTokens.length == 0) return; // Nothing to remove
        if (allStakedTokens.length == 0) return; // Nothing to remove

        // Remove from user's array
        uint256 index = tokenIdToArrayIndex[tokenId];
        if (index >= userTokens.length) return; // Invalid index
        uint256 lastIndex = userTokens.length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = userTokens[lastIndex];
            userTokens[index] = lastTokenId;
            tokenIdToArrayIndex[lastTokenId] = index;
        }

        userTokens.pop();
        delete tokenIdToArrayIndex[tokenId];

        // Remove from global array
        uint256 globalIndex = tokenIdToAllStakedIndex[tokenId];
        if (globalIndex >= allStakedTokens.length) return; // Invalid index

        uint256 globalLastIndex = allStakedTokens.length - 1;

        if (globalIndex != globalLastIndex) {
            uint256 lastGlobalTokenId = allStakedTokens[globalLastIndex];
            allStakedTokens[globalIndex] = lastGlobalTokenId;
            tokenIdToAllStakedIndex[lastGlobalTokenId] = globalIndex;
        }

        allStakedTokens.pop();
        delete tokenIdToAllStakedIndex[tokenId];

        // Clear staking data
        delete tokenIdToStaker[tokenId];
        delete tokenIdToStakeTimestamp[tokenId];
    }

    // ============ Reward Distribution ============

    /**
     * @dev Calculate boosted stake duration (3x for first week)
     * @param stakeTimestamp When the NFT was staked
     * @return Boosted stake duration in seconds
     */
    function _calculateBoostedDuration(uint256 stakeTimestamp) private view returns (uint256) {
        uint256 currentTime = block.timestamp;
        uint256 boostPeriodEnd = deploymentTime + BOOST_PERIOD;

        // If staked after boost period, no boost
        if (stakeTimestamp >= boostPeriodEnd) {
            return currentTime - stakeTimestamp;
        }

        // If we're still in boost period
        if (currentTime <= boostPeriodEnd) {
            // All stake time is boosted
            return (currentTime - stakeTimestamp) * BOOST_MULTIPLIER;
        }

        // If staked during boost but now it's after boost period
        // boosted part: from stake to end of boost (3x)
        // normal part: from end of boost to now (1x)
        uint256 boostedPart = (boostPeriodEnd - stakeTimestamp) * BOOST_MULTIPLIER;
        uint256 normalPart = currentTime - boostPeriodEnd;

        return boostedPart + normalPart;
    }

    /**
     * @dev Distribute rewards proportionally based on staking duration
     * WARNING: For large arrays (>1000 NFTs), use distributeRewardsBatch instead
     */
    function distributeRewards() external payable onlyOwner nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (totalStaked == 0) revert NoStakedTokens();

        // Prevent gas issues with large arrays
        if (allStakedTokens.length > 1000) {
            revert("Use distributeRewardsBatch for large arrays");
        }

        uint256 totalAmount = msg.value;
        uint256 totalStakeSeconds = 0;

        // Calculate total stake-seconds (with boost!)
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            uint256 stakeDuration = _calculateBoostedDuration(tokenIdToStakeTimestamp[tokenId]);
            totalStakeSeconds += stakeDuration;
        }

        // !!! Prevent division by zero !!!!
        if (totalStakeSeconds == 0) {
            // Distribute equally if all tokens were staked at same block
            uint256 rewardPerToken = totalAmount / allStakedTokens.length;
            for (uint256 i = 0; i < allStakedTokens.length; i++) {
                uint256 tokenId = allStakedTokens[i];
                address staker = tokenIdToStaker[tokenId];

                if (staker != address(0)) {
                    uint256 reward = (i == allStakedTokens.length - 1) ?
                        totalAmount - (rewardPerToken * i) : rewardPerToken;

                    totalRewardsReceived[staker] += reward;
                    lastRewardDistribution[staker] = block.timestamp;

                    (bool success, ) = staker.call{value: reward}("");
                    if (!success) revert TransferFailed();

                    emit IndividualReward(staker, reward, 0);
                }
            }

            totalRewardsDistributed += totalAmount;
            lastDistributionTimestamp = block.timestamp;
            emit RewardsDistributed(totalAmount, 0, allStakedTokens.length, block.timestamp);
            return;
        }

        uint256 distributedAmount = 0;
        uint256 recipientCount = 0;
        uint256 remainingAmount = totalAmount;

        // Distribute rewards with precision fix maybe...
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            address staker = tokenIdToStaker[tokenId];
            uint256 stakeDuration = _calculateBoostedDuration(tokenIdToStakeTimestamp[tokenId]); // BOOSTED!

            uint256 reward;

            // Last recipient gets all remaining amount to prevent precision loss
            if (i == allStakedTokens.length - 1) {
                reward = remainingAmount;
            } else {
                reward = (totalAmount * stakeDuration) / totalStakeSeconds;
                if (reward > remainingAmount) reward = remainingAmount;
                remainingAmount -= reward;
            }

            if (reward > 0 && staker != address(0)) {
                totalRewardsReceived[staker] += reward;
                lastRewardDistribution[staker] = block.timestamp;
                distributedAmount += reward;

                (bool success, ) = staker.call{value: reward}("");
                if (!success) revert TransferFailed();

                emit IndividualReward(staker, reward, stakeDuration);
                recipientCount++;
            }
        }

        totalRewardsDistributed += distributedAmount;
        lastDistributionTimestamp = block.timestamp;

        emit RewardsDistributed(totalAmount, totalStakeSeconds, recipientCount, block.timestamp);
    }

    // State variable to cache total stake seconds for batch processing
    uint256 private cachedTotalStakeSeconds;
    uint256 private lastStakeSecondsUpdate;

    /**
     * @dev Update cached total stake seconds (call before batch distribution)
     */
    function updateTotalStakeSeconds() external onlyOwner {
        uint256 totalStakeSeconds = 0;

        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            uint256 stakeDuration = _calculateBoostedDuration(tokenIdToStakeTimestamp[tokenId]); // BOOSTED!
            totalStakeSeconds += stakeDuration;
        }

        cachedTotalStakeSeconds = totalStakeSeconds;
        lastStakeSecondsUpdate = block.timestamp;
    }

    /**
     * @dev Batch reward distribution for large arrays (gas-optimized)
     * @param startIndex Starting index in allStakedTokens array
     * @param batchSize Number of tokens to process (max 200)
     */
    function distributeRewardsBatch(
        uint256 startIndex,
        uint256 batchSize
    ) external payable onlyOwner nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (totalStaked == 0) revert NoStakedTokens();
        if (batchSize > 200) revert InvalidArrayLength(); // Max 200 per batch
        if (startIndex >= allStakedTokens.length) revert InvalidAmount();

        // Ensure total stake seconds is updated recently (within 1 hour)
        if (block.timestamp - lastStakeSecondsUpdate > 3600) {
            revert("Call updateTotalStakeSeconds first");
        }

        uint256 endIndex = startIndex + batchSize;
        if (endIndex > allStakedTokens.length) {
            endIndex = allStakedTokens.length;
        }

        uint256 totalAmount = msg.value;
        uint256 totalStakeSeconds = cachedTotalStakeSeconds;

        // CRITICAL: Prevent division by zero in batch ..
        if (totalStakeSeconds == 0) {
            // Distribute equally among batch tokens
            uint256 batchTokenCount = endIndex - startIndex;
            uint256 rewardPerToken = totalAmount / batchTokenCount;
            uint256 distributedAmount = 0;

            for (uint256 i = startIndex; i < endIndex; i++) {
                uint256 tokenId = allStakedTokens[i];
                address staker = tokenIdToStaker[tokenId];

                if (staker != address(0)) {
                    uint256 reward = (i == endIndex - 1) ?
                        totalAmount - distributedAmount : rewardPerToken;

                    totalRewardsReceived[staker] += reward;
                    lastRewardDistribution[staker] = block.timestamp;
                    distributedAmount += reward;

                    (bool success, ) = staker.call{value: reward}("");
                    if (!success) revert TransferFailed();

                    emit IndividualReward(staker, reward, 0);
                }
            }

            totalRewardsDistributed += distributedAmount;
            lastDistributionTimestamp = block.timestamp;
            emit RewardsDistributed(distributedAmount, 0, batchTokenCount, block.timestamp);
            return;
        }

        uint256 distributedAmount = 0;
        uint256 recipientCount = 0;

        // Second pass: Distribute to batch only
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 tokenId = allStakedTokens[i];
            address staker = tokenIdToStaker[tokenId];
            uint256 stakeDuration = _calculateBoostedDuration(tokenIdToStakeTimestamp[tokenId]); // BOOSTED!

            uint256 reward = (totalAmount * stakeDuration) / totalStakeSeconds;

            if (reward > 0 && staker != address(0)) {
                totalRewardsReceived[staker] += reward;
                lastRewardDistribution[staker] = block.timestamp;
                distributedAmount += reward;

                (bool success, ) = staker.call{value: reward}("");
                if (!success) revert TransferFailed();

                emit IndividualReward(staker, reward, stakeDuration);
                recipientCount++;
            }
        }

        totalRewardsDistributed += distributedAmount;
        lastDistributionTimestamp = block.timestamp;

        emit RewardsDistributed(distributedAmount, totalStakeSeconds, recipientCount, block.timestamp);
    }
}
