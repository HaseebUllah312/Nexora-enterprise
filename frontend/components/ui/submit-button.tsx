'use client';

import { Loader2 } from 'lucide-react';

interface SubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  onClick?: () => void;
  variant?: 'primary' | 'danger';
  type?: 'button' | 'submit';
}

export function SubmitButton({ loading, label, loadingLabel, onClick, variant = 'primary', type = 'submit' }: SubmitButtonProps) {
  const base = 'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';
  const styles = {
    primary: `${base} bg-primary text-primary-foreground hover:opacity-90`,
    danger:  `${base} bg-red-500 text-white hover:bg-red-600`,
  };
  return (
    <button type={type} disabled={loading} onClick={onClick} className={styles[variant]}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {loading ? (loadingLabel ?? 'Saving...') : label}
    </button>
  );
}
