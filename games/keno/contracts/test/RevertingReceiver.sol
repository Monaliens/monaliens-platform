// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title RevertingReceiver
 * @notice Test contract that reverts when receiving ETH
 */
contract RevertingReceiver {
    receive() external payable {
        revert("I don't accept ETH");
    }

    fallback() external payable {
        revert("I don't accept ETH");
    }
}
