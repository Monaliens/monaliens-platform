// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenAirdrop
 * @dev This contract distributes ERC20 tokens and native tokens (Ether) to a list of addresses.
 * It offers two distribution methods: Linear (proportional by weight) and Equal distribution.
 */
contract TokenAirdrop {
    // Reentrancy guard
    bool private _locked;
    
    // Event emitted when airdrop is completed
    event AirdropCompleted(
        address indexed tokenAddress,
        uint256 totalAmount,
        uint256 recipientCount,
        bool isLinearDistribution
    );
    
    // Event emitted when native token airdrop is completed
    event NativeAirdropCompleted(
        uint256 totalAmount,
        uint256 recipientCount,
        bool isLinearDistribution
    );
    
    // Event emitted when transfer fails
    event TransferFailed(
        address indexed recipient,
        uint256 amount,
        string reason
    );

    /**
     * @dev Modifier to prevent reentrancy
     */
    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    /**
     * @dev Initializes the contract
     */
    constructor() {}
    
    /**
     * @notice Helper function to get token approval data
     * @param amount Amount to approve
     * @return bytes Calldata for approval transaction
     */
    function getTokenApprovalData(uint256 amount) external view returns (bytes memory) {
        return abi.encodeWithSignature("approve(address,uint256)", address(this), amount);
    }

    /**
     * @notice Linear native token (Ether) distribution - sends proportional amounts based on weights
     * @param recipients List of recipient addresses
     * @param weights Weight for each recipient (e.g., NFT count)
     */
    function linearNativeAirdrop(
        address[] calldata recipients,
        uint256[] calldata weights
    ) external payable nonReentrant {
        require(recipients.length > 0, "Recipient list cannot be empty");
        require(recipients.length == weights.length, "Recipients and weights arrays must have same length");
        require(msg.value > 0, "Must send some Ether");
        
        // Calculate total weight
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        
        require(totalWeight > 0, "Total weight must be greater than zero");
        
        // Send proportional Ether to each recipient
        uint256 sentAmount = 0;
        uint256 failedTransfers = 0;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (weights[i] > 0 && recipients[i] != address(0)) {
                uint256 amount = (msg.value * weights[i]) / totalWeight;
                if (amount > 0) {
                    (bool success, ) = payable(recipients[i]).call{value: amount}("");
                    if (success) {
                        sentAmount += amount;
                    } else {
                        failedTransfers++;
                        emit TransferFailed(recipients[i], amount, "Native transfer failed");
                    }
                }
            }
        }
        
        // Return remaining Ether if any
        uint256 remaining = msg.value - sentAmount;
        if (remaining > 0) {
            (bool success, ) = payable(msg.sender).call{value: remaining}("");
            require(success, "Failed to return remaining Ether");
        }
        
        emit NativeAirdropCompleted(msg.value, recipients.length - failedTransfers, true);
    }
    
    /**
     * @notice Equal native token (Ether) distribution - sends equal amounts to each recipient
     * @param recipients List of recipient addresses
     */
    function equalNativeAirdrop(
        address[] calldata recipients
    ) external payable nonReentrant {
        require(recipients.length > 0, "Recipient list cannot be empty");
        require(msg.value > 0, "Must send some Ether");
        
        // Calculate valid recipient count
        uint256 validRecipients = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0)) {
                validRecipients++;
            }
        }
        
        require(validRecipients > 0, "No valid recipients");
        uint256 amountPerRecipient = msg.value / validRecipients;
        require(amountPerRecipient > 0, "Amount per recipient is too small");
        
        // Send equal amount of Ether to each recipient
        uint256 sentAmount = 0;
        uint256 successfulTransfers = 0;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0)) {
                (bool success, ) = payable(recipients[i]).call{value: amountPerRecipient}("");
                if (success) {
                    sentAmount += amountPerRecipient;
                    successfulTransfers++;
                } else {
                    emit TransferFailed(recipients[i], amountPerRecipient, "Native transfer failed");
                }
            }
        }
        
        // Return remaining Ether if any
        uint256 remaining = msg.value - sentAmount;
        if (remaining > 0) {
            (bool success, ) = payable(msg.sender).call{value: remaining}("");
            require(success, "Failed to return remaining Ether");
        }
        
        emit NativeAirdropCompleted(msg.value, successfulTransfers, false);
    }

    /**
     * @notice Linear distribution method - sends proportional token amounts based on weights
     * @param tokenAddress Address of the ERC20 token to distribute
     * @param recipients List of recipient addresses
     * @param weights Weight for each recipient (e.g., NFT count)
     * @param totalAmount Total amount of tokens to distribute
     */
    function linearAirdrop(
        address tokenAddress,
        address[] calldata recipients,
        uint256[] calldata weights,
        uint256 totalAmount
    ) external nonReentrant {
        require(recipients.length > 0, "Recipient list cannot be empty");
        require(recipients.length == weights.length, "Recipients and weights arrays must have same length");
        require(totalAmount > 0, "Total amount must be greater than zero");
        
        IERC20 token = IERC20(tokenAddress);
        
        // Calculate total weight
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += weights[i];
        }
        
        require(totalWeight > 0, "Total weight must be greater than zero");
        
        // Check if sender has sufficient tokens
        require(token.balanceOf(msg.sender) >= totalAmount, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= totalAmount, "Insufficient token allowance");
        
        // Transfer tokens to contract
        bool transferred = token.transferFrom(msg.sender, address(this), totalAmount);
        require(transferred, "Token transfer failed");
        
        // Send proportional tokens to each recipient
        uint256 sentAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (weights[i] > 0 && recipients[i] != address(0)) {
                uint256 amount = (totalAmount * weights[i]) / totalWeight;
                if (amount > 0) {
                    bool success = token.transfer(recipients[i], amount);
                    require(success, "Token transfer failed");
                    sentAmount += amount;
                }
            }
        }
        
        // Return remaining tokens if any
        uint256 remaining = totalAmount - sentAmount;
        if (remaining > 0) {
            bool success = token.transfer(msg.sender, remaining);
            require(success, "Token transfer failed");
        }
        
        emit AirdropCompleted(tokenAddress, totalAmount, recipients.length, true);
    }
    
    /**
     * @notice Equal distribution method - sends equal token amounts to each recipient
     * @param tokenAddress Address of the ERC20 token to distribute
     * @param recipients List of recipient addresses
     * @param totalAmount Total amount of tokens to distribute
     */
    function equalAirdrop(
        address tokenAddress,
        address[] calldata recipients,
        uint256 totalAmount
    ) external nonReentrant {
        require(recipients.length > 0, "Recipient list cannot be empty");
        require(totalAmount > 0, "Total amount must be greater than zero");
        
        IERC20 token = IERC20(tokenAddress);
        
        // Check if sender has sufficient tokens
        require(token.balanceOf(msg.sender) >= totalAmount, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= totalAmount, "Insufficient token allowance");
        
        // Transfer tokens to contract
        bool transferred = token.transferFrom(msg.sender, address(this), totalAmount);
        require(transferred, "Token transfer failed");
        
        // Calculate equal amount for each valid recipient
        uint256 validRecipients = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0)) {
                validRecipients++;
            }
        }
        
        require(validRecipients > 0, "No valid recipients");
        uint256 amountPerRecipient = totalAmount / validRecipients;
        require(amountPerRecipient > 0, "Amount per recipient is too small");
        
        // Send equal tokens to each recipient
        uint256 sentAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0)) {
                bool success = token.transfer(recipients[i], amountPerRecipient);
                require(success, "Token transfer failed");
                sentAmount += amountPerRecipient;
            }
        }
        
        // Return remaining tokens if any
        uint256 remaining = totalAmount - sentAmount;
        if (remaining > 0) {
            bool success = token.transfer(msg.sender, remaining);
            require(success, "Token transfer failed");
        }
        
        emit AirdropCompleted(tokenAddress, totalAmount, validRecipients, false);
    }
    
    /**
     * @notice Estimate gas for linear native token distribution
     * @param recipients List of recipients
     * @param weights List of weights
     * @return Estimated gas usage
     */
    function estimateLinearNativeAirdropGas(
        address[] calldata recipients,
        uint256[] calldata weights
    ) external pure returns (uint256) {
        require(recipients.length > 0, "Recipient list cannot be empty");
        require(recipients.length == weights.length, "Recipients and weights arrays must have same length");
        
        // Estimated gas calculation
        uint256 baseGas = 21000;           // Base transaction gas
        uint256 contractCallGas = 35000;   // Contract call overhead
        uint256 perRecipientGas = 6000;    // Additional gas per recipient (native transfer is more expensive)
        
        return baseGas + contractCallGas + (perRecipientGas * recipients.length);
    }
    
    /**
     * @notice Estimate gas for equal native token distribution
     * @param recipients List of recipients
     * @return Estimated gas usage
     */
    function estimateEqualNativeAirdropGas(
        address[] calldata recipients
    ) external pure returns (uint256) {
        require(recipients.length > 0, "Recipient list cannot be empty");
        
        // Estimated gas calculation
        uint256 baseGas = 21000;           // Base transaction gas
        uint256 contractCallGas = 30000;   // Contract call overhead
        uint256 perRecipientGas = 5500;    // Additional gas per recipient
        
        return baseGas + contractCallGas + (perRecipientGas * recipients.length);
    }
    
    /**
     * @notice Estimate gas for linear token distribution
     * @param recipients List of recipients
     * @param weights List of weights (for linear distribution)
     * @return Estimated gas usage
     */
    function estimateLinearAirdropGas(
        address[] calldata recipients,
        uint256[] calldata weights
    ) external pure returns (uint256) {
        require(recipients.length > 0, "Recipient list cannot be empty");
        require(recipients.length == weights.length, "Recipients and weights arrays must have same length");
        
        // Estimated gas calculation (these values should be adjusted based on real usage)
        uint256 baseGas = 21000;           // Base transaction gas
        uint256 contractCallGas = 30000;   // Contract call overhead
        uint256 perRecipientGas = 5000;    // Additional gas per recipient
        
        return baseGas + contractCallGas + (perRecipientGas * recipients.length);
    }
    
    /**
     * @notice Estimate gas for equal token distribution
     * @param recipients List of recipients
     * @return Estimated gas usage
     */
    function estimateEqualAirdropGas(
        address[] calldata recipients
    ) external pure returns (uint256) {
        require(recipients.length > 0, "Recipient list cannot be empty");
        
        // Estimated gas calculation
        uint256 baseGas = 21000;           // Base transaction gas
        uint256 contractCallGas = 25000;   // Contract call overhead
        uint256 perRecipientGas = 4500;    // Additional gas per recipient
        
        return baseGas + contractCallGas + (perRecipientGas * recipients.length);
    }
    
    /**
     * @notice Recover any remaining tokens from the contract
     * @param tokenAddress Address of the ERC20 token to recover
     */
    function recoverTokens(address tokenAddress) external {
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            bool success = token.transfer(msg.sender, balance);
            require(success, "Token transfer failed");
        }
    }
    
    /**
     * @notice Recover any remaining native tokens (Ether) from the contract
     */
    function recoverNativeTokens() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "No Ether to recover");
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Ether transfer failed");
    }
    
    /**
     * @notice Get the current Ether balance of the contract
     * @return uint256 Contract's Ether balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Fallback function to receive Ether
     */
    receive() external payable {}
    
    /**
     * @notice Fallback function
     */
    fallback() external payable {}
} 