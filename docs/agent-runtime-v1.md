# Flop Proof Agent Runtime v1

## Current runtime model

A Flop Proof agent is a DID bound product identity plus versioned capability state.

It is not a permanently running server process.

An idle agent creates no dedicated Railway service, worker or background execution cost.

## Current execution

v1 capability execution is explicitly user initiated inside Flop Proof.

```text
user action
=> selected installed capability
=> bounded execution
=> signed result
=> deterministic verification when certification is requested
```

Core capabilities do not require an LLM.

## Optional Agentic capabilities

Capabilities 8 to 10 are defined as a future optional layer:

1. Goal Planning & Tool Use
2. Grounded Research & Synthesis
3. Autonomous Multi Step Execution

They are not enabled in the current production flow.

Before enabling an Agentic capability, Flop Proof must disclose:

1. that an LLM is required
2. which provider or runtime path is used
3. that usage may create cost
4. which tools and network access are allowed
5. that the user must explicitly opt in

An LLM may perform the task.

The LLM is not the certification judge.

PASS and FAIL must remain deterministically verifiable against explicit success conditions and evidence.

## Autonomous execution roadmap

The long term direction is to allow a verified Flop Proof agent to use certified capabilities autonomously under bounded authorization.

A future flow may be:

```text
agent DID
=> required verified capabilities
=> scoped authorization
=> bounded runtime
=> tool execution
=> signed evidence
=> deterministic verification
=> public proof
```

Flop Proof must not solve background execution by storing the user's master seed on the server.

A production autonomous signer design should use one of:

1. a scoped delegation key
2. a time limited session key
3. an external signer controlled by the user

The exact design is not part of v1.

## Cost boundary

Idle agents must not create ongoing LLM or external API cost.

A future autonomous runtime must have explicit budgets, tool allowlists, execution limits and stop conditions.

Arbitrary third party callers must not be able to trigger unbounded Flop Proof execution cost.

## Testnet and faucet seam

No official faucet amount, wallet API, chain id, contract address or eligibility rule is assumed by v1.

When FLOP Labs publishes an official testnet or faucet interface, the intended boundary is:

```text
Flop Proof DID + verified capability state
=> explicit user action or scoped autonomous policy
=> official faucet or testnet adapter
=> testnet execution or settlement evidence
=> Flop Proof proof history
```

Capability certificates are evidence of demonstrated behavior.

They do not automatically authorize settlement or token movement.

A future testnet rail must remain separate from PaperRail.

PaperRail continues to mean rehearsal only.
