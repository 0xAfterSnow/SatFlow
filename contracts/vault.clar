;; SatFlow Vault Contract
;; Stores user deposits, tracks balances, handles withdrawals
;; Deployed on Stacks — BTC/sBTC locked here

;; ─── Error constants ───────────────────────────────────────────────────────────
(define-constant ERR-NO-DEPOSIT (err u200))
(define-constant ERR-ALREADY-DEPOSITED (err u201))
(define-constant ERR-INVALID-AMOUNT (err u202))
(define-constant ERR-UNAUTHORIZED (err u203))
(define-constant ERR-ZERO-BALANCE (err u204))

;; ─── Constants ─────────────────────────────────────────────────────────────────
(define-constant MIN-DEPOSIT u100000)  ;; 0.1 STX minimum (proxy for sBTC in testnet)
(define-constant CONTRACT-OWNER tx-sender)

;; ─── Data maps ─────────────────────────────────────────────────────────────────
;; Primary user vault record
(define-map UserVault
  { user: principal }
  {
    sbtc-deposited: uint,          ;; amount in micro-units
    usdcx-equivalent: uint,        ;; synthetic USDCx balance in micro-units
    strategy: (string-ascii 20),   ;; "conservative" | "balanced" | "aggressive"
    deposited-at: uint,            ;; block height
    last-rebalanced: uint,         ;; block height
    is-active: bool
  }
)

;; Track total protocol TVL
(define-data-var total-tvl uint u0)
(define-data-var total-depositors uint u0)

;; ─── Read-only functions ───────────────────────────────────────────────────────
(define-read-only (get-vault (user principal))
  (map-get? UserVault { user: user })
)

(define-read-only (get-vault-balance (user principal))
  (match (map-get? UserVault { user: user })
    vault-data
    (ok {
      sbtc: (get sbtc-deposited vault-data),
      usdcx: (get usdcx-equivalent vault-data),
      strategy: (get strategy vault-data),
      is-active: (get is-active vault-data)
    })
    ERR-NO-DEPOSIT
  )
)

(define-read-only (get-total-tvl)
  (var-get total-tvl)
)

(define-read-only (get-total-depositors)
  (var-get total-depositors)
)

(define-read-only (has-active-position (user principal))
  (match (map-get? UserVault { user: user })
    vault-data (get is-active vault-data)
    false
  )
)

;; ─── Public functions ──────────────────────────────────────────────────────────

;; deposit: user sends sBTC (STX on testnet), allocation set by router
(define-public (deposit (amount uint) (strategy (string-ascii 20)))
  (let
    (
      (caller tx-sender)
      (existing (map-get? UserVault { user: caller }))
    )
    ;; Validate amount
    (asserts! (>= amount MIN-DEPOSIT) ERR-INVALID-AMOUNT)
    ;; No double deposits — must withdraw first
    (asserts! (is-none existing) ERR-ALREADY-DEPOSITED)

    ;; Transfer sBTC (STX on testnet) into contract
    (try! (stx-transfer? amount caller (as-contract tx-sender)))

    ;; Compute USDCx equivalent (router.clar handles the split logic;
    ;; here we store the full deposited amount as sBTC, router updates allocations)
    (map-set UserVault
      { user: caller }
      {
        sbtc-deposited: amount,
        usdcx-equivalent: u0,           ;; router.clar will set this via rebalance
        strategy: strategy,
        deposited-at: stacks-block-height,
        last-rebalanced: stacks-block-height,
        is-active: true
      }
    )

    ;; Update TVL
    (var-set total-tvl (+ (var-get total-tvl) amount))
    (var-set total-depositors (+ (var-get total-depositors) u1))

    (ok true)
  )
)

;; withdraw: exits entire position and returns principal
;; Yield is tracked off-chain via strategy.clar, added here as a simulated credit
(define-public (withdraw)
  (let
    (
      (caller tx-sender)
      (vault-data (unwrap! (map-get? UserVault { user: caller }) ERR-NO-DEPOSIT))
    )
    ;; Must have active position
    (asserts! (get is-active vault-data) ERR-ZERO-BALANCE)

    (let
      (
        (sbtc-amount (get sbtc-deposited vault-data))
      )
      ;; Return principal (yield simulation handled in UI / strategy.clar)
      (try! (as-contract (stx-transfer? sbtc-amount tx-sender caller)))

      ;; Mark position as closed
      (map-set UserVault
        { user: caller }
        (merge vault-data { is-active: false, sbtc-deposited: u0, usdcx-equivalent: u0 })
      )

      ;; Update TVL
      (var-set total-tvl (- (var-get total-tvl) sbtc-amount))

      (ok sbtc-amount)
    )
  )
)

;; update-allocation: called by router.clar to persist allocation ratios
(define-public (update-allocation
    (user principal)
    (sbtc-amount uint)
    (usdcx-amount uint)
    (new-strategy (string-ascii 20))
  )
  (let
    (
      (vault-data (unwrap! (map-get? UserVault { user: user }) ERR-NO-DEPOSIT))
    )
    ;; Only contract itself (router calls this) or owner
    (asserts!
      (or (is-eq tx-sender (as-contract tx-sender)) (is-eq tx-sender CONTRACT-OWNER))
      ERR-UNAUTHORIZED
    )

    (map-set UserVault
      { user: user }
      (merge vault-data {
        sbtc-deposited: sbtc-amount,
        usdcx-equivalent: usdcx-amount,
        strategy: new-strategy,
        last-rebalanced: stacks-block-height
      })
    )

    (ok true)
  )
)
