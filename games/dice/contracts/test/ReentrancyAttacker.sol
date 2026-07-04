// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

interface IDice {
    function play(uint8 threshold, bool isOver) external payable;
}

/**
 * @title ReentrancyAttacker
 * @notice Contract to test reentrancy protection
 */
contract ReentrancyAttacker {
    IDice public dice;
    uint256 public attackCount;

    constructor(address _dice) {
        dice = IDice(_dice);
    }

    function attack() external payable {
        dice.play{value: msg.value}(50, true);
    }

    // Attempt reentry when receiving ETH
    receive() external payable {
        if (attackCount < 3 && address(dice).balance > 0.1 ether) {
            attackCount++;
            dice.play{value: 0.1 ether}(50, true);
        }
    }
}
