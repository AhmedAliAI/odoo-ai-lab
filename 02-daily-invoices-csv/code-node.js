const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const rows = $input.all().map((item) => {
  const inv = item.json;
  return {
    invoice_number: inv.name,
    invoice_date: inv.invoice_date,
    customer: Array.isArray(inv.partner_id) ? inv.partner_id[1] : '',
    currency: Array.isArray(inv.currency_id) ? inv.currency_id[1] : '',
    untaxed: round(inv.amount_untaxed),
    taxes: round(inv.amount_tax),
    total: round(inv.amount_total),
  };
});
const sum = (key) => round(rows.reduce((s, r) => s + r[key], 0));
rows.push({
  invoice_number: 'TOTAL (' + rows.length + ' invoices)',
  invoice_date: $('Report date').first().json.report_date,
  customer: '',
  currency: '',
  untaxed: sum('untaxed'),
  taxes: sum('taxes'),
  total: sum('total'),
});
return rows.map((r) => ({ json: r }));