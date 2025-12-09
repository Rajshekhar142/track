import React from 'react';
import type { Domain, Task } from '../lib/storage';

type Props = {
  domains: Domain[];
  onAddDomain: () => void;
  onRenameDomain: (d: Domain) => void;
  onDeleteDomain: (id: string) => void;
  onEditTask: (t: Task) => void;
};

export function ManagerPanel({ domains, onAddDomain, onRenameDomain, onDeleteDomain, onEditTask }: Props) {
  return (
    <aside style={{ marginTop: 18, background: '#fff', padding: 14, borderRadius: 12, border: '1px solid rgba(3,105,161,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#074c6b' }}>Manager</h4>
        <button onClick={onAddDomain} style={btnPrimary}>+ Domain</button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {domains.map(d => (
          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 8, border: '1px solid #eee' }}>
            <div style={{ fontWeight: 800 }}>{d.name}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => {
                const name = prompt('Rename domain:', d.name);
                if (name && name.trim()) onRenameDomain({ ...d, name: name.trim() });
              }} style={btnGhost}>Rename</button>
              <button onClick={() => { if (confirm(`Delete domain '${d.name}' ?`)) onDeleteDomain(d.id); }} style={btnDanger}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

const btnPrimary: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 800 };
const btnGhost: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid #eee', background: '#fff' };
const btnDanger: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid #ffdede', background: '#fff', color: '#c00' };
