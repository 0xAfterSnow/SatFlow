;; SatFlow Strategy Contract
;; Mock yield simulation layer returns APY values and computes expected yield
;; In production: integrates with Arkadiko, Zest, or other Stacks DeFi protocols

;; Error constants 
(define-constant ERR-INVALID-STRATEGY (err u400))
(define-constant ERR-INVALID-AMOUNT (err u401))
(define-constant ERR-NO-HISTORY (err u402))

;; APY constants (basis points: 10000 = 100%)
;; Conservative strategy APYs
(define-constant CONSERVATIVE-SBTC-APY-MIN u800)   ;; 8%
(define-constant CONSERVATIVE-SBTC-APY-MAX u1000)  ;; 10%
(define-constant CONSERVATIVE-USDCX-APY-MIN u400)  ;; 4%
(define-constant CONSERVATIVE-USDCX-APY-MAX u600)  ;; 6%

;; Balanced strategy APYs
(define-constant BALANCED-SBTC-APY-MIN u1000)      ;; 10%
(define-constant BALANCED-SBTC-APY-MAX u1300)      ;; 13%
(define-constant BALANCED-USDCX-APY-MIN u500)      ;; 5%
(define-constant BALANCED-USDCX-APY-MAX u700)      ;; 7%

;; Aggressive strategy APYs
(define-constant AGGRESSIVE-SBTC-APY-MIN u1200)    ;; 12%
(define-constant AGGRESSIVE-SBTC-APY-MAX u1500)    ;; 15%
(define-constant AGGRESSIVE-USDCX-APY-MIN u600)    ;; 6%
(define-constant AGGRESSIVE-USDCX-APY-MAX u800)    ;; 8%

(define-constant APY-DENOMINATOR u10000)
;; Blocks per year (Stacks ~10min blocks)
(define-constant BLOCKS-PER-YEAR u52560)

;; Data maps
(define-map YieldAccrued
  { user: principal }
  {
    sbtc-yield: uint,
    usdcx-yield: uint,
    total-yield: uint,
    last-updated: uint,
    strategy: (string-ascii 20)
  }
)

;; Read-only helpers
(define-read-only (get-strategy-apy (strategy (string-ascii 20)))
  (if (is-eq strategy "conservative")
    (ok {
      sbtc-apy-min: CONSERVATIVE-SBTC-APY-MIN,
      sbtc-apy-max: CONSERVATIVE-SBTC-APY-MAX,
      usdcx-apy-min: CONSERVATIVE-USDCX-APY-MIN,
      usdcx-apy-max: CONSERVATIVE-USDCX-APY-MAX
    })
    (if (is-eq strategy "balanced")
      (ok {
        sbtc-apy-min: BALANCED-SBTC-APY-MIN,
        sbtc-apy-max: BALANCED-SBTC-APY-MAX,
        usdcx-apy-min: BALANCED-USDCX-APY-MIN,
        usdcx-apy-max: BALANCED-USDCX-APY-MAX
      })
      (if (is-eq strategy "aggressive")
        (ok {
          sbtc-apy-min: AGGRESSIVE-SBTC-APY-MIN,
          sbtc-apy-max: AGGRESSIVE-SBTC-APY-MAX,
          usdcx-apy-min: AGGRESSIVE-USDCX-APY-MIN,
          usdcx-apy-max: AGGRESSIVE-USDCX-APY-MAX
        })
        ERR-INVALID-STRATEGY
      )
    )
  )
)

;; calculate-expected-yield: returns expected annual yield for given amounts
(define-read-only (calculate-expected-yield
    (sbtc-amount uint)
    (usdcx-amount uint)
    (strategy (string-ascii 20))
  )
  (match (get-strategy-apy strategy)
    apy-data
    (let
      (
        ;; Use midpoint APY for calculation
        (sbtc-mid-apy (/ (+ (get sbtc-apy-min apy-data) (get sbtc-apy-max apy-data)) u2))
        (usdcx-mid-apy (/ (+ (get usdcx-apy-min apy-data) (get usdcx-apy-max apy-data)) u2))
        (sbtc-annual-yield (/ (* sbtc-amount sbtc-mid-apy) APY-DENOMINATOR))
        (usdcx-annual-yield (/ (* usdcx-amount usdcx-mid-apy) APY-DENOMINATOR))
      )
      (ok {
        sbtc-annual-yield: sbtc-annual-yield,
        usdcx-annual-yield: usdcx-annual-yield,
        total-annual-yield: (+ sbtc-annual-yield usdcx-annual-yield),
        blended-apy-bps: (if (> (+ sbtc-amount usdcx-amount) u0)
          (/ (* (+ sbtc-annual-yield usdcx-annual-yield) APY-DENOMINATOR)
             (+ sbtc-amount usdcx-amount))
          u0)
      })
    )
    err-val (err err-val)
  )
)

;; calculate-yield-for-blocks: returns yield accrued over N blocks
(define-read-only (calculate-yield-for-blocks
    (sbtc-amount uint)
    (usdcx-amount uint)
    (strategy (string-ascii 20))
    (blocks uint)
  )
  (match (get-strategy-apy strategy)
    apy-data
    (let
      (
        (sbtc-mid-apy (/ (+ (get sbtc-apy-min apy-data) (get sbtc-apy-max apy-data)) u2))
        (usdcx-mid-apy (/ (+ (get usdcx-apy-min apy-data) (get usdcx-apy-max apy-data)) u2))
        (sbtc-yield (/ (* (/ (* sbtc-amount sbtc-mid-apy) APY-DENOMINATOR) blocks) BLOCKS-PER-YEAR))
        (usdcx-yield (/ (* (/ (* usdcx-amount usdcx-mid-apy) APY-DENOMINATOR) blocks) BLOCKS-PER-YEAR))
      )
      (ok {
        sbtc-yield: sbtc-yield,
        usdcx-yield: usdcx-yield,
        total-yield: (+ sbtc-yield usdcx-yield),
        blocks-elapsed: blocks
      })
    )
    err-val (err err-val)
  )
)

(define-read-only (get-yield-record (user principal))
  (map-get? YieldAccrued { user: user })
)

;; Public functions

;; snapshot-yield: records current yield state on-chain (called periodically)
(define-public (snapshot-yield
    (sbtc-amount uint)
    (usdcx-amount uint)
    (strategy (string-ascii 20))
    (blocks-elapsed uint)
  )
  (match (calculate-yield-for-blocks sbtc-amount usdcx-amount strategy blocks-elapsed)
    yield-data
    (begin
      (map-set YieldAccrued
        { user: tx-sender }
        {
          sbtc-yield: (get sbtc-yield yield-data),
          usdcx-yield: (get usdcx-yield yield-data),
          total-yield: (get total-yield yield-data),
          last-updated: stacks-block-height,
          strategy: strategy
        }
      )
      (ok (get total-yield yield-data))
    )
    err-val (err err-val)
  )
)

;; clear-yield: called on withdraw
(define-public (clear-yield)
  (begin
    (map-delete YieldAccrued { user: tx-sender })
    (ok true)
  )
)
