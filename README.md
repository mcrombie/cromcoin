# Cromcoin

A fixed-supply ERC-20 token on [Base](https://base.org) distributed entirely through a
browser-based proof-of-work mining game. No presale, no founder allocation, no staking,
no burning. The full 1,000,000,000 CROMCOIN supply is minted to the contract at
deployment and handed out 1,000 at a time to anyone who can find a valid PoW nonce.
When the mine is empty, it's gone.

## How it works

- **Total supply:** 1,000,000,000 CROMCOIN (0 decimals — whole coins only)
- **Reward per claim:** 1,000 CROMCOIN
- **Cooldown:** 1 claim per wallet per 24 hours
- **Proof-of-work:** the browser brute-forces a `nonce` such that
  `keccak256(abi.encodePacked(msg.sender, nonce, block.number / 10))` has 20 leading
  zero bits. The hash is scoped to the caller's own address, so there's no
  front-running risk — finding someone else's nonce is useless to you.
- **Total possible claims:** 1,000,000 (1B supply ÷ 1,000 per claim)

See [`contracts/Cromcoin.sol`](contracts/Cromcoin.sol) for the full implementation.

## Project structure

```
contracts/
  Cromcoin.sol            # the production contract
  test/
    CromcoinHarness.sol    # test-only subclass, difficulty lowered to 4 bits
test/
  Cromcoin.test.js          # Hardhat/Chai test suite
scripts/                    # deployment scripts (see PLAN.md)
  deploy.js                 # production Cromcoin deploy script
cromcoin-miner.html         # standalone frontend: wallet connect + client-side PoW + claim UI
hardhat.config.js           # networks: Base mainnet + Base Sepolia, Basescan verification
```

## Setup

```bash
npm install
cp .env.example .env
# fill in PRIVATE_KEY (deployer wallet) and BASESCAN_API_KEY
```

## Testing

```bash
npm run compile
npm test
```

Runs the full suite against `CromcoinHarness` (difficulty 4, so PoW brute-forcing is
instant), while dedicated read-only tests confirm the production difficulty and PoW
bit-checking boundaries.

## Deployment

Not yet deployed anywhere. The deploy script targets the production `Cromcoin`
contract, not the test harness.

Local dry-run:

```bash
npm run deploy:local
```

Base Sepolia:

```bash
npm run deploy:base-sepolia
npm run verify:base-sepolia -- <deployed-address>
```

Base mainnet:

```bash
npm run deploy:base
npm run verify:base -- <deployed-address>
```

Set `VERIFY=true` to have `scripts/deploy.js` wait briefly and attempt verification
after deployment:

```bash
$env:VERIFY="true"
npm run deploy:base-sepolia
```

See [`PLAN.md`](PLAN.md) for the full path from here to a live contract with a
working frontend.

## Frontend

[`cromcoin-miner.html`](cromcoin-miner.html) is a single-file UI (ethers.js v6 via CDN,
`window.ethereum` wallet connection) that mirrors the contract's PoW logic in
JavaScript to find a nonce client-side, then submits it to `mine()`. It currently has
a placeholder `CONTRACT_ADDRESS` — needs wiring to a real deployment before it's usable.

## License

MIT
