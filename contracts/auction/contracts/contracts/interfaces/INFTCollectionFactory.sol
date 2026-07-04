// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INFTCollectionFactory {
    event CollectionCreated(
        address indexed creator,
        address indexed collection,
        string name,
        string symbol,
        uint256 timestamp
    );
    event ImplementationUpdated(address indexed oldImpl, address indexed newImpl);
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event UserRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    function createCollection(
        string calldata name,
        string calldata symbol,
        string calldata collectionURI,
        address royaltyReceiver,
        uint96 royaltyFee
    ) external payable returns (address);

    function getCollectionsByCreator(address creator) external view returns (address[] memory);
    function getCollectionCount() external view returns (uint256);
    function getAllCollections() external view returns (address[] memory);
    function isCollection(address collection) external view returns (bool);
    function getCreationFee() external view returns (uint256);
}
