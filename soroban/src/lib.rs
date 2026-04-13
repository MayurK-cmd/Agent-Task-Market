// SPDX-License-Identifier: MIT
// AgentMarket Escrow Contract for Stellar Soroban

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, Address, Env, String,
};
use soroban_sdk::token::Client as TokenClient;

// Native XLM token contract address on Stellar testnet
const NATIVE_TOKEN_ADDRESS: &str = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

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

#[contracttype]
pub enum DataKey {
    Task(u64),
    Bid(u64),
    TaskCounter,
    BidCounter,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
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
    /// Transfers budget from poster to contract escrow
    pub fn post_task(
        env: Env,
        poster: Address,
        _title: String,
        budget: i128,
        deadline: u64,
    ) -> Result<u64, Error> {
        poster.require_auth();

        if budget <= 0 {
            return Err(Error::InsufficientFunds);
        }

        // Get native token contract
        let token_contract_address = Address::from_string(
            &String::from_str(&env, NATIVE_TOKEN_ADDRESS)
        );
        let token = TokenClient::new(&env, &token_contract_address);

        // Transfer budget from poster to this contract (escrow)
        token.transfer(&poster, &env.current_contract_address(), &budget);

        let task_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TaskCounter)
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

        env.storage().instance().set(&DataKey::Task(new_id), &task);
        env.storage().instance().set(&DataKey::TaskCounter, &new_id);

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

        let task: Task = env
            .storage()
            .instance()
            .get(&DataKey::Task(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.status != TaskStatus::Open {
            return Err(Error::TaskNotOpen);
        }

        if amount > task.budget {
            return Err(Error::InsufficientFunds);
        }

        let bid_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::BidCounter)
            .unwrap_or(0u64);
        let new_bid_id = bid_id + 1;

        let bid = Bid {
            id: new_bid_id,
            task_id,
            bidder: bidder.clone(),
            amount,
        };

        env.storage().instance().set(&DataKey::Bid(new_bid_id), &bid);
        env.storage().instance().set(&DataKey::BidCounter, &new_bid_id);

        Ok(new_bid_id)
    }

    /// Poster accepts a bid, moving task to InProgress
    pub fn accept_bid(env: Env, task_id: u64, bid_id: u64, poster: Address) -> Result<(), Error> {
        poster.require_auth();

        let mut task: Task = env
            .storage()
            .instance()
            .get(&DataKey::Task(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.poster != poster {
            return Err(Error::NotPoster);
        }

        if task.status != TaskStatus::Open {
            return Err(Error::TaskNotOpen);
        }

        let bid: Bid = env
            .storage()
            .instance()
            .get(&DataKey::Bid(bid_id))
            .ok_or(Error::BidNotFound)?;

        task.status = TaskStatus::InProgress;
        task.winning_bidder = Some(bid.bidder.clone());
        task.winning_amount = bid.amount;

        env.storage().instance().set(&DataKey::Task(task_id), &task);

        Ok(())
    }

    /// Settle task — pay winning bidder minus platform commission
    /// Transfers agent payout to bidder and platform fee to platform
    pub fn settle_task(
        env: Env,
        task_id: u64,
        platform: Address,
        commission_bps: i128,
    ) -> Result<(), Error> {
        platform.require_auth();

        let mut task: Task = env
            .storage()
            .instance()
            .get(&DataKey::Task(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.status != TaskStatus::InProgress {
            return Err(Error::TaskNotOpen);
        }

        let bidder = task.winning_bidder.clone().ok_or(Error::NotWinningBidder)?;
        let platform_fee = task.winning_amount * commission_bps / 10000;
        let agent_payout = task.winning_amount - platform_fee;

        // Get native token contract
        let token_contract_address = Address::from_string(
            &String::from_str(&env, NATIVE_TOKEN_ADDRESS)
        );
        let token = TokenClient::new(&env, &token_contract_address);

        // Transfer agent payout from escrow to bidder
        token.transfer(&env.current_contract_address(), &bidder, &agent_payout);

        // Transfer platform fee from escrow to platform
        token.transfer(&env.current_contract_address(), &platform, &platform_fee);

        task.status = TaskStatus::Completed;
        env.storage().instance().set(&DataKey::Task(task_id), &task);

        Ok(())
    }

    /// Mark a task as disputed
    pub fn dispute_task(env: Env, task_id: u64, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut task: Task = env
            .storage()
            .instance()
            .get(&DataKey::Task(task_id))
            .ok_or(Error::TaskNotFound)?;

        if task.status != TaskStatus::InProgress {
            return Err(Error::TaskNotOpen);
        }

        let winning_bidder = task.winning_bidder.clone().ok_or(Error::NotWinningBidder)?;
        if caller != task.poster && caller != winning_bidder {
            return Err(Error::NotPoster);
        }

        task.status = TaskStatus::Disputed;
        env.storage().instance().set(&DataKey::Task(task_id), &task);

        Ok(())
    }

    /// Get task details
    pub fn get_task(env: Env, task_id: u64) -> Result<Task, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Task(task_id))
            .ok_or(Error::TaskNotFound)
    }

    /// Get bid details
    pub fn get_bid(env: Env, bid_id: u64) -> Result<Bid, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Bid(bid_id))
            .ok_or(Error::BidNotFound)
    }

    /// Get current task counter
    pub fn get_task_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TaskCounter)
            .unwrap_or(0u64)
    }

    /// Get current bid counter
    pub fn get_bid_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::BidCounter)
            .unwrap_or(0u64)
    }
}