# ADR-002: Warehouse Layout as Versioned Configuration

## Status
Accepted

## Context
Warehouses come in diverse topological layouts: some use numeric aisles, some use alphabetic racks, some divide spaces into e-commerce vs. retail fulfillment sides, and rack heights vary from single-tier picking shelves to four-tier high-bay pallet racking. Traditional WMS platforms hard-code location formats or use brittle database regular expressions.

## Decision
1. Warehouse layouts are represented as first-class, versioned domain entities (`WarehouseLayout`).
2. Layouts define template syntax, segment sequences, padding, level elevations, access constraints, and physical metric dimensions.
3. Every spatial location is dynamically generated and stored with both its formatted code string and normalized structured components (`side`, `row`, `column`, `level`).
4. Any change to a warehouse layout increments its version number (`version + 1`).
5. Inventory Manipulation Units (MUs) maintain explicit foreign keys to the layout version under which they were placed. Modifying a layout never silently deletes or orphans inventory; explicit reallocation migrations are required.

## Consequences
- **Positive:** Fulcrum supports arbitrary warehouses without code modifications.
- **Positive:** Layout versioning protects against inventory corruption and silent data loss.
- **Negative:** Layout migration workflows require UI support for handling unmapped or blocked bays during version upgrades.
