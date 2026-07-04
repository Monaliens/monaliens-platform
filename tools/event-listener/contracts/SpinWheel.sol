// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

contract SpinWheel is Ownable {
    struct Reward {
        string name;
        uint256 amount;  // Amount in wei
        uint256 chance;  // Chance out of TOTAL_CHANCES
    }
    
    // Spin history record
    struct SpinRecord {
        string rewardName;
        uint256 rewardAmount;
        bool usedNFT;
        uint256 nftId;
        uint256 timestamp;
    }

    // Add new struct for batch query results after the Reward and SpinRecord structs
    struct NFTSpinInfo {
        uint256 nftId;
        bool isOwned;
        uint256 spinsRemaining;
    }

    // Constants
    uint256 private constant TOTAL_CHANCES = 10000; // Total chances (100%) - updated from 1000 to 10000
    uint256 private constant MAX_HISTORY_PER_USER = 20; // Store up to 20 most recent spins per user
    uint256 private constant RESET_PERIOD = 1 days; // Spins reset after 24 hours

    // Game state variables
    Reward[] public rewards;
    mapping(address => uint256) public playerLastSpinTimestamp;
    mapping(address => Reward) public playerLastReward;
    uint256 public cooldownPeriod = 1 hours; // Default 1 hour cooldown
    
    // Spin history
    mapping(address => SpinRecord[]) private playerSpinHistory;
    
    // NFT integration
    IERC721 public nftContract;
    bool public isEnumerableNFT;
    mapping(uint256 => uint256) public nftSpinsUsed; // NFT ID => Spins used
    mapping(uint256 => uint256) public nftLastResetTime; // NFT ID => Last reset timestamp
    uint256 public spinsPerNFT = 2; // Each NFT gives 2 spins
    bool public nftIntegrationEnabled = false;
    
    // Track whitelist rewards already received by each wallet
    mapping(address => bool) public hasFcfsWhitelist;
    mapping(address => bool) public hasGtdWhitelist;
    
    // Dev wallet that can withdraw funds
    address public devWallet;
    
    // Counter to ensure different random values in recursive calls
    uint256 private spinCounter;
    
    // Events
    event WheelSpun(address indexed player, string rewardName, uint256 rewardAmount, bool usedNFT, uint256 nftId);
    event RewardAdded(string name, uint256 amount, uint256 chance);
    event RewardUpdated(uint256 indexed rewardId, string name, uint256 amount, uint256 chance);
    event RewardRemoved(uint256 indexed rewardId);
    event CooldownPeriodUpdated(uint256 newPeriod);
    event DevWalletUpdated(address indexed newDevWallet);
    event Withdrawn(address indexed to, uint256 amount);
    event NFTContractSet(address indexed nftContract, bool isEnumerable);
    event SpinsPerNFTUpdated(uint256 newSpinsPerNFT);
    event NFTIntegrationStatusChanged(bool enabled);
    event NFTSpinsReset(address indexed player, uint256 nftId, uint256 timestamp);

    constructor() {
        // Set dev wallet to owner initially
        devWallet = owner();
        
        // Initialize with new reward percentages based on 10000
        _addReward("Monad", 1.0 ether, 4115);       // 41.15%
        _addReward("Monad", 5.0 ether, 400);        // 4.00%
        _addReward("Monad", 10.0 ether, 200);       // 2.00%
        _addReward("Monad", 20.0 ether, 100);       // 1.00%
        _addReward("Monad", 50.0 ether, 50);        // 0.50%
        _addReward("Monad", 100.0 ether, 20);       // 0.20%
        _addReward("Monad", 500.0 ether, 5);        // 0.05%
        _addReward("Nothing", 0.0 ether, 5000);     // 50.00%
        _addReward("Monaliens fcfs whitelist", 0.0001 ether, 100); // 1.00%
        _addReward("Monaliens gtd whitelist", 0.0001 ether, 10);  // 0.10%
    }

    // Public functions
    function spinWheel() external returns (string memory, uint256) {
        // Normal spinning is disabled, only NFT-based spinning is active
        revert("Normal spinning is disabled. Please use spinWheelWithNFT instead.");
    }
    
    // Spin with specific NFT ID
    function spinWheelWithNFT(uint256 nftId) external returns (string memory, uint256) {
        require(nftIntegrationEnabled, "NFT integration is not enabled");
        require(nftContract.ownerOf(nftId) == msg.sender, "You don't own this NFT");
        
        // Check if we need to reset daily spins
        _checkAndResetDailySpins(nftId);
        
        // Check if this is the first time using this NFT with the current flag
        if (_initialSpinFlag[nftId] == 0) {
            _initialSpinFlag[nftId] = _resetAllSpinsFlag ? 2 : 1;
            nftSpinsUsed[nftId] = 0;
        } else if (_initialSpinFlag[nftId] != uint256(_resetAllSpinsFlag ? 2 : 1)) {
            // Flag has changed, reset the spins
            _initialSpinFlag[nftId] = _resetAllSpinsFlag ? 2 : 1;
            nftSpinsUsed[nftId] = 0;
        }
        
        require(nftSpinsUsed[nftId] < spinsPerNFT, "No more spins left for this NFT");
        
        nftSpinsUsed[nftId]++;
        return _spinWheel(nftId, true);
    }
    
    // Internal function for spin logic
    function _spinWheel(uint256 nftId, bool usedNFT) internal returns (string memory, uint256) {
        // Generate pseudo-random number using block information and sender
        uint256 randomValue = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            blockhash(block.number - 1),
            nftId,
            spinCounter
        ))) % TOTAL_CHANCES;
        
        uint256 cumulativeChance = 0;
        
        for (uint256 i = 0; i < rewards.length; i++) {
            cumulativeChance += rewards[i].chance;
            if (randomValue < cumulativeChance) {
                // Check if this is a whitelist reward the user already has
                string memory rewardName = rewards[i].name;
                if (_isWhitelistDuplicate(msg.sender, rewardName)) {
                    // Re-spin if this is a duplicate whitelist
                    spinCounter++;
                    return _spinWheel(nftId, usedNFT); // Note: this is recursive and gas intensive
                }
                
                // If it's a whitelist reward, mark it as received
                if (_isWhitelistReward(rewardName)) {
                    _markWhitelistReceived(msg.sender, rewardName);
                }
                
                // Winner!
                _sendReward(msg.sender, i, true, nftId);
                return (rewards[i].name, rewards[i].amount);
            }
        }
        
        // Fallback to first reward (shouldn't happen unless chances don't add up to TOTAL_CHANCES)
        _sendReward(msg.sender, 0, true, nftId);
        return (rewards[0].name, rewards[0].amount);
    }
    
    // Helper functions for whitelist checking
    function _isWhitelistReward(string memory rewardName) internal pure returns (bool) {
        return 
            keccak256(bytes(rewardName)) == keccak256(bytes("Monaliens fcfs whitelist")) ||
            keccak256(bytes(rewardName)) == keccak256(bytes("Monaliens gtd whitelist"));
    }
    
    function _isWhitelistDuplicate(address player, string memory rewardName) internal view returns (bool) {
        bytes32 nameHash = keccak256(bytes(rewardName));
        
        if (nameHash == keccak256(bytes("Monaliens fcfs whitelist"))) {
            return hasFcfsWhitelist[player];
        } else if (nameHash == keccak256(bytes("Monaliens gtd whitelist"))) {
            return hasGtdWhitelist[player];
        }
        
        return false;
    }
    
    function _markWhitelistReceived(address player, string memory rewardName) internal {
        bytes32 nameHash = keccak256(bytes(rewardName));
        
        if (nameHash == keccak256(bytes("Monaliens fcfs whitelist"))) {
            hasFcfsWhitelist[player] = true;
        } else if (nameHash == keccak256(bytes("Monaliens gtd whitelist"))) {
            hasGtdWhitelist[player] = true;
        }
    }

    // View functions
    function getRewardsCount() external view returns (uint256) {
        return rewards.length;
    }
    
    function getAllRewards() external view returns (Reward[] memory) {
        return rewards;
    }
    
    function canSpin(address player) external view returns (bool) {
        return block.timestamp >= playerLastSpinTimestamp[player] + cooldownPeriod;
    }
    
    function getLastReward(address player) external view returns (string memory, uint256) {
        Reward memory reward = playerLastReward[player];
        return (reward.name, reward.amount);
    }
    
    function getSpinHistory(address player) external view returns (SpinRecord[] memory) {
        return playerSpinHistory[player];
    }
    
    function getTotalChances() external pure returns (uint256) {
        return TOTAL_CHANCES;
    }
    
    function calculateRemainingChances() external view returns (uint256) {
        uint256 usedChances = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            usedChances += rewards[i].chance;
        }
        return TOTAL_CHANCES - usedChances;
    }
    
    function getNFTSpinsRemaining(address player, uint256 nftId) external view returns (uint256) {
        if (!nftIntegrationEnabled) return 0;
        
        try nftContract.ownerOf(nftId) returns (address owner) {
            if (owner != player) return 0;
            
            // Check if we need to reset based on 24-hour period
            if (_shouldResetDailySpins(nftId)) {
                return spinsPerNFT; // Would be reset to full spins if called in a transaction
            }
            
            // If using the current flag, return normal value, otherwise return full spins
            // This creates the effect of resetting all spins without actually modifying the mapping
            uint256 initialFlag = _initialSpinFlag[nftId];
            if (initialFlag == 0) {
                // First time tracking this NFT, initialize the flag
                return spinsPerNFT;
            } else if (initialFlag != uint256(_resetAllSpinsFlag ? 2 : 1)) {
                // Flag has changed since this NFT was last used, so reset spins
                return spinsPerNFT;
            }
            
            return spinsPerNFT - nftSpinsUsed[nftId];
        } catch {
            return 0;
        }
    }
    
    function getWhitelistStatus(address player) external view returns (bool hasFcfs, bool hasGtd) {
        return (hasFcfsWhitelist[player], hasGtdWhitelist[player]);
    }
    
    // Get when a player last spun (timestamp)
    function getLastSpinTime(address player) external view returns (uint256) {
        return playerLastSpinTimestamp[player];
    }
    
    // Get time remaining until player can spin again (0 if can spin now)
    function getTimeUntilNextSpin(address player) external view returns (uint256) {
        uint256 lastSpin = playerLastSpinTimestamp[player];
        uint256 nextSpinTime = lastSpin + cooldownPeriod;
        
        if (block.timestamp >= nextSpinTime) {
            return 0; // Can spin now
        }
        
        return nextSpinTime - block.timestamp; // Seconds until can spin
    }
    
    // Check if daily spins should be reset
    function _shouldResetDailySpins(uint256 nftId) internal view returns (bool) {
        uint256 lastResetTime = nftLastResetTime[nftId];
        uint256 currentDay = block.timestamp / 1 days; // Current day since epoch
        uint256 lastResetDay = lastResetTime / 1 days; // Last reset day since epoch
        
        // Reset if never reset or if we're in a new day (00:00 UTC)
        return lastResetTime == 0 || currentDay > lastResetDay;
    }
    
    // Check and reset daily spins if needed
    function _checkAndResetDailySpins(uint256 nftId) internal {
        if (_shouldResetDailySpins(nftId)) {
            // Reset spins
            nftSpinsUsed[nftId] = 0;
            // Update reset timestamp to start of current day (00:00 UTC)
            uint256 currentDay = block.timestamp / 1 days;
            nftLastResetTime[nftId] = currentDay * 1 days; // Set to 00:00 UTC of current day
            emit NFTSpinsReset(msg.sender, nftId, nftLastResetTime[nftId]);
        }
    }
    
    // This function will only work with NFTs that support IERC721Enumerable interface
    function getUserNFTs(address player) external view returns (uint256[] memory) {
        if (!nftIntegrationEnabled || address(nftContract) == address(0)) {
            return new uint256[](0);
        }
        
        if (!isEnumerableNFT) {
            // Contract doesn't support enumeration, return empty array
            return new uint256[](0);
        }
        
        IERC721Enumerable enumNft = IERC721Enumerable(address(nftContract));
        uint256 balance = enumNft.balanceOf(player);
        if (balance == 0) {
            return new uint256[](0);
        }
        
        uint256[] memory tokenIds = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = enumNft.tokenOfOwnerByIndex(player, i);
        }
        
        return tokenIds;
    }

    // Admin functions
    function addReward(string calldata name, uint256 amount, uint256 chance) external onlyOwner {
        _addReward(name, amount, chance);
    }
    
    function updateReward(uint256 rewardId, string calldata name, uint256 amount, uint256 chance) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        
        rewards[rewardId].name = name;
        rewards[rewardId].amount = amount;
        rewards[rewardId].chance = chance;
        
        emit RewardUpdated(rewardId, name, amount, chance);
    }
    
    function removeReward(uint256 rewardId) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        
        // Swap with the last element and pop
        if (rewardId != rewards.length - 1) {
            rewards[rewardId] = rewards[rewards.length - 1];
        }
        rewards.pop();
        
        emit RewardRemoved(rewardId);
    }
    
    function updateCooldownPeriod(uint256 newPeriod) external onlyOwner {
        cooldownPeriod = newPeriod;
        emit CooldownPeriodUpdated(newPeriod);
    }
    
    function updateDevWallet(address newDevWallet) external onlyOwner {
        require(newDevWallet != address(0), "Invalid address");
        devWallet = newDevWallet;
        emit DevWalletUpdated(newDevWallet);
    }
    
    // Reset a user's whitelist status
    function resetWhitelistStatus(address user, bool resetFcfs, bool resetGtd) external onlyOwner {
        if (resetFcfs) {
            hasFcfsWhitelist[user] = false;
        }
        if (resetGtd) {
            hasGtdWhitelist[user] = false;
        }
    }
    
    // Set whitelist status for a user (to register existing whitelist holders from DB)
    function setWhitelistStatus(address user, bool hasFcfs, bool hasGtd) external onlyOwner {
        hasFcfsWhitelist[user] = hasFcfs;
        hasGtdWhitelist[user] = hasGtd;
    }
    
    // Batch set whitelist status for multiple users (efficient for migrating from DB)
    function batchSetWhitelistStatus(
        address[] calldata users, 
        bool[] calldata fcfsStatus, 
        bool[] calldata gtdStatus
    ) external onlyOwner {
        require(users.length == fcfsStatus.length && users.length == gtdStatus.length, "Array lengths must match");
        
        for (uint256 i = 0; i < users.length; i++) {
            hasFcfsWhitelist[users[i]] = fcfsStatus[i];
            hasGtdWhitelist[users[i]] = gtdStatus[i];
        }
    }
    
    // Only Owner or Dev wallet can withdraw funds
    function withdraw() external {
        require(
            msg.sender == owner() || msg.sender == devWallet, 
            "Only owner or dev wallet can withdraw"
        );
        
        uint256 amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawn(msg.sender, amount);
    }
    
    // NFT integration functions
    function setNFTContract(address _nftContract, bool _isEnumerable) external onlyOwner {
        require(_nftContract != address(0), "Invalid NFT contract address");
        nftContract = IERC721(_nftContract);
        isEnumerableNFT = _isEnumerable;
        emit NFTContractSet(_nftContract, _isEnumerable);
    }
    
    function setSpinsPerNFT(uint256 _spinsPerNFT) external onlyOwner {
        spinsPerNFT = _spinsPerNFT;
        emit SpinsPerNFTUpdated(_spinsPerNFT);
    }
    
    function setNFTIntegrationEnabled(bool _enabled) external onlyOwner {
        nftIntegrationEnabled = _enabled;
        emit NFTIntegrationStatusChanged(_enabled);
    }
    
    // Reset NFT spins for a specific NFT ID
    function resetNFTSpins(uint256 nftId) external onlyOwner {
        nftSpinsUsed[nftId] = 0;
        nftLastResetTime[nftId] = block.timestamp;
        emit NFTSpinsReset(msg.sender, nftId, block.timestamp);
    }
    
    // Set NFT spins used for migration from database
    function setNFTSpinsUsed(uint256 nftId, uint256 spinsUsed) external onlyOwner {
        require(spinsUsed <= spinsPerNFT, "Spins used cannot exceed spins per NFT");
        nftSpinsUsed[nftId] = spinsUsed;
        
        // Set reset time to start of today (00:00 UTC) to ensure proper daily reset
        uint256 currentDay = block.timestamp / 1 days;
        nftLastResetTime[nftId] = currentDay * 1 days;
        
        emit NFTSpinsReset(msg.sender, nftId, nftLastResetTime[nftId]);
    }
    
    // Batch set NFT spins used for multiple NFTs (efficient for migration)
    function batchSetNFTSpinsUsed(
        uint256[] calldata nftIds, 
        uint256[] calldata spinsUsed
    ) external onlyOwner {
        require(nftIds.length == spinsUsed.length, "Array lengths must match");
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 todayStart = currentDay * 1 days;
        
        for (uint256 i = 0; i < nftIds.length; i++) {
            require(spinsUsed[i] <= spinsPerNFT, "Spins used cannot exceed spins per NFT");
            nftSpinsUsed[nftIds[i]] = spinsUsed[i];
            nftLastResetTime[nftIds[i]] = todayStart;
            emit NFTSpinsReset(msg.sender, nftIds[i], todayStart);
        }
    }
    
    // Reset all NFT spins
    function resetAllNFTSpins() external onlyOwner {
        // Can't directly delete nested mappings, this function would need to be 
        // implemented differently for a production contract, e.g., using a version counter
        // or by individually resetting spins for known NFT IDs
        // For now, we'll just comment it out as it's not critical functionality
        // delete nftSpinsUsed;
        
        // Alternative approaches:
        // 1. Use a version counter to invalidate all previous spins
        // 2. Iterate through known NFT IDs and owners (would be very gas intensive)
        // 3. Use a new contract version
        
        // For this simplified implementation, we'll use a flag approach
        // Set a flag that invalidates all previous spin usage
        _resetAllSpinsFlag = !_resetAllSpinsFlag;
    }
 
    // Add a flag to invalidate all previous spins
    bool private _resetAllSpinsFlag;
    
    // Add mapping to track initial flag value for each NFT
    mapping(uint256 => uint256) private _initialSpinFlag; // NFT ID => Initial flag value (1 or 2)

    // Internal functions
    function _addReward(string memory name, uint256 amount, uint256 chance) internal {
        rewards.push(Reward({
            name: name,
            amount: amount,
            chance: chance
        }));
        
        emit RewardAdded(name, amount, chance);
    }
    
    function _sendReward(address player, uint256 rewardId, bool usedNFT, uint256 nftId) internal {
        Reward memory reward = rewards[rewardId];
        playerLastReward[player] = reward;
        
        // Record this spin in player's history
        _addSpinToHistory(player, reward.name, reward.amount, usedNFT, nftId);
        
        // If reward amount is greater than 0, send it
        if (reward.amount > 0) {
            (bool success, ) = payable(player).call{value: reward.amount}("");
            require(success, "Reward transfer failed");
        }
        
        emit WheelSpun(player, reward.name, reward.amount, usedNFT, nftId);
    }
    
    // Add spin to player's history
    function _addSpinToHistory(address player, string memory rewardName, uint256 rewardAmount, bool usedNFT, uint256 nftId) internal {
        SpinRecord[] storage history = playerSpinHistory[player];
        
        // If history is at maximum capacity, remove the oldest record
        if (history.length >= MAX_HISTORY_PER_USER) {
            // Shift all records one position to the left (remove oldest)
            for (uint256 i = 0; i < history.length - 1; i++) {
                history[i] = history[i + 1];
            }
            
            // Resize the array by removing the last element
            history.pop();
        }
        
        // Add new record to history
        history.push(SpinRecord({
            rewardName: rewardName,
            rewardAmount: rewardAmount,
            usedNFT: usedNFT,
            nftId: nftId,
            timestamp: block.timestamp
        }));
    }
    
    /**
     * @dev Batch query to check multiple NFTs at once
     * @param player Address of the player
     * @param nftIds Array of NFT IDs to check
     * @return Array of NFTSpinInfo structs with ownership and remaining spins information
     */
    function batchCheckNFTs(address player, uint256[] calldata nftIds) external view returns (NFTSpinInfo[] memory) {
        if (!nftIntegrationEnabled || address(nftContract) == address(0)) {
            return new NFTSpinInfo[](0);
        }
        
        NFTSpinInfo[] memory results = new NFTSpinInfo[](nftIds.length);
        
        for (uint256 i = 0; i < nftIds.length; i++) {
            uint256 nftId = nftIds[i];
            results[i].nftId = nftId;
            
            // Check ownership
            try nftContract.ownerOf(nftId) returns (address owner) {
                results[i].isOwned = (owner == player);
                
                // Only check remaining spins if the player owns this NFT
                if (results[i].isOwned) {
                    // Check if we need to reset based on 24-hour period
                    if (_shouldResetDailySpins(nftId)) {
                        results[i].spinsRemaining = spinsPerNFT;
                    } else {
                        // Check flag status
                        uint256 initialFlag = _initialSpinFlag[nftId];
                        if (initialFlag == 0) {
                            // First time tracking this NFT
                            results[i].spinsRemaining = spinsPerNFT;
                        } else if (initialFlag != uint256(_resetAllSpinsFlag ? 2 : 1)) {
                            // Flag has changed since last use
                            results[i].spinsRemaining = spinsPerNFT;
                        } else {
                            // Normal case
                            results[i].spinsRemaining = spinsPerNFT - nftSpinsUsed[nftId];
                        }
                    }
                } else {
                    results[i].spinsRemaining = 0;
                }
            } catch {
                // NFT doesn't exist or other error
                results[i].isOwned = false;
                results[i].spinsRemaining = 0;
            }
        }
        
        return results;
    }
    
    // Fallback and receive functions to accept native currency
    receive() external payable {}
    fallback() external payable {}
} 