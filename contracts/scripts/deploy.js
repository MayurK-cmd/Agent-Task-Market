const hre = require('hardhat')
require('dotenv').config()

async function main() {
  const [deployer] = await hre.ethers.getSigners()

  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   TaskMarket Deployment                  ║')
  console.log('╚══════════════════════════════════════════╝\n')

  console.log('Deployer:       ', deployer.address)
  console.log('Network:        ', hre.network.name)
  console.log('Chain ID:       ', (await hre.ethers.provider.getNetwork()).chainId.toString())

  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log('Deployer balance:', hre.ethers.formatEther(balance), 'CELO\n')

  // ── Config ─────────────────────────────────────────────────────────────────
  const platformWallet = process.env.PLATFORM_WALLET || deployer.address
  const commissionBps  = parseInt(process.env.COMMISSION_BPS || '2000')

  // ERC-8004 registry on Celo Sepolia — pass address(0) until confirmed deployed
  // Update this once you confirm the registry address on Celo Sepolia
  const reputationRegistry = '0x0000000000000000000000000000000000000000'

  console.log('Platform wallet: ', platformWallet)
  console.log('Commission:      ', `${commissionBps / 100}% (${commissionBps} bps)`)
  console.log('Rep registry:    ', reputationRegistry, '(disabled — no ERC-8004 on Sepolia yet)\n')

  // ── Deploy ─────────────────────────────────────────────────────────────────
  console.log('Deploying TaskMarket...')

  const TaskMarket = await hre.ethers.getContractFactory('TaskMarket')
  const contract   = await TaskMarket.deploy(
    platformWallet,
    commissionBps,
    reputationRegistry,
  )

  await contract.waitForDeployment()
  const address = await contract.getAddress()

  console.log('\n✅ TaskMarket deployed!')
  console.log('   Address:  ', address)
  console.log('   Explorer: ', `https://celo-sepolia.blockscout.com/address/${address}`)

  // ── Post-deploy instructions ───────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════')
  console.log('NEXT STEPS:')
  console.log('══════════════════════════════════════════')
  console.log(`1. Copy this address to backend/.env:`)
  console.log(`   CONTRACT_ADDRESS=${address}`)
  console.log(`2. Copy to agents/bidder/.env:`)
  console.log(`   CONTRACT_ADDRESS=${address}`)
  console.log(`3. Copy to frontend/.env:`)
  console.log(`   VITE_CONTRACT_ADDRESS=${address}`)
  console.log('══════════════════════════════════════════\n')

  // ── Save deployment info ───────────────────────────────────────────────────
  const fs   = require('fs')
  const info = {
    network:         hre.network.name,
    chainId:         (await hre.ethers.provider.getNetwork()).chainId.toString(),
    address,
    platformWallet,
    commissionBps,
    deployedAt:      new Date().toISOString(),
    deployer:        deployer.address,
    blockExplorer:   `https://celo-sepolia.blockscout.com/address/${address}`,
  }
  fs.writeFileSync(
    'deployment.json',
    JSON.stringify(info, null, 2)
  )
  console.log('Deployment info saved to deployment.json')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})