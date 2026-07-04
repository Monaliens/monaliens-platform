// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTStakingFixed
 * @dev Fixed version of NFT Staking contract with all bugs resolved
 */
contract NFTStakingFixed is ReentrancyGuard, Pausable, Ownable {
    // ============ Constants ============
    // TEST MODE: 10 minutes, PRODUCTION: 5 days
    uint256 public constant COOLDOWN_PERIOD = 10 minutes; // 600 seconds for testing
    string public constant CONTRACT_VERSION = "1.0.2";
    
    // ============ State Variables ============
    IERC721 public immutable nftCollection;
    
    // Staking data structures
    mapping(uint256 => address) public tokenIdToStaker;
    mapping(uint256 => uint256) public tokenIdToStakeTimestamp;
    mapping(address => uint256[]) public userToStakedTokenIds;
    mapping(address => uint256) public totalRewardsReceived;
    
    // Track array indices for efficient removal
    mapping(uint256 => uint256) private tokenIdToArrayIndex;
    
    // Reward distribution tracking
    mapping(address => uint256) public lastRewardDistribution;
    uint256 public totalRewardsDistributed;
    uint256 public lastDistributionTimestamp;
    
    // Statistics
    uint256 public totalStaked;
    
    // Track all staked tokens for iteration
    uint256[] private allStakedTokens;
    mapping(uint256 => uint256) private tokenIdToAllStakedIndex;
    
    // ============ Events ============
    event NFTStaked(address indexed staker, uint256[] tokenIds, uint256 timestamp);
    event NFTUnstaked(address indexed staker, uint256[] tokenIds, uint256 timestamp);
    event EmergencyWithdraw(address indexed owner, uint256[] tokenIds, address indexed to);
    event EmergencyWithdrawAll(uint256 totalWithdrawn, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDistributed(uint256 totalAmount, uint256 totalStakeSeconds, uint256 recipientCount, uint256 timestamp);
    event IndividualReward(address indexed staker, uint256 amount, uint256 stakeSeconds);
    
    // ============ Errors ============
    error NotTokenOwner();
    error NotStaker();
    error InvalidArrayLength();
    error CooldownNotMet();
    error NoStakedTokens();
    error InsufficientRewards();
    error ZeroAddress();
    error InvalidAmount();
    error TransferFailed();
    error TokenNotStaked();
    
    // ============ Constructor ============
    constructor(address _nftCollection) {
        if (_nftCollection == address(0)) revert ZeroAddress();
        nftCollection = IERC721(_nftCollection);
    }
    
    // ============ Staking Functions ============
    
    /**
     * @dev Stake multiple NFTs - FIXED: whenNotPaused properly enforced
     * @param tokenIds Array of token IDs to stake
     */
    function stake(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        if (tokenIds.length == 0) revert InvalidArrayLength();
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            // FIXED: Verify ownership before transfer
            if (nftCollection.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
            
            // FIXED: Additional check to prevent double staking
            if (tokenIdToStaker[tokenId] != address(0)) revert TokenNotStaked();
            
            // Transfer NFT to contract
            nftCollection.transferFrom(msg.sender, address(this), tokenId);
            
            // Update staking data
            tokenIdToStaker[tokenId] = msg.sender;
            tokenIdToStakeTimestamp[tokenId] = block.timestamp;
            
            // Add to user's staked tokens array
            tokenIdToArrayIndex[tokenId] = userToStakedTokenIds[msg.sender].length;
            userToStakedTokenIds[msg.sender].push(tokenId);
            
            // Add to global staked tokens array
            tokenIdToAllStakedIndex[tokenId] = allStakedTokens.length;
            allStakedTokens.push(tokenId);
        }
        
        totalStaked += tokenIds.length;
        
        emit NFTStaked(msg.sender, tokenIds, block.timestamp);
    }
    // Trying
    /**
     * @dev Unstake multiple NFTs with cooldown check - FIXED: Better validation
     * @param tokenIds Array of token IDs to unstake
     */
    function unstake(uint256[] calldata tokenIds) external nonReentrant {
        if (tokenIds.length == 0) revert InvalidArrayLength();
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            // FIXED: Better validation for staker
            if (tokenIdToStaker[tokenId] != msg.sender) revert NotStaker();
            
            // Check cooldown period
            if (block.timestamp < tokenIdToStakeTimestamp[tokenId] + COOLDOWN_PERIOD) {
                revert CooldownNotMet();
            }
            
            // Remove from staking data
            _removeStakedToken(msg.sender, tokenId);
            
            // Transfer NFT back to user
            nftCollection.transferFrom(address(this), msg.sender, tokenId);
        }
        
        totalStaked -= tokenIds.length;
        
        emit NFTUnstaked(msg.sender, tokenIds, block.timestamp);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get all staked NFTs for a user with staking durations
     * @param user Address of the user
     * @return tokenIds Array of staked token IDs
     * @return stakeDurations Array of staking durations in seconds
     */
    function getStakedNFTs(address user) external view returns (
        uint256[] memory tokenIds,
        uint256[] memory stakeDurations
    ) {
        uint256[] memory stakedTokens = userToStakedTokenIds[user];
        uint256 length = stakedTokens.length;
        
        tokenIds = new uint256[](length);
        stakeDurations = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = stakedTokens[i];
            tokenIds[i] = tokenId;
            stakeDurations[i] = block.timestamp - tokenIdToStakeTimestamp[tokenId];
        }
        
        return (tokenIds, stakeDurations);
    }
    
    /**
     * @dev Get staking info for a specific token
     * @param tokenId Token ID to query
     * @return staker Address of the staker
     * @return stakedAt Timestamp when staked
     * @return canUnstake Whether cooldown period has passed
     */
    function getStakingInfo(uint256 tokenId) external view returns (
        address staker,
        uint256 stakedAt,
        bool canUnstake
    ) {
        staker = tokenIdToStaker[tokenId];
        stakedAt = tokenIdToStakeTimestamp[tokenId];
        canUnstake = block.timestamp >= stakedAt + COOLDOWN_PERIOD;
        
        return (staker, stakedAt, canUnstake);
    }
    
    /**
     * @dev Get remaining cooldown time for a token
     * @param tokenId Token ID to query
     * @return remainingTime Remaining cooldown in seconds (0 if ready)
     */
    function getRemainingCooldown(uint256 tokenId) external view returns (uint256 remainingTime) {
        uint256 stakedAt = tokenIdToStakeTimestamp[tokenId];
        if (stakedAt == 0) return 0;
        
        uint256 cooldownEnd = stakedAt + COOLDOWN_PERIOD;
        if (block.timestamp >= cooldownEnd) {
            return 0;
        }
        return cooldownEnd - block.timestamp;
    }
    
    /**
     * @dev Get number of NFTs staked by a user
     * @param user Address to query
     * @return Number of NFTs staked
     */
    function getUserStakedCount(address user) external view returns (uint256) {
        return userToStakedTokenIds[user].length;
    }
    
    /**
     * @dev Get contract statistics
     * @return totalNFTsStaked Total number of NFTs currently staked
     * @return uniqueStakersCount Number of unique addresses with staked NFTs
     * @return totalRewardsDistributedAmount Total rewards distributed in wei
     */
    function getContractStats() external view returns (
        uint256 totalNFTsStaked,
        uint256 uniqueStakersCount,
        uint256 totalRewardsDistributedAmount
    ) {
        totalNFTsStaked = totalStaked;
        totalRewardsDistributedAmount = totalRewardsDistributed;
        
        // Count unique stakers using a more reliable method
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
    
    /**
     * @dev Get contract version
     * @return Version string
     */
    function getContractVersion() external pure returns (string memory) {
        return CONTRACT_VERSION;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Emergency withdraw specific NFTs - FIXED: Better implementation
     * @param tokenIds Array of token IDs to withdraw
     * @param to Address to send NFTs to
     */
    function emergencyWithdrawNFT(uint256[] calldata tokenIds, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (tokenIds.length == 0) revert InvalidArrayLength();
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            address staker = tokenIdToStaker[tokenId];
            
            if (staker != address(0)) {
                // Remove from staking data
                _removeStakedToken(staker, tokenId);
                totalStaked--;
            }
            
            // Transfer NFT to specified address
            nftCollection.transferFrom(address(this), to, tokenId);
        }
        
        emit EmergencyWithdraw(msg.sender, tokenIds, to);
    }
    
    /**
     * @dev FIXED: Properly implemented emergency withdraw all
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 withdrawCount = 0;
        uint256[] memory withdrawnTokens = new uint256[](allStakedTokens.length);
        
        // Process all staked tokens
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            address staker = tokenIdToStaker[tokenId];
            
            if (staker != address(0)) {
                // Transfer NFT back to original staker
                nftCollection.transferFrom(address(this), staker, tokenId);
                
                // Clear staking data
                delete tokenIdToStaker[tokenId];
                delete tokenIdToStakeTimestamp[tokenId];
                
                withdrawnTokens[withdrawCount] = tokenId;
                withdrawCount++;
            }
        }
        
        // Clear arrays (expensive but emergency only)
        delete allStakedTokens;
        totalStaked = 0;
        
        emit EmergencyWithdrawAll(withdrawCount, block.timestamp);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Remove a staked token from tracking arrays
     * @param staker Address of the staker
     * @param tokenId Token ID to remove
     */
    function _removeStakedToken(address staker, uint256 tokenId) private {
        // Remove from user's array
        uint256 index = tokenIdToArrayIndex[tokenId];
        uint256[] storage userTokens = userToStakedTokenIds[staker];
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
     * @dev Distribute rewards proportionally based on staking duration
     */
    function distributeRewards() external payable onlyOwner nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (totalStaked == 0) revert NoStakedTokens();
        
        uint256 totalAmount = msg.value;
        uint256 totalStakeSeconds = 0;
        
        // Calculate total stake-seconds
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            uint256 stakeDuration = block.timestamp - tokenIdToStakeTimestamp[tokenId];
            totalStakeSeconds += stakeDuration;
        }
        
        uint256 distributedAmount = 0;
        uint256 recipientCount = 0;
        
        // Distribute rewards
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            address staker = tokenIdToStaker[tokenId];
            uint256 stakeDuration = block.timestamp - tokenIdToStakeTimestamp[tokenId];
            
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
        
        emit RewardsDistributed(totalAmount, totalStakeSeconds, recipientCount, block.timestamp);
    }
    
    /**
     * @dev Simulate reward distribution for UI preview
     */
    function simulateRewardDistribution() external view returns (
        address[] memory stakers,
        uint256[] memory expectedRewards,
        uint256[] memory percentages
    ) {
        if (totalStaked == 0) revert NoStakedTokens();
        
        uint256 uniqueStakerCount = 0;
        address[] memory tempStakers = new address[](totalStaked);
        uint256[] memory tempRewards = new uint256[](totalStaked);
        
        uint256 totalStakeSeconds = 0;
        
        // Calculate total stake-seconds
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            uint256 stakeDuration = block.timestamp - tokenIdToStakeTimestamp[tokenId];
            totalStakeSeconds += stakeDuration;
        }
        
        // Calculate rewards per staker
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            uint256 tokenId = allStakedTokens[i];
            address staker = tokenIdToStaker[tokenId];
            
            bool found = false;
            uint256 stakerIndex = 0;
            
            for (uint256 j = 0; j < uniqueStakerCount; j++) {
                if (tempStakers[j] == staker) {
                    found = true;
                    stakerIndex = j;
                    break;
                }
            }
            
            uint256 stakeDuration = block.timestamp - tokenIdToStakeTimestamp[tokenId];
            uint256 reward = (1 ether * stakeDuration) / totalStakeSeconds;
            
            if (!found) {
                tempStakers[uniqueStakerCount] = staker;
                tempRewards[uniqueStakerCount] = reward;
                uniqueStakerCount++;
            } else {
                tempRewards[stakerIndex] += reward;
            }
        }
        
        // Prepare return arrays
        stakers = new address[](uniqueStakerCount);
        expectedRewards = new uint256[](uniqueStakerCount);
        percentages = new uint256[](uniqueStakerCount);
        
        for (uint256 i = 0; i < uniqueStakerCount; i++) {
            stakers[i] = tempStakers[i];
            expectedRewards[i] = tempRewards[i];
            percentages[i] = (tempRewards[i] * 10000) / 1 ether;
        }
        
        return (stakers, expectedRewards, percentages);
    }
    
    // ============ Migration Support ============
    
    /**
     * @dev Export current state for migration
     */
    function exportSnapshot(uint256 offset, uint256 limit) external view returns (
        string memory version,
        uint256 totalStakedCount,
        uint256 uniqueStakers,
        uint256 totalRewardsDistributedAmount,
        uint256[] memory tokenIds,
        address[] memory stakers,
        uint256[] memory timestamps
    ) {
        version = CONTRACT_VERSION;
        totalStakedCount = totalStaked;
        totalRewardsDistributedAmount = totalRewardsDistributed;
        
        uint256 end = offset + limit;
        if (end > allStakedTokens.length) {
            end = allStakedTokens.length;
        }
        
        uint256 length = end - offset;
        tokenIds = new uint256[](length);
        stakers = new address[](length);
        timestamps = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = allStakedTokens[offset + i];
            tokenIds[i] = tokenId;
            stakers[i] = tokenIdToStaker[tokenId];
            timestamps[i] = tokenIdToStakeTimestamp[tokenId];
        }
        
        // Count unique stakers
        uint256 uniqueCount = 0;
        for (uint256 i = 0; i < allStakedTokens.length; i++) {
            address staker = tokenIdToStaker[allStakedTokens[i]];
            if (staker != address(0) && userToStakedTokenIds[staker].length > 0) {
                uniqueCount++;
                i += userToStakedTokenIds[staker].length - 1;
            }
        }
        uniqueStakers = uniqueCount;
        
        return (version, totalStakedCount, uniqueStakers, totalRewardsDistributedAmount, tokenIds, stakers, timestamps);
    }
    
    // ============ Pause Functions ============
    
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
}