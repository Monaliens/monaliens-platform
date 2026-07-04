// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEntropyConsumer {
    // The external entry point that verifies caller is Entropy
    function _entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external;
}

contract MockEntropy {
    uint64 public sequenceNumber;
    address public provider;

    // Store pending requests
    mapping(uint64 => address) public pendingRequests;
    mapping(uint64 => bytes32) public commitments;

    struct RequestInfo {
        address requester;
        uint64 sequenceNumber;
        uint32 blockNumber;
        bytes32 commitment;
        uint64 callbackGasLimit;
        address callbackAddress;
        bool fulfilled;
        uint8 callbackStatus;
        uint16 providerFee;
    }

    constructor() {
        provider = address(this);
    }

    function setProvider(address _provider) external {
        provider = _provider;
    }

    function getFeeV2() external pure returns (uint256) {
        return 0.001 ether;
    }

    function requestV2() external payable returns (uint64) {
        sequenceNumber++;
        pendingRequests[sequenceNumber] = msg.sender;
        return sequenceNumber;
    }

    // Simulate callback from entropy provider
    // This contract calls the callback, so msg.sender will be this contract
    function fulfillRandomness(uint64 _sequenceNumber, bytes32 randomNumber) external {
        address requester = pendingRequests[_sequenceNumber];
        require(requester != address(0), "Request not found");

        // Set commitment for settleRandomness
        commitments[_sequenceNumber] = randomNumber;

        // Call the callback from this contract (MockEntropy is the entropy address)
        IEntropyConsumer(requester)._entropyCallback(
            _sequenceNumber,
            address(this), // provider is this contract in mock
            randomNumber
        );
    }

    // For settleRandomness - returns request info
    function getRequestV2(address /* _provider */, uint64 _sequenceNumber) external view returns (
        address requester,
        uint64 seqNum,
        uint32 blockNum,
        bytes32 commitment,
        uint64 callbackGasLimit,
        address callbackAddress,
        bool fulfilled,
        uint8 callbackStatus,
        uint16 providerFee
    ) {
        return (
            pendingRequests[_sequenceNumber],
            _sequenceNumber,
            uint32(block.number),
            commitments[_sequenceNumber],
            100000,
            pendingRequests[_sequenceNumber],
            commitments[_sequenceNumber] != bytes32(0),
            0,
            0
        );
    }

    // Set commitment for testing settleRandomness
    function setCommitment(uint64 _sequenceNumber, bytes32 _commitment) external {
        commitments[_sequenceNumber] = _commitment;
    }
}
