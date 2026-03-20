;; SatFlow Vault Contract
;; Stores user deposits, tracks balances, handles withdrawals
;; Deployed on Stacks  sBTC (SIP-010) is the deposit token (UI label: BTC)
;; Unit precision: satoshis 1 sBTC = 100,000,000 sats

;; Clarity requires contract-call? to use a trait, NOT a stored constant.
(define-trait sip-010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
    (get-decimals () (response uint uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
    (get-total-supply () (response uint uint))
  )
)

(define-constant ERR-NO-DEPOSIT (err u200))
(define-constant ERR-ALREADY-DEPOSITED (err u201))
(define-constant ERR-INVALID-AMOUNT (err u202))
(define-constant ERR-UNAUTHORIZED (err u203))
(define-constant ERR-ZERO-BALANCE (err u204))

;; MIN-DEPOSIT: 100,000 sats = 0.001 sBTC (matches frontend minimum of 0.001 BTC)
(define-constant MIN-DEPOSIT u100000)
(define-constant CONTRACT-OWNER tx-sender)

(define-map UserVault
  { user: principal }
  {
    sbtc-deposited: uint,          ;; amount in satoshis (1 sBTC = 100,000,000 sats)
    usdcx-equivalent: uint,        ;; synthetic USDCx balance in micro-units
    strategy: (string-ascii 20),   ;; "conservative" | "balanced" | "aggressive"
    sbtc-token: principal,         ;; token contract used at deposit time
    deposited-at: uint,
    last-rebalanced: uint,
    is-active: bool
  }
)

(define-data-var total-tvl uint u0)
(define-data-var total-depositors uint u0)

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


;; deposit: user sends sBTC via SIP-010 trait
(define-public (deposit
    (amount uint)
    (strategy (string-ascii 20))
    (sbtc-token <sip-010-trait>)
  )
  (let
    (
      (caller tx-sender)
      (existing (map-get? UserVault { user: caller }))
    )
    (asserts! (>= amount MIN-DEPOSIT) ERR-INVALID-AMOUNT)
    (asserts! (is-none existing) ERR-ALREADY-DEPOSITED)

    (try! (contract-call? sbtc-token transfer amount caller (as-contract tx-sender) none))

    (map-set UserVault
      { user: caller }
      {
        sbtc-deposited: amount,
        usdcx-equivalent: u0,
        strategy: strategy,
        sbtc-token: (contract-of sbtc-token),
        deposited-at: stacks-block-height,
        last-rebalanced: stacks-block-height,
        is-active: true
      }
    )

    (var-set total-tvl (+ (var-get total-tvl) amount))
    (var-set total-depositors (+ (var-get total-depositors) u1))

    (ok true)
  )
)

;; withdraw: returns sBTC to caller via SIP-010 trait
;; Caller must pass the same token contract used at deposit time.
(define-public (withdraw (sbtc-token <sip-010-trait>))
  (let
    (
      (caller tx-sender)
      (vault-data (unwrap! (map-get? UserVault { user: caller }) ERR-NO-DEPOSIT))
    )
    (asserts! (get is-active vault-data) ERR-ZERO-BALANCE)
    ;; Ensure same token contract as deposit
    (asserts! (is-eq (contract-of sbtc-token) (get sbtc-token vault-data)) ERR-UNAUTHORIZED)

    (let
      (
        (sbtc-amount (get sbtc-deposited vault-data))
      )
      ;; Return sBTC to caller (as-contract switches tx-sender to this contract)
      (try! (as-contract (contract-call? sbtc-token transfer sbtc-amount tx-sender caller none)))

      ;; Delete the record entirely so user can re-deposit later
      (map-delete UserVault { user: caller })

      ;; Update TVL
      (var-set total-tvl (- (var-get total-tvl) sbtc-amount))

      (ok sbtc-amount)
    )
  )
)

;; update-allocation: called by router to persist allocation ratios
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
