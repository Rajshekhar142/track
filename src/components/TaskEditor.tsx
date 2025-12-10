// src/components/TaskEditor.tsx
import React, { useEffect, useState } from 'react';
import type { Task, Frequency } from '../lib/storage';

export default function TaskEditor({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (t: Task) => void;
  onCancel: () => void;
}) {
  const [t, setT] = useState<Task>(task);

  useEffect(() => setT(task), [task.id]);

  const handleSave = () => {
    // normalize values
    const updated = { ...t, points: Number(t.points) || 0 };
    onSave(updated);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)', zIndex: 9999, padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 520, borderRadius: 12, padding: 18, background: 'var(--bg-surface)' }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>Edit Task</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <input
            value={t.title}
            onChange={e => setT({ ...t, title: e.target.value })}
            placeholder="Task title"
            style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eef7' }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min={0}
              value={t.points}
              onChange={e => setT({ ...t, points: Number(e.target.value) })}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eef7', width: 120 }}
            />
            <select
              value={t.frequency}
              onChange={e => setT({ ...t, frequency: e.target.value as Frequency })}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #e6eef7', flex: 1 }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="one_time">One Time</option>
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={t.isActive}
                onChange={e => setT({ ...t, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={onCancel} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #eee' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
