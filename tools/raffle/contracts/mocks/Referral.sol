// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Referral {
    struct ReferralStats {
        bytes32 referralCode;
        uint256 totalReferrals;
        uint256 totalEarnings;
    }

    mapping(address => ReferralStats) public referralStats;
    mapping(bytes32 => address) public codeToUser;

    event ReferralCodeGenerated(address indexed user, bytes32 code);

    constructor(address /* _rewardToken */) {}

    function generateReferralCode(string memory code) external {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        require(codeToUser[codeHash] == address(0), "Code already taken");

        referralStats[msg.sender].referralCode = codeHash;
        codeToUser[codeHash] = msg.sender;

        emit ReferralCodeGenerated(msg.sender, codeHash);
    }

    function getReferralStats(address user) external view returns (ReferralStats memory) {
        return referralStats[user];
    }
}
