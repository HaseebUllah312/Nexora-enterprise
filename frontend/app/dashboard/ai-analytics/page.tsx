'use client';
import { useState } from 'react';
import { Send, Sparkles, Loader2, TrendingDown, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';

const EXAMPLE_QUESTIONS = [
  'Why did sales decrease this month?',
  'Which branch is performing best?',
  'What is our net profit this month?',
  'Show me slow moving inventory.',
  'What are our total payables right now?',
  'Which products have the highest revenue?',
];

export default function AiAnalyticsPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topProducts, setTopProducts] = useState<any[]|null>(null);
  const [slowMoving, setSlowMoving] = useState<any[]|null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setQuestion(q); setAnswer(''); setError(''); setLoading(true);
    try {
      const res = await api.post<{answer:string}>('/ai/ask', { question: q });
      setAnswer(res.answer);
    } catch (e: any) { setError(e.message || 'AI assistant unavailable'); }
    finally { setLoading(false); }
  }

  async function loadTopProducts() {
    const data = await api.get<any[]>('/ai/top-products?limit=5');
    setTopProducts(data);
  }

  async function loadSlowMoving() {
    const data = await api.get<any[]>('/ai/slow-moving');
    setSlowMoving(data.slice(0, 8));
  }

  const PKR = (v:number) => 'PKR '+v.toLocaleString('en-PK',{maximumFractionDigits:0});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles size={20}/></div>
        <div>
          <h1 className="text-2xl font-semibold">AI Analytics</h1>
          <p className="text-sm text-muted-foreground">Ask anything about your business — powered by Claude</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex gap-3">
          <input
            value={question}
            onChange={(e)=>setQuestion(e.target.value)}
            onKeyDown={(e)=>e.key==='Enter' && ask(question)}
            placeholder="Ask about sales, inventory, profitability, branches..."
            className="flex-1 rounded-md border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={()=>ask(question)} disabled={loading || !question.trim()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            Ask
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q)=>(
            <button key={q} onClick={()=>ask(q)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              {q}
            </button>
          ))}
        </div>

        {(answer || error) && (
          <div className={'mt-5 rounded-lg p-4 text-sm '+(error?'bg-red-50 text-red-700 dark:bg-red-900/20':'bg-muted')}>
            {error || answer.split('\n').map((line,i)=><p key={i} className="mb-1">{line}</p>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium"><BarChart3 size={16}/>Top Products by Revenue</h2>
            <button onClick={loadTopProducts} className="text-xs text-primary hover:underline">Load</button>
          </div>
          {topProducts && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">Product</th><th className="py-1 text-right">Revenue</th><th className="py-1 text-right">Units</th></tr></thead>
              <tbody>{topProducts.map(p=>(
                <tr key={p.productId} className="border-t border-border">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right font-medium">{PKR(p.revenue)}</td>
                  <td className="py-2 text-right text-muted-foreground">{p.unitsSold.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium"><TrendingDown size={16}/>Slow Moving Inventory</h2>
            <button onClick={loadSlowMoving} className="text-xs text-primary hover:underline">Load</button>
          </div>
          {slowMoving && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">Product</th><th className="py-1 text-right">Stock</th><th className="py-1">Last Sale</th></tr></thead>
              <tbody>{slowMoving.map(i=>(
                <tr key={i.product.id} className="border-t border-border">
                  <td className="py-2">{i.product.name}</td>
                  <td className="py-2 text-right font-medium text-amber-600">{i.totalStock}</td>
                  <td className="py-2 text-muted-foreground text-xs">{i.lastSaleDate?new Date(i.lastSaleDate).toLocaleDateString():'Never sold'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
