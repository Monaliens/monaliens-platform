// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IFakeVRF.sol";

/**
 * @title FakeVRF
 * @notice Mock VRF contract for testing (simulates Pyth Entropy callback pattern)
 * @dev In production, replace with actual Pyth Entropy integration
 *
 * Flow:
 * 1. Auction calls requestRandomness() -> returns requestId
 * 2. Anyone (keeper/admin) calls fulfillRandomness(requestId)
 * 3. Auction calls getRandomWord(requestId) to get result
 * 4. Auction calls completeRaffle() with the random word
 */
contract FakeVRF is IFakeVRF {
    // ============ State Variables ============

    uint256 private _requestIdCounter;

    // requestId => requester address
    mapping(uint256 => address) public requesters;

    // requestId => random word
    mapping(uint256 => uint256) public randomWords;

    // requestId => fulfilled
    mapping(uint256 => bool) public fulfilled;

    // requestId => block number (for pseudo-randomness)
    mapping(uint256 => uint256) public requestBlocks;

    // Admin who can fulfill requests
    address public admin;

    // Auto-fulfill mode for testing
    bool public autoFulfill;

    // ============ Events ============

    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event AutoFulfillUpdated(bool enabled);

    // ============ Constructor ============

    constructor() {
        admin = msg.sender;
        autoFulfill = false;
    }

    // ============ External Functions ============

    /**
     * @notice Request randomness (called by Auction)
     * @return requestId The request ID
     */
    function requestRandomness() external override returns (uint256 requestId) {
        requestId = ++_requestIdCounter;
        requesters[requestId] = msg.sender;
        requestBlocks[requestId] = block.number;

        emit RandomnessRequested(requestId, msg.sender);

        // Auto-fulfill in test mode
        if (autoFulfill) {
            _fulfill(requestId);
        }
    }

    /**
     * @notice Fulfill randomness request (simulates VRF callback)
     * @dev In production, this would be called by Pyth Entropy
     * @param requestId The request ID to fulfill
     */
    function fulfillRandomness(uint256 requestId) external override {
        require(requesters[requestId] != address(0), "FakeVRF: Invalid request");
        require(!fulfilled[requestId], "FakeVRF: Already fulfilled");

        _fulfill(requestId);
    }

    /**
     * @notice Fulfill with specific random value (for testing)
     * @param requestId The request ID
     * @param randomValue The random value to use
     */
    function fulfillRandomnessWithValue(uint256 requestId, uint256 randomValue) external {
        require(msg.sender == admin, "FakeVRF: Only admin");
        require(requesters[requestId] != address(0), "FakeVRF: Invalid request");
        require(!fulfilled[requestId], "FakeVRF: Already fulfilled");

        fulfilled[requestId] = true;
        randomWords[requestId] = randomValue;

        emit RandomnessFulfilled(requestId, randomValue);
    }

    /**
     * @notice Batch fulfill multiple requests
     * @param requestIds Array of request IDs
     */
    function batchFulfill(uint256[] calldata requestIds) external {
        for (uint256 i = 0; i < requestIds.length; i++) {
            uint256 requestId = requestIds[i];
            if (requesters[requestId] != address(0) && !fulfilled[requestId]) {
                _fulfill(requestId);
            }
        }
    }

    // ============ View Functions ============

    function getRandomWord(uint256 requestId) external view override returns (uint256) {
        require(fulfilled[requestId], "FakeVRF: Not fulfilled");
        return randomWords[requestId];
    }

    function isRequestFulfilled(uint256 requestId) external view override returns (bool) {
        return fulfilled[requestId];
    }

    function getRequestInfo(uint256 requestId) external view returns (
        address requester,
        uint256 blockNumber,
        bool isFulfilled,
        uint256 randomWord
    ) {
        return (
            requesters[requestId],
            requestBlocks[requestId],
            fulfilled[requestId],
            randomWords[requestId]
        );
    }

    function getLatestRequestId() external view returns (uint256) {
        return _requestIdCounter;
    }

    function getPendingRequests() external view returns (uint256[] memory) {
        // Count pending
        uint256 count = 0;
        for (uint256 i = 1; i <= _requestIdCounter; i++) {
            if (!fulfilled[i]) {
                count++;
            }
        }

        // Build array
        uint256[] memory pending = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _requestIdCounter; i++) {
            if (!fulfilled[i]) {
                pending[index++] = i;
            }
        }

        return pending;
    }

    // ============ Admin Functions ============

    function setAdmin(address newAdmin) external {
        require(msg.sender == admin, "FakeVRF: Only admin");
        require(newAdmin != address(0), "FakeVRF: Invalid admin");
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminUpdated(oldAdmin, newAdmin);
    }

    function setAutoFulfill(bool enabled) external {
        require(msg.sender == admin, "FakeVRF: Only admin");
        autoFulfill = enabled;
        emit AutoFulfillUpdated(enabled);
    }

    // ============ Internal Functions ============

    function _fulfill(uint256 requestId) internal {
        fulfilled[requestId] = true;

        // Generate pseudo-random number (NOT secure - only for testing!)
        // Uses block data, requester, requestId, and timestamp
        uint256 randomWord = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(requestBlocks[requestId]),
                    block.prevrandao,
                    block.timestamp,
                    requesters[requestId],
                    requestId,
                    block.number
                )
            )
        );

        randomWords[requestId] = randomWord;
        emit RandomnessFulfilled(requestId, randomWord);
    }
}
