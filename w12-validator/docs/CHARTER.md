# CHARTER - Validator

Gonzalo Patlan - Venture for Weeks 12-17, extracted from Week 11 (Packaging Evidence Validator)
Written before the Core Build rebuild starts. This document is the referee for every scope fight from here on, including with myself.

## VISION

In three years, Validator is the default evidence-reconciliation layer that small and mid-size Mexican producers and importers use before they submit any packaging-compliance claim under the Circular Economy Law: every supplier value they cite carries a source, a version history, and a human sign-off, so a producer who can't afford a quote-based enterprise platform can still hand a regulator or a buyer evidence that survives an audit, not just a spreadsheet nobody checked.

## USERS

The internal compliance or operations person at a small or mid-size Mexican producer or importer (10 to 200 employees) who has to reconcile supplier packaging data before a reconciliation cycle closes, and does it today by eye in a spreadsheet, with no way to prove any of it later. Primary persona built from my own experience at Concept G. Not the user: large multinational producers with existing legal and compliance teams (Amazon-scale); not consultants managing many clients' EPR filings as their business.

## PRINCIPLES

1. Every value Validator shows carries its source, its uploader, and its timestamp. No exceptions, no "trust the dashboard."
2. Nothing is ever overwritten. A correction is a new version or a new decision row, never an edit that erases what came before.
3. The AI never decides. It may only flag, always labeled "sin validar," and the server rejects any AI output that states a verdict or invents a number.
4. A finding only changes state through a human decision with a required note. No automatic resolution, ever.
5. Validator never claims compliance, recycling, or environmental recovery. It only makes evidence traceable enough for a human to decide.

## NON-GOALS

Validator will NEVER: file anything with a regulator on the producer's behalf; calculate or certify whether a company complies with the law; replace the human reviewer with an automated approval; sell or share a producer's data with sellers, auditors, or anyone outside the producer's own organization; build a general-purpose EPR filing suite (imports, exceptions, multi-cycle workflows) - that is a different, bigger product than this one, and chasing it this semester means building nothing well.

## NORTH STAR

Number of discrepancies detected and resolved with a human decision and note, per producer, per reconciliation cycle. Not signups, not uploads: a discrepancy that reached a human decision is the one unit of value this product actually produces - everything else is plumbing.

## CORE CONCEPTS

- **Evidence version** - one uploaded supplier file, immutable once stored, with full provenance (source file, uploader, timestamp).
- **Finding** - a detected discrepancy (missing supplier, conflicting value, late revision, possible duplicate), always "pending" until a human acts on it.
- **Decision** - a human's confirm/discard action on a finding, with a required note; append-only, never edited.
- **Provenance** - the trail from any single value back to the exact file, row, and person who entered it.
- **AI observation** - an optional, labeled, unvalidated hint from the AI reader; never a decision, never a number the data didn't contain.
- **Reconciliation cycle** - the period between two accepted-evidence snapshots for a producer; the unit the north star is measured per.

## RUNG (Knowledge Ladder, from METHOD_GonzaloPatlan_Week12.pdf)

Methodology, rung 1. Climbing to a product (rung 2) means a stranger gets a trustworthy, traceable evidence trail without me personally tuning the detection logic for their data - the Core Build is the first real test of that.
