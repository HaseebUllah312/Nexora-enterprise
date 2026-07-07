'use client';
import { WATERMARK_BASE64 } from './watermark-base64';

export interface InvoiceItem {
  productName: string; quantity: number; unit: string; unitPrice: number; discount: number;
}
export interface CompanyInfo {
  companyName: string; tagline?: string; address?: string; city?: string;
  phone?: string; mobile?: string; email?: string; website?: string;
  ntn?: string; strn?: string; bankName?: string; bankAccount?: string;
  bankIBAN?: string; taxRate?: number; termsAndConditions?: string;
  showSignatures?: boolean;
}
export interface InvoiceData {
  invoiceNo: string; orderNo: string; date: string; dueDate?: string;
  paymentMethod: string; paidAmount?: number;
  customer: { name: string; phone?: string; address?: string; taxNumber?: string; };
  branch: { name: string; address?: string; phone?: string; };
  items: InvoiceItem[];
  company?: CompanyInfo;
  isQuotation?: boolean;
}

const FMT = (v:number) => 'PKR '+v.toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});

export function printInvoice(data: InvoiceData, format: 'a4' | 'thermal' = 'a4') {
  const subtotal  = data.items.reduce((s,i) => s + i.quantity * i.unitPrice, 0);
  const discount  = data.items.reduce((s,i) => s + i.discount, 0);
  const taxRate   = data.company?.taxRate ?? 0;
  const taxAmount = Math.round((subtotal - discount) * taxRate / 100 * 100) / 100;
  const total     = subtotal - discount + taxAmount;
  const paid      = data.isQuotation ? 0 : (data.paidAmount ?? (data.paymentMethod === 'CASH' ? total : 0));
  const outstanding = total - paid;

  const company = data.company ?? { companyName: data.branch.name };

  let html = '';

  if (format === 'thermal') {
    // 80mm Thermal Receipt Layout
    html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${data.isQuotation ? 'Quotation' : 'Receipt'} ${data.invoiceNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    width: 72mm;
    margin: 0 auto;
    padding: 4mm 2mm;
    background: #fff;
  }
  @page { size: auto; margin: 0; }
  @media print {
    body { width: 72mm; }
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .right { text-align: right; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { font-family: inherit; font-size: 11px; }
  .item-table th { border-bottom: 1px dashed #000; padding: 4px 0; }
  .item-table td { padding: 4px 0; vertical-align: top; }
  .totals-table td { padding: 2px 0; }
</style>
</head>
<body>
  <div class="center">
    <h1 style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">${company.companyName}</h1>
    ${company.tagline ? `<p style="font-size: 9px; margin-bottom: 2px;">${company.tagline}</p>` : ''}
    ${company.address ? `<p style="font-size: 9px;">${company.address}</p>` : ''}
    ${company.phone ? `<p style="font-size: 9px;">Tel: ${company.phone}</p>` : ''}
    ${company.ntn ? `<p style="font-size: 9px;">NTN: ${company.ntn}</p>` : ''}
  </div>

  <div class="line"></div>

  <div>
    <p><span class="bold">${data.isQuotation ? 'QUOTATION' : 'RECEIPT'}:</span> ${data.invoiceNo}</p>
    ${!data.isQuotation ? `<p><span class="bold">Order:</span> ${data.orderNo}</p>` : ''}
    <p><span class="bold">Date:</span> ${new Date(data.date).toLocaleDateString('en-PK')}</p>
    <p><span class="bold">Customer:</span> ${data.customer.name}</p>
    ${data.customer.phone ? `<p><span class="bold">Cust. Tel:</span> ${data.customer.phone}</p>` : ''}
    <p><span class="bold">Payment:</span> ${data.paymentMethod}</p>
    <p><span class="bold">Branch:</span> ${data.branch.name}</p>
  </div>

  <div class="line"></div>

  <table class="item-table">
    <thead>
      <tr>
        <th class="bold" style="text-align: left; width: 55%;">Item</th>
        <th class="bold" style="text-align: center; width: 15%;">Qty</th>
        <th class="bold" style="text-align: right; width: 30%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(item => {
        const lineTotal = item.quantity * item.unitPrice - item.discount;
        return `
          <tr>
            <td style="padding-top: 4px;">
              ${item.productName}<br/>
              <span style="font-size: 9px; color: #555;">${item.quantity} x ${item.unitPrice.toLocaleString('en-PK')}</span>
              ${item.discount > 0 ? `<br/><span style="font-size: 9px; color: red;">Disc: -${item.discount.toLocaleString('en-PK')}</span>` : ''}
            </td>
            <td style="text-align: center; padding-top: 4px;">${item.quantity} ${item.unit}</td>
            <td style="text-align: right; padding-top: 4px;">${lineTotal.toLocaleString('en-PK')}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="line"></div>

  <table class="totals-table">
    <tr>
      <td>Subtotal:</td>
      <td class="right">${subtotal.toLocaleString('en-PK')}</td>
    </tr>
    ${discount > 0 ? `<tr style="color: red;"><td>Discount:</td><td class="right">-${discount.toLocaleString('en-PK')}</td></tr>` : ''}
    ${taxRate > 0 ? `<tr><td>GST (${taxRate}%):</td><td class="right">${taxAmount.toLocaleString('en-PK')}</td></tr>` : ''}
    <tr class="bold" style="font-size: 12px;">
      <td>GRAND TOTAL:</td>
      <td class="right">${total.toLocaleString('en-PK')}</td>
    </tr>
    ${!data.isQuotation && paid > 0 ? `<tr style="color: green;"><td>Paid:</td><td class="right">-${paid.toLocaleString('en-PK')}</td></tr>` : ''}
    ${!data.isQuotation && outstanding > 0 ? `<tr class="bold" style="color: red;"><td>Balance Due:</td><td class="right">${outstanding.toLocaleString('en-PK')}</td></tr>` : ''}
  </table>

  <div class="line"></div>

  <div class="center" style="font-size: 9px; margin-top: 10px;">
    <p class="bold">Thank you for your business!</p>
    <p>Nexora Enterprise Desktop</p>
  </div>
</body>
</html>`;
  } else {
    // Standard A4 Layout
    const rows = data.items.map((item, i) => {
      const lineTotal = item.quantity * item.unitPrice - item.discount;
      return `
      <tr style="background:${i%2===0?'#f8fafc':'#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i+1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500">${item.productName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity.toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${FMT(item.unitPrice)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#dc2626">${item.discount>0?FMT(item.discount):'—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold">${FMT(lineTotal)}</td>
      </tr>`;
    }).join('');

    html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${data.isQuotation ? 'Quotation' : 'Invoice'} ${data.invoiceNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; position: relative; }
  @page { size: A4; margin: 12mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  table { width: 100%; border-collapse: collapse; }
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 380px;
    height: 380px;
    opacity: 0.055;
    pointer-events: none;
    z-index: 1000;
    mix-blend-mode: multiply;
  }
</style>
</head><body style="padding: 0; margin: 0; position: relative;">
<img class="watermark" src="${WATERMARK_BASE64}" />

<!-- HEADER -->
<div style="background: #1d4ed8; color: white; padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start;">
  <div>
    <h1 style="font-size: 22px; font-weight: bold; margin-bottom: 4px;">${company.companyName}</h1>
    ${company.tagline ? `<p style="font-size: 12px; opacity: 0.8; margin-bottom: 6px;">${company.tagline}</p>` : ''}
    ${company.address ? `<p style="font-size: 11px; opacity: 0.75;">${company.address}${company.city?', '+company.city:''}</p>` : ''}
    ${company.phone   ? `<p style="font-size: 11px; opacity: 0.75;">Tel: ${company.phone}${company.mobile?' | Mob: '+company.mobile:''}</p>` : ''}
    ${company.ntn     ? `<p style="font-size: 11px; opacity: 0.75;">NTN: ${company.ntn}${company.strn?' | STRN: '+company.strn:''}</p>` : ''}
  </div>
  <div style="text-align: right;">
    <h2 style="font-size: 28px; font-weight: bold; letter-spacing: 2px; opacity: 0.9;">${data.isQuotation ? 'QUOTATION' : 'INVOICE'}</h2>
    <p style="font-size: 16px; font-weight: bold; margin-top: 4px;">${data.invoiceNo}</p>
    ${!data.isQuotation ? `<p style="font-size: 11px; opacity: 0.75; margin-top: 2px;">Order: ${data.orderNo}</p>` : ''}
    <p style="font-size: 11px; opacity: 0.75;">Date: ${new Date(data.date).toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</p>
    ${data.dueDate && !data.isQuotation ? `<p style="font-size: 11px; color: #fbbf24; margin-top: 2px;">Due: ${new Date(data.dueDate).toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</p>` : ''}
  </div>
</div>

<!-- BILL TO + STATUS -->
<div style="display: flex; justify-content: space-between; padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
  <div>
    <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px;">Bill To</p>
    <p style="font-size: 15px; font-weight: bold; color: #111;">${data.customer.name}</p>
    ${data.customer.phone   ? `<p style="color: #555; margin-top: 2px;">Tel: ${data.customer.phone}</p>` : ''}
    ${data.customer.address ? `<p style="color: #555; margin-top: 2px;">${data.customer.address}</p>` : ''}
    ${data.customer.taxNumber ? `<p style="color: #555; margin-top: 2px;">NTN: ${data.customer.taxNumber}</p>` : ''}
  </div>
  <div style="text-align: right;">
    ${!data.isQuotation ? `
      <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px;">Payment</p>
      <p style="font-size: 14px; font-weight: bold; color: ${data.paymentMethod==='CREDIT'?'#dc2626':'#16a34a'};">${data.paymentMethod}</p>
    ` : ''}
    <p style="color: #555; margin-top: 2px;">Branch: ${data.branch.name}</p>
  </div>
</div>

<!-- ITEMS TABLE -->
<div style="padding: 20px 24px 0; min-height: 380px; display: flex; flex-direction: column;">
  <table style="width: 100%; border-collapse: collapse; flex-grow: 1; height: 100%;">
    <thead>
      <tr style="background: #1e293b; color: white;">
        <th style="padding: 10px 12px; text-align: left; width: 4%;">#</th>
        <th style="padding: 10px 12px; text-align: left; width: 36%;">Description</th>
        <th style="padding: 10px 12px; text-align: center; width: 8%;">Unit</th>
        <th style="padding: 10px 12px; text-align: center; width: 8%;">Qty</th>
        <th style="padding: 10px 12px; text-align: right; width: 16%;">Unit Price</th>
        <th style="padding: 10px 12px; text-align: right; width: 12%;">Discount</th>
        <th style="padding: 10px 12px; text-align: right; width: 16%;">Total</th>
      </tr>
    </thead>
    <tbody style="vertical-align: top;">
      ${rows}
      <tr style="height: auto;">
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
        <td style="border-bottom: 1px solid #e2e8f0;"></td>
      </tr>
    </tbody>
  </table>
</div>

<!-- TOTALS -->
<div style="display: flex; justify-content: flex-end; padding: 0 24px 20px;">
  <table style="width: 300px; margin-top: 0;">
    <tr style="border-top: 2px solid #e2e8f0;">
      <td style="padding: 8px 12px; color: #6b7280;">Subtotal</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: 500;">${FMT(subtotal)}</td>
    </tr>
    ${discount > 0 ? `<tr><td style="padding: 6px 12px; color: #dc2626;">Total Discount</td><td style="padding: 6px 12px; text-align: right; color: #dc2626;">- ${FMT(discount)}</td></tr>` : ''}
    ${taxRate > 0 ? `<tr><td style="padding: 6px 12px; color: #6b7280;">GST (${taxRate}%)</td><td style="padding: 6px 12px; text-align: right;">${FMT(taxAmount)}</td></tr>` : ''}
    <tr style="background: #1d4ed8; color: white;">
      <td style="padding: 12px; font-size: 14px; font-weight: bold;">Grand Total</td>
      <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: bold;">${FMT(total)}</td>
    </tr>
    ${!data.isQuotation && paid > 0 ? `<tr><td style="padding: 6px 12px; color: #16a34a;">Paid</td><td style="padding: 6px 12px; text-align: right; color: #16a34a; font-weight: 500;">- ${FMT(paid)}</td></tr>` : ''}
    ${!data.isQuotation && outstanding > 0 ? `<tr style="background: #fef2f2;"><td style="padding: 8px 12px; font-weight: bold; color: #dc2626;">Balance Due</td><td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #dc2626;">${FMT(outstanding)}</td></tr>` : ''}
    ${!data.isQuotation && outstanding === 0 ? `<tr style="background: #f0fdf4;"><td colspan="2" style="padding: 8px 12px; text-align: center; color: #16a34a; font-weight: bold;">&#10004; FULLY PAID</td></tr>` : ''}
  </table>
</div>

<!-- BANK DETAILS + TERMS -->
${(company.bankName||company.termsAndConditions) ? `
<div style="display: flex; gap: 20px; padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
  ${company.bankName ? `
  <div style="flex: 1;">
    <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px;">Bank Details</p>
    <p style="font-weight: 500;">${company.bankName}</p>
    ${company.bankAccount ? `<p style="color: #555;">${company.bankAccount}</p>` : ''}
    ${company.bankIBAN    ? `<p style="color: #555; font-family: monospace;">${company.bankIBAN}</p>` : ''}
  </div>` : ''}
  ${company.termsAndConditions ? `
  <div style="flex: 2;">
    <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px;">Terms & Conditions</p>
    <p style="color: #555; line-height: 1.5;">${company.termsAndConditions}</p>
  </div>` : ''}
</div>` : ''}

${(company.showSignatures ?? true) ? `
<!-- SIGNATURES -->
<div style="display: flex; justify-content: space-between; padding: 20px 24px 16px; margin-top: 10px;">
  <div style="text-align: center; width: 180px;">
    <div style="border-top: 1px solid #374151; padding-top: 6px; color: #6b7280; font-size: 11px;">Authorized Signature</div>
  </div>
  <div style="text-align: center; width: 180px;">
    <div style="border-top: 1px solid #374151; padding-top: 6px; color: #6b7280; font-size: 11px;">Customer Signature</div>
  </div>
</div>
` : `
<!-- DIGITAL BILL NOTICE -->
<div style="text-align: center; padding: 20px 24px; margin-top: 10px;">
  <div style="display: inline-block; border: 2px dashed #1d4ed8; border-radius: 8px; padding: 10px 24px; background: #eff6ff;">
    <p style="font-size: 13px; font-weight: bold; color: #1d4ed8; text-transform: uppercase; letter-spacing: 1px;">&#10004; Computer Generated Invoice</p>
    <p style="font-size: 10px; color: #1e40af; margin-top: 2px;">This is a system-generated digital invoice and does not require a physical signature.</p>
  </div>
</div>
`}

<div style="text-align: center; padding: 8px; background: #1e293b; color: rgba(255,255,255,0.5); font-size: 10px;">
  Nexora Enterprise | Developed by HM Nexora | ${company.companyName}
  ${company.email ? ` | ${company.email}` : ''}
  ${company.website ? ` | ${company.website}` : ''}
</div>

</body></html>`;
  }

  // ── Desktop (Electron): use IPC printToPDF → save as PDF with invoice number ─
  const electronAPI = (typeof window !== 'undefined' && (window as any).electronAPI);
  if (electronAPI?.printInvoicePDF) {
    electronAPI.printInvoicePDF(html, data.invoiceNo);
    return;
  }

  // ── Browser fallback: open in new tab and trigger print dialog ───────────────
  const w = window.open('', '_blank');
  if (!w) { alert('Allow popups to print invoices'); return; }
  w.document.write(html.replace('</body></html>', '<script>window.onload=function(){window.print();}<\/script></body></html>'));
  w.document.close();
}
