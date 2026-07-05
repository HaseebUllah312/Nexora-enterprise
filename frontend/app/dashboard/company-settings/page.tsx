'use client';
import { useEffect, useState } from 'react';
import { Save, Building2, CreditCard, FileText, CheckCircle, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { getCurrentUser } from '@/lib/auth';

interface Settings {
  id?:string; branchId:string; companyName:string; tagline?:string; address?:string; city?:string;
  phone?:string; mobile?:string; email?:string; website?:string; ntn?:string; strn?:string;
  bankName?:string; bankAccount?:string; bankIBAN?:string; invoicePrefix:string;
  invoiceCounter:number; currency:string; taxRate:number; termsAndConditions?:string;
  showSignatures:boolean;
}

interface Branch { id:string; name:string; }

type TabKey = 'general'|'tax'|'bank'|'invoice';

export default function CompanySettingsPage() {
  const user = getCurrentUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(user?.branch?.id ?? '');
  const [settings, setSettings] = useState<Partial<Settings>>({
    companyName:'', invoicePrefix:'INV', invoiceCounter:1, currency:'PKR', taxRate:0, showSignatures:true,
  });
  const [loading, setLoading]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);
  const [tab,     setTab]       = useState<TabKey>('general');

  useEffect(() => {
    api.get<Branch[]>('/branches').then(b=>{ setBranches(b); if(!branchId&&b.length>0) setBranchId(b[0].id); }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    api.get<Settings>(`/company-settings?branchId=${branchId}`)
      .then(s => setSettings(s))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [branchId]);

  function set(f:string, v:string|number|boolean) { setSettings(p=>({...p,[f]:v})); setSaved(false); }

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/company-settings?branchId=${branchId}`, { ...settings, branchId });
      setSaved(true);
      setTimeout(()=>setSaved(false), 3000);
    } catch (e:any) { alert(e.message); }
    finally { setSaving(false); }
  }

  const TABS: {key:TabKey;label:string;icon:any}[] = [
    { key:'general', label:'Company Info',    icon:Building2  },
    { key:'tax',     label:'Tax & GST',       icon:FileText   },
    { key:'bank',    label:'Bank Details',    icon:CreditCard },
    { key:'invoice', label:'Invoice Settings',icon:FileText   },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Settings</h1>
          <p className="text-sm text-muted-foreground">Business info printed on invoices, challans and reports</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle size={16}/>Settings saved
          </div>
        )}
      </div>

      {/* Branch selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">Configure for:</label>
        <Select value={branchId} onChange={e=>setBranchId(e.target.value)} className="w-56">
          {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`flex items-center gap-2 flex-1 justify-center rounded-md py-2 text-sm font-medium transition-colors ${tab===t.key?'bg-card shadow-sm':'text-muted-foreground hover:text-foreground'}`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        {tab==='general' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Company Information</h2>
            <p className="text-sm text-muted-foreground -mt-2 flex items-center gap-1.5"><Info size={13}/>This information appears on every invoice, delivery challan, and report.</p>
            <Field label="Company / Business Name" required>
              <Input value={settings.companyName??''} onChange={e=>set('companyName',e.target.value)} placeholder="Ali PVC Industries"/>
            </Field>
            <Field label="Tagline" hint="Printed under company name on invoices">
              <Input value={settings.tagline??''} onChange={e=>set('tagline',e.target.value)} placeholder="Quality PVC & PPRC Solutions"/>
            </Field>
            <Field label="Full Address">
              <Input value={settings.address??''} onChange={e=>set('address',e.target.value)} placeholder="Shop #12, Industrial Estate"/>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City"><Input value={settings.city??''} onChange={e=>set('city',e.target.value)} placeholder="Gujranwala"/></Field>
              <Field label="Phone"><Input value={settings.phone??''} onChange={e=>set('phone',e.target.value)} placeholder="055-1234567"/></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mobile / WhatsApp"><Input value={settings.mobile??''} onChange={e=>set('mobile',e.target.value)} placeholder="0300-1234567"/></Field>
              <Field label="Email"><Input type="email" value={settings.email??''} onChange={e=>set('email',e.target.value)} placeholder="info@company.com"/></Field>
            </div>
            <Field label="Website"><Input value={settings.website??''} onChange={e=>set('website',e.target.value)} placeholder="www.company.com"/></Field>
          </div>
        )}

        {tab==='tax' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Tax & Registration</h2>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
              <Info size={15} className="shrink-0 mt-0.5"/>
              <div>
                <p className="font-medium">GST Configuration</p>
                <p className="text-xs mt-0.5">Set your tax rate here. It will be automatically applied to all new invoices. Set 0 for tax-exempt businesses.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="NTN (National Tax Number)"><Input value={settings.ntn??''} onChange={e=>set('ntn',e.target.value)} placeholder="1234567-8"/></Field>
              <Field label="STRN (Sales Tax Reg No)"><Input value={settings.strn??''} onChange={e=>set('strn',e.target.value)} placeholder="12-34-5678-001-89"/></Field>
            </div>
            <Field label="GST / Tax Rate (%)" hint="e.g. 17 for Pakistan standard GST. Set 0 to disable tax on invoices.">
              <div className="flex items-center gap-3">
                <Input type="number" min={0} max={100} step={0.5} value={settings.taxRate??0}
                  onChange={e=>set('taxRate',Number(e.target.value))} className="w-36"/>
                <span className="text-sm text-muted-foreground">
                  {Number(settings.taxRate)>0
                    ? `PKR 100 sale → PKR ${(100*(1+Number(settings.taxRate)/100)).toFixed(2)} total`
                    : 'No tax applied'}
                </span>
              </div>
            </Field>
            <Field label="Terms & Conditions" hint="Printed at bottom of invoices">
              <textarea value={settings.termsAndConditions??''} onChange={e=>set('termsAndConditions',e.target.value)} rows={3}
                placeholder="Goods once sold will not be returned. Payment within 30 days."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"/>
            </Field>
          </div>
        )}

        {tab==='bank' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Bank Details</h2>
            <p className="text-sm text-muted-foreground">Printed on invoices to facilitate bank transfers from customers.</p>
            <Field label="Bank Name"><Input value={settings.bankName??''} onChange={e=>set('bankName',e.target.value)} placeholder="Meezan Bank / HBL / MCB..."/></Field>
            <Field label="Account Title"><Input value={settings.bankAccount??''} onChange={e=>set('bankAccount',e.target.value)} placeholder="Ali PVC Industries"/></Field>
            <Field label="Account Number / IBAN"><Input value={settings.bankIBAN??''} onChange={e=>set('bankIBAN',e.target.value)} placeholder="PK36MEZN0001234567890123"/></Field>
          </div>
        )}

        {tab==='invoice' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold">Invoice Number Settings</h2>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <Info size={15} className="shrink-0 mt-0.5"/>
              <p>Invoice numbers are auto-generated as: <strong>{settings.invoicePrefix||'INV'}-{new Date().getFullYear()}-{String(settings.invoiceCounter||1).padStart(5,'0')}</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice Prefix" hint="e.g. INV, BILL, SI">
                <Input value={settings.invoicePrefix??'INV'} onChange={e=>set('invoicePrefix',e.target.value.toUpperCase())} placeholder="INV"/>
              </Field>
              <Field label="Next Invoice Number" hint="The counter for the next invoice">
                <Input type="number" min={1} value={settings.invoiceCounter??1} onChange={e=>set('invoiceCounter',Number(e.target.value))}/>
              </Field>
            </div>
            <Field label="Currency">
              <Select value={settings.currency??'PKR'} onChange={e=>set('currency',e.target.value)}>
                <option value="PKR">PKR — Pakistani Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="SAR">SAR — Saudi Riyal</option>
              </Select>
            </Field>
            <Field label="Invoice Footer Mode" hint="Configure the signature and authenticity layout for A4 invoices">
              <Select value={settings.showSignatures ?? true ? 'sign' : 'digital'}
                onChange={e=>set('showSignatures', e.target.value === 'sign')}>
                <option value="sign">Show Physical Signatures (Authorized & Customer lines)</option>
                <option value="digital">Digital Bill (Hide signatures, show digital stamp notice)</option>
              </Select>
            </Field>
            <div className="rounded-lg bg-muted/40 p-4 text-sm">
              <p className="font-medium mb-1">Preview:</p>
              <p className="font-mono text-primary text-lg">{settings.invoicePrefix||'INV'}-{new Date().getFullYear()}-{String(settings.invoiceCounter||1).padStart(5,'0')}</p>
              <p className="text-xs text-muted-foreground mt-1">Next invoice will get this number, then auto-increments.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6 border-t border-border pt-4">
          <SubmitButton loading={saving} label="Save Settings" loadingLabel="Saving..." onClick={save} type="button"/>
        </div>
      </div>
    </div>
  );
}
