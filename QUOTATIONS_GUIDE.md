# Quotations vs Invoices - Complete Guide

**Updated:** 2026-07-17  
**Version:** 1.0.0  

---

## Overview

Your system supports **two types of sales documents**:
1. **Quotations** - Price estimates (NO stock required)
2. **Invoices** - Actual sales with payment (stock MUST be available)

---

## 🟦 Creating a Quotation

### Step-by-Step

1. **Click "New Invoice"** (modal opens)
2. **Select customer** (or create new)
3. **Select branch**
4. **Change Payment Method to: "Quotation"** ← This is the key step
5. **Add items:**
   - Search for any product
   - **ALL items are selectable** (including zero-stock items)
   - Items show: `"No stock (Quotation OK)"` in amber color
6. **Enter quantities** (any amount, no stock limit)
7. **Click "Save Quotation"** (creates quotation, NOT invoice)

---

## 🟩 Creating an Invoice (Actual Sale)

### Step-by-Step

1. **Click "New Invoice"** (modal opens)
2. **Select customer** (or create new)
3. **Select branch**
4. **Choose Payment Method:**
   - `Cash` - Immediate payment
   - `Bank` - Bank transfer/cheque
   - `Credit (Udhaar)` - Customer credit
   - ~~Quotation~~ (No - we want invoice)
5. **Add items:**
   - Search for products
   - **Only in-stock items are selectable** (bold green)
   - Items show: `"100 available"` 
   - Zero-stock items: `"OUT OF STOCK"` (grayed out, can't click)
6. **Enter quantities** (up to available stock)
7. **Click "Create Invoice"** (creates invoice, deducts stock)

---

## 📊 Comparison Table

| Feature | Quotation | Invoice |
|---------|-----------|---------|
| **Requires Stock?** | ❌ No | ✅ Yes |
| **Can use zero-stock items?** | ✅ Yes | ❌ No |
| **Item selection** | All unlocked | Only in-stock |
| **Stock display** | "No stock (OK)" | "50 available" or "OUT OF STOCK" |
| **Deducts inventory?** | ❌ No | ✅ Yes |
| **Creates invoice?** | ❌ No (just quotation) | ✅ Yes |
| **Payment recording?** | ❌ No | ✅ Yes |
| **Printable?** | ✅ Yes | ✅ Yes |

---

## 🔄 Quotation Workflow

### Scenario 1: Convert Quotation to Invoice

1. **Customer approves the quotation**
2. **Go to Sales → Find the quotation order**
3. **Click on it**
4. **[In future version: "Convert to Invoice" button]**
   - For now: manually create an invoice for the same items
5. **System checks stock availability**
   - If item now has stock ✅ → Invoice created
   - If item has no stock ❌ → Error: "has no stock available in this branch"
6. **Adjust quantities if needed** and retry

### Scenario 2: Customer Declines

1. **No action needed** - quotation remains as reference
2. **Optionally delete or mark as cancelled**

---

## ✅ Use Cases

### Use Quotations For:
- 🎯 **Price estimates** before customer commits
- 📋 **Multiple options** - quote different versions
- 💰 **Future orders** - quote availability later
- 📧 **Email quotes** - customer approval before sale
- 🚫 **Items temporarily out of stock** - quote for future delivery

### Use Invoices For:
- ✔️ **Ready to sell now** - all items in stock
- 💳 **Immediate payment** - cash/bank/credit card
- 📦 **Reduce inventory** - actual transaction
- 📊 **Revenue recording** - official document

---

## 💡 Smart Examples

### Example 1: New Customer Quote

**Situation:** Customer inquires about 500 PVC pipes + 200 fittings, but you don't have all in stock yet

**Solution:**
1. Create **QUOTATION** with full quantities
2. Show customer the total price
3. Note when items will be available
4. Customer approves
5. When items arrive → Create **INVOICE** with approved quantities

✅ **Result:** Customer locked in price, no confusion about availability

---

### Example 2: Stock Shortage

**Situation:** Customer wants to buy 100 units, but only 50 in stock

**Solution - Option A (Invoice now):**
1. Create **INVOICE** with 50 units only (available stock)
2. Deduct inventory
3. Order more from supplier
4. Create new invoice later for remaining 50 units

**Solution - Option B (Quote then decide):**
1. Create **QUOTATION** for 100 units (even though only 50 in stock)
2. Show customer two options:
   - Get 50 now + 50 later
   - Wait for all 100
3. When ready → Convert quotation to invoice for available quantity

✅ **Result:** Flexibility + customer clarity

---

### Example 3: Multiple Branches

**Situation:** Gujranwala branch wants items that Lahore branch has

**Solution:**
1. Create **QUOTATION** at Gujranwala branch with any items
2. Transfer inventory from Lahore
3. Create **INVOICE** when items arrive at Gujranwala

✅ **Result:** No "stock not available" errors

---

## 🎨 UI Visual Guide

### Creating Sale with Payment Method = "QUOTATION"

```
Product Search Dropdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ PVC Pipe 1 inch             PKR 50
│ SKU-001 · No stock (OK) ▶   [AMBER] ← Click works!
├─────────────────────────────────
│ Elbow Fitting               PKR 12  
│ SKU-002 · No stock (OK) ▶   [AMBER] ← Click works!
├─────────────────────────────────
│ Tee Fitting                 PKR 15
│ SKU-003 · 200 available ▶   [GREEN] ← Click works!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All items UNLOCKED and selectable!
```

---

### Creating Sale with Payment Method = "CASH" / "BANK" / "CREDIT"

```
Product Search Dropdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ PVC Pipe 1 inch             PKR 50
│ SKU-001 · OUT OF STOCK      [RED] ✗ DISABLED
├─────────────────────────────────
│ Elbow Fitting               PKR 12  
│ SKU-002 · OUT OF STOCK      [RED] ✗ DISABLED
├─────────────────────────────────
│ Tee Fitting                 PKR 15
│ SKU-003 · 200 available ▶   [GREEN] ✅ Click works!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only in-stock items are selectable!
```

---

## ⚠️ Important Notes

### Stock Check Happens at Invoice Creation
- Quotations: **No stock check**
- Invoices: **Stock validated** ✓
  - If item has 0 stock → Error
  - If item has less than needed → Error
  - User must adjust quantities

### Quotation Doesn't Reduce Stock
- Creating quotation: Stock unchanged
- Converting to invoice: Stock deducted at that time

### Duplicate Orders Risk
- If you create QUOTATION for item with no stock
- Stock arrives later
- If you forget and create another order
- Both quotes might end up as invoices
- Could cause overselling

**Protection:** Quotations are timestamped - you can see which quote is older

---

## 🔍 Troubleshooting

### "I can't select a product in my quotation!"

**Possible Causes:**
1. ❌ You didn't change payment method to "QUOTATION"
   - **Fix:** Change from CASH/BANK/CREDIT to QUOTATION
2. ❌ Product is archived/inactive
   - **Fix:** Check product is active in product list

---

### "Product shows 'OUT OF STOCK' but I need to quote it"

**Solution:** Change payment method to "QUOTATION"
- In QUOTATION mode: All products available
- In INVOICE mode: Only in-stock products

---

### "I created an invoice but got error about no stock"

**Cause:** Stock wasn't available when invoice was created

**Fix:**
1. Add inventory first
2. Then create invoice
3. Or create QUOTATION, wait for stock to arrive, then convert

---

## 📋 Quotation Status Tracking

**Quotations appear in Sales list with status: `QUOTATION`**

You can see:
- Quote Date
- Customer Name
- Quoted Amount
- No invoice yet (not billed)

**Actions:**
- ✅ View quotation details
- ✅ Print as PDF
- ✅ Share with customer
- ❌ Receive payment (until converted to invoice)

---

## ✨ Best Practices

1. **Always use QUOTATION for estimates** - Don't pretend to have stock you don't
2. **Include availability info** - When items will be in stock
3. **Convert when ready** - Once stock confirmed, convert quotation to invoice
4. **Keep quotations for records** - Reference for disputes/follow-ups
5. **Use for planning** - Quotations help you forecast inventory needs

---

## Summary

✅ **Quotations** = Flexible, no stock limits, good for estimates  
✅ **Invoices** = Firm sales, stock validation, payment tracking  

**One EXE, Two Document Types = Maximum Business Flexibility!**

