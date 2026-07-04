require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

// Test deployer private key
const TEST_PRIVATE_KEY = "process.env.TEST_PRIVATE_KEY";

// Production private key from env
const PRODUCTION_PRIVATE_KEY = process.env.PRODUCTION_PRIVATE_KEY || TEST_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      mining: {
        auto: true,
        interval: 1000
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    monadMainnet: {
      url: process.env.RPC_URL || "https://mainnet.monad.xyz",
      chainId: 143,
      accounts: [TEST_PRIVATE_KEY]
    },
    monadProduction: {
      url: process.env.RPC_URL || "https://mainnet.monad.xyz",
      chainId: 143,
      accounts: [PRODUCTION_PRIVATE_KEY]
    }
  }
};
