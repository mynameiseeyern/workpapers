# Engine changes from the prototype

`@workpapers/core` is a port of the prototype (v15) calculations. The prototype is frozen in
`tools/prototype/` and used only as a rules oracle: `tools/oracle` runs it headless over made-up ledgers
(the example year plus 60 random ones) and records its answers in `packages/core/test/golden/cases.json`.
`packages/core/test/golden.test.ts` checks the engine gives the same figures, to the cent.

No household data from the prototype is imported. Production starts with an empty ledger; the
**example year** (`packages/core/src/example/exampleYear.ts`) is made-up data for seeing how records flow.

## Deliberate differences

Each fix is applied to the prototype inside the oracle too (`tools/oracle/prototype.mjs`, `FIXES`), so the
golden tests keep checking everything else.

| ID | Change | Why |
|----|--------|-----|
| F1 | The $300 immediate-deduction test applies only to "tools & equipment" | It's a rule for depreciating assets. The prototype sent any work expense over $300 (a membership fee, a phone bill) to decline in value. |
| F2 | Phone & internet overlap uses employment WFH hours only | The fixed rate only covers phone costs when employment hours are claimed. Business-only hours don't. |

## Money

All amounts are integer cents. A person's share of a shared row, an apportioned expense, or a GST credit is
rounded to the cent where it is taken. The prototype worked in floating-point dollars; golden tests allow 1c.

## Regenerating fixtures

    pnpm --filter @workpapers/oracle golden

Only needed when the random generator or the list of fixes changes. The prototype itself never changes.
