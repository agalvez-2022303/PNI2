/**
 * Almacenamiento de corridas y datos de validación en IndexedDB (FASE 0.3).
 *
 * Sustituye al localStorage. Sólo se guardan CORRIDAS (entradas + resultados
 * resumidos) y datos de validación: nunca materiales ni geometría, que viven
 * congelados en el modelo de referencia.
 *
 * Exportar/importar en JSON para poder mover corridas entre equipos.
 */

const DB_NAME = 'piezolab';
const DB_VERSION = 1;
const STORE_RUNS = 'runs';
const STORE_VALIDATION = 'validation';

export interface StoredRun {
  id?: number;
  kind: 'tile' | 'beam';
  createdAt: string;
  inputs: Record<string, number>;
  /** Resumen numérico de la corrida, sin las trazas pesadas. */
  summary: Record<string, number>;
}

export interface StoredValidation {
  id?: number;
  name: string;
  createdAt: string;
  payload: unknown;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RUNS)) {
        db.createObjectStore(STORE_RUNS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_VALIDATION)) {
        db.createObjectStore(STORE_VALIDATION, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** Guarda una corrida. Devuelve el id asignado. */
export async function saveRun(run: Omit<StoredRun, 'id'>): Promise<number> {
  const id = await tx<IDBValidKey>(STORE_RUNS, 'readwrite', (s) => s.add(run));
  return Number(id);
}

/** Lista todas las corridas, de la más reciente a la más antigua. */
export async function listRuns(): Promise<StoredRun[]> {
  const all = await tx<StoredRun[]>(STORE_RUNS, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Borra una corrida por id. */
export async function deleteRun(id: number): Promise<void> {
  await tx(STORE_RUNS, 'readwrite', (s) => s.delete(id));
}

/** Borra todas las corridas. */
export async function clearRuns(): Promise<void> {
  await tx(STORE_RUNS, 'readwrite', (s) => s.clear());
}

/** Guarda un registro de validación (referencia contra modelo). */
export async function saveValidation(v: Omit<StoredValidation, 'id'>): Promise<number> {
  const id = await tx<IDBValidKey>(STORE_VALIDATION, 'readwrite', (s) => s.add(v));
  return Number(id);
}

export async function listValidation(): Promise<StoredValidation[]> {
  const all = await tx<StoredValidation[]>(STORE_VALIDATION, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------------------------------------------ */
/* Exportar / importar JSON                                            */
/* ------------------------------------------------------------------ */

export interface RunArchive {
  format: 'piezolab-runs';
  version: 1;
  exportedAt: string;
  runs: StoredRun[];
  validation: StoredValidation[];
}

/** Serializa todas las corridas y validaciones a un objeto JSON portable. */
export async function exportArchive(): Promise<RunArchive> {
  return {
    format: 'piezolab-runs',
    version: 1,
    exportedAt: new Date().toISOString(),
    runs: await listRuns(),
    validation: await listValidation(),
  };
}

/** Descarga el archivo JSON de corridas. */
export async function downloadArchive(filename = 'piezolab_corridas.json'): Promise<void> {
  const data = await exportArchive();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Importa un archivo JSON de corridas. Valida el formato y devuelve cuántas
 * entradas se recuperaron.
 */
export async function importArchive(text: string): Promise<{ runs: number; validation: number }> {
  const data = JSON.parse(text) as Partial<RunArchive>;
  if (data.format !== 'piezolab-runs') {
    throw new Error('El archivo no es un archivo de corridas de PiezoLab');
  }
  let runs = 0;
  let validation = 0;
  for (const r of data.runs ?? []) {
    const { id: _ignored, ...rest } = r;
    await saveRun(rest);
    runs++;
  }
  for (const v of data.validation ?? []) {
    const { id: _ignored, ...rest } = v;
    await saveValidation(rest);
    validation++;
  }
  return { runs, validation };
}
