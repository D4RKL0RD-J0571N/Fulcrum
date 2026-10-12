# ADR-003: Fixed Segment Order in Location Code Template v1

## Status
Accepted

## Context
Warehouse location codes typically encode hierarchy: Side/Zone, Row/Aisle, Column/Bay, and Level (shelf tier). While arbitrary permutations of segments are theoretically possible in diverse operations, fully free-form segment reordering dramatically complicates the parsing grammar, ambiguity validation, and UI configuration wizards.

## Decision
1. For Version 1 (v1) of the Layout Engine, the segment order is fixed to:
   `[side?][row][column][level]`
2. The `side` segment remains optional (disabled by default).
3. The format, padding, characters, separators, counts, and access levels within those segments remain 100% configurable.
4. Arbitrary segment reordering is deferred to future releases, requiring a dedicated grammar specification and validation engine.

## Consequences
- **Positive:** Enables a streamlined, robust setup wizard with instant, unambiguous code parsing and validation.
- **Positive:** Guarantees deterministic round-trip parsing (`parse(format(x)) === x`) across all valid templates.
- **Negative:** Warehouses with non-standard addressing orders (e.g. `Level-Bay-Row`) cannot be modeled in v1 without adapting to standard hierarchy.
