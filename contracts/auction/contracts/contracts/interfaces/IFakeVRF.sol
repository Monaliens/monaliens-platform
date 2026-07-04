// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFakeVRF {
    event RandomnessRequested(uint256 indexed requestId, address indexed requester);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);

    function requestRandomness() external returns (uint256 requestId);
    function fulfillRandomness(uint256 requestId) external;
    function getRandomWord(uint256 requestId) external view returns (uint256);
    function isRequestFulfilled(uint256 requestId) external view returns (bool);
}
