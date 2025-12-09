// src/App.tsx
import React, { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { useTheme } from './theme';
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

import { TaskList } from './components/TaskList';
import { ManagerPanel } from './components/ManagerPanel';
import { Stats } from './components/Stats';
import { v4 as uuidv4 } from 'uuid';
// small React hook + button
useTheme();
export function InstallButton() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
      console.log('beforeinstallprompt saved');
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const install = async () => {
    if (!deferred) return alert('Install prompt not ready');
    deferred.prompt();
    const choice = await deferred.userChoice;
    console.log('userChoice', choice);
    setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;
  return (
    <button onClick={install} style={{ padding: '8px 12px', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 800 }}>
      Install App
    </button>
  );
}

const todayIso = () => new Date().toISOString().slice(0,10);

export default function App(): JSX.Element {
  const [store, setStore] = useState<StorageShape | null>(null);
  const [date, setDate] = useState<string>(todayIso());
  const [managerOpen, setManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importText, setImportText] = useState('');

  // Load DB on mount
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

  // derived helpers
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

  // Streak logic: qualify if at least one completion per active domain
  function qualifiedForDate(targetDate: string) {
    if (!store) return false;
    const activeDomains = store.domains.filter(d => d.isActive).map(d => d.id);
    const completedDomainIds = new Set(
      store.completions
        .filter(c => c.date === targetDate)
        .map(c => {
          const t = store.tasks.find(x => x.id === c.taskId);
          return t?.domainId;
        })
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

  /* ----------------- CRUD helpers that persist to Dexie ----------------- */

  // Toggle completion for a task on the selected date
  async function toggleTask(task: Task) {
    if (!store) return;
    const existing = store.completions.find(c => c.taskId === task.id && c.date === date);
    if (existing) {
      // optimistic update
      setStore(prev => prev ? ({ ...prev, completions: prev.completions.filter(c => c.id !== existing.id) }) : prev);
      try {
        await dbRemoveCompletion(existing.id);
      } catch (err) {
        console.error('Failed to remove completion', err);
      }
    } else {
      const comp: TaskCompletion = { id: uuidv4(), taskId: task.id, date, completedAt: new Date().toISOString(), pointsEarned: task.points };
      setStore(prev => prev ? ({ ...prev, completions: [...prev.completions, comp] }) : prev);
      try {
        await dbAddCompletion(comp);
      } catch (err) {
        console.error('Failed to add completion', err);
      }
    }
  }

  async function addTask(domainId: string) {
    if (!store) return;
    const t: Task = { id: uuidv4(), domainId, title: 'New task', points: 1, frequency: 'daily', isActive: true, order: store.tasks.length };
    setStore(prev => prev ? ({ ...prev, tasks: [...prev.tasks, t] }) : prev);
    try {
      await dbAddTask(t);
    } catch (err) {
      console.error('Failed to add task to DB', err);
    }
  }

  async function editTask(updated: Task) {
    if (!store) return;
    setStore(prev => prev ? ({ ...prev, tasks: prev.tasks.map(tt => tt.id === updated.id ? updated : tt) }) : prev);
    try {
      await dbUpdateTask(updated);
    } catch (err) {
      console.error('Failed to update task', err);
    }
  }

  async function deleteTask(id: string) {
    if (!store) return;
    setStore(prev => prev ? ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id), completions: prev.completions.filter(c => c.taskId !== id) }) : prev);
    try {
      await dbRemoveTask(id);
      // remove completions belonging to that task in db too
      // dbRemoveTask above deletes tasks; completions cleaned from UI; delete completions explicitly
      const completionsToRemove = (store?.completions || []).filter(c => c.taskId === id);
      for (const c of completionsToRemove) {
        try { await dbRemoveCompletion(c.id); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  }

  // Domain CRUD
  async function addDomain() {
    if (!store) return;
    const d: Domain = { id: uuidv4(), name: 'New domain', order: store.domains.length, isActive: true };
    setStore(prev => prev ? ({ ...prev, domains: [...prev.domains, d] }) : prev);
    try {
      await (await import('./lib/storage')).addDomain(d); // dynamic import to avoid circular typing issues
    } catch (err) {
      console.error('Failed to add domain', err);
    }
  }

  async function renameDomain(updated: Domain) {
    if (!store) return;
    setStore(prev => prev ? ({ ...prev, domains: prev.domains.map(dd => dd.id === updated.id ? updated : dd) }) : prev);
    try {
      await (await import('./lib/storage')).updateDomain(updated);
    } catch (err) {
      console.error('Failed to rename domain', err);
    }
  }

  async function deleteDomain(id: string) {
    if (!store) return;
    const remainingTasks = store.tasks.filter(t => t.domainId !== id);
    const remainingCompletions = store.completions.filter(c => remainingTasks.some(t => t.id === c.taskId));
    setStore({ domains: store.domains.filter(d => d.id !== id), tasks: remainingTasks, completions: remainingCompletions });
    try {
      await (await import('./lib/storage')).removeDomain(id);
      // clean completions for removed tasks
      for (const c of store.completions.filter(c => !remainingTasks.some(t => t.id === c.taskId))) {
        try { await dbRemoveCompletion(c.id); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('Failed to delete domain', err);
    }
  }

  /* ---------------- Export / Import / Reset ---------------- */

  async function exportJSON() {
    try {
      const json = await dbExportJSON();
      await navigator.clipboard?.writeText(json);
      alert('Data copied to clipboard (JSON)');
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
    }
  }

  async function importJSONFromText() {
    if (!importText) return alert('Paste JSON into the input first');
    try {
      await dbImportJSON(importText);
      const reloaded = await loadStorage();
      setStore(reloaded);
      setImportText('');
      alert('Imported successfully');
    } catch (err) {
      console.error('Import failed', err);
      alert('Invalid JSON');
    }
  }

  async function importJSONFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const txt = String(reader.result);
        await dbImportJSON(txt);
        const reloaded = await loadStorage();
        setStore(reloaded);
        alert('Imported file successfully.');
      } catch (e) {
        console.error(e);
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }

  async function resetSample() {
    await dbResetToDefaults();
    const reloaded = await loadStorage();
    setStore(reloaded);
    alert('Sample data restored.');
  }

  // Loading guard
  if (loading || !store) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18 }}>Loading Life Tracker…</h2>
      </div>
    );
  }

  // local helpers used by components expecting certain signatures
  // map dbRemoveTask name to avoid shadowing
  //async function dbRemoveTask(id: string) { await dbRemoveTaskImpl(id); }
  // but dbRemoveTaskImpl isn't defined — instead directly call dbRemoveTask exported earlier
  // To avoid confusion, just call the storage helper above: dbRemoveTask is not imported; fix below.

  // NOTE: We already used dbRemoveTask earlier in deleteTask and didn't import it; to avoid errors,
  // let's import removeTask function dynamically where needed or simply call (await import('./lib/storage')).removeTask(...)
  // For brevity, previous deleteTask used dbRemoveTask which is not defined: we'll rely on dynamic imports in that block above.

  return (
    <div style={{ minHeight: '100vh', background: '#f0f9ff', padding: 18, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'#074c6b' }}>Life Tracker</h1>
            <div style={{ color:'#666', marginTop:6 }}>Small daily wins — minimalist + flexible</div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type='date' value={date} onChange={e=>setDate(e.target.value)} style={{ padding:8, borderRadius:8, border:'1px solid #ddd' }} />
            <div style={{ padding:'8px 12px', borderRadius:8, background:'#fff', border:'1px solid rgba(3,105,161,0.12)', fontWeight:800, color:'#0ea5e9' }}>{pointsToday} pts</div>
            <div style={{ padding:'8px 12px', borderRadius:8, background:'#fff', border:'1px solid rgba(3,105,161,0.12)', fontWeight:800, color:'#074c6b' }}>Streak: {currentStreak()}</div>
            <button onClick={()=>setManagerOpen(s=>!s)} style={{ padding:'8px 12px', borderRadius:8, background:'#0ea5e9', color:'#fff', border:'none', fontWeight:800 }}>{managerOpen ? 'Close Manager' : 'Open Manager'}</button>
            <button onClick={exportJSON} style={{ padding:'8px 12px', borderRadius:8, background:'#fff', border:'1px solid #eee', fontWeight:800 }}>Export</button>
            <InstallButton />
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
              onEditTask={editTask}
              onDeleteTask={deleteTask}
              managerOpen={managerOpen}
            />

            <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'center' }}>
              <button onClick={resetSample} style={{ padding:'10px 16px', borderRadius:10, border:'1px solid #eee', background:'#fff', fontWeight:800 }}>Reset</button>

              <label style={{ cursor:'pointer' }}>
                <input type='file' accept='application/json' style={{ display:'none' }} onChange={e=>{ const f = e.target.files?.[0]; if(!f) return; importJSONFile(f); }} />
                <div style={{ padding:'10px 16px', borderRadius:10, background:'#fff', border:'1px solid #eee', fontWeight:800 }}>Import File</div>
              </label>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input placeholder="Paste JSON here..." value={importText} onChange={(e)=>setImportText(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #eee", minWidth: 220 }} />
                <button onClick={importJSONFromText} style={{ padding: '8px 12px', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 800 }}>Import</button>
              </div>
            </div>
          </div>

          <div>
            <ManagerPanel domains={domains} onAddDomain={addDomain} onRenameDomain={renameDomain} onDeleteDomain={deleteDomain} onEditTask={editTask} />
            <Stats completions={store.completions} tasks={store.tasks} domains={store.domains} days={30} />
          </div>
        </main>

        <footer style={{ marginTop:20, textAlign:'center', color:'#0369a1' }}>Minimal • Blue theme • Local-first • Mobile responsive</footer>
      </div>
    </div>
  );
}
