# Rate review

`packages/core/src/rates/ratebook.ts` holds every ATO figure the engine uses. Each entry is keyed by income year.

When a new income year starts (1 July), or when the ATO announces a change:
1. For each entry, check the ATO source and add the new year's value, or deliberately carry the old one.
2. Update `CHECKED_ON` to the date of the review.
3. Run `pnpm test`; the ratebook tests flag any year that is carried rather than checked.
4. In the app, carried rates show as "not rechecked" until step 1 is done for that year.

Record each review below.

| Date | Income year | Reviewer | Notes |
|------|-------------|----------|-------|
| 2026-09-24 | FY 2026–27 | Claude (from prototype) | Seeded from prototype rate book; confirm against ATO before first lodgement |
