const { expect }        = require('chai')
const { ethers }        = require('hardhat')
const { loadFixture }   = require('@nomicfoundation/hardhat-toolbox/network-helpers')

// ── Helpers ───────────────────────────────────────────────────────────────────
const CELO  = (n) => ethers.parseEther(String(n))
const DAY   = 86400
const later = (secs) => Math.floor(Date.now() / 1000) + secs

describe('TaskMarket', () => {

  // ── Fixture ─────────────────────────────────────────────────────────────────
  async function deployFixture() {
    const [owner, platform, poster, bidderA, bidderB, stranger] =
      await ethers.getSigners()

    const TaskMarket = await ethers.getContractFactory('TaskMarket')
    const market = await TaskMarket.deploy(
      platform.address,
      2000,              // 20% commission
      ethers.ZeroAddress // no rep registry in tests
    )

    return { market, owner, platform, poster, bidderA, bidderB, stranger }
  }

  // ── Convenience: post a basic task ──────────────────────────────────────────
  async function postTask(market, poster, opts = {}) {
    const tx = await market.connect(poster).postTask(
      opts.title    || 'Scrape top 10 Celo DeFi protocols',
      opts.category || 'data_collection',
      opts.deadline || later(DAY),
      opts.minRep   || 0,
      { value: opts.budget || CELO(2) }
    )
    const receipt = await tx.wait()
    const event   = receipt.logs.find(l => {
      try { return market.interface.parseLog(l)?.name === 'TaskPosted' }
      catch { return false }
    })
    const parsed  = market.interface.parseLog(event)
    return parsed.args.taskId
  }

  // ── Convenience: post + bid ──────────────────────────────────────────────────
  async function postAndBid(market, poster, bidder, opts = {}) {
    const taskId = await postTask(market, poster, opts)
    const tx     = await market.connect(bidder).submitBid(
      taskId,
      opts.bidAmount || CELO(1.8),
      opts.message   || 'I can do this task'
    )
    const receipt = await tx.wait()
    const event   = receipt.logs.find(l => {
      try { return market.interface.parseLog(l)?.name === 'BidSubmitted' }
      catch { return false }
    })
    const parsed  = market.interface.parseLog(event)
    return { taskId, bidId: parsed.args.bidId }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  describe('Deployment', () => {

    it('sets platform wallet correctly', async () => {
      const { market, platform } = await loadFixture(deployFixture)
      expect(await market.platformWallet()).to.equal(platform.address)
    })

    it('sets commission correctly', async () => {
      const { market } = await loadFixture(deployFixture)
      expect(await market.commissionBps()).to.equal(2000)
    })

    it('reverts if commission > 30%', async () => {
      const [owner, platform] = await ethers.getSigners()
      const TaskMarket = await ethers.getContractFactory('TaskMarket')
      await expect(
        TaskMarket.deploy(platform.address, 3001, ethers.ZeroAddress)
      ).to.be.reverted
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('postTask', () => {

    it('creates a task and emits TaskPosted', async () => {
      const { market, poster } = await loadFixture(deployFixture)
      await expect(
        market.connect(poster).postTask(
          'Test task', 'data_collection', later(DAY), 0,
          { value: CELO(2) }
        )
      ).to.emit(market, 'TaskPosted')
        .withArgs(1n, poster.address, CELO(2), 'data_collection', (v) => v > 0n)
    })

    it('holds budget in escrow', async () => {
      const { market, poster } = await loadFixture(deployFixture)
      await postTask(market, poster)
      expect(await ethers.provider.getBalance(await market.getAddress()))
        .to.equal(CELO(2))
    })

    it('reverts with zero value', async () => {
      const { market, poster } = await loadFixture(deployFixture)
      await expect(
        market.connect(poster).postTask('T', 'data_collection', later(DAY), 0, { value: 0 })
      ).to.be.revertedWithCustomError(market, 'BudgetRequired')
    })

    it('reverts with past deadline', async () => {
      const { market, poster } = await loadFixture(deployFixture)
      await expect(
        market.connect(poster).postTask('T', 'data_collection', later(-100), 0, { value: CELO(1) })
      ).to.be.reverted
    })

    it('increments taskCount', async () => {
      const { market, poster } = await loadFixture(deployFixture)
      await postTask(market, poster)
      await postTask(market, poster)
      expect(await market.taskCount()).to.equal(2n)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('submitBid', () => {

    it('creates a bid and emits BidSubmitted', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const taskId = await postTask(market, poster)
      await expect(
        market.connect(bidderA).submitBid(taskId, CELO(1.8), 'I can do this')
      ).to.emit(market, 'BidSubmitted')
        .withArgs(1n, taskId, bidderA.address, CELO(1.8))
    })

    it('transitions task to Bidding status', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const taskId = await postTask(market, poster)
      await market.connect(bidderA).submitBid(taskId, CELO(1.8), 'msg')
      const task = await market.getTask(taskId)
      expect(task.status).to.equal(1n) // Bidding = 1
    })

    it('reverts if poster bids on own task', async () => {
      const { market, poster } = await loadFixture(deployFixture)
      const taskId = await postTask(market, poster)
      await expect(
        market.connect(poster).submitBid(taskId, CELO(1), 'self bid')
      ).to.be.revertedWithCustomError(market, 'SelfBid')
    })

    it('reverts if bid exceeds budget', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const taskId = await postTask(market, poster)
      await expect(
        market.connect(bidderA).submitBid(taskId, CELO(3), 'over budget')
      ).to.be.revertedWithCustomError(market, 'BidExceedsBudget')
    })

    it('reverts on duplicate bid', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const taskId = await postTask(market, poster)
      await market.connect(bidderA).submitBid(taskId, CELO(1.8), 'first')
      await expect(
        market.connect(bidderA).submitBid(taskId, CELO(1.5), 'second')
      ).to.be.revertedWithCustomError(market, 'AlreadyBid')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('acceptBid', () => {

    it('marks bid as winning and task as InProgress', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA)

      await market.connect(poster).acceptBid(bidId)

      const task = await market.getTask(taskId)
      const bid  = await market.getBid(bidId)
      expect(task.status).to.equal(2n)       // InProgress = 2
      expect(bid.status).to.equal(1n)        // Winning = 1
      expect(task.winningBidId).to.equal(bidId)
    })

    it('marks other bids as outbid', async () => {
      const { market, poster, bidderA, bidderB } = await loadFixture(deployFixture)
      const taskId = await postTask(market, poster)
      await market.connect(bidderA).submitBid(taskId, CELO(1.8), 'A')
      const txB    = await market.connect(bidderB).submitBid(taskId, CELO(1.5), 'B')
      const recB   = await txB.wait()
      const evB    = recB.logs.find(l => {
        try { return market.interface.parseLog(l)?.name === 'BidSubmitted' } catch { return false }
      })
      const bidIdB = market.interface.parseLog(evB).args.bidId

      // accept B
      await market.connect(poster).acceptBid(bidIdB)
      const bidIdA = await market.agentTaskBid(bidderA.address, taskId)
      const bidA   = await market.getBid(bidIdA)
      expect(bidA.status).to.equal(2n) // Outbid = 2
    })

    it('reverts if non-poster tries to accept', async () => {
      const { market, poster, bidderA, stranger } = await loadFixture(deployFixture)
      const { bidId } = await postAndBid(market, poster, bidderA)
      await expect(
        market.connect(stranger).acceptBid(bidId)
      ).to.be.revertedWithCustomError(market, 'NotTaskPoster')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('settleTask — the 80/20 split', () => {

    it('pays bidder 80% and platform 20%', async () => {
      const { market, poster, bidderA, platform } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA, { budget: CELO(2) })
      await market.connect(poster).acceptBid(bidId)

      const bidderBefore   = await ethers.provider.getBalance(bidderA.address)
      const platformBefore = await ethers.provider.getBalance(platform.address)

      await market.connect(poster).settleTask(taskId, 'QmTestCid123')

      const bidderAfter    = await ethers.provider.getBalance(bidderA.address)
      const platformAfter  = await ethers.provider.getBalance(platform.address)

      // budget = 2 CELO, commission = 20%
      // platform gets 0.4 CELO, bidder gets 1.6 CELO
      expect(platformAfter - platformBefore).to.equal(CELO(0.4))
      expect(bidderAfter   - bidderBefore  ).to.equal(CELO(1.6))
    })

    it('sets task status to Completed and records IPFS CID', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA)
      await market.connect(poster).acceptBid(bidId)
      await market.connect(poster).settleTask(taskId, 'QmMyDeliverable')

      const task = await market.getTask(taskId)
      expect(task.status).to.equal(3n) // Completed = 3
      expect(task.ipfsCid).to.equal('QmMyDeliverable')
    })

    it('emits TaskSettled with correct amounts', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA, { budget: CELO(2) })
      await market.connect(poster).acceptBid(bidId)

      await expect(market.connect(poster).settleTask(taskId, 'QmCid'))
        .to.emit(market, 'TaskSettled')
        .withArgs(taskId, bidderA.address, CELO(1.6), CELO(0.4), 'QmCid')
    })

    it('reverts if non-poster tries to settle', async () => {
      const { market, poster, bidderA, stranger } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA)
      await market.connect(poster).acceptBid(bidId)
      await expect(
        market.connect(stranger).settleTask(taskId, 'QmCid')
      ).to.be.revertedWithCustomError(market, 'NotTaskPoster')
    })

    it('reverts if no IPFS CID provided', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA)
      await market.connect(poster).acceptBid(bidId)
      await expect(
        market.connect(poster).settleTask(taskId, '')
      ).to.be.reverted
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('disputeTask + resolveDispute', () => {

    it('poster can dispute an in-progress task', async () => {
      const { market, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA)
      await market.connect(poster).acceptBid(bidId)

      await expect(market.connect(poster).disputeTask(taskId))
        .to.emit(market, 'TaskDisputed')

      const task = await market.getTask(taskId)
      expect(task.status).to.equal(4n) // Disputed = 4
    })

    it('owner resolves dispute in favour of bidder', async () => {
      const { market, owner, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA, { budget: CELO(2) })
      await market.connect(poster).acceptBid(bidId)
      await market.connect(poster).disputeTask(taskId)

      const before = await ethers.provider.getBalance(bidderA.address)
      await market.connect(owner).resolveDispute(taskId, true) // pay bidder
      const after  = await ethers.provider.getBalance(bidderA.address)

      expect(after - before).to.equal(CELO(2)) // full amount, no commission on dispute
    })

    it('owner resolves dispute in favour of poster (refund)', async () => {
      const { market, owner, poster, bidderA } = await loadFixture(deployFixture)
      const { taskId, bidId } = await postAndBid(market, poster, bidderA, { budget: CELO(2) })
      await market.connect(poster).acceptBid(bidId)
      await market.connect(poster).disputeTask(taskId)

      const before = await ethers.provider.getBalance(poster.address)
      await market.connect(owner).resolveDispute(taskId, false) // refund poster
      const after  = await ethers.provider.getBalance(poster.address)

      expect(after - before).to.be.closeTo(CELO(2), ethers.parseEther('0.01'))
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('expireTask', () => {

    it('refunds poster after deadline with no accepted bid', async () => {
      const { market, poster } = await loadFixture(deployFixture)

      // Set deadline 60 seconds from now
      const deadline = later(60)
      const taskId   = await postTask(market, poster, { deadline })

      // Jump chain time past the deadline
      await ethers.provider.send('evm_setNextBlockTimestamp', [deadline + 1])
      await ethers.provider.send('evm_mine')

      const before = await ethers.provider.getBalance(poster.address)
      const tx     = await market.connect(poster).expireTask(taskId)
      const rec    = await tx.wait()
      const gas    = rec.gasUsed * rec.gasPrice
      const after  = await ethers.provider.getBalance(poster.address)

      expect(after + gas - before).to.equal(CELO(2))
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  describe('Admin functions', () => {

    it('owner can update commission', async () => {
      const { market, owner } = await loadFixture(deployFixture)
      await market.connect(owner).setCommission(2500)
      expect(await market.commissionBps()).to.equal(2500n)
    })

    it('reverts if commission > 30%', async () => {
      const { market, owner } = await loadFixture(deployFixture)
      await expect(
        market.connect(owner).setCommission(3001)
      ).to.be.revertedWithCustomError(market, 'CommissionTooHigh')
    })

    it('non-owner cannot update commission', async () => {
      const { market, stranger } = await loadFixture(deployFixture)
      await expect(
        market.connect(stranger).setCommission(1000)
      ).to.be.reverted
    })
  })
})