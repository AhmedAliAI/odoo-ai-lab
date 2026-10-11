# 02 · Daily invoices totals (CSV)

Every night at 23:30 (Africa/Cairo) it fetches today's **posted customer invoices** (`account.move`, `move_type = out_invoice`) and writes a CSV:

| invoice_number | invoice_date | customer | currency | untaxed | taxes | total |
|---|---|---|---|---|---|---|

The last row is a **TOTAL** row. The CSV includes a UTF-8 BOM, so Excel shows Arabic customer names correctly.

The logic is in [`code-node.js`](code-node.js).
