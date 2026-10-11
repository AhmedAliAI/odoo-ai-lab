// ===== Daily sales report: summary + multi-sheet XLSX (built by hand) + HTML email =====
// Input: Odoo account.move items (may contain one empty item when there are no invoices)
const reportDate = $('Report date').first().json.report_date;
const COMPANY_CCY = 'EGP';
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const m2o = (v) => (Array.isArray(v) ? v[1] : '');

const invoices = $input.all()
  .map((i) => i.json)
  .filter((inv) => inv && inv.id)
  .map((inv) => ({
    invoice_number: inv.name,
    invoice_date: inv.invoice_date,
    journal: m2o(inv.journal_id),
    customer: m2o(inv.partner_id) || '(no customer)',
    salesperson: m2o(inv.invoice_user_id) || '(no salesperson)',
    untaxed: r2(inv.amount_untaxed_signed),
    taxes: r2(inv.amount_tax_signed),
    total: r2(inv.amount_total_signed),
  }))
  .sort((a, b) => b.total - a.total);

const sum = (rows, k) => r2(rows.reduce((s, r) => s + r[k], 0));
const totals = {
  count: invoices.length,
  untaxed: sum(invoices, 'untaxed'),
  taxes: sum(invoices, 'taxes'),
  total: sum(invoices, 'total'),
};
totals.avg = totals.count ? r2(totals.total / totals.count) : 0;

const groupBy = (key) => {
  const m = new Map();
  for (const inv of invoices) {
    const g = m.get(inv[key]) || { name: inv[key], invoices: 0, untaxed: 0, taxes: 0, total: 0 };
    g.invoices += 1; g.untaxed += inv.untaxed; g.taxes += inv.taxes; g.total += inv.total;
    m.set(inv[key], g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, untaxed: r2(g.untaxed), taxes: r2(g.taxes), total: r2(g.total),
      share: totals.total ? g.total / totals.total : 0 }))
    .sort((a, b) => b.total - a.total)
    .map((g, i) => ({ rank: i + 1, ...g }));
};
const customers = groupBy('customer');
const salespeople = groupBy('salesperson');

// ---------- XLSX writer (inline strings, stored ZIP) ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (n) => { let s = ''; n += 1; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// styles: 0 normal, 1 header, 2 money, 3 bold money, 4 title, 5 kpi label, 6 kpi money, 7 percent, 8 bold text, 9 subtitle, 10 kpi count
const cell = (r, c, v, s = 0) => {
  const ref = colName(c) + (r + 1);
  if (v === null || v === undefined || v === '') return s ? `<c r="${ref}" s="${s}"/>` : '';
  if (typeof v === 'number') return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
};
const sheetXml = (rows, widths, extra = '', heights = {}) => {
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const body = rows.map((row, r) => {
    if (!row) return '';
    const ht = heights[r] ? ` ht="${heights[r]}" customHeight="1"` : '';
    return `<row r="${r + 1}"${ht}>${row.map((c, ci) => (c ? cell(r, ci, c.v, c.s) : '')).join('')}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>${cols}<sheetData>${body}</sheetData>${extra}</worksheet>`;
};
const dataBar = (range, color, prio) => `<conditionalFormatting sqref="${range}"><cfRule type="dataBar" priority="${prio}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${color}"/></dataBar></cfRule></conditionalFormatting>`;
const V = (v, s = 0) => ({ v, s });

// Dashboard sheet
const D = [];
D[0] = [V(`Daily Sales Dashboard — ${reportDate}`, 4)];
D[1] = [V(`Posted customer invoices · amounts in ${COMPANY_CCY} (company currency)`, 9)];
D[3] = [V('Invoices', 5), V('Untaxed', 5), V('Taxes', 5), V('Total', 5), V('Average invoice', 5)];
D[4] = [V(totals.count, 10), V(totals.untaxed, 6), V(totals.taxes, 6), V(totals.total, 6), V(totals.avg, 6)];
let r = 6;
D[r++] = [V('Top 10 customers', 8)];
D[r++] = [V('Rank', 1), V('Customer', 1), V('Invoices', 1), V('Total', 1), V('Share', 1)];
const custStart = r;
for (const c of customers.slice(0, 10)) D[r++] = [V(c.rank), V(c.name), V(c.invoices), V(c.total, 2), V(c.share, 7)];
const custEnd = r - 1;
r += 1;
D[r++] = [V('Top salespersons', 8)];
D[r++] = [V('Rank', 1), V('Salesperson', 1), V('Invoices', 1), V('Total', 1), V('Share', 1)];
const spStart = r;
for (const s of salespeople.slice(0, 10)) D[r++] = [V(s.rank), V(s.name), V(s.invoices), V(s.total, 2), V(s.share, 7)];
const spEnd = r - 1;
let dashExtra = '';
if (customers.length) dashExtra += dataBar(`D${custStart + 1}:D${custEnd + 1}`, 'FF2E7D6B', 1);
if (salespeople.length) dashExtra += dataBar(`D${spStart + 1}:D${spEnd + 1}`, 'FF6B4FBF', 2);
if (!invoices.length) D[6] = [V('No posted customer invoices for this date.', 8)];
const dashboard = sheetXml(D, [16, 46, 12, 18, 18], invoices.length ? dashExtra : '', { 0: 30, 4: 26 });

// Invoices sheet
const I = [[V('Invoice', 1), V('Date', 1), V('Journal', 1), V('Customer', 1), V('Salesperson', 1), V('Untaxed', 1), V('Taxes', 1), V('Total', 1)]];
for (const inv of invoices) I.push([V(inv.invoice_number), V(inv.invoice_date), V(inv.journal), V(inv.customer), V(inv.salesperson), V(inv.untaxed, 2), V(inv.taxes, 2), V(inv.total, 2)]);
I.push([V(`TOTAL (${totals.count} invoices)`, 8), null, null, null, null, V(totals.untaxed, 3), V(totals.taxes, 3), V(totals.total, 3)]);
const invSheet = sheetXml(I, [20, 12, 22, 44, 26, 16, 14, 16]);

const groupSheet = (rows, label, color) => {
  const G = [[V('Rank', 1), V(label, 1), V('Invoices', 1), V('Untaxed', 1), V('Taxes', 1), V('Total', 1), V('Share', 1)]];
  for (const g of rows) G.push([V(g.rank), V(g.name), V(g.invoices), V(g.untaxed, 2), V(g.taxes, 2), V(g.total, 2), V(g.share, 7)]);
  const extra = rows.length ? dataBar(`F2:F${rows.length + 1}`, color, 1) : '';
  return sheetXml(G, [8, 46, 10, 16, 14, 16, 10], extra);
};
const sheets = [
  ['Dashboard', dashboard],
  ['Invoices', invSheet],
  ['Customers', groupSheet(customers, 'Customer', 'FF2E7D6B')],
  ['Salespersons', groupSheet(salespeople, 'Salesperson', 'FF6B4FBF')],
];

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="6"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF1F3A5F"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1F3A5F"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3A5F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F7"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="5" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="5" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const files = [
  ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml', styles],
  ...sheets.map(([, xml], i) => [`xl/worksheets/sheet${i + 1}.xml`, xml]),
];

const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const zip = (entries) => {
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content, 'utf8'); const nameBuf = Buffer.from(name, 'utf8'); const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, end]);
};
const xlsxBuffer = zip(files);
const fileName = `daily_sales_${reportDate}.xlsx`;

// ---------- HTML email dashboard ----------
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (x) => (x * 100).toFixed(1) + '%';
const kpi = (label, value) => `<td style="padding:12px 14px;background:#EEF2F7;border-radius:8px;"><div style="font-size:12px;color:#6B7280;">${label}</div><div style="font-size:20px;font-weight:bold;color:#1F3A5F;">${value}</div></td>`;
const barTable = (title, rows, color) => {
  if (!rows.length) return '';
  const max = rows[0].total || 1;
  const trs = rows.slice(0, 5).map((g) => `<tr><td style="padding:6px 8px;color:#6B7280;width:24px;">${g.rank}</td><td style="padding:6px 8px;" dir="auto">${esc(g.name)}<div style="height:8px;background:#E5E7EB;border-radius:4px;margin-top:4px;"><div style="height:8px;width:${Math.max(2, Math.round((g.total / max) * 100))}%;background:${color};border-radius:4px;"></div></div></td><td style="padding:6px 8px;text-align:right;white-space:nowrap;">${fmt(g.total)}</td><td style="padding:6px 8px;text-align:right;color:#6B7280;">${pct(g.share)}</td></tr>`).join('');
  return `<h3 style="color:#1F3A5F;margin:24px 0 8px;">${title}</h3><table style="width:100%;border-collapse:collapse;font-size:14px;">${trs}</table>`;
};
const html = invoices.length
  ? `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111827;">
<h2 style="color:#1F3A5F;margin:0 0 4px;">Daily Sales Dashboard — ${reportDate}</h2>
<div style="color:#6B7280;font-size:13px;margin-bottom:16px;">Posted customer invoices · ${COMPANY_CCY}</div>
<table style="border-collapse:separate;border-spacing:8px;width:100%;"><tr>${kpi('Invoices', totals.count)}${kpi('Untaxed', fmt(totals.untaxed))}</tr><tr>${kpi('Taxes', fmt(totals.taxes))}${kpi('Total', fmt(totals.total))}</tr></table>
${barTable('Top customers', customers, '#2E7D6B')}
${barTable('Top salespersons', salespeople, '#6B4FBF')}
<p style="color:#6B7280;font-size:12px;margin-top:24px;">Full details in the attached Excel: Dashboard, Invoices, Customers and Salespersons sheets.</p></div>`
  : `<div style="font-family:Arial,Helvetica,sans-serif;"><h2 style="color:#1F3A5F;">Daily Sales Dashboard — ${reportDate}</h2><p>No posted customer invoices for this date.</p></div>`;

const binary = { data: await this.helpers.prepareBinaryData(xlsxBuffer, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') };
return [{
  json: {
    report_date: reportDate,
    subject: `Daily sales ${reportDate}: ${totals.count} invoices · ${fmt(totals.total)} ${COMPANY_CCY}`,
    html,
    invoices: totals.count, untaxed: totals.untaxed, taxes: totals.taxes, total: totals.total,
    top_customer: customers[0]?.name || '', top_salesperson: salespeople[0]?.name || '',
  },
  binary,
}];
