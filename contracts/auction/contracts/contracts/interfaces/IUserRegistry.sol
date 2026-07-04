// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUserRegistry {
    struct UserProfile {
        string username;
        string profileURI; // IPFS URI for avatar, banner
        uint256 registeredAt;
        bool isVerified;
        bool exists;
    }

    struct SocialLinks {
        string twitter;
        string discord;
        string telegram;
        string website;
    }

    struct ExtendedProfile {
        string bio;
        SocialLinks socials;
    }

    event UserRegistered(address indexed user, string username, uint256 timestamp);
    event ProfileUpdated(address indexed user, string profileURI);
    event UsernameChanged(address indexed user, string oldUsername, string newUsername);
    event UserVerified(address indexed user, bool verified);
    event CollectionAdded(address indexed user, address indexed collection);
    event CollectionRemoved(address indexed user, address indexed collection);
    event BioUpdated(address indexed user, string bio);
    event SocialLinksUpdated(address indexed user);

    function register(string calldata username) external;
    function updateProfile(string calldata profileURI) external;
    function changeUsername(string calldata newUsername) external;
    function addCollection(address user, address collection) external;
    function removeCollection(address user, address collection) external;
    function updateBio(string calldata bio) external;
    function updateSocialLinks(SocialLinks calldata socials) external;

    function getProfile(address user) external view returns (UserProfile memory);
    function getExtendedProfile(address user) external view returns (ExtendedProfile memory);
    function getCollections(address user) external view returns (address[] memory);
    function getUserByUsername(string calldata username) external view returns (address);
    function isRegistered(address user) external view returns (bool);
    function isUsernameAvailable(string calldata username) external view returns (bool);
}
