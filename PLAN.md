# Cromcoin — Path to Launch

Current state: contract is written and fully tested (13/13 passing). Nothing has been
deployed. This is the remaining path to a live, mineable coin.

## Phase 0 — Decisions before writing more code

These are calls only the project owner can make; get them settled first since they
affect the deploy script and are hard to change once mainnet-deployed.

- [ ] **Keep or drop `Ownable`?** The contract currently inherits it but defines no
      `onlyOwner` functions — it's inert. Either remove it (smaller, more trustworthy
      contract — nothing an owner key can do) or add a deliberate, scoped admin
      function (e.g. an emergency pause on `mine()`). Silent/unused privilege looks
      worse to on-chain observers than no privilege at all.
- [ ] **Confirm PoW difficulty (20 bits) is right for launch.** At 20 bits a browser
      needs ~2^20 (~1M) hash attempts on average — likely a few seconds on a modern
      laptop, longer on mobile. Decide if that's the intended friction level before
      it's locked in immutably.
- [ ] **Where does the frontend live?** Contract comment says "crombie.xyz (or
      wherever)" — pick the actual host/domain now so it can be referenced in the
      verified contract's metadata/README consistently.

## Phase 1 — Deploy script

- [ ] Write `scripts/deploy.js`:
  - Deploy `Cromcoin` (production contract, not the harness).
  - Log the deployed address and the deployer's balance before/after.
  - Optionally auto-run `hardhat verify` at the end (needs a confirmation delay —
    Basescan can't verify until the deploy tx is indexed, typically wait ~30s or a
    few block confirmations first).
- [ ] Dry-run against the local Hardhat network to confirm the script itself works
      before touching a real chain.

## Phase 2 — Testnet deployment (Base Sepolia)

- [ ] Get Base Sepolia ETH from a faucet into the deployer wallet.
- [ ] `npx hardhat run scripts/deploy.js --network baseSepolia`
- [ ] Verify on Sepolia Basescan: `npx hardhat verify --network baseSepolia <address>`
- [ ] Wire the deployed address into `cromcoin-miner.html`'s `CONTRACT_ADDRESS`
      (temporarily, for testing).
- [ ] Manually run the full user flow through the actual UI against testnet:
  - Connect wallet, auto-prompt network switch to Base Sepolia.
  - Mine successfully, confirm balance updates and `Mined` event fires.
  - Try mining again immediately — confirm cooldown message appears.
  - Check `cooldownRemaining()` / `sessionsRemaining()` display correctly in the UI.
- [ ] Only after this works end-to-end with a real wallet and real (test) transactions
      should mainnet be considered.

## Phase 3 — Security pass

Not a full paid audit necessarily (this is a novelty/game token, not a DeFi protocol
holding user deposits), but at minimum:

- [ ] Re-read `mine()` for the checks-effects-interactions pattern — currently state
      (`lastClaimed`, `usedNonces`, `mineBalance`) is updated *before* `_transfer`,
      which is correct and reentrancy-safe since OZ's `_transfer` doesn't call
      external contracts.
- [ ] Confirm the `Ownable`/admin decision from Phase 0 is finalized and intentional.
- [ ] Sanity-check `_hasLeadingZeroBits` against edge cases (bits = 0, bits = 256,
      non-multiple-of-8 values) — a quick unit test for `bits=20` on a known hash
      would close the loop, since current tests only exercise `bits=4`.
- [ ] Decide whether `BLOCK_WINDOW = 10` (~20s on Base) gives enough time for a
      browser to submit a mined transaction before the window rolls over and the
      nonce becomes invalid — test this under realistic network latency on testnet,
      not just locally.

## Phase 4 — Mainnet deployment

**This is the point where real money and an irreversible action happen — do not run
this step without explicitly deciding to, in the moment.**

- [ ] Fund the deployer wallet with real ETH on Base (deployment + verification gas
      only — cheap on Base, but non-zero).
- [ ] `npx hardhat run scripts/deploy.js --network base`
- [ ] Verify: `npx hardhat verify --network base <address>`
- [ ] Double-check the verified source on Basescan matches what you intended — this
      is the public trust signal for anyone inspecting the token before mining it.

## Phase 5 — Frontend wiring & hosting

- [ ] Update `CONTRACT_ADDRESS` in `cromcoin-miner.html` to the mainnet address.
- [ ] Deploy the static HTML file to whatever host was decided in Phase 0
      (GitHub Pages / Vercel / Netlify / custom domain).
- [ ] Confirm HTTPS works and the site correctly prompts MetaMask/wallet network
      switch to Base mainnet (chain ID 8453) — the switch/add-network logic already
      exists in the HTML (`window.ethereum.request` calls around line 394–410);
      verify it against mainnet, not just testnet.

## Phase 6 — Launch checklist

- [ ] Mine once yourself on mainnet with a small wallet to confirm the full loop
      works with real funds.
- [ ] Watch `Mined` / `MineExhausted` events for the first stretch after launch to
      catch anything unexpected early (e.g. via Basescan's event log view — no
      separate monitoring infra needed at this scale).
- [ ] Publish the contract address somewhere authoritative (README, site) so people
      don't get phished by a fake contract address.

## Explicitly out of scope unless asked

- Liquidity pool / DEX listing — nothing in the current contract or plan sets up
  trading; it's mine-only distribution. Worth a separate conversation if that's
  wanted later, since it changes the trust/economic model.
- Multi-chain deployment — config only covers Base + Base Sepolia today.
