'use client';

import { ReactNode } from 'react';

interface FieldProps {
  label: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, error, required, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border ${error ? 'border-red-400 focus:ring-red-400' : 'border-border'} bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${className}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border ${error ? 'border-red-400' : 'border-border'} bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className={`w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none ${className}`}
    />
  );
}
