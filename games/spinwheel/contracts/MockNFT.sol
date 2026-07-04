// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockNFT is ERC721, ERC721Enumerable, Ownable {
    uint256 private _tokenIdCounter;
    
    constructor() ERC721("MockNFT", "MNFT") {
        _tokenIdCounter = 1;
    }
    
    function mint(address to, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < amount; i++) {
            _safeMint(to, _tokenIdCounter);
            _tokenIdCounter++;
        }
    }
    
    function mintToMany(address[] calldata recipients, uint256 amountEach) external onlyOwner {
        for (uint256 i = 0; i < recipients.length; i++) {
            for (uint256 j = 0; j < amountEach; j++) {
                _safeMint(recipients[i], _tokenIdCounter);
                _tokenIdCounter++;
            }
        }
    }
    
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    // Override required by Solidity.
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

// MockERC20 contract for testing
contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}