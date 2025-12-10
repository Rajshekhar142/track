// src/components/TaskList.tsx
import React from 'react';
import type { Task, Domain, TaskCompletion } from '../lib/storage';

type Props = {
  domains: Domain[];
  tasksByDomain: Record<string, Task[]>;
  date: string;
  completions: TaskCompletion[];
  onToggle: (task: Task) => void;
  onAddTask: (domainId: string) => void;
  onEditRequest: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  managerOpen?: boolean;
};

export function TaskList({ domains, tasksByDomain, date, completions, onToggle, onAddTask, onEditRequest, onDeleteTask, managerOpen }: Props) {
  const doneFor = new Set(completions.filter(c => c.date === date).map(c => c.taskId));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {domains.map(d => (
        <section key={d.id} style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 12, border: '1px solid rgba(3,105,161,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-primary-dark)' }}>{d.name}</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(tasksByDomain[d.id] || []).filter(t => t.isActive).length} active</div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Always visible add button for quick add */}
              <button onClick={() => onAddTask(d.id)} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 800 }}>
                + Task
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(tasksByDomain[d.id] || []).filter(t => t.isActive).map(t => {
              const done = doneFor.has(t.id);
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: done ? 'color-mix(in srgb, var(--bg-surface) 94%, black 1%)' : 'var(--bg-surface)', border: '1px solid rgba(3,105,161,0.03)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type='checkbox' checked={done} onChange={() => onToggle(t)} style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.frequency} • <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>+{t.points} pts</span></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, color: 'var(--color-primary)' }}>{t.points}</div>

                    {/* Edit always available */}
                    <button onClick={() => onEditRequest(t)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>Edit</button>

                    <button onClick={() => { if (confirm('Delete this task?')) onDeleteTask(t.id); }} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ffdede', background: '#fff', color: '#c00' }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
