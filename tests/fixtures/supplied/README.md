# Supplied CSV audit fixtures

Provenance: the four CSV test files already present in the user's Documents folder. They appear to be prior generated test datasets, not authenticated customer exports. Customer/account names were replaced with numbered identifiers; representative names and internal notes were removed. Statuses, amounts, dates, headers and row order are preserved. Original files were not edited.

- `hvac_test_data.csv`: 8 rows. Explicit expected outcomes for each row.
- `hvac_realistic_test_data.csv`: 50 rows. Explicit expected positive row indexes and leak types, with all other rows acting as negatives.
- `hvac_adversarial_test_50.csv`: 50 rows. Original expectation columns removed from uploaded input. Expectations reviewed against the current product's supported detector families, as below.
- `ai_mapper_messy_test.csv`: 12 mixed CRM rows. Tests verify exact mappings, typed amount derivations, partial balances of 7,600 − 2,000 = 5,600 and 5,900 − 1,500 = 4,400, identity, and won/paid/scheduled controls. These are targeted expectations, not a claim of complete recall across every lead-status synonym in this file.

The HVAC oracle in `expected.json` records customer identity, row index, leak type and independently calculated amount: Quote for lead/estimate/job-loss cases, Invoice for unpaid invoice cases. There are no partial payments in those HVAC files. Tests compare every returned finding and the total, so extra findings on control rows fail.

## Historical expectation changes

The adversarial file's original Expected Leak / Expected Type labels predate the expanded product:

- Data row 8: Estimate Expired was NO; the current Expired Estimate detector intentionally flags the 2,800 quote.
- Data rows 15 and 16: Lost / Lost Lead were NO; the current Lost Lead detector flags 2,100 and 900.
- Data row 37: Cancelled was NO; the current Cancelled Job detector flags 2,800.
- Data rows 21, 22, 47, 48, 49 and 50: labels said Unpaid Invoice. Current ownership gives explicit overdue balances to Overdue Invoice at unchanged amounts.

Row numbers above are one-based data rows, excluding the header; JSON indexes are zero-based. These are explicit compatibility decisions, not silent relaxation of failing expectations. The existing detector-level suite continues to enforce those families and ownership rules.

## Limitations

These fixtures do not establish real customer ROI, support for every CRM status, or browser upload behavior. In particular, mixed CRM Deal Value without a recognized Record Type requires review. Reached maps to Contacted; it does not imply that an estimate has received a follow-up. No AI service is called during this verification.
