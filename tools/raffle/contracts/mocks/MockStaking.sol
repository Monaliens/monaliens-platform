// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockStaking
 * @dev Mock staking contract for holder-only raffle testing
 */
contract MockStaking {
    // tokenId => staker address
    mapping(uint256 => address) public tokenIdToStaker;

    function stake(uint256 tokenId, address staker) external {
        tokenIdToStaker[tokenId] = staker;
    }

    function unstake(uint256 tokenId) external {
        tokenIdToStaker[tokenId] = address(0);
    }
}
