// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IUserRegistry.sol";

/**
 * @title UserRegistry
 * @notice Manages user profiles and their collections on-chain
 * @dev UUPS Upgradeable pattern
 */
contract UserRegistry is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IUserRegistry
{
    // ============ State Variables ============

    // User address => UserProfile
    mapping(address => UserProfile) private _profiles;

    // Username => User address (for uniqueness check)
    mapping(string => address) private _usernameToAddress;

    // User address => Collection addresses
    mapping(address => address[]) private _userCollections;

    // Collection address => index in user's collection array (for efficient removal)
    mapping(address => mapping(address => uint256)) private _collectionIndex;

    // Authorized contracts that can add/remove collections (factories)
    mapping(address => bool) public authorizedContracts;

    // Admin addresses for verification
    mapping(address => bool) public admins;

    // Minimum username length
    uint256 public minUsernameLength;

    // Maximum username length
    uint256 public maxUsernameLength;

    // ============ V2 State Variables (added at end for upgrade safety) ============

    // User address => bio
    mapping(address => string) private _bios;

    // User address => social links
    mapping(address => SocialLinks) private _socialLinks;

    // Maximum bio length
    uint256 public maxBioLength;

    // ============ Modifiers ============

    modifier onlyRegistered() {
        require(_profiles[msg.sender].exists, "UserRegistry: Not registered");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedContracts[msg.sender] || msg.sender == owner(),
            "UserRegistry: Not authorized"
        );
        _;
    }

    modifier onlyAdmin() {
        require(
            admins[msg.sender] || msg.sender == owner(),
            "UserRegistry: Not admin"
        );
        _;
    }

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        minUsernameLength = 3;
        maxUsernameLength = 20;
        admins[msg.sender] = true;
    }

    /**
     * @notice Initialize V2 features (called once after upgrade)
     */
    function initializeV2() external onlyOwner {
        require(maxBioLength == 0, "UserRegistry: V2 already initialized");
        maxBioLength = 280; // Twitter-style bio length
    }

    // ============ External Functions ============

    /**
     * @notice Register a new user with a username
     * @param username The desired username
     */
    function register(string calldata username) external override {
        require(!_profiles[msg.sender].exists, "UserRegistry: Already registered");
        require(_isValidUsername(username), "UserRegistry: Invalid username");
        require(_usernameToAddress[_toLower(username)] == address(0), "UserRegistry: Username taken");

        string memory lowerUsername = _toLower(username);

        _profiles[msg.sender] = UserProfile({
            username: username,
            profileURI: "",
            registeredAt: block.timestamp,
            isVerified: false,
            exists: true
        });

        _usernameToAddress[lowerUsername] = msg.sender;

        emit UserRegistered(msg.sender, username, block.timestamp);
    }

    /**
     * @notice Update profile URI (IPFS link containing avatar, banner, bio, socials)
     * @param profileURI The IPFS URI
     */
    function updateProfile(string calldata profileURI) external override onlyRegistered {
        _profiles[msg.sender].profileURI = profileURI;
        emit ProfileUpdated(msg.sender, profileURI);
    }

    /**
     * @notice Change username
     * @param newUsername The new username
     */
    function changeUsername(string calldata newUsername) external override onlyRegistered {
        require(_isValidUsername(newUsername), "UserRegistry: Invalid username");

        string memory newLower = _toLower(newUsername);
        require(_usernameToAddress[newLower] == address(0), "UserRegistry: Username taken");

        string memory oldUsername = _profiles[msg.sender].username;
        string memory oldLower = _toLower(oldUsername);

        // Clear old username mapping
        delete _usernameToAddress[oldLower];

        // Set new username
        _profiles[msg.sender].username = newUsername;
        _usernameToAddress[newLower] = msg.sender;

        emit UsernameChanged(msg.sender, oldUsername, newUsername);
    }

    /**
     * @notice Update bio
     * @param bio The new bio (max 160 characters)
     */
    function updateBio(string calldata bio) external override onlyRegistered {
        require(bytes(bio).length <= maxBioLength, "UserRegistry: Bio too long");
        _bios[msg.sender] = bio;
        emit BioUpdated(msg.sender, bio);
    }

    /**
     * @notice Update social links
     * @param socials The social links struct
     */
    function updateSocialLinks(SocialLinks calldata socials) external override onlyRegistered {
        _socialLinks[msg.sender] = socials;
        emit SocialLinksUpdated(msg.sender);
    }

    /**
     * @notice Add a collection to user's profile (called by factory)
     * @param user The user address
     * @param collection The collection address
     */
    function addCollection(address user, address collection) external override onlyAuthorized {
        require(_profiles[user].exists, "UserRegistry: User not registered");

        _collectionIndex[user][collection] = _userCollections[user].length;
        _userCollections[user].push(collection);

        emit CollectionAdded(user, collection);
    }

    /**
     * @notice Remove a collection from user's profile
     * @param user The user address
     * @param collection The collection address
     */
    function removeCollection(address user, address collection) external override onlyAuthorized {
        address[] storage collections = _userCollections[user];
        uint256 index = _collectionIndex[user][collection];

        require(index < collections.length && collections[index] == collection, "UserRegistry: Collection not found");

        // Move last element to deleted position
        uint256 lastIndex = collections.length - 1;
        if (index != lastIndex) {
            address lastCollection = collections[lastIndex];
            collections[index] = lastCollection;
            _collectionIndex[user][lastCollection] = index;
        }

        collections.pop();
        delete _collectionIndex[user][collection];

        emit CollectionRemoved(user, collection);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set user verification status
     * @param user The user address
     * @param verified The verification status
     */
    function setVerified(address user, bool verified) external onlyAdmin {
        require(_profiles[user].exists, "UserRegistry: User not registered");
        _profiles[user].isVerified = verified;
        emit UserVerified(user, verified);
    }

    /**
     * @notice Admin override for user bio (scam prevention)
     * @param user The user address
     * @param bio The new bio
     */
    function adminSetBio(address user, string calldata bio) external onlyAdmin {
        require(_profiles[user].exists, "UserRegistry: User not registered");
        _bios[user] = bio;
        emit BioUpdated(user, bio);
    }

    /**
     * @notice Admin override for social links (scam prevention)
     * @param user The user address
     * @param socials The new social links
     */
    function adminSetSocialLinks(address user, SocialLinks calldata socials) external onlyAdmin {
        require(_profiles[user].exists, "UserRegistry: User not registered");
        _socialLinks[user] = socials;
        emit SocialLinksUpdated(user);
    }

    /**
     * @notice Admin clear all user extended profile (bio + socials)
     * @param user The user address
     */
    function adminClearExtendedProfile(address user) external onlyAdmin {
        require(_profiles[user].exists, "UserRegistry: User not registered");
        delete _bios[user];
        delete _socialLinks[user];
        emit BioUpdated(user, "");
        emit SocialLinksUpdated(user);
    }

    /**
     * @notice Add/remove authorized contract
     * @param contractAddress The contract address
     * @param authorized Authorization status
     */
    function setAuthorizedContract(address contractAddress, bool authorized) external onlyOwner {
        authorizedContracts[contractAddress] = authorized;
    }

    /**
     * @notice Add/remove admin
     * @param admin The admin address
     * @param isAdmin Admin status
     */
    function setAdmin(address admin, bool isAdmin) external onlyOwner {
        admins[admin] = isAdmin;
    }

    /**
     * @notice Update username length limits
     * @param minLength Minimum length
     * @param maxLength Maximum length
     */
    function setUsernameLimits(uint256 minLength, uint256 maxLength) external onlyOwner {
        require(minLength > 0 && maxLength >= minLength, "UserRegistry: Invalid limits");
        minUsernameLength = minLength;
        maxUsernameLength = maxLength;
    }

    // ============ View Functions ============

    function getProfile(address user) external view override returns (UserProfile memory) {
        return _profiles[user];
    }

    function getExtendedProfile(address user) external view override returns (ExtendedProfile memory) {
        return ExtendedProfile({
            bio: _bios[user],
            socials: _socialLinks[user]
        });
    }

    function getBio(address user) external view returns (string memory) {
        return _bios[user];
    }

    function getSocialLinks(address user) external view returns (SocialLinks memory) {
        return _socialLinks[user];
    }

    function getCollections(address user) external view override returns (address[] memory) {
        return _userCollections[user];
    }

    function getUserByUsername(string calldata username) external view override returns (address) {
        return _usernameToAddress[_toLower(username)];
    }

    function isRegistered(address user) external view override returns (bool) {
        return _profiles[user].exists;
    }

    function isUsernameAvailable(string calldata username) external view override returns (bool) {
        if (!_isValidUsername(username)) return false;
        return _usernameToAddress[_toLower(username)] == address(0);
    }

    function getCollectionCount(address user) external view returns (uint256) {
        return _userCollections[user].length;
    }

    // ============ Internal Functions ============

    function _isValidUsername(string memory username) internal view returns (bool) {
        bytes memory b = bytes(username);
        if (b.length < minUsernameLength || b.length > maxUsernameLength) {
            return false;
        }

        // Only allow alphanumeric and underscore
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            if (
                !(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x41 && char <= 0x5A) && // A-Z
                !(char >= 0x61 && char <= 0x7A) && // a-z
                !(char == 0x5F) // _
            ) {
                return false;
            }
        }
        return true;
    }

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            if ((bStr[i] >= 0x41) && (bStr[i] <= 0x5A)) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function getVersion() external pure returns (string memory) {
        return "2.0.0";
    }

    /**
     * @notice Update max bio length
     * @param newMaxLength New max bio length
     */
    function setMaxBioLength(uint256 newMaxLength) external onlyOwner {
        require(newMaxLength > 0, "UserRegistry: Invalid length");
        maxBioLength = newMaxLength;
    }
}
