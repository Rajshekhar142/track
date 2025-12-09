import React from 'react';
import type { TaskCompletion, Task, Domain } from '../lib/storage';

type Props = { completions: TaskCompletion[]; tasks: Task[]; domains: Domain[]; days?: number };

function dateKey(d: Date) { return d.toISOString().slice(0,10); }

export function Stats({ completions, tasks, domains, days = 30 }: Props) {
  const today = new Date();
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = days-1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const key = dateKey(dt);
    labels.push(key);
    const total = completions.filter(c => c.date === key).reduce((s, c) => s + c.pointsEarned, 0);
    values.push(total);
  }

  const weekly = aggregate(values, 7);
  const monthly = aggregate(values, 30);

  const pointsByDomain: Record<string, number> = {};
  for (const d of domains) pointsByDomain[d.id] = 0;
  for (const c of completions) {
    if (!labels.includes(c.date)) continue;
    const task = tasks.find(t => t.id === c.taskId);
    if (!task) continue;
    pointsByDomain[task.domainId] = (pointsByDomain[task.domainId] || 0) + c.pointsEarned;
  }

  return (
    <section style={{ marginTop: 16, background: '#fff', padding: 12, borderRadius: 12, border: '1px solid rgba(3,105,161,0.06)' }}>
      <h4 style={{ margin: 0, marginBottom: 8, color: '#074c6b' }}>Progress (last {days} days)</h4>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <MiniLineChart labels={labels} values={values} />
        </div>

        <div style={{ width: 220 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Weekly total (sum):</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{sum(weekly)}</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Monthly total (approx):</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{sum(monthly)}</div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Focus by domain</div>
            {domains.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <div style={{ fontSize: 13 }}>{d.name}</div>
                <div style={{ fontWeight: 800 }}>{pointsByDomain[d.id] || 0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function aggregate(values: number[], window: number) {
  const out: number[] = [];
  for (let i = 0; i < values.length; i += window) {
    out.push(values.slice(i, i+window).reduce((s,v)=>s+v,0));
  }
  return out;
}
function sum(arr: number[]) { return arr.reduce((s,a)=>s+a,0); }

function MiniLineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const w = 500, h = 120, pad = 8;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length-1)) * (w - pad*2);
    const y = h - pad - (v / max) * (h - pad*2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width='100%' viewBox={`0 0 ${w} ${h}`} style={{ borderRadius: 6 }}>
      <rect x='0' y='0' width={w} height={h} fill='none' />
      <polyline fill='none' stroke='#0ea5e9' strokeWidth={2} points={points} strokeLinecap='round' strokeLinejoin='round' />
      {values.map((v,i)=>{
        const x = pad + (i / Math.max(1, values.length-1)) * (w - pad*2);
        const y = h - pad - (v / max) * (h - pad*2);
        return <circle key={i} cx={x} cy={y} r={2} fill='#0369a1' />;
      })}
    </svg>
  );
}
