# 03 · Daily sales dashboard (Excel + email)

Every night at 23:30 (Africa/Cairo):

1. Reads today's posted customer invoices from Odoo (signed amounts in company currency).
2. Builds an `.xlsx` workbook with 4 sheets:
   - **Dashboard**: KPIs (count, untaxed, taxes, total, average) plus the top 10 customers and top salespersons, with data bars
   - **Invoices**: one row per invoice, with a TOTAL row
   - **Customers**: ranking with share of revenue
   - **Salespersons**: ranking with share of revenue
3. Emails an HTML dashboard with the Excel file attached.

![Email preview](demo/email-preview.png)

Sample output (demo data): [`demo/daily_sales_demo.xlsx`](demo/daily_sales_demo.xlsx)

## Engineering note: an XLSX without libraries

The n8n Cloud Code node blocks `xlsx` and `exceljs`. [`code-node.js`](code-node.js) therefore writes the workbook by hand: SpreadsheetML XML with inline strings, a styles sheet and conditional-format data bars, packed into a ZIP with a small CRC32 + stored-ZIP writer. There are no dependencies, so it runs anywhere Node does.

If there are no invoices, it still sends a clear "no invoices today" email instead of failing.
