// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Staking {
    using SafeERC20 for IERC20;

    struct StakingPool {
        address stakingToken;
        uint256 rewardRate;
        uint256 minPeriod;
        uint256 poolType;
        bool isActive;
    }

    struct UserStake {
        uint256 amount;
        uint256 startTime;
        bool active;
    }

    StakingPool[] public stakingPools;
    mapping(uint256 => mapping(address => UserStake)) public tokenStakes;
    IERC20 public rewardToken;

    event TokensStaked(address indexed user, uint256 poolId, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 poolId, uint256 amount);

    constructor(address _rewardToken) {
        rewardToken = IERC20(_rewardToken);
    }

    function createStakingPool(
        address _stakingToken,
        uint256 _rewardRate,
        uint256 _minPeriod,
        uint256 _poolType
    ) external {
        stakingPools.push(StakingPool({
            stakingToken: _stakingToken,
            rewardRate: _rewardRate,
            minPeriod: _minPeriod,
            poolType: _poolType,
            isActive: true
        }));
    }

    function stakeTokens(uint256 poolId, uint256 amount) external {
        require(poolId < stakingPools.length, "Invalid pool");
        StakingPool storage pool = stakingPools[poolId];
        require(pool.isActive, "Pool not active");

        IERC20(pool.stakingToken).safeTransferFrom(msg.sender, address(this), amount);

        tokenStakes[poolId][msg.sender] = UserStake({
            amount: amount,
            startTime: block.timestamp,
            active: true
        });

        emit TokensStaked(msg.sender, poolId, amount);
    }
}
