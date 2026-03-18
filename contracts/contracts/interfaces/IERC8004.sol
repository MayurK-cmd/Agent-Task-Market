// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004
 * @notice Minimal interface for reading from the ERC-8004 reputation registry.
 *
 * We only need getSummary() — it returns the agent's reputation score
 * which we use to gate bidding on tasks with a min_rep_score requirement.
 *
 * Full ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
 */
interface IERC8004 {
    /**
     * @notice Returns a summary of an agent's reputation.
     * @param agent  The agent's wallet address.
     * @return score       Reputation score (0–100)
     * @return totalTasks  Total tasks completed
     * @return verified    Whether the agent is verified
     */
    function getSummary(address agent)
        external
        view
        returns (
            uint256 score,
            uint256 totalTasks,
            bool    verified
        );
}
