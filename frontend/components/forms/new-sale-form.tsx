'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Receipt, Info, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { ProductSearch } from '@/components/ui/product-search';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { printInvoice } from '@/components/ui/invoice-print';

interface Customer  { id:string; name:string; balance:string; creditLimit:string; phone?:string; address?:string; }
interface Branch    { id:string; name:string; }
interface CompanySettings { taxRate:number; currency:string; companyName?:string; }

interface LineItem {
  productId:string; productName:string; unit:string;
  quantity:number; unitPrice:number; discount:number;
}

interface Props { open:boolean; onClose:()=>void; onCreated:()=>void; }
const PKR = (v:number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits:0 });

export function NewSaleForm({ open, onClose, onCreated }: Props) {
  const currentUser = getCurrentUser();
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [settings,     setSettings]     = useState<CompanySettings | null>(null);
  const [customerId,   setCustomerId]   = useState('');
  const [branchId,     setBranchId]     = useState(currentUser?.branch?.id ?? '');
  const [paymentMethod,setPaymentMethod]= useState<'CASH'|'BANK'|'CREDIT'|'QUOTATION'>('CASH');
  const [dueDate,      setDueDate]      = useState('');
  const [lines,        setLines]        = useState<LineItem[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState<Record<string,string>>({});
  const [success,      setSuccess]      = useState<{invoiceNo:string;total:number;tax:number;isQuotation?:boolean}|null>(null);
  const [taxRateOverride, setTaxRateOverride] = useState<number | ''>('');

  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');

  useEffect(() => {
    if (!open) return;
    setSuccess(null); setErrors({}); setLines([]); setTaxRateOverride('');
    setIsNewCustomer(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerAddress('');
    const bid = currentUser?.branch?.id || branchId;
    Promise.all([
      api.get<Customer[]>('/customers'),
      api.get<Branch[]>('/branches'),
      bid ? api.get<CompanySettings>(`/company-settings?branchId=${bid}`).catch(()=>null) : Promise.resolve(null),
    ]).then(([c, b, s]) => {
      setCustomers(c);
      setBranches(b);
      setSettings(s);
      if (s) setTaxRateOverride(s.taxRate);
    });
  }, [open]);

  // Re-fetch settings when branch changes
  useEffect(() => {
    if (!branchId) return;
    api.get<CompanySettings>(`/company-settings?branchId=${branchId}`).then(s => {
      setSettings(s);
      if (s) setTaxRateOverride(s.taxRate);
    }).catch(()=>{});
  }, [branchId]);

  function addLine() { setLines(p=>[...p,{productId:'',productName:'',unit:'',quantity:1,unitPrice:0,discount:0}]); }
  function removeLine(i:number){ setLines(p=>p.filter((_,j)=>j!==i)); }

  function setLineProduct(i:number, productId:string, product:any){
    if(!product) return;
    setLines(p=>p.map((l,j)=>j===i?{...l,productId:product.id,productName:product.name,unit:product.unit,unitPrice:Number(product.salePrice)}:l));
  }
  function updateLine(i:number, f:keyof LineItem, v:number|string){
    setLines(p=>p.map((l,j)=>j===i?{...l,[f]:v}:l));
  }

  const subtotal   = lines.reduce((s,l) => s + l.quantity * l.unitPrice, 0);
  const totalDisc  = lines.reduce((s,l) => s + l.discount, 0);
  const taxRate    = taxRateOverride !== '' ? Number(taxRateOverride) : (settings?.taxRate ?? 0);
  const taxAmount  = Math.round((subtotal - totalDisc) * taxRate / 100 * 100) / 100;
  const total      = subtotal - totalDisc + taxAmount;

  const selectedCustomer = customers.find(c=>c.id===customerId);

  function validate(){
    const e:Record<string,string>={};
    if(!isNewCustomer && !customerId)  e.customerId='Select a customer';
    if(isNewCustomer && !newCustomerName.trim()) e.newCustomerName='Customer name required';
    if(!branchId)    e.branchId='Select a branch';
    if(lines.length===0) e.lines='Add at least one product';
    lines.forEach((l,i)=>{
      if(!l.productId) e[`l_${i}_p`]='Select product';
      if(l.quantity<=0) e[`l_${i}_q`]='Qty > 0';
      if(l.unitPrice<=0) e[`l_${i}_u`]='Price > 0';
    });
    if(paymentMethod==='CREDIT'&&!dueDate) e.dueDate='Due date required';
    setErrors(e); return Object.keys(e).length===0;
  }

  async function handleSubmit(){
    if(!validate()) return;
    setLoading(true);
    try{
      let actualCustomerId = customerId;
      if(isNewCustomer){
        const newCust = await api.post<Customer>('/customers',{
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          address: newCustomerAddress.trim() || undefined,
          branchId,
        });
        actualCustomerId = newCust.id;
      }
      const order = await api.post<{id:string;orderNo:string}>('/sales/orders',{
        customerId: actualCustomerId, branchId,
        items: lines.map(l=>({productId:l.productId,quantity:l.quantity,unitPrice:l.unitPrice,discount:l.discount})),
      });

      if (paymentMethod === 'QUOTATION') {
        setSuccess({
          invoiceNo: order.orderNo,
          total: subtotal - totalDisc,
          tax: 0,
          isQuotation: true,
        });
        onCreated();
      } else {
        await api.patch(`/sales/orders/${order.id}/confirm`);
        const invoice = await api.post<{invoiceNo:string;totalAmount:string;taxAmount:number}>('/sales/invoices',{
          salesOrderId:order.id, paymentMethod, dueDate:dueDate||undefined,
          taxRate: taxRateOverride !== '' ? Number(taxRateOverride) : undefined,
        });
        setSuccess({
          invoiceNo: invoice.invoiceNo,
          total: Number(invoice.totalAmount),
          tax: invoice.taxAmount ?? 0,
          isQuotation: false,
        });
        onCreated();
      }
    }catch(err:any){ setErrors({submit:err.message}); }
    finally{ setLoading(false); }
  }

  function doPrint(isQuotation: boolean, invoiceNo: string, format: 'a4' | 'thermal' = 'a4') {
    const cust = isNewCustomer 
      ? { name: newCustomerName, phone: newCustomerPhone, address: newCustomerAddress }
      : customers.find(c => c.id === customerId);
    
    const br = branches.find(b => b.id === branchId);

    printInvoice({
      invoiceNo: invoiceNo,
      orderNo: invoiceNo,
      date: new Date().toISOString(),
      paymentMethod: isQuotation ? 'QUOTATION' : paymentMethod,
      paidAmount: isQuotation ? 0 : (paymentMethod === 'CASH' ? (subtotal - totalDisc + (success?.tax ?? 0)) : 0),
      customer: {
        name: cust?.name ?? 'Walk-in Customer',
        phone: cust?.phone,
        address: cust?.address,
      },
      branch: {
        name: br?.name ?? 'Main Branch',
      },
      items: lines.map(l => ({
        productName: l.productName,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        discount: l.discount,
      })),
      company: settings ? {
        companyName: settings.companyName ?? 'FactoryERP',
        taxRate: settings.taxRate ?? 0,
      } : undefined,
      isQuotation: isQuotation,
    }, format);
  }

  if(success){
    return(
      <Modal open={open} onClose={onClose} title={success.isQuotation ? "Quotation Saved" : "Invoice Created"} width="max-w-md">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Receipt size={28} className="text-emerald-600"/>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-600">{success.invoiceNo}</p>
            <p className="text-sm text-muted-foreground mt-1">{success.isQuotation ? "Quotation saved successfully" : "Invoice created successfully"}</p>
          </div>
          <div className="w-full rounded-lg bg-muted p-4 text-sm space-y-2">
            <div className="flex justify-between"><span>Subtotal</span><span>{PKR(subtotal - totalDisc)}</span></div>
            {success.tax > 0 && <div className="flex justify-between"><span>Tax ({taxRate}%)</span><span>{PKR(success.tax)}</span></div>}
            <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span className="text-primary">{PKR(success.total)}</span></div>
            <div className="flex justify-between"><span>Billing Type</span><span>{paymentMethod === 'QUOTATION' ? 'QUOTATION' : paymentMethod}</span></div>
            {paymentMethod==='CREDIT'&&dueDate&&<div className="flex justify-between text-red-500"><span>Due Date</span><span>{dueDate}</span></div>}
          </div>
          
          <div className="flex gap-2 w-full">
            <button onClick={() => doPrint(!!success.isQuotation, success.invoiceNo, 'a4')}
              className="flex-1 rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5">
              <Printer size={14}/> Print A4
            </button>
            <button onClick={() => doPrint(!!success.isQuotation, success.invoiceNo, 'thermal')}
              className="flex-1 rounded-md border border-primary text-primary py-2.5 text-sm font-bold hover:bg-primary/5 flex items-center justify-center gap-1.5">
              <Printer size={14}/> Print Thermal
            </button>
          </div>

          <div className="flex gap-3 w-full border-t border-border pt-4">
            <button onClick={()=>{
                setSuccess(null);
                setLines([]);
                setCustomerId('');
                setIsNewCustomer(false);
                setNewCustomerName('');
                setNewCustomerPhone('');
                setNewCustomerAddress('');
              }}
              className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted font-medium">New Sale</button>
            <button onClick={onClose}
              className="flex-1 rounded-md border border-border py-2 text-sm font-medium hover:bg-muted">Done</button>
          </div>
        </div>
      </Modal>
    );
  }

  return(
    <Modal open={open} onClose={onClose} title="New Sale / Invoice" subtitle="Create a sales invoice with automatic inventory deduction" width="max-w-4xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {!isNewCustomer ? (
            <Field
              label={
                <div className="flex justify-between items-center w-full">
                  <span>Customer</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomer(true);
                      setCustomerId('');
                      setErrors({});
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase transition-colors"
                  >
                    + New
                  </button>
                </div>
              }
              required
              error={errors.customerId}
            >
              <Select value={customerId} onChange={e=>setCustomerId(e.target.value)} error={!!errors.customerId}>
                <option value="">Select customer...</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              {selectedCustomer&&Number(selectedCustomer.balance)>0&&(
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Info size={11}/>Outstanding: {PKR(Number(selectedCustomer.balance))}
                  {Number(selectedCustomer.creditLimit)>0&&` / Limit: ${PKR(Number(selectedCustomer.creditLimit))}`}
                </p>
              )}
            </Field>
          ) : (
            <Field
              label={
                <div className="flex justify-between items-center w-full">
                  <span>Customer Name</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomer(false);
                      setNewCustomerName('');
                      setNewCustomerPhone('');
                      setNewCustomerAddress('');
                      setErrors({});
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase transition-colors"
                  >
                    Select List
                  </button>
                </div>
              }
              required
              error={errors.newCustomerName}
            >
              <Input
                value={newCustomerName}
                onChange={e=>setNewCustomerName(e.target.value)}
                placeholder="Walk-in name..."
                error={!!errors.newCustomerName}
              />
            </Field>
          )}
          <Field label="Branch" required error={errors.branchId}>
            <Select value={branchId} onChange={e=>setBranchId(e.target.value)} error={!!errors.branchId}>
              <option value="">Select branch...</option>
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment Method" required>
            <Select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as any)}>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer / Cheque</option>
              <option value="CREDIT">Credit (Udhaar)</option>
              <option value="QUOTATION">Quotation</option>
            </Select>
          </Field>
          <Field label="Sales Tax Rate (%)" hint="Overrides branch tax settings">
            <Input type="number" min={0} max={100} step={0.5} value={taxRateOverride}
              onChange={e=>{
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setTaxRateOverride(v);
              }}
            />
          </Field>
        </div>

        {isNewCustomer && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-muted/20 p-4 rounded-lg border border-border">
            <Field label="Customer Phone (Optional)" error={errors.newCustomerPhone}>
              <Input
                value={newCustomerPhone}
                onChange={e=>setNewCustomerPhone(e.target.value)}
                placeholder="e.g. 03001234567"
              />
            </Field>
            <Field label="Customer Address (Optional)" error={errors.newCustomerAddress}>
              <Input
                value={newCustomerAddress}
                onChange={e=>setNewCustomerAddress(e.target.value)}
                placeholder="e.g. Sultan Pura, Lahore"
              />
            </Field>
          </div>
        )}

        {paymentMethod==='CREDIT'&&(
          <div className="max-w-xs">
            <Field label="Due Date" required error={errors.dueDate}>
              <Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} error={!!errors.dueDate}/>
            </Field>
          </div>
        )}

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Items</h3>
            <button onClick={addLine} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              <Plus size={14}/>Add Item
            </button>
          </div>
          {errors.lines&&<p className="text-xs text-red-500 mb-2">{errors.lines}</p>}

          {lines.length===0?(
            <div className="rounded-lg border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Click "Add Item" to add products
            </div>
          ):(
            <div className="rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 w-[32%]">Product</th>
                    <th className="px-3 py-2 w-[8%]">Unit</th>
                    <th className="px-3 py-2 w-[12%]">Qty</th>
                    <th className="px-3 py-2 w-[16%]">Unit Price</th>
                    <th className="px-3 py-2 w-[14%]">Discount</th>
                    <th className="px-3 py-2 w-[14%] text-right">Line Total</th>
                    <th className="px-3 py-2 w-[4%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line,i)=>{
                    const lt = line.quantity * line.unitPrice - line.discount;
                    return(
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <ProductSearch
                            value={line.productId}
                            onChange={(id,p)=>setLineProduct(i,id,p)}
                            error={!!errors[`l_${i}_p`]}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{line.unit||'—'}</td>
                        <td className="px-3 py-2">
                          <Input type="number" min={1} value={line.quantity}
                            onChange={e=>updateLine(i,'quantity',Number(e.target.value))}
                            error={!!errors[`l_${i}_q`]}/>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min={0} value={line.unitPrice}
                            onChange={e=>updateLine(i,'unitPrice',Number(e.target.value))}
                            error={!!errors[`l_${i}_u`]}/>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min={0} value={line.discount}
                            onChange={e=>updateLine(i,'discount',Number(e.target.value))}/>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{PKR(lt)}</td>
                        <td className="px-3 py-2">
                          <button onClick={()=>removeLine(i)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals */}
        {lines.length>0&&(
          <div className="flex justify-end">
            <div className="w-72 rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{PKR(subtotal)}</span></div>
              {totalDisc>0&&<div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="text-red-500">- {PKR(totalDisc)}</span></div>}
              {taxRate>0&&<div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{PKR(taxAmount)}</span></div>}
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <span>Grand Total</span><span className="text-primary">{PKR(total)}</span>
              </div>
            </div>
          </div>
        )}

        {errors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label={paymentMethod === 'QUOTATION' ? `Save Quotation — ${PKR(total)}` : `Create Invoice — ${PKR(total)}`} onClick={handleSubmit} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
