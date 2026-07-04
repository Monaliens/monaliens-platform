require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      metadata: {
        bytecodeHash: "none",
        useLiteralContent: true
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: false
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    },
    monadTestnet: {
      url: "process.env.RPC_URL_TESTNET",
      chainId: 10143,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 100000000000,
      gas: 8000000,
      timeout: 60000
    },
    vitriol: {
      url: process.env.RPC_URL || process.env.RPC_URL || "https://mainnet.monad.xyz",
      chainId: 143, // Monad Mainnet
      accounts: process.env.MAINNET_DEPLOYER_PRIVATE_KEY ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 200000000000,
      gas: 8000000,
      timeout: 120000
    },
    vitriolDev: {
      url: process.env.RPC_URL || process.env.RPC_URL || "https://mainnet.monad.xyz",
      chainId: 143,
      accounts: process.env.MAINNET_DEV_PRIVATE_KEY ? [process.env.MAINNET_DEV_PRIVATE_KEY] : [],
      gasPrice: 200000000000,
      gas: 8000000,
      timeout: 120000
    }
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org/",
    browserUrl: "https://monadvision.com/"
  },
  etherscan: {
    enabled: false,
    apiKey: {
      vitriol: "no-api-key-needed"
    },
    customChains: [
      {
        network: "vitriol",
        chainId: 143,
        urls: {
          apiURL: "https://sourcify-api-monad.blockvision.org/api",
          browserURL: "https://monadvision.com/"
        }
      }
    ]
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 30,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
    outputFile: "gas-report.txt",
    noColors: true
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 120000
  }
};
