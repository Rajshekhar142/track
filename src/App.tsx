// src/App.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useTheme } from './theme';
import TaskEditor from './components/TaskEditor';
import { TaskList } from './components/TaskList';
import { ManagerPanel } from './components/ManagerPanel';
import { Stats } from './components/Stats';

import {
  loadStorage,
  ensureSeeded,
  defaultData,
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  removeTask as dbRemoveTask,
  addCompletion as dbAddCompletion,
  removeCompletion as dbRemoveCompletion,
  exportJSON as dbExportJSON,
  importJSON as dbImportJSON,
  resetToDefaults as dbResetToDefaults,
  StorageShape,
  Task,
  TaskCompletion,
  Domain,
} from './lib/storage';

const todayIso = () => new Date().toISOString().slice(0,10);

export default function App(): JSX.Element {
  const [store, setStore] = useState<StorageShape | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [managerOpen, setManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importText, setImportText] = useState('');
  const { theme, setTheme } = useTheme();

  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await ensureSeeded();
        const data = await loadStorage();
        if (!mounted) return;
        setStore(data);
      } catch (err) {
        console.error('Failed loading storage', err);
        setStore(defaultData());
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const domains = useMemo(() => store ? [...store.domains].sort((a,b)=>a.order-b.order) : [], [store]);
  const tasksByDomain = useMemo(() => {
    const map: Record<string, Task[]> = {};
    if (!store) return map;
    for (const d of domains) map[d.id] = [];
    for (const t of store.tasks) {
      if (!map[t.domainId]) map[t.domainId] = [];
      map[t.domainId].push(t);
    }
    for (const k of Object.keys(map)) map[k].sort((a,b)=>a.order-b.order);
    return map;
  }, [store, domains]);
  const completionsForDate = useMemo(() => store ? store.completions.filter(c => c.date === date) : [], [store, date]);
  const pointsToday = completionsForDate.reduce((s, c) => s + c.pointsEarned, 0);

  function qualifiedForDate(targetDate: string) {
    if (!store) return false;
    const activeDomains = store.domains.filter(d => d.isActive).map(d => d.id);
    const completedDomainIds = new Set(
      store.completions
        .filter(c => c.date === targetDate)
        .map(c => store.tasks.find(t => t.id === c.taskId)?.domainId)
        .filter(Boolean) as string[]
    );
    return activeDomains.every(id => completedDomainIds.has(id));
  }
  function currentStreak() {
    if (!store) return 0;
    let streak = 0;
    let cursor = new Date(date);
    while (true) {
      const key = cursor.toISOString().slice(0,10);
      if (qualifiedForDate(key)) { streak++; cursor.setDate(cursor.getDate()-1); } else break;
    }
    return streak;
  }

  /* CRUD */
  async function toggleTask(task: Task) {
    if (!store) return;
    const existing = store.completions.find(c => c.taskId === task.id && c.date === date);
    if (existing) {
      setStore(prev => prev ? ({ ...prev, completions: prev.completions.filter(c => c.id !== existing.id) }) : prev);
      try { await dbRemoveCompletion(existing.id); } catch (e) { console.error(e); }
    } else {
      const comp: TaskCompletion = { id: uuidv4(), taskId: task.id, date, completedAt: new Date().toISOString(), pointsEarned: task.points };
      setStore(prev => prev ? ({ ...prev, completions: [...prev.completions, comp] }) : prev);
      try { await dbAddCompletion(comp); } catch (e) { console.error(e); }
    }
  }

  async function addTask(domainId: string) {
    if (!store) return;
    const t: Task = { id: uuidv4(), domainId, title: 'New task', points: 1, frequency: 'daily', isActive: true, order: store.tasks.length };
    setStore(prev => prev ? ({ ...prev, tasks: [...prev.tasks, t] }) : prev);
    try { await dbAddTask(t); } catch (e) { console.error(e); }
    // open editor immediately for quick edit
    setEditingTask(t);
  }

  async function editTask(updated: Task) {
    if (!store) return;
    setStore(prev => prev ? ({ ...prev, tasks: prev.tasks.map(tt => tt.id === updated.id ? updated : tt) }) : prev);
    try { await dbUpdateTask(updated); } catch (e) { console.error(e); }
  }

  async function deleteTask(id: string) {
    if (!store) return;
    setStore(prev => prev ? ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id), completions: prev.completions.filter(c => c.taskId !== id) }) : prev);
    try {
      await dbRemoveTask(id);
      const comps = (store?.completions || []).filter(c => c.taskId === id);
      for (const c of comps) { try { await dbRemoveCompletion(c.id); } catch(_){} }
    } catch (e) { console.error(e); }
  }

  /* Domain ops (dynamic import to avoid cycles) */
  async function addDomain() {
    if (!store) return;
    const d: Domain = { id: uuidv4(), name: 'New domain', order: store.domains.length, isActive: true };
    setStore(prev => prev ? ({ ...prev, domains: [...prev.domains, d] }) : prev);
    try { const mod = await import('./lib/storage'); await mod.addDomain(d); } catch(e){ console.error(e); }
  }
  async function renameDomain(updated: Domain) {
    if (!store) return;
    setStore(prev => prev ? ({ ...prev, domains: prev.domains.map(dd => dd.id === updated.id ? updated : dd) }) : prev);
    try { const mod = await import('./lib/storage'); await mod.updateDomain(updated); } catch(e){ console.error(e); }
  }
  async function deleteDomain(id: string) {
    if (!store) return;
    const remainingTasks = store.tasks.filter(t => t.domainId !== id);
    const remainingCompletions = store.completions.filter(c => remainingTasks.some(t => t.id === c.taskId));
    setStore({ domains: store.domains.filter(d => d.id !== id), tasks: remainingTasks, completions: remainingCompletions });
    try { const mod = await import('./lib/storage'); await mod.removeDomain(id); } catch(e){ console.error(e); }
  }

  /* export/import/reset */
  async function exportJSON() { try { const json = await dbExportJSON(); await navigator.clipboard?.writeText(json); alert('Data copied to clipboard (JSON)'); } catch (e) { console.error(e); alert('Export failed'); } }
  async function importJSONFromText() { if (!importText) return alert('Paste JSON into the input first'); try { await dbImportJSON(importText); const reloaded = await loadStorage(); setStore(reloaded); setImportText(''); alert('Imported successfully'); } catch (e) { console.error(e); alert('Invalid JSON'); } }
  async function importJSONFile(file: File | null) { if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const txt = String(reader.result); await dbImportJSON(txt); const reloaded = await loadStorage(); setStore(reloaded); alert('Imported file successfully.'); } catch (e) { console.error(e); alert('Invalid JSON file.'); } }; reader.readAsText(file); }
  async function resetSample() { await dbResetToDefaults(); const reloaded = await loadStorage(); setStore(reloaded); alert('Sample data restored.'); }

  /* editor handlers */
  async function handleEditorSave(updated: Task) {
    await editTask(updated);
    setEditingTask(null);
  }
  function handleEditorCancel() { setEditingTask(null); }

  if (loading || !store) return (<div style={{ padding: 24 }}><h2 style={{ fontSize: 18 }}>Loading Life Tracker…</h2></div>);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #f0f9ff)', padding: 18, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'var(--color-primary-dark)' }}>Life Tracker</h1>
            <div style={{ color:'var(--text-secondary)', marginTop:6 }}>Small daily wins — minimalist + flexible</div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-primary)', fontWeight: 700 }}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>

            <input type='date' value={date} onChange={e=>setDate(e.target.value)} style={{ padding:8, borderRadius:8, border:'1px solid #ddd' }} />
            <div style={{ padding:'8px 12px', borderRadius:8, background:'var(--bg-surface)', border:'1px solid rgba(3,105,161,0.08)', fontWeight:800, color:'var(--color-primary)' }}>{pointsToday} pts</div>
            <div style={{ padding:'8px 12px', borderRadius:8, background:'var(--bg-surface)', border:'1px solid rgba(3,105,161,0.08)', fontWeight:800, color:'var(--color-primary-dark)' }}>Streak: {currentStreak()}</div>
            <button onClick={()=>setManagerOpen(s=>!s)} style={{ padding:'8px 12px', borderRadius:8, background:'var(--color-primary)', color:'#fff', border:'none', fontWeight:800 }}>{managerOpen ? 'Close Manager' : 'Open Manager'}</button>
            <button onClick={exportJSON} style={{ padding:'8px 12px', borderRadius:8, background:'var(--bg-surface)', border:'1px solid #eee', fontWeight:800 }}>Export</button>
          </div>
        </header>

        <main style={{ marginTop:18, display:'grid', gridTemplateColumns: managerOpen ? '2fr 1fr' : '1fr', gap: 16 }}>
          <div>
            <TaskList
              domains={domains}
              tasksByDomain={tasksByDomain}
              date={date}
              completions={store.completions}
              onToggle={toggleTask}
              onAddTask={addTask}
              onEditRequest={(t: Task) => setEditingTask(t)}
              onDeleteTask={deleteTask}
              managerOpen={managerOpen}
            />

            <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'center' }}>
              <button onClick={resetSample} style={{ padding:'10px 16px', borderRadius:10, border:'1px solid #eee', background:'var(--bg-surface)', fontWeight:800 }}>Reset</button>

              <label style={{ cursor:'pointer' }}>
                <input type='file' accept='application/json' style={{ display:'none' }} onChange={e=>{ const f = e.target.files?.[0]; if(!f) return; importJSONFile(f); }} />
                <div style={{ padding:'10px 16px', borderRadius:10, background:'var(--bg-surface)', border:'1px solid #eee', fontWeight:800 }}>Import File</div>
              </label>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input placeholder="Paste JSON here..." value={importText} onChange={(e)=>setImportText(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #eee", minWidth: 220 }} />
                <button onClick={importJSONFromText} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontWeight: 800 }}>Import</button>
              </div>
            </div>
          </div>

          <div>
            <ManagerPanel domains={domains} onAddDomain={addDomain} onRenameDomain={renameDomain} onDeleteDomain={deleteDomain} onEditTask={editTask} />
            <Stats completions={store.completions} tasks={store.tasks} domains={store.domains} days={30} />
          </div>
        </main>

        <footer style={{ marginTop:20, textAlign:'center', color:'var(--color-primary-dark)' }}>Minimal • Blue theme • Local-first • Mobile responsive</footer>
      </div>

      {editingTask && (
        <TaskEditor task={editingTask} onSave={handleEditorSave} onCancel={handleEditorCancel} />
      )}
    </div>
  );
}
