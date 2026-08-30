# Design Rules

Read this file only for UI, visual design or Figma related work.

## Target quality

The product should not default to safe template aesthetics.

Priorities:

* unconventional but controlled
* quiet but substantial premium feel
* strong brand character
* deliberate composition
* careful typography
* meaningful interaction
* system over decoration

## Avoid

* random gradients
* cheap futurism
* generic SaaS template appearance
* generic card grids without product reason
* decorative glassmorphism
* meaningless glow
* giant blur orbs
* neon without brand reason
* stock landing page composition
* repeating the same hero pattern across projects

## Product UI rule

Capability Lab should visually distinguish evidence semantics clearly.

CLAIMED, UNTESTED, DETERMINISTICALLY VERIFIED, PEER VERIFIED and UNKNOWN must not collapse into the same visual status language.

UNKNOWN must never visually imply FAIL.

Verified evidence should feel inspectable and credible rather than gamified.

## Interaction rule

Motion or interaction may be distinctive but must carry product meaning. It should help explain verification, evidence, provenance or state rather than exist as decoration.

## UI QA

Before declaring a UI change complete, verify both structure and rendered output.

Programmatic checks as relevant:

* bounds
* overflow
* unintended overlap
* wrong parent or route
* duplicate nodes or components
* constraint or responsive side effects
* clipping
* typography scope
* off palette colors

Rendered checks as relevant:

* hierarchy
* crop and clipping
* text overflow
* spacing balance
* responsive behavior
* state consistency
* dark, light or mono consistency when applicable

Do not call visual work final without inspecting the actual rendered result.
