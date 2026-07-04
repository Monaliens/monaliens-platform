import config from '../config.json'

export interface DeploymentConfig {
  network: string
  chainId: number
  api: {
    baseUrl: string
  }
  rpc: {
    url: string
  }
  contracts: {
    monToken: string
    testNFT: string
    staking: string
    referral: string
    raffleFactory: string
    deployer: string
    platformFeeWallet: string
  }
  blockchain: {
    name: string
    symbol: string
    decimals: number
    explorer: {
      name: string
      url: string
    }
  }
}

export const getConfig = (): DeploymentConfig => {
  return config as DeploymentConfig
}

export const getContractAddress = (contractName: keyof DeploymentConfig['contracts']) => {
  return config.contracts[contractName]
}

export const getPlatformWallet = () => {
  return config.contracts.deployer
}

export const getPlatformFeeWallet = () => {
  return config.contracts.platformFeeWallet
}

export const getChainId = () => {
  return config.chainId
}

export const getApiUrl = () => {
  // Always use config.json for both development and production
  return config.api.baseUrl
}

export const getRpcUrl = () => {
  return config.rpc.url
}

export const getBlockchainConfig = () => {
  return config.blockchain
}

export const getExplorerUrl = () => {
  return config.blockchain.explorer.url
}

export const getExplorerName = () => {
  return config.blockchain.explorer.name
}

export default config 