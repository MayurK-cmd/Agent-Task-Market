require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // ── Local hardhat (for tests) ───────────────────────────────────────────
    hardhat: {
      chainId: 31337,
    },

    // ── Celo Sepolia testnet ────────────────────────────────────────────────
    'celo-sepolia': {
      url:      process.env.CELO_RPC_URL || 'https://celo-sepolia.drpc.org',
      chainId:  11142220,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      gasPrice: 'auto',
    },

    // ── Celo Mainnet (use later) ────────────────────────────────────────────
    celo: {
      url:      'https://forno.celo.org',
      chainId:  42220,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },

  // ── Blockscout verification (Celo Sepolia uses Blockscout not Etherscan) ──
  etherscan: {
    apiKey: {
      'celo-sepolia': 'placeholder', // Blockscout doesn't need a real key
    },
    customChains: [
      {
        network:  'celo-sepolia',
        chainId:  11142220,
        urls: {
          apiURL:      'https://celo-sepolia.blockscout.com/api',
          browserURL:  'https://celo-sepolia.blockscout.com',
        },
      },
    ],
  },

  gasReporter: {
    enabled:  true,
    currency: 'USD',
  },
}