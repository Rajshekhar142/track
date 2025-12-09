import React from 'react';
import type { Task, Domain, TaskCompletion } from '../lib/storage';

type Props = {
  domains: Domain[];
  tasksByDomain: Record<string, Task[]>;
  date: string;
  completions: TaskCompletion[];
  onToggle: (task: Task) => void;
  onAddTask: (domainId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  managerOpen: boolean;
};

export function TaskList({ domains, tasksByDomain, date, completions, onToggle, onAddTask, onEditTask, onDeleteTask, managerOpen }: Props) {
  const doneFor = new Set(completions.filter(c => c.date === date).map(c => c.taskId));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {domains.map(d => (
        <section key={d.id} style={{ background: '#fff', padding: 14, borderRadius: 12, border: '1px solid rgba(3,105,161,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0369a1' }}>{d.name}</h3>
              <div style={{ fontSize: 12, color: '#666' }}>{(tasksByDomain[d.id] || []).filter(t => t.isActive).length} active</div>
            </div>

            {managerOpen ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onAddTask(d.id)} style={btnPrimary}>+ Task</button>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(tasksByDomain[d.id] || []).filter(t => t.isActive).map(t => {
              const done = doneFor.has(t.id);
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: done ? '#fbfcfd' : '#fff', border: '1px solid rgba(3,105,161,0.04)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type='checkbox' checked={done} onChange={() => onToggle(t)} style={{ width: 18, height: 18, accentColor: '#0ea5e9' }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{t.frequency} • <span style={{ color: '#0369a1', fontWeight: 800 }}>+{t.points} pts</span></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 900, color: '#0369a1' }}>{t.points}</div>
                    {managerOpen && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => onEditTask(t)} style={btnGhost}>Edit</button>
                        <button onClick={() => { if (confirm('Delete this task?')) onDeleteTask(t.id); }} style={btnDanger}>Delete</button>
                      </div>
                    )}
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

const btnPrimary: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 800 };
const btnGhost: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid #eee', background: '#fff' };
const btnDanger: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ffdede', background: '#fff', color: '#c00' };
