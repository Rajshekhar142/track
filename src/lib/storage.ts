// src/lib/storage.ts
import Dexie, { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export type Domain = { id: string; name: string; order: number; isActive: boolean };
export type Frequency = 'daily' | 'weekly' | 'one_time';
export type Task = { id: string; domainId: string; title: string; points: number; frequency: Frequency; isActive: boolean; order: number };
export type TaskCompletion = { id: string; taskId: string; date: string; completedAt: string; pointsEarned: number };

export type StorageShape = { domains: Domain[]; tasks: Task[]; completions: TaskCompletion[] };

const DB_NAME = 'life_tracker_db_v1';

class LifeTrackerDB extends Dexie {
  domains!: Table<Domain, string>;
  tasks!: Table<Task, string>;
  completions!: Table<TaskCompletion, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      domains: 'id, order',
      tasks: 'id, domainId, order',
      completions: 'id, taskId, date'
    });
  }
}

const db = new LifeTrackerDB();

export function defaultData(): StorageShape {
  return {
    domains: [
      { id: 'physical', name: 'Physical', order: 0, isActive: true },
      { id: 'financial', name: 'Financial', order: 1, isActive: true },
      { id: 'social', name: 'Social', order: 2, isActive: true },
      { id: 'spiritual', name: 'Spiritual', order: 3, isActive: true },
    ],
    tasks: [
      { id: uuidv4(), domainId: 'physical', title: 'Open app', points: 1, frequency: 'daily', isActive: true, order: 0 },
      { id: uuidv4(), domainId: 'physical', title: '3 exercises', points: 2, frequency: 'daily', isActive: true, order: 1 },
    ],
    completions: []
  };
}

/**
 * ensureSeeded
 * - Seeds DB the first time.
 * - Uses bulkPut to avoid BulkError if keys already exist.
 * - Safe to call multiple times.
 */
export async function ensureSeeded() {
  try {
    const count = await db.domains.count();
    if (count === 0) {
      const d = defaultData();
      await db.transaction('rw', db.domains, db.tasks, db.completions, async () => {
        // bulkPut does upsert (safe if something partially exists)
        await db.domains.bulkPut(d.domains);
        await db.tasks.bulkPut(d.tasks);
        await db.completions.bulkPut(d.completions);
      });
    }
  } catch (err) {
    console.warn('ensureSeeded failed, attempting fallback seeding', err);
    // fallback non-transactional safer put
    try {
      const d = defaultData();
      for (const dom of d.domains) await db.domains.put(dom);
      for (const t of d.tasks) await db.tasks.put(t);
      for (const c of d.completions) await db.completions.put(c);
    } catch (e) {
      console.error('fallback seeding failed', e);
    }
  }
}

// Load full storage (domains, tasks, completions)
export async function loadStorage(): Promise<StorageShape> {
  await ensureSeeded();
  const [domains, tasks, completions] = await Promise.all([
    db.domains.orderBy('order').toArray(),
    db.tasks.orderBy('order').toArray(),
    db.completions.toArray()
  ]);
  return { domains, tasks, completions };
}

// Save full shape (overwrites)
export async function saveStorage(shape: StorageShape) {
  await db.transaction('rw', db.domains, db.tasks, db.completions, async () => {
    await db.domains.clear();
    await db.tasks.clear();
    await db.completions.clear();
    if (shape.domains?.length) await db.domains.bulkPut(shape.domains);
    if (shape.tasks?.length) await db.tasks.bulkPut(shape.tasks);
    if (shape.completions?.length) await db.completions.bulkPut(shape.completions);
  });
}

// CRUD helpers
export const addDomain = async (domain: Domain) => db.domains.put(domain);
export const updateDomain = async (domain: Domain) => db.domains.put(domain);
export const removeDomain = async (id: string) => db.domains.delete(id);

export const addTask = async (task: Task) => db.tasks.put(task);
export const updateTask = async (task: Task) => db.tasks.put(task);
export const removeTask = async (id: string) => db.tasks.delete(id);

export const addCompletion = async (c: TaskCompletion) => db.completions.put(c);
export const removeCompletion = async (id: string) => db.completions.delete(id);

// export/import helpers
export async function exportJSON(): Promise<string> {
  const shape = await loadStorage();
  return JSON.stringify(shape, null, 2);
}
export async function importJSON(text: string) {
  const parsed = JSON.parse(text) as StorageShape;
  if (!Array.isArray(parsed.domains) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.completions)) {
    throw new Error('Invalid JSON shape');
  }
  await saveStorage(parsed);
}

export async function resetToDefaults() {
  await saveStorage(defaultData());
}
