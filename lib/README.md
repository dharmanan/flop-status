# Domain Layer

This directory will contain the reusable product domain modules.

Planned boundaries:

* `identity/`
* `challenges/`
* `verification/`
* `receipts/`
* `crypto/`
* `db/`
* `technocore/`

The core dependency direction is:

Identity → Challenge → Submission → Verification → Receipt → Capability Record

`technocore/` is an optional downstream integration. Core verification modules must not require Technocore availability.

No domain code is implemented yet.
