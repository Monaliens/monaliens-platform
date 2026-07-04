// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

contract SpinWheel is Ownable {
    struct Reward {
        string name;
        uint256 amount;
        uint256 chance;
        uint256 maxSupply;
        uint256 currentSupply;
        bool isLimited;
    }
    
    struct NFTSpinInfo {
        uint256 nftId;
        bool isOwned;
        uint256 spinsRemaining;
    }

    uint256 private constant TOTAL_CHANCES = 10000;
    uint256 private constant RESET_PERIOD = 1 days;
    uint256 private constant MAX_RESPINS = 2;

    Reward[] public rewards;
    mapping(address => uint256) public playerLastSpinTimestamp;
    mapping(address => Reward) public playerLastReward;
    uint256 public cooldownPeriod = 1 hours;
    
    IERC721 public nftContract;
    bool public isEnumerableNFT;
    mapping(uint256 => uint256) public nftSpinsUsed;
    mapping(uint256 => uint256) public nftLastResetTime;
    uint256 public spinsPerNFT = 2;
    bool public nftIntegrationEnabled = false;
    
    // Whitelist tracking
    mapping(address => bool) public hasFcfsWhitelist;
    mapping(address => bool) public hasGtdWhitelist;
    

    mapping(address => mapping(uint256 => bool)) public hasReceivedLimitedReward; // player => rewardId => received
    
    address public devWallet;
    uint256 private spinCounter;
    
    event WheelSpun(address indexed player, string rewardName, uint256 rewardAmount, bool usedNFT, uint256 nftId);
    event RewardAdded(string name, uint256 amount, uint256 chance, bool isLimited, uint256 maxSupply);
    event RewardUpdated(uint256 indexed rewardId, string name, uint256 amount, uint256 chance);
    event RewardRemoved(uint256 indexed rewardId);
    event RewardExhausted(uint256 indexed rewardId, string rewardName, uint256 chanceTransferred);
    event CooldownPeriodUpdated(uint256 newPeriod);
    event DevWalletUpdated(address indexed newDevWallet);
    event Withdrawn(address indexed to, uint256 amount);
    event NFTContractSet(address indexed nftContract, bool isEnumerable);
    event SpinsPerNFTUpdated(uint256 newSpinsPerNFT);
    event NFTIntegrationStatusChanged(bool enabled);
    event NFTSpinsReset(address indexed player, uint256 nftId, uint256 timestamp);
    event LimitedRewardReceived(address indexed player, uint256 indexed rewardId, string rewardName);
    event LimitedRewardSupplyUpdated(uint256 indexed rewardId, uint256 oldMaxSupply, uint256 newMaxSupply);

    constructor() {
        devWallet = owner();
        
        // Rewards are configured post-deployment via addReward() / updateReward()
    }

    function spinWheel() external returns (string memory, uint256) {
        revert("Normal spinning is disabled. Please use spinWheelWithNFT instead.");
    }
    
    function spinWheelWithNFT(uint256 nftId) external returns (string memory, uint256) {
        require(nftIntegrationEnabled, "NFT integration is not enabled");
        require(nftContract.ownerOf(nftId) == msg.sender, "You don't own this NFT");
        
        _checkAndResetDailySpins(nftId);
        
        if (_initialSpinFlag[nftId] == 0) {
            _initialSpinFlag[nftId] = _resetAllSpinsFlag ? 2 : 1;
            nftSpinsUsed[nftId] = 0;
        } else if (_initialSpinFlag[nftId] != uint256(_resetAllSpinsFlag ? 2 : 1)) {
            _initialSpinFlag[nftId] = _resetAllSpinsFlag ? 2 : 1;
            nftSpinsUsed[nftId] = 0;
        }
        
        require(nftSpinsUsed[nftId] < spinsPerNFT, "No more spins left for this NFT");
        
        nftSpinsUsed[nftId]++;
        return _spinWheel(nftId, true);
    }
    
    function _spinWheel(uint256 nftId, bool usedNFT) internal returns (string memory, uint256) {
        return _spinWheelWithRespin(nftId, usedNFT, 0);
    }
    
    function _spinWheelWithRespin(uint256 nftId, bool usedNFT, uint256 respinCount) internal returns (string memory, uint256) {
        uint256 randomValue = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            blockhash(block.number - 1),
            nftId,
            spinCounter,
            respinCount
        ))) % TOTAL_CHANCES;
        
        uint256 cumulativeChance = 0;
        
        for (uint256 i = 0; i < rewards.length; i++) {
            cumulativeChance += rewards[i].chance;
            if (randomValue < cumulativeChance) {

                string memory rewardName = rewards[i].name;
                if (_isWhitelistDuplicate(msg.sender, rewardName)) {
                    if (respinCount >= MAX_RESPINS) {
                        _sendReward(msg.sender, _getMonadRewardIndex(10.0 ether), usedNFT, nftId);
                        return ("Monad", 10.0 ether);
                    }
                    spinCounter++;
                    return _spinWheelWithRespin(nftId, usedNFT, respinCount + 1);
                }
                

                if (rewards[i].isLimited && hasReceivedLimitedReward[msg.sender][i]) {
                    if (respinCount >= MAX_RESPINS) {
                        _sendReward(msg.sender, _getMonadRewardIndex(10.0 ether), usedNFT, nftId);
                        return ("Monad", 10.0 ether);
                    }
                    spinCounter++;
                    return _spinWheelWithRespin(nftId, usedNFT, respinCount + 1);
                }
                
                // Whitelist reward tracking
                if (_isWhitelistReward(rewardName)) {
                    _markWhitelistReceived(msg.sender, rewardName);
                }
                
                // Limited reward tracking
                if (rewards[i].isLimited) {
                    hasReceivedLimitedReward[msg.sender][i] = true;
                    emit LimitedRewardReceived(msg.sender, i, rewards[i].name);
                }
                
                _sendReward(msg.sender, i, usedNFT, nftId);
                return (rewards[i].name, rewards[i].amount);
            }
        }
        
        _sendReward(msg.sender, 0, true, nftId);
        return (rewards[0].name, rewards[0].amount);
    }
    
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
    
    function _getMonadRewardIndex(uint256 amount) internal view returns (uint256) {
        for (uint256 i = 0; i < rewards.length; i++) {
            if (keccak256(bytes(rewards[i].name)) == keccak256(bytes("Monad")) && rewards[i].amount == amount) {
                return i;
            }
        }
        for (uint256 i = 0; i < rewards.length; i++) {
            if (keccak256(bytes(rewards[i].name)) == keccak256(bytes("Monad"))) {
                return i;
            }
        }
        return 0;
    }

    // View functions
    function getRewardsCount() external view returns (uint256) {
        return rewards.length;
    }
    
    function getAllRewards() external view returns (Reward[] memory) {
        return rewards;
    }
    
    function getActiveRewards() external view returns (Reward[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].chance > 0) {
                activeCount++;
            }
        }
        
        Reward[] memory activeRewards = new Reward[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].chance > 0) {
                activeRewards[index] = rewards[i];
                index++;
            }
        }
        
        return activeRewards;
    }
    
    function canSpin(address player) external view returns (bool) {
        return block.timestamp >= playerLastSpinTimestamp[player] + cooldownPeriod;
    }
    
    function getLastReward(address player) external view returns (string memory, uint256) {
        Reward memory reward = playerLastReward[player];
        return (reward.name, reward.amount);
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
            
            if (_shouldResetDailySpins(nftId)) {
                return spinsPerNFT;
            }
            
            uint256 initialFlag = _initialSpinFlag[nftId];
            if (initialFlag == 0) {
                return spinsPerNFT;
            } else if (initialFlag != uint256(_resetAllSpinsFlag ? 2 : 1)) {
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
    

    function getLimitedRewardStatus(address player, uint256 rewardId) external view returns (bool hasReceived) {
        require(rewardId < rewards.length, "Invalid reward ID");
        return hasReceivedLimitedReward[player][rewardId];
    }
    
    function getLimitedRewardStatusBatch(address player, uint256[] calldata rewardIds) external view returns (bool[] memory hasReceived) {
        hasReceived = new bool[](rewardIds.length);
        for (uint256 i = 0; i < rewardIds.length; i++) {
            if (rewardIds[i] < rewards.length) {
                hasReceived[i] = hasReceivedLimitedReward[player][rewardIds[i]];
            } else {
                hasReceived[i] = false;
            }
        }
        return hasReceived;
    }
    
    function getAllLimitedRewardStatus(address player) external view returns (
        uint256[] memory rewardIds,
        bool[] memory hasReceived,
        string[] memory rewardNames
    ) {

        uint256 limitedCount = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].isLimited) {
                limitedCount++;
            }
        }
        
        rewardIds = new uint256[](limitedCount);
        hasReceived = new bool[](limitedCount);
        rewardNames = new string[](limitedCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].isLimited) {
                rewardIds[index] = i;
                hasReceived[index] = hasReceivedLimitedReward[player][i];
                rewardNames[index] = rewards[i].name;
                index++;
            }
        }
        
        return (rewardIds, hasReceived, rewardNames);
    }
    
    function getRewardDetails(uint256 rewardId) external view returns (
        string memory name,
        uint256 amount,
        uint256 chance,
        bool isLimited,
        uint256 maxSupply,
        uint256 currentSupply,
        uint256 remainingSupply
    ) {
        require(rewardId < rewards.length, "Invalid reward ID");
        Reward storage reward = rewards[rewardId];
        
        return (
            reward.name,
            reward.amount,
            reward.chance,
            reward.isLimited,
            reward.maxSupply,
            reward.currentSupply,
            reward.isLimited ? (reward.maxSupply > reward.currentSupply ? reward.maxSupply - reward.currentSupply : 0) : type(uint256).max
        );
    }
    
    function getLimitedRewards() external view returns (
        uint256[] memory rewardIds,
        string[] memory names,
        uint256[] memory chances,
        uint256[] memory maxSupplies,
        uint256[] memory currentSupplies,
        uint256[] memory remainingSupplies
    ) {
        uint256 limitedCount = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].isLimited) {
                limitedCount++;
            }
        }
        
        rewardIds = new uint256[](limitedCount);
        names = new string[](limitedCount);
        chances = new uint256[](limitedCount);
        maxSupplies = new uint256[](limitedCount);
        currentSupplies = new uint256[](limitedCount);
        remainingSupplies = new uint256[](limitedCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].isLimited) {
                rewardIds[index] = i;
                names[index] = rewards[i].name;
                chances[index] = rewards[i].chance;
                maxSupplies[index] = rewards[i].maxSupply;
                currentSupplies[index] = rewards[i].currentSupply;
                remainingSupplies[index] = rewards[i].maxSupply > rewards[i].currentSupply ? 
                    rewards[i].maxSupply - rewards[i].currentSupply : 0;
                index++;
            }
        }
        
        return (rewardIds, names, chances, maxSupplies, currentSupplies, remainingSupplies);
    }
    
    function getLastSpinTime(address player) external view returns (uint256) {
        return playerLastSpinTimestamp[player];
    }
    
    function getTimeUntilNextSpin(address player) external view returns (uint256) {
        uint256 lastSpin = playerLastSpinTimestamp[player];
        uint256 nextSpinTime = lastSpin + cooldownPeriod;
        
        if (block.timestamp >= nextSpinTime) {
            return 0;
        }
        
        return nextSpinTime - block.timestamp;
    }
    
    function _shouldResetDailySpins(uint256 nftId) internal view returns (bool) {
        uint256 lastResetTime = nftLastResetTime[nftId];
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastResetDay = lastResetTime / 1 days;
        
        return lastResetTime == 0 || currentDay > lastResetDay;
    }
    
    function _checkAndResetDailySpins(uint256 nftId) internal {
        if (_shouldResetDailySpins(nftId)) {
            nftSpinsUsed[nftId] = 0;
            uint256 currentDay = block.timestamp / 1 days;
            nftLastResetTime[nftId] = currentDay * 1 days;
            emit NFTSpinsReset(msg.sender, nftId, nftLastResetTime[nftId]);
        }
    }
    
    function getUserNFTs(address player) external view returns (uint256[] memory) {
        if (!nftIntegrationEnabled || address(nftContract) == address(0)) {
            return new uint256[](0);
        }
        
        if (!isEnumerableNFT) {
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
    
    function addLimitedReward(
        string calldata name, 
        uint256 amount, 
        uint256 chance, 
        uint256 maxSupply
    ) external onlyOwner {
        require(maxSupply > 0, "Max supply must be greater than 0 for limited rewards");
        _addReward(name, amount, chance, true, maxSupply);
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
    
    function resetWhitelistStatus(address user, bool resetFcfs, bool resetGtd) external onlyOwner {
        if (resetFcfs) {
            hasFcfsWhitelist[user] = false;
        }
        if (resetGtd) {
            hasGtdWhitelist[user] = false;
        }
    }
    
    function setWhitelistStatus(address user, bool hasFcfs, bool hasGtd) external onlyOwner {
        hasFcfsWhitelist[user] = hasFcfs;
        hasGtdWhitelist[user] = hasGtd;
    }
    
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
    
    // Limited rewards admin functions
    function resetLimitedRewardStatus(address user, uint256 rewardId) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        hasReceivedLimitedReward[user][rewardId] = false;
    }
    
    function setLimitedRewardStatus(address user, uint256 rewardId, bool hasReceived) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        hasReceivedLimitedReward[user][rewardId] = hasReceived;
        
        if (hasReceived) {
            emit LimitedRewardReceived(user, rewardId, rewards[rewardId].name);
        }
    }
    
    function batchSetLimitedRewardStatus(
        address[] calldata users, 
        uint256[] calldata rewardIds, 
        bool[] calldata hasReceived
    ) external onlyOwner {
        require(users.length == rewardIds.length && users.length == hasReceived.length, "Array lengths must match");
        
        for (uint256 i = 0; i < users.length; i++) {
            require(rewardIds[i] < rewards.length, "Invalid reward ID");
            hasReceivedLimitedReward[users[i]][rewardIds[i]] = hasReceived[i];
            
            if (hasReceived[i]) {
                emit LimitedRewardReceived(users[i], rewardIds[i], rewards[rewardIds[i]].name);
            }
        }
    }
    
    function resetAllLimitedRewardStatus(address user) external onlyOwner {
        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].isLimited) {
                hasReceivedLimitedReward[user][i] = false;
            }
        }
    }
    
    // Limited reward supply management
    function updateLimitedRewardSupply(uint256 rewardId, uint256 newMaxSupply) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        require(rewards[rewardId].isLimited, "Reward is not limited");
        require(newMaxSupply > 0, "Max supply must be greater than 0");
        
        Reward storage reward = rewards[rewardId];
        uint256 oldMaxSupply = reward.maxSupply;
        

        require(newMaxSupply >= reward.currentSupply, "New max supply cannot be less than current supply");
        
        reward.maxSupply = newMaxSupply;
        

        if (reward.chance == 0 && newMaxSupply > reward.currentSupply) {

            uint256 nothingIndex = _findNothingRewardIndex();
            if (rewards[nothingIndex].chance >= 100) {
                rewards[nothingIndex].chance -= 100;
                reward.chance = 100;
            }
        }
        
        emit LimitedRewardSupplyUpdated(rewardId, oldMaxSupply, newMaxSupply);
    }
    
    function decreaseLimitedRewardSupply(uint256 rewardId, uint256 decreaseAmount) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        require(rewards[rewardId].isLimited, "Reward is not limited");
        require(decreaseAmount > 0, "Decrease amount must be greater than 0");
        
        Reward storage reward = rewards[rewardId];
        uint256 oldMaxSupply = reward.maxSupply;
        
        require(reward.maxSupply >= decreaseAmount, "Cannot decrease below 0");
        uint256 newMaxSupply = reward.maxSupply - decreaseAmount;
        

        require(newMaxSupply >= reward.currentSupply, "New max supply cannot be less than current supply");
        
        reward.maxSupply = newMaxSupply;
        

        if (newMaxSupply == reward.currentSupply && reward.chance > 0) {
            uint256 nothingIndex = _findNothingRewardIndex();
            uint256 chanceToTransfer = reward.chance;
            rewards[nothingIndex].chance += chanceToTransfer;
            reward.chance = 0;
            
            emit RewardExhausted(rewardId, reward.name, chanceToTransfer);
        }
        
        emit LimitedRewardSupplyUpdated(rewardId, oldMaxSupply, newMaxSupply);
    }
    
    function increaseLimitedRewardSupply(uint256 rewardId, uint256 increaseAmount) external onlyOwner {
        require(rewardId < rewards.length, "Invalid reward ID");
        require(rewards[rewardId].isLimited, "Reward is not limited");
        require(increaseAmount > 0, "Increase amount must be greater than 0");
        
        Reward storage reward = rewards[rewardId];
        uint256 oldMaxSupply = reward.maxSupply;
        uint256 newMaxSupply = reward.maxSupply + increaseAmount;
        
        reward.maxSupply = newMaxSupply;
        

        if (reward.chance == 0 && newMaxSupply > reward.currentSupply) {

            uint256 nothingIndex = _findNothingRewardIndex();
            if (rewards[nothingIndex].chance >= 100) {
                rewards[nothingIndex].chance -= 100;
                reward.chance = 100;
            }
        }
        
        emit LimitedRewardSupplyUpdated(rewardId, oldMaxSupply, newMaxSupply);
    }
    
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
    
    function resetNFTSpins(uint256 nftId) external onlyOwner {
        nftSpinsUsed[nftId] = 0;
        nftLastResetTime[nftId] = block.timestamp;
        emit NFTSpinsReset(msg.sender, nftId, block.timestamp);
    }
    
    function setNFTSpinsUsed(uint256 nftId, uint256 spinsUsed) external onlyOwner {
        require(spinsUsed <= spinsPerNFT, "Spins used cannot exceed spins per NFT");
        nftSpinsUsed[nftId] = spinsUsed;
        
        uint256 currentDay = block.timestamp / 1 days;
        nftLastResetTime[nftId] = currentDay * 1 days;
        
        emit NFTSpinsReset(msg.sender, nftId, nftLastResetTime[nftId]);
    }
    
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
    
    function resetAllNFTSpins() external onlyOwner {
        _resetAllSpinsFlag = !_resetAllSpinsFlag;
    }
 
    bool private _resetAllSpinsFlag;
    mapping(uint256 => uint256) private _initialSpinFlag;

    function _addReward(string memory name, uint256 amount, uint256 chance) internal {
        _addReward(name, amount, chance, false, 0);
    }
    
    function _addReward(string memory name, uint256 amount, uint256 chance, bool isLimited, uint256 maxSupply) internal {
        rewards.push(Reward({
            name: name,
            amount: amount,
            chance: chance,
            maxSupply: maxSupply,
            currentSupply: 0,
            isLimited: isLimited
        }));
        
        emit RewardAdded(name, amount, chance, isLimited, maxSupply);
    }
    
    function _sendReward(address player, uint256 rewardId, bool usedNFT, uint256 nftId) internal {
        Reward storage reward = rewards[rewardId];
        
        if (reward.isLimited && reward.currentSupply >= reward.maxSupply) {
            _handleExhaustedReward(rewardId);
            
            uint256 nothingIndex = _findNothingRewardIndex();
            Reward storage nothingReward = rewards[nothingIndex];
            playerLastReward[player] = nothingReward;
            emit WheelSpun(player, nothingReward.name, nothingReward.amount, usedNFT, nftId);
            return;
        }
        
        playerLastReward[player] = reward;
        
        if (reward.isLimited) {
            reward.currentSupply++;
        }
        
        if (reward.amount > 0) {
            (bool success, ) = payable(player).call{value: reward.amount}("");
            require(success, "Reward transfer failed");
        }
        
        emit WheelSpun(player, reward.name, reward.amount, usedNFT, nftId);
        
        if (reward.isLimited && reward.currentSupply >= reward.maxSupply) {
            _handleExhaustedReward(rewardId);
        }
    }
    
    function _handleExhaustedReward(uint256 rewardId) internal {
        Reward storage exhaustedReward = rewards[rewardId];
        
        if (exhaustedReward.chance > 0) {
            uint256 nothingIndex = _findNothingRewardIndex();
            uint256 chanceToTransfer = exhaustedReward.chance;
            rewards[nothingIndex].chance += chanceToTransfer;
            
            emit RewardExhausted(rewardId, exhaustedReward.name, chanceToTransfer);
            
            exhaustedReward.chance = 0;
        }
    }
    
    function _findNothingRewardIndex() internal view returns (uint256) {
        for (uint256 i = 0; i < rewards.length; i++) {
            if (keccak256(bytes(rewards[i].name)) == keccak256(bytes("Nothing"))) {
                return i;
            }
        }
        return 0;
    }
    
    function batchCheckNFTSpins(address player, uint256[] calldata nftIds) external view returns (NFTSpinInfo[] memory) {
        if (!nftIntegrationEnabled || address(nftContract) == address(0)) {
            return new NFTSpinInfo[](0);
        }
        
        NFTSpinInfo[] memory results = new NFTSpinInfo[](nftIds.length);
        
        for (uint256 i = 0; i < nftIds.length; i++) {
            uint256 nftId = nftIds[i];
            results[i].nftId = nftId;
            
            try nftContract.ownerOf(nftId) returns (address owner) {
                results[i].isOwned = (owner == player);
                
                if (results[i].isOwned) {
                    if (_shouldResetDailySpins(nftId)) {
                        results[i].spinsRemaining = spinsPerNFT;
                    } else {
                        uint256 initialFlag = _initialSpinFlag[nftId];
                        if (initialFlag == 0) {
                            results[i].spinsRemaining = spinsPerNFT;
                        } else if (initialFlag != uint256(_resetAllSpinsFlag ? 2 : 1)) {
                            results[i].spinsRemaining = spinsPerNFT;
                        } else {
                            results[i].spinsRemaining = spinsPerNFT - nftSpinsUsed[nftId];
                        }
                    }
                } else {
                    results[i].spinsRemaining = 0;
                }
            } catch {
                results[i].isOwned = false;
                results[i].spinsRemaining = 0;
            }
        }
        
        return results;
    }
    
    // Alias function for frontend compatibility
    function batchCheckNFTs(address player, uint256[] calldata nftIds) external view returns (NFTSpinInfo[] memory) {
        return this.batchCheckNFTSpins(player, nftIds);
    }
    
    receive() external payable {}
    fallback() external payable {}
} 