;; SatFlow Router Contract
;; Manages allocation logic, strategy selection, and rebalancing
;; Core capital routing engine of SatFlow protocol

;; Error constants 
(define-constant ERR-INVALID-STRATEGY (err u300))
(define-constant ERR-NO-POSITION (err u301))
(define-constant ERR-SAME-STRATEGY (err u302))
(define-constant ERR-UNAUTHORIZED (err u303))
(define-constant ERR-INVALID-AMOUNT (err u304))

;; Strategy allocation ratios (basis points: 10000 = 100%)
;; Conservative: 20% sBTC, 80% USDCx
(define-constant CONSERVATIVE-SBTC-BPS u2000)
(define-constant CONSERVATIVE-USDCX-BPS u8000)

;; Balanced: 50% sBTC, 50% USDCx
(define-constant BALANCED-SBTC-BPS u5000)
(define-constant BALANCED-USDCX-BPS u5000)

;; Aggressive: 80% sBTC, 20% USDCx
(define-constant AGGRESSIVE-SBTC-BPS u8000)
(define-constant AGGRESSIVE-USDCX-BPS u2000)

(define-constant BPS-DENOMINATOR u10000)

;; Data maps
(define-map UserAllocation
  { user: principal }
  {
    strategy: (string-ascii 20),
    sbtc-bps: uint,     ;; basis points allocated to sBTC
    usdcx-bps: uint,    ;; basis points allocated to USDCx
    total-amount: uint, ;; total deposit in micro-units
    sbtc-amount: uint,
    usdcx-amount: uint,
    created-at: uint,
    updated-at: uint
  }
)

(define-data-var rebalance-count uint u0)

;; Read-only helpers
(define-read-only (get-allocation (user principal))
  (map-get? UserAllocation { user: user })
)

(define-read-only (get-strategy-bps (strategy (string-ascii 20)))
  (if (is-eq strategy "conservative")
    (ok { sbtc-bps: CONSERVATIVE-SBTC-BPS, usdcx-bps: CONSERVATIVE-USDCX-BPS })
    (if (is-eq strategy "balanced")
      (ok { sbtc-bps: BALANCED-SBTC-BPS, usdcx-bps: BALANCED-USDCX-BPS })
      (if (is-eq strategy "aggressive")
        (ok { sbtc-bps: AGGRESSIVE-SBTC-BPS, usdcx-bps: AGGRESSIVE-USDCX-BPS })
        ERR-INVALID-STRATEGY
      )
    )
  )
)

(define-read-only (calculate-split (amount uint) (strategy (string-ascii 20)))
  (match (get-strategy-bps strategy)
    ratios
    (ok {
      sbtc-amount: (/ (* amount (get sbtc-bps ratios)) BPS-DENOMINATOR),
      usdcx-amount: (/ (* amount (get usdcx-bps ratios)) BPS-DENOMINATOR)
    })
    err-val (err err-val)
  )
)

(define-read-only (get-rebalance-count)
  (var-get rebalance-count)
)

;; Public functions

;; set-allocation: called after deposit to initialize routing
(define-public (set-allocation
    (user principal)
    (amount uint)
    (strategy (string-ascii 20))
  )
  (let
    (
      (ratios (unwrap! (get-strategy-bps strategy) ERR-INVALID-STRATEGY))
      (sbtc-amt (/ (* amount (get sbtc-bps ratios)) BPS-DENOMINATOR))
      (usdcx-amt (/ (* amount (get usdcx-bps ratios)) BPS-DENOMINATOR))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    (map-set UserAllocation
      { user: user }
      {
        strategy: strategy,
        sbtc-bps: (get sbtc-bps ratios),
        usdcx-bps: (get usdcx-bps ratios),
        total-amount: amount,
        sbtc-amount: sbtc-amt,
        usdcx-amount: usdcx-amt,
        created-at: stacks-block-height,
        updated-at: stacks-block-height,
      }
    )

    (ok { sbtc-amount: sbtc-amt, usdcx-amount: usdcx-amt })
  )
)

;; rebalance: user switches strategy, reallocating their capital
(define-public (rebalance (new-strategy (string-ascii 20)))
  (let
    (
      (caller tx-sender)
      (alloc (unwrap! (map-get? UserAllocation { user: caller }) ERR-NO-POSITION))
      (total (get total-amount alloc))
      (new-ratios (unwrap! (get-strategy-bps new-strategy) ERR-INVALID-STRATEGY))
      (new-sbtc (/ (* total (get sbtc-bps new-ratios)) BPS-DENOMINATOR))
      (new-usdcx (/ (* total (get usdcx-bps new-ratios)) BPS-DENOMINATOR))
    )
    ;; Prevent no-op rebalance
    (asserts! (not (is-eq new-strategy (get strategy alloc))) ERR-SAME-STRATEGY)

    ;; Update allocation map
    (map-set UserAllocation
      { user: caller }
      (merge alloc {
        strategy: new-strategy,
        sbtc-bps: (get sbtc-bps new-ratios),
        usdcx-bps: (get usdcx-bps new-ratios),
        sbtc-amount: new-sbtc,
        usdcx-amount: new-usdcx,
        updated-at: stacks-block-height
      })
    )

    ;; Increment global rebalance counter
    (var-set rebalance-count (+ (var-get rebalance-count) u1))

    (ok {
      new-strategy: new-strategy,
      sbtc-amount: new-sbtc,
      usdcx-amount: new-usdcx
    })
  )
)

;; clear-allocation: called on withdraw
(define-public (clear-allocation (user principal))
  (begin
    (map-delete UserAllocation { user: user })
    (ok true)
  )
)
