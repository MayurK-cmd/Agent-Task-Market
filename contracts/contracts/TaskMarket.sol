// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC8004.sol";

/**
 * @title TaskMarket
 * @notice Decentralised task marketplace on Celo.
 *
 * Flow:
 *   1. Anyone calls postTask() with cUSD escrow attached
 *   2. Agents call submitBid() — gated by ERC-8004 rep score
 *   3. Poster calls acceptBid() — locks in the winning agent
 *   4. Agent does the work off-chain, uploads deliverable to IPFS
 *   5. Poster calls settleTask() — splits payment:
 *        → (100 - commissionBps/100)% to winning agent
 *        → commissionBps/100% to platform wallet
 *
 * Dispute: poster can call disputeTask() before settling.
 *          Owner (platform) resolves disputes via resolveDispute().
 *
 * Payment token: native CELO (for simplicity on testnet).
 *                Swap for cUSD ERC-20 in production using IERC20.
 */
contract TaskMarket is ReentrancyGuard, Ownable {

    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 public constant MAX_COMMISSION_BPS = 3000; // 30% hard cap
    uint256 public constant BPS_DENOMINATOR    = 10000;

    // ── State ─────────────────────────────────────────────────────────────────
    address public platformWallet;
    uint256 public commissionBps;          // e.g. 2000 = 20%
    address public reputationRegistry;     // ERC-8004 registry address (optional)
    bool    public reputationGatingEnabled;

    uint256 private _taskCounter;
    uint256 private _bidCounter;

    // ── Enums ─────────────────────────────────────────────────────────────────
    enum TaskStatus { Open, Bidding, InProgress, Completed, Disputed, Expired }
    enum BidStatus  { Pending, Winning, Outbid, Paid, Rejected }

    // ── Structs ───────────────────────────────────────────────────────────────
    struct Task {
        uint256 id;
        address poster;
        uint256 budget;          // in wei (native CELO on testnet)
        uint256 deadline;        // unix timestamp
        uint256 minRepScore;     // ERC-8004 minimum score to bid
        TaskStatus status;
        uint256 winningBidId;    // 0 if none yet
        string  ipfsCid;         // deliverable CID (set on completion)
        string  category;        // data_collection | code_review | etc
        string  title;
    }

    struct Bid {
        uint256 id;
        uint256 taskId;
        address bidder;
        uint256 amount;          // in wei — must be <= task.budget
        BidStatus status;
        string  message;         // agent's pitch
    }

    // ── Storage ───────────────────────────────────────────────────────────────
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Bid)  public bids;

    // taskId → array of bid ids
    mapping(uint256 => uint256[]) public taskBids;

    // bidder → taskId → bidId (prevent duplicate bids)
    mapping(address => mapping(uint256 => uint256)) public agentTaskBid;

    // ── Events ────────────────────────────────────────────────────────────────
    event TaskPosted(
        uint256 indexed taskId,
        address indexed poster,
        uint256 budget,
        string  category,
        uint256 deadline
    );
    event BidSubmitted(
        uint256 indexed bidId,
        uint256 indexed taskId,
        address indexed bidder,
        uint256 amount
    );
    event BidAccepted(
        uint256 indexed bidId,
        uint256 indexed taskId,
        address indexed bidder
    );
    event TaskSettled(
        uint256 indexed taskId,
        address indexed bidder,
        uint256 bidderPayout,
        uint256 platformFee,
        string  ipfsCid
    );
    event TaskDisputed(uint256 indexed taskId, address indexed poster);
    event DisputeResolved(uint256 indexed taskId, address indexed winner, uint256 amount);
    event CommissionUpdated(uint256 oldBps, uint256 newBps);

    // ── Errors ────────────────────────────────────────────────────────────────
    error TaskNotFound(uint256 taskId);
    error BidNotFound(uint256 bidId);
    error NotTaskPoster(uint256 taskId);
    error TaskNotOpen(uint256 taskId, TaskStatus current);
    error DeadlinePassed(uint256 taskId);
    error DeadlineNotPassed(uint256 taskId);
    error BudgetRequired();
    error BidExceedsBudget(uint256 bid, uint256 budget);
    error AlreadyBid(uint256 taskId);
    error SelfBid(uint256 taskId);
    error RepTooLow(uint256 required, uint256 actual);
    error NotWinningBid(uint256 bidId);
    error CommissionTooHigh(uint256 bps);
    error TransferFailed();

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _platformWallet,
        uint256 _commissionBps,
        address _reputationRegistry   // pass address(0) to disable rep gating
    ) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_commissionBps <= MAX_COMMISSION_BPS, "Commission too high");

        platformWallet          = _platformWallet;
        commissionBps           = _commissionBps;
        reputationRegistry      = _reputationRegistry;
        reputationGatingEnabled = _reputationRegistry != address(0);
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier taskExists(uint256 taskId) {
        if (tasks[taskId].poster == address(0)) revert TaskNotFound(taskId);
        _;
    }

    modifier onlyPoster(uint256 taskId) {
        if (tasks[taskId].poster != msg.sender) revert NotTaskPoster(taskId);
        _;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * @notice Post a new task with budget held in escrow.
     * @dev Send CELO with this call — it becomes the escrow.
     */
    function postTask(
        string  calldata title,
        string  calldata category,
        uint256 deadline,
        uint256 minRepScore
    ) external payable returns (uint256 taskId) {
        if (msg.value == 0) revert BudgetRequired();
        require(deadline > block.timestamp, "Deadline must be in future");
        require(bytes(title).length > 0,    "Title required");

        taskId = ++_taskCounter;

        tasks[taskId] = Task({
            id:           taskId,
            poster:       msg.sender,
            budget:       msg.value,
            deadline:     deadline,
            minRepScore:  minRepScore,
            status:       TaskStatus.Open,
            winningBidId: 0,
            ipfsCid:      "",
            category:     category,
            title:        title
        });

        emit TaskPosted(taskId, msg.sender, msg.value, category, deadline);
    }

    /**
     * @notice Submit a bid on an open task.
     * @param taskId   The task to bid on.
     * @param amount   Bid amount in wei — must be <= task.budget.
     * @param message  Short pitch from the agent.
     */
    function submitBid(
        uint256 taskId,
        uint256 amount,
        string  calldata message
    ) external taskExists(taskId) returns (uint256 bidId) {
        Task storage task = tasks[taskId];

        if (task.status != TaskStatus.Open && task.status != TaskStatus.Bidding)
            revert TaskNotOpen(taskId, task.status);
        if (block.timestamp >= task.deadline)
            revert DeadlinePassed(taskId);
        if (msg.sender == task.poster)
            revert SelfBid(taskId);
        if (amount > task.budget)
            revert BidExceedsBudget(amount, task.budget);
        if (agentTaskBid[msg.sender][taskId] != 0)
            revert AlreadyBid(taskId);

        // ── ERC-8004 reputation gate ────────────────────────────────────────
        if (reputationGatingEnabled && task.minRepScore > 0) {
            try IERC8004(reputationRegistry).getSummary(msg.sender)
                returns (uint256 score, uint256, bool)
            {
                if (score < task.minRepScore)
                    revert RepTooLow(task.minRepScore, score);
            } catch {
                // Registry not available — allow bid (score 0 tasks pass)
                if (task.minRepScore > 0) revert RepTooLow(task.minRepScore, 0);
            }
        }

        bidId = ++_bidCounter;

        bids[bidId] = Bid({
            id:      bidId,
            taskId:  taskId,
            bidder:  msg.sender,
            amount:  amount,
            status:  BidStatus.Pending,
            message: message
        });

        taskBids[taskId].push(bidId);
        agentTaskBid[msg.sender][taskId] = bidId;

        // Transition task to Bidding
        if (task.status == TaskStatus.Open) {
            task.status = TaskStatus.Bidding;
        }

        emit BidSubmitted(bidId, taskId, msg.sender, amount);
    }

    /**
     * @notice Poster accepts a bid — task moves to InProgress.
     * @dev Only the poster can call this. Marks all other bids as Outbid.
     */
    function acceptBid(uint256 bidId)
        external
        taskExists(bids[bidId].taskId)
        onlyPoster(bids[bidId].taskId)
    {
        Bid  storage bid  = bids[bidId];
        Task storage task = tasks[bid.taskId];

        if (bid.bidder == address(0))         revert BidNotFound(bidId);
        if (task.status != TaskStatus.Bidding) revert TaskNotOpen(bid.taskId, task.status);

        // Mark winning bid
        bid.status       = BidStatus.Winning;
        task.status      = TaskStatus.InProgress;
        task.winningBidId = bidId;

        // Mark all other bids as outbid
        uint256[] storage bidIds = taskBids[bid.taskId];
        for (uint256 i = 0; i < bidIds.length; i++) {
            if (bidIds[i] != bidId) {
                bids[bidIds[i]].status = BidStatus.Outbid;
            }
        }

        emit BidAccepted(bidId, bid.taskId, bid.bidder);
    }

    /**
     * @notice Poster confirms delivery and releases payment.
     *
     * Splits the escrowed budget:
     *   bidder  → budget * (BPS_DENOMINATOR - commissionBps) / BPS_DENOMINATOR
     *   platform→ budget * commissionBps / BPS_DENOMINATOR
     *
     * @param taskId   The task being settled.
     * @param ipfsCid  IPFS CID of the deliverable (for on-chain record).
     */
    function settleTask(uint256 taskId, string calldata ipfsCid)
        external
        nonReentrant
        taskExists(taskId)
        onlyPoster(taskId)
    {
        Task storage task = tasks[taskId];

        require(task.status == TaskStatus.InProgress, "Task not in progress");
        require(task.winningBidId != 0,               "No winning bid");
        require(bytes(ipfsCid).length > 0,            "IPFS CID required");

        Bid storage winningBid = bids[task.winningBidId];

        // ── Calculate split ─────────────────────────────────────────────────
        uint256 platformFee   = (task.budget * commissionBps) / BPS_DENOMINATOR;
        uint256 bidderPayout  = task.budget - platformFee;

        // ── Update state before transfers (checks-effects-interactions) ─────
        task.status   = TaskStatus.Completed;
        task.ipfsCid  = ipfsCid;
        winningBid.status = BidStatus.Paid;

        // ── Transfer payments ────────────────────────────────────────────────
        (bool sentBidder,)   = winningBid.bidder.call{value: bidderPayout}("");
        (bool sentPlatform,) = platformWallet.call{value: platformFee}("");

        if (!sentBidder || !sentPlatform) revert TransferFailed();

        emit TaskSettled(taskId, winningBid.bidder, bidderPayout, platformFee, ipfsCid);
    }

    /**
     * @notice Poster raises a dispute — escrow stays locked until resolved.
     */
    function disputeTask(uint256 taskId)
        external
        taskExists(taskId)
        onlyPoster(taskId)
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.InProgress, "Task not in progress");

        task.status = TaskStatus.Disputed;
        emit TaskDisputed(taskId, msg.sender);
    }

    /**
     * @notice Owner (platform) resolves a dispute.
     * @param taskId     The disputed task.
     * @param payBidder  true = pay bidder (work was acceptable),
     *                   false = refund poster (work was not delivered).
     */
    function resolveDispute(uint256 taskId, bool payBidder)
        external
        nonReentrant
        onlyOwner
        taskExists(taskId)
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Task not disputed");

        task.status = TaskStatus.Completed;

        address recipient = payBidder
            ? bids[task.winningBidId].bidder
            : task.poster;

        (bool sent,) = recipient.call{value: task.budget}("");
        if (!sent) revert TransferFailed();

        emit DisputeResolved(taskId, recipient, task.budget);
    }

    /**
     * @notice Poster reclaims escrow if deadline passed with no bids accepted.
     */
    function expireTask(uint256 taskId)
        external
        nonReentrant
        taskExists(taskId)
        onlyPoster(taskId)
    {
        Task storage task = tasks[taskId];
        require(
            task.status == TaskStatus.Open || task.status == TaskStatus.Bidding,
            "Task cannot be expired"
        );
        require(block.timestamp >= task.deadline, "Deadline not passed yet");

        task.status = TaskStatus.Expired;

        (bool sent,) = task.poster.call{value: task.budget}("");
        if (!sent) revert TransferFailed();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════

    function getTask(uint256 taskId)
        external view taskExists(taskId)
        returns (Task memory)
    {
        return tasks[taskId];
    }

    function getBid(uint256 bidId)
        external view
        returns (Bid memory)
    {
        require(bids[bidId].bidder != address(0), "Bid not found");
        return bids[bidId];
    }

    function getTaskBids(uint256 taskId)
        external view taskExists(taskId)
        returns (uint256[] memory)
    {
        return taskBids[taskId];
    }

    function taskCount() external view returns (uint256) { return _taskCounter; }
    function bidCount()  external view returns (uint256) { return _bidCounter;  }

    // ═════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════

    function setCommission(uint256 newBps) external onlyOwner {
        if (newBps > MAX_COMMISSION_BPS) revert CommissionTooHigh(newBps);
        emit CommissionUpdated(commissionBps, newBps);
        commissionBps = newBps;
    }

    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid address");
        platformWallet = newWallet;
    }

    function setReputationRegistry(address registry) external onlyOwner {
        reputationRegistry      = registry;
        reputationGatingEnabled = registry != address(0);
    }

    // ── Emergency withdraw (only if contract is stuck) ───────────────────────
    function emergencyWithdraw() external onlyOwner {
        (bool sent,) = owner().call{value: address(this).balance}("");
        if (!sent) revert TransferFailed();
    }

    receive() external payable {}
}