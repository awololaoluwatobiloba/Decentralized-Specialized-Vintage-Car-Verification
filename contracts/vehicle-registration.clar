;; Vehicle Registration Contract
;; Records details of classic automobiles

;; Define data variables
(define-data-var contract-owner principal tx-sender)

;; Define data maps
(define-map vehicles
  { vehicle-id: (string-ascii 36) }
  {
    make: (string-ascii 50),
    model: (string-ascii 50),
    year: uint,
    vin: (string-ascii 50),
    chassis-number: (string-ascii 50),
    engine-type: (string-ascii 100),
    engine-number: (string-ascii 50),
    original-color: (string-ascii 50),
    registered-by: principal,
    registered-at: uint,
    verified: bool
  }
)

;; Define error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_REGISTERED u2)
(define-constant ERR_NOT_FOUND u3)

;; Register a new vehicle
(define-public (register-vehicle
    (vehicle-id (string-ascii 36))
    (make (string-ascii 50))
    (model (string-ascii 50))
    (year uint)
    (vin (string-ascii 50))
    (chassis-number (string-ascii 50))
    (engine-type (string-ascii 100))
    (engine-number (string-ascii 50))
    (original-color (string-ascii 50)))
  (let ((vehicle-exists (map-get? vehicles { vehicle-id: vehicle-id })))
    (asserts! (is-none vehicle-exists) (err ERR_ALREADY_REGISTERED))
    (ok (map-set vehicles
      { vehicle-id: vehicle-id }
      {
        make: make,
        model: model,
        year: year,
        vin: vin,
        chassis-number: chassis-number,
        engine-type: engine-type,
        engine-number: engine-number,
        original-color: original-color,
        registered-by: tx-sender,
        registered-at: block-height,
        verified: false
      }
    ))
  )
)

;; Get vehicle details
(define-read-only (get-vehicle (vehicle-id (string-ascii 36)))
  (map-get? vehicles { vehicle-id: vehicle-id })
)

;; Verify a vehicle (only contract owner can do this)
(define-public (verify-vehicle (vehicle-id (string-ascii 36)))
  (let ((vehicle (map-get? vehicles { vehicle-id: vehicle-id })))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (is-some vehicle) (err ERR_NOT_FOUND))
    (ok (map-set vehicles
      { vehicle-id: vehicle-id }
      (merge (unwrap-panic vehicle) { verified: true })
    ))
  )
)

;; Transfer contract ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok (var-set contract-owner new-owner))
  )
)
