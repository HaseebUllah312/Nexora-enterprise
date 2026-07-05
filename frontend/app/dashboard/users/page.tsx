'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, ShieldCheck, Key, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTableShell } from '@/components/ui/data-table-shell';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/form-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { getCurrentUser } from '@/lib/auth';

interface User {
  id:string; email:string; firstName:string; lastName:string; status:string; lastLoginAt?:string;
  role:{id:string;name:string}; branch?:{id:string;name:string}|null;
}
interface Role   { id:string;name:string; }
interface Branch { id:string;name:string; }

const STATUS_STYLE:Record<string,string>={
  ACTIVE:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE:'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  SUSPENDED:'bg-red-100 text-red-700',
};

export default function UsersPage() {
  const me = getCurrentUser();
  const isSuperAdmin = me?.role?.name === 'SUPER_ADMIN';

  const [users,setUsers]   = useState<User[]>([]);
  const [roles,setRoles]   = useState<Role[]>([]);
  const [branches,setBranches] = useState<Branch[]>([]);
  const [loading,setLoading]   = useState(true);
  const [error,setError]       = useState<string|null>(null);

  // Add/Edit user
  const [showForm,setShowForm] = useState(false);
  const [editing,setEditing]   = useState<User|null>(null);
  const [form,setForm]         = useState({firstName:'',lastName:'',email:'',password:'',roleId:'',branchId:'',status:'ACTIVE'});
  const [fErr,setFErr]         = useState<Record<string,string>>({});
  const [saving,setSaving]     = useState(false);

  // Password reset (SUPER_ADMIN only)
  const [resetTarget,setResetTarget]   = useState<User|null>(null);
  const [newPw,setNewPw]               = useState('');
  const [showPw,setShowPw]             = useState(false);
  const [resetLoading,setResetLoading] = useState(false);
  const [resetOk,setResetOk]           = useState(false);
  const [resetErr,setResetErr]         = useState('');

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const[u,r,b]=await Promise.all([
        api.get<User[]>('/users'),
        api.get<Role[]>('/roles'),
        api.get<Branch[]>('/branches'),
      ]);
      setUsers(u); setRoles(r); setBranches(b);
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  function openAdd(){
    setEditing(null);
    setForm({firstName:'',lastName:'',email:'',password:'',roleId:'',branchId:'',status:'ACTIVE'});
    setFErr({}); setShowForm(true);
  }
  function openEdit(u:User){
    setEditing(u);
    setForm({firstName:u.firstName,lastName:u.lastName,email:u.email,password:'',
      roleId:u.role.id,branchId:u.branch?.id??'',status:u.status});
    setFErr({}); setShowForm(true);
  }
  function set(f:string,v:string){setForm(p=>({...p,[f]:v}));setFErr(p=>({...p,[f]:''}));}

  async function saveUser(){
    const e:Record<string,string>={};
    if(!form.firstName.trim()) e.firstName='Required';
    if(!form.lastName.trim())  e.lastName='Required';
    if(!form.email.trim())     e.email='Required';
    if(!editing&&form.password.length<8) e.password='Minimum 8 characters';
    if(!form.roleId) e.roleId='Select a role';
    setFErr(e); if(Object.keys(e).length) return;
    setSaving(true);
    try{
      if(editing){
        await api.patch(`/users/${editing.id}`,{
          firstName:form.firstName, lastName:form.lastName,
          email:isSuperAdmin ? form.email : undefined,
          roleId:form.roleId, branchId:form.branchId||undefined, status:form.status as any,
        });
      } else {
        await api.post('/users',{
          firstName:form.firstName, lastName:form.lastName,
          email:form.email, password:form.password,
          roleId:form.roleId, branchId:form.branchId||undefined,
        });
      }
      setShowForm(false); load();
    }catch(err:any){setFErr({submit:err.message});}
    finally{setSaving(false);}
  }

  async function doReset(){
    if(newPw.length<8){setResetErr('Minimum 8 characters');return;}
    setResetLoading(true); setResetErr('');
    try{
      await api.patch(`/users/${resetTarget!.id}/reset-password`,{newPassword:newPw});
      setResetOk(true);
      setTimeout(()=>{setResetTarget(null);setNewPw('');setResetOk(false);},1800);
    }catch(e:any){setResetErr(e.message);}
    finally{setResetLoading(false);}
  }

  async function toggleStatus(u:User){
    const next=u.status==='ACTIVE'?'INACTIVE':'ACTIVE';
    try{await api.patch(`/users/${u.id}`,{status:next as any});load();}
    catch(e:any){alert(e.message);}
  }

  async function deleteUser(u:User){
    if(!confirm(`Deactivate ${u.firstName} ${u.lastName}? They will not be able to log in.`)) return;
    try{await api.delete(`/users/${u.id}`);load();}
    catch(e:any){alert(e.message);}
  }

  const roleColor:Record<string,string>={
    SUPER_ADMIN:'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    OWNER:'bg-blue-100 text-blue-700',
    BRANCH_MANAGER:'bg-teal-100 text-teal-700',
    FACTORY_MANAGER:'bg-orange-100 text-orange-700',
    ACCOUNTANT:'bg-yellow-100 text-yellow-700',
    SALES_MANAGER:'bg-pink-100 text-pink-700',
  };

  return(
    <>
      {/* Add / Edit User Modal */}
      <Modal open={showForm} onClose={()=>setShowForm(false)}
        title={editing?`Edit — ${editing.firstName} ${editing.lastName}`:'Add New User'}
        subtitle={editing?'Update role, branch access, or account status':'Create login credentials for a team member'}
        width="max-w-lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required error={fErr.firstName}>
              <Input value={form.firstName} onChange={e=>set('firstName',e.target.value)} placeholder="Muhammad" error={!!fErr.firstName}/>
            </Field>
            <Field label="Last Name" required error={fErr.lastName}>
              <Input value={form.lastName} onChange={e=>set('lastName',e.target.value)} placeholder="Ali" error={!!fErr.lastName}/>
            </Field>
          </div>
          <Field label="Email Address" required error={fErr.email}>
            <Input type="email" value={form.email} onChange={e=>set('email',e.target.value)}
              placeholder="user@company.com" error={!!fErr.email}
              disabled={!!editing && !isSuperAdmin} className={(editing && !isSuperAdmin) ? 'opacity-65' : ''} />
            {editing && !isSuperAdmin && <p className="text-xs text-muted-foreground mt-1">Email cannot be changed after account creation.</p>}
          </Field>
          {!editing&&(
            <Field label="Password" required error={fErr.password} hint="Min 8 chars — user can change after first login">
              <Input type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••••" error={!!fErr.password}/>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" required error={fErr.roleId}>
              <Select value={form.roleId} onChange={e=>set('roleId',e.target.value)} error={!!fErr.roleId}>
                <option value="">Select role...</option>
                {roles.map(r=><option key={r.id} value={r.id}>{r.name.replace(/_/g,' ')}</option>)}
              </Select>
            </Field>
            <Field label="Branch Access" hint="Leave blank = access all branches">
              <Select value={form.branchId} onChange={e=>set('branchId',e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          </div>
          {editing&&(
            <Field label="Account Status">
              <Select value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive (cannot login)</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </Field>
          )}
          {/* Branch access explanation */}
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Branch Access Rules:</p>
            <p>· <strong>All Branches</strong> — SUPER_ADMIN and OWNER can see all branch data consolidated.</p>
            <p>· <strong>Single Branch</strong> — User sees ONLY their own branch. Cannot access or view other branches.</p>
          </div>
          {fErr.submit&&<p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-600">{fErr.submit}</p>}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button onClick={()=>setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
            <SubmitButton loading={saving} label={editing?'Save Changes':'Create Account'} onClick={saveUser} type="button"/>
          </div>
        </div>
      </Modal>

      {/* Password Reset Modal (SUPER_ADMIN only) */}
      <Modal open={!!resetTarget} onClose={()=>{setResetTarget(null);setNewPw('');setResetErr('');setResetOk(false);}}
        title={`Reset Password — ${resetTarget?.firstName} ${resetTarget?.lastName}`}
        subtitle={resetTarget?.email}
        width="max-w-sm">
        <div className="flex flex-col gap-4">
          {resetOk ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={40} className="text-emerald-500"/>
              <p className="font-semibold text-emerald-600">Password reset successfully!</p>
              <p className="text-sm text-muted-foreground">All existing sessions for this user have been revoked.</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-400">
                ⚠ This will immediately invalidate all active sessions for this user.
              </div>
              <Field label="New Password" required error={resetErr}>
                <div className="relative">
                  <Input type={showPw?'text':'password'} value={newPw}
                    onChange={e=>{setNewPw(e.target.value);setResetErr('');}}
                    placeholder="Min 8 characters" error={!!resetErr}/>
                  <button type="button" onClick={()=>setShowPw(v=>!v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                  </button>
                </div>
              </Field>
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button onClick={()=>{setResetTarget(null);setNewPw('');}} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
                <SubmitButton loading={resetLoading} label="Reset Password" onClick={doReset} type="button" variant="danger"/>
              </div>
            </>
          )}
        </div>
      </Modal>

      <DataTableShell title="Users & Access Control"
        description={`${users.length} accounts — SUPER_ADMIN and OWNER see all data; Branch users see only their own branch`}
        loading={loading} error={error} empty={users.length===0} emptyLabel="No users found."
        action={
          <button onClick={openAdd}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-sm">
            <Plus size={16}/>Add User
          </button>
        }>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              {['Name','Email','Role','Branch Access','Status','Last Login','Actions'].map(h=>(
                <th key={h} className="px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <span className="font-medium">{u.firstName} {u.lastName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${roleColor[u.role.name]||'bg-muted text-muted-foreground'}`}>
                    <ShieldCheck size={10}/>
                    {u.role.name.replace(/_/g,' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.branch
                    ? <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-xs font-medium">{u.branch.name}</span>
                    : <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 text-xs font-medium">All Branches</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[u.status]||''}`}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>openEdit(u)}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                      <Pencil size={10}/>Edit
                    </button>
                    {isSuperAdmin&&(
                      <button onClick={()=>{setResetTarget(u);setNewPw('');setResetOk(false);setResetErr('');}}
                        className="flex items-center gap-1 rounded-md border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 px-2 py-1 text-xs hover:bg-amber-50 dark:hover:bg-amber-900/20">
                        <Key size={10}/>Reset PW
                      </button>
                    )}
                    {u.status==='ACTIVE'
                      ? <button onClick={()=>toggleStatus(u)} className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-xs hover:bg-red-50">Disable</button>
                      : <button onClick={()=>toggleStatus(u)} className="rounded-md border border-emerald-300 text-emerald-700 px-2 py-1 text-xs hover:bg-emerald-50">Enable</button>
                    }
                    {isSuperAdmin&&u.role.name!=='SUPER_ADMIN'&&(
                      <button onClick={()=>deleteUser(u)} className="rounded-md border border-red-200 text-red-400 px-2 py-1 text-xs hover:bg-red-50">Remove</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
