// Validate Ethereum address
function isValidEthereumAddress(address) {
  // Basic Ethereum address validation (0x followed by 40 hex characters)
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethRegex.test(address);
}

// Validate wallet address (only Ethereum)
function isValidWalletAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  return isValidEthereumAddress(address);
}

// Validate list name (alphanumeric, underscores, hyphens)
function isValidListName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Allow alphanumeric, underscores, and hyphens (3-50 characters)
  const nameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return nameRegex.test(name);
}

// Batch validate addresses
function validateAddresses(addresses) {
  if (!Array.isArray(addresses)) {
    return {
      valid: false,
      invalidAddresses: [],
      error: 'Addresses must be an array'
    };
  }

  const invalidAddresses = [];
  const validAddresses = [];

  for (const address of addresses) {
    if (isValidWalletAddress(address)) {
      validAddresses.push(address);
    } else {
      invalidAddresses.push(address);
    }
  }

  return {
    valid: invalidAddresses.length === 0,
    validAddresses,
    invalidAddresses
  };
}

// Clean and normalize addresses
function normalizeAddresses(addresses) {
  if (!Array.isArray(addresses)) {
    // If it's a string (multiline), split by newlines
    if (typeof addresses === 'string') {
      addresses = addresses.split(/[\n,]+/);
    } else {
      return [];
    }
  }

  return addresses
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0)
    .filter((addr, index, self) => self.indexOf(addr) === index); // Remove duplicates
}

module.exports = {
  isValidEthereumAddress,
  isValidWalletAddress,
  isValidListName,
  validateAddresses,
  normalizeAddresses
};