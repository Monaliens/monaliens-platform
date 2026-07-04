require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      viaIR: true,
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
        interval: 300 // 0.3 seconds = 300ms
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    monadMainnet: {
      url: process.env.RPC_URL || process.env.RPC_URL || "https://mainnet.monad.xyz",
      chainId: 143,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    monadProduction: {
      url: process.env.RPC_URL || process.env.RPC_URL || "https://mainnet.monad.xyz",
      chainId: 143,
      accounts: process.env.PRODUCTION_PRIVATE_KEY ? [process.env.PRODUCTION_PRIVATE_KEY] : []
    }
  }
};
