# Soroban Escrow Contract

## Deploy

```bash
# Install Rust + Soroban
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
npm install -g @stellar/stellar-cli

# Build
cd soroban
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/agentmarket_escrow.wasm \
  --source YOUR_WALLET_SECRET \
  --network testnet

# Copy contract address to backend/.env
SOROBAN_CONTRACT_ADDRESS=CBUBTHSZYVAJ6F2X54TWUETKYT5OLD2E6DWEKEOLUBSKFVLNRXRW37VJ
```

## Interact

```bash
# Post task
stellar contract invoke \
  --id CD... \
  --source YOUR_SECRET \
  --network testnet \
  -- post_task \
  --poster GA... \
  --title "My Task" \
  --budget 10000000 \
  --deadline 1735689600

# Submit bid
stellar contract invoke \
  --id CD... \
  --source BIDDER_SECRET \
  --network testnet \
  -- submit_bid \
  --task_id 1 \
  --bidder GA... \
  --amount 9000000
```


