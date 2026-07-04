// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title MockReferral
 * @notice Mock referral contract for testing
 */
contract MockReferral {
    mapping(address => address) public referrers;

    function setReferrer(address player, address referrer) external {
        referrers[player] = referrer;
    }

    function getReferrerWallet(address player) external view returns (address) {
        return referrers[player];
    }
}
