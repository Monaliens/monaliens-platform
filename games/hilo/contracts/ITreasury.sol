// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface ITreasury {
    function pay(address to, uint256 amount) external;
    function whitelistedGames(address game) external view returns (bool);
    function getBalance() external view returns (uint256);
}
