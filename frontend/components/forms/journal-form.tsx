'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface Account { id:string;name:string;type:string;balance:string; }
interface Branch  { id:string;name:string; }

interface Props { open:boolean;onClose:()=>void;onSaved:()=>void; }

const ACCOUNT_TYPES=['CASH','BANK','RECEIVABLE','PAYABLE','EXPENSE','INCOME','EQUITY'];

export function AccountForm({ open, onClose, onSaved }: Props) {
  const currentUser=getCurrentUser();
  const [branches,setBranches]=useState<Branch[]>([]);
  const [form,setForm]=useState({name:'',type:'CASH',branchId:currentUser?.branch?.id??''});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setForm({name:'',type:'CASH',branchId:currentUser?.branch?.id??''});setErrors({});
    api.get<Branch[]>('/branches').then(setBranches).catch(()=>{});
  },[open]);

  async function save(){
    const e:Record<string,string>={};
    if(!form.name.trim()) e.name='Account name required';
    if(!form.branchId)    e.branchId='Select branch';
    setErrors(e);if(Object.keys(e).length)return;
    setLoading(true);
    try{await api.post('/accounting/accounts',form);onSaved();onClose();}
    catch(err:any){setErrors({submit:err.message});}
    finally{setLoading(false);}
  }

  return(
    <Modal open={open} onClose={onClose} title="Add Account" subtitle="Add an account to the chart of accounts" width="max-w-sm">
      <div className="flex flex-col gap-4">
        <Field label="Account Name" required error={errors.name}>
          <Input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Cash in Hand" error={!!errors.name}/>
        </Field>
        <Field label="Account Type" required>
          <Select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
            {ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Branch" required error={errors.branchId}>
          <Select value={form.branchId} onChange={e=>setForm(p=>({...p,branchId:e.target.value}))} error={!!errors.branchId}>
            <option value="">Select branch...</option>
            {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        {errors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label="Add Account" onClick={save} type="button"/>
        </div>
      </div>
    </Modal>
  );
}

interface JournalProps { open:boolean;onClose:()=>void;onSaved:()=>void; }

export function JournalEntryForm({ open, onClose, onSaved }: JournalProps) {
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [form,setForm]=useState({accountId:'',type:'DEBIT',amount:'',description:'',referenceType:'',referenceId:''});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setForm({accountId:'',type:'DEBIT',amount:'',description:'',referenceType:'',referenceId:''});setErrors({});
    api.get<Account[]>('/accounting/accounts').then(setAccounts).catch(()=>{});
  },[open]);

  function set(f:string,v:string){setForm(p=>({...p,[f]:v}));setErrors(p=>({...p,[f]:''}));}

  async function save(){
    const e:Record<string,string>={};
    if(!form.accountId)               e.accountId='Select account';
    if(!form.amount||Number(form.amount)<=0) e.amount='Enter valid amount';
    setErrors(e);if(Object.keys(e).length)return;
    setLoading(true);
    try{
      await api.post('/accounting/transactions',{
        accountId:form.accountId,type:form.type,amount:Number(form.amount),
        description:form.description||undefined,
        referenceType:form.referenceType||undefined,
        referenceId:form.referenceId||undefined,
      });
      onSaved();onClose();
    }catch(err:any){setErrors({submit:err.message});}
    finally{setLoading(false);}
  }

  const sel=accounts.find(a=>a.id===form.accountId);

  return(
    <Modal open={open} onClose={onClose} title="Post Journal Entry" subtitle="Record a debit or credit transaction" width="max-w-md">
      <div className="flex flex-col gap-4">
        <Field label="Account" required error={errors.accountId}>
          <Select value={form.accountId} onChange={e=>set('accountId',e.target.value)} error={!!errors.accountId}>
            <option value="">Select account...</option>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.type}) — PKR {Number(a.balance).toLocaleString()}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Entry Type" required>
            <Select value={form.type} onChange={e=>set('type',e.target.value)}>
              <option value="DEBIT">DEBIT (Increase Asset/Expense)</option>
              <option value="CREDIT">CREDIT (Increase Liability/Income)</option>
            </Select>
          </Field>
          <Field label="Amount (PKR)" required error={errors.amount}>
            <Input type="number" min={0.01} step={0.01} value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" error={!!errors.amount}/>
          </Field>
        </div>
        <Field label="Description">
          <Input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Cash received from customer..."/>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Reference Type" hint="e.g. SalesInvoice">
            <Input value={form.referenceType} onChange={e=>set('referenceType',e.target.value)} placeholder="SalesInvoice"/>
          </Field>
          <Field label="Reference ID">
            <Input value={form.referenceId} onChange={e=>set('referenceId',e.target.value)} placeholder="INV-001"/>
          </Field>
        </div>
        {sel&&(
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Current balance: </span>
            <span className="font-semibold">PKR {Number(sel.balance).toLocaleString()}</span>
            {form.amount&&<>
              <span className="text-muted-foreground mx-2">→ After: </span>
              <span className="font-semibold text-primary">
                PKR {(Number(sel.balance)+(form.type==='DEBIT'?1:-1)*Number(form.amount)).toLocaleString()}
              </span>
            </>}
          </div>
        )}
        {errors.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{errors.submit}</p>}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <SubmitButton loading={loading} label="Post Entry" onClick={save} type="button"/>
        </div>
      </div>
    </Modal>
  );
}
