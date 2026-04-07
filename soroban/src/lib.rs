// SPDX-License-Identifier: MIT
// AgentMarket Escrow Contract for Stellar Soroban

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, Address, Env, String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Task {
    pub id: u64,
    pub poster: Address,
    pub budget: i128,
    pub deadline: u64,
    pub status: TaskStatus,
    pub winning_bidder: Option<Address>,
    pub winning_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TaskStatus {
    Open,
    InProgress,
    Completed,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bid {
    pub id: u64,
    pub task_id: u64,
    pub bidder: Address,
    pub amount: i128,
}

#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    TaskNotFound = 1,
    BidNotFound = 2,
    NotPoster = 3,
    TaskNotOpen = 4,
    DeadlinePassed = 5,
    InsufficientFunds = 6,
    AlreadyBid = 7,
    NotWinningBidder = 8,
}

#[contract]
pub struct AgentMarketEscrow;

#[contractimpl]
impl AgentMarketEscrow {
    /// Post a new task with escrowed payment
    pub fn post_task(
        env: Env,
        poster: Address,
        title: String,
        budget: i128,
        deadline: u64,
    ) -> Result<u64, Error> {
        poster.require_auth();

        // Transfer budget from poster to contract
        // In production: use native token transfer

        let task_id: u64 = env.storage().instance().get(&Symbol::new(&env, "task_counter"))
            .unwrap_or(0u64);
        let new_id = task_id + 1;

        let task = Task {
            id: new_id,
            poster: poster.clone(),
            budget,
            deadline,
            status: TaskStatus::Open,
            winning_bidder: None,
            winning_amount: 0,
        };

        env.storage().instance().set(&Self::task_key(new_id), &task);
        env.storage().instance().set(&Symbol::new(&env, "task_counter"), &new_id);

        Ok(new_id)
    }

    /// Submit a bid on a task
    pub fn submit_bid(
        env: Env,
        task_id: u64,
        bidder: Address,
        amount: i128,
    ) -> Result<u64, Error> {
        bidder.require_auth();

        let mut task: Task = env.storage().instance()
            .get(&Self::task_key(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.status != TaskStatus::Open {
            return Err(Error::TaskNotOpen);
        }

        if amount > task.budget {
            return Err(Error::InsufficientFunds);
        }

        let bid_id: u64 = env.storage().instance().get(&Symbol::new(&env, "bid_counter"))
            .unwrap_or(0u64);
        let new_bid_id = bid_id + 1;

        let bid = Bid {
            id: new_bid_id,
            task_id,
            bidder: bidder.clone(),
            amount,
        };

        env.storage().instance().set(&Self::bid_key(new_bid_id), &bid);
        env.storage().instance().set(&Symbol::new(&env, "bid_counter"), &new_bid_id);

        Ok(new_bid_id)
    }

    /// Poster accepts a bid
    pub fn accept_bid(env: Env, task_id: u64, bid_id: u64, poster: Address) -> Result<(), Error> {
        poster.require_auth();

        let mut task: Task = env.storage().instance()
            .get(&Self::task_key(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.poster != poster {
            return Err(Error::NotPoster);
        }

        let bid: Bid = env.storage().instance()
            .get(&Self::bid_key(bid_id))
            .ok_or(Error::BidNotFound)?;

        task.status = TaskStatus::InProgress;
        task.winning_bidder = Some(bid.bidder.clone());
        task.winning_amount = bid.amount;

        env.storage().instance().set(&Self::task_key(task_id), &task);

        Ok(())
    }

    /// Settle task - pay winning bidder (80/20 split)
    pub fn settle_task(
        env: Env,
        task_id: u64,
        platform: Address,
        commission_bps: i128,
    ) -> Result<(), Error> {
        platform.require_auth();

        let mut task: Task = env.storage().instance()
            .get(&Self::task_key(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.status != TaskStatus::InProgress {
            return Err(Error::TaskNotOpen);
        }

        let bidder = task.winning_bidder.clone().ok_or(Error::NotWinningBidder)?;
        let platform_fee = task.winning_amount * commission_bps / 10000;
        let agent_payout = task.winning_amount - platform_fee;

        // Transfer to agent (80%)
        // In production: token.transfer(&bidder, &agent_payout)

        // Transfer to platform (20%)
        // In production: token.transfer(&platform, &platform_fee)

        task.status = TaskStatus::Completed;
        env.storage().instance().set(&Self::task_key(task_id), &task);

        Ok(())
    }

    /// Get task details
    pub fn get_task(env: Env, task_id: u64) -> Result<Task, Error> {
        env.storage().instance()
            .get(&Self::task_key(task_id))
            .ok_or(Error::TaskNotFound)
    }

    /// Get bid details
    pub fn get_bid(env: Env, bid_id: u64) -> Result<Bid, Error> {
        env.storage().instance()
            .get(&Self::bid_key(bid_id))
            .ok_or(Error::BidNotFound)
    }

    fn task_key(task_id: u64) -> Symbol {
        Symbol::new(&std::env::current_borrowed(), "task")
    }

    fn bid_key(bid_id: u64) -> Symbol {
        Symbol::new(&std::env::current_borrowed(), "bid")
    }
}
