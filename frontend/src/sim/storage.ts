/**
 * Almacenamiento LOCAL de la aplicación, sin backend ni base de datos externa:
 * IndexedDB envuelto en una capa limpia (`get`, `set`, `exportJSON`,
 * `importJSON`, `resetToFactory`) más el archivo de corridas.
 *
 * Se guardan CORRIDAS (entradas + resultados resumidos), datos de validación y
 * CONFIGURACIÓN DE INTERFAZ (vistas, factor CAD, peso, flujo): nunca materiales
 * ni geometría, que viven congelados en el modelo de referencia.
 */

const DB_NAME = 'piezolab';
const DB_VERSION = 3;
const STORE_RUNS = 'runs';
const STORE_VALIDATION = 'validation';
const STORE_SETTINGS = 'settings';

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

const STORES = [STORE_RUNS, STORE_VALIDATION, STORE_SETTINGS];

function hasAllStores(db: IDBDatabase): boolean {
  return STORES.every((s) => db.objectStoreNames.contains(s));
}

/** Crea los stores que falten. Idempotente: sólo toca los ausentes. */
function createMissingStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_RUNS)) {
    db.createObjectStore(STORE_RUNS, { keyPath: 'id', autoIncrement: true });
  }
  if (!db.objectStoreNames.contains(STORE_VALIDATION)) {
    db.createObjectStore(STORE_VALIDATION, { keyPath: 'id', autoIncrement: true });
  }
  if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
    db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
  }
}

function openWith(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => createMissingStores(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Abre sin fijar versión: sirve cuando existe una BD de otra app con un
 *  número de versión mayor que el nuestro (fallaría `VersionError`). */
function openLatest(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Abre la BD y GARANTIZA los tres stores. Si el navegador conserva una BD de
 * una versión anterior de la app con el mismo número de versión (caso real:
 * `piezolab` v2 sin `settings`), `onupgradeneeded` nunca corre y la transacción
 * falla con "object store not found". Aquí se detecta y se sube de versión una
 * unidad hasta que el esquema coincida. Los datos existentes se preservan.
 */
function ensureDB(): Promise<IDBDatabase> {
  return openWith(DB_VERSION)
    .catch(() => openLatest())
    .then(async (db) => {
      if (hasAllStores(db)) return db;
      db.close();
      let v = db.version + 1;
      // Reintentos limitados: cubre BDs huérfanas con versiones arbitrarias.
      for (let i = 0; i < 10; i++, v++) {
        const next = await openWith(v);
        if (hasAllStores(next)) return next;
        next.close();
      }
      throw new Error('No se pudo sanear la base local (IndexedDB)');
    });
}

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = ensureDB().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
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
    await saveValidation(r2(v));
    validation++;
  }
  return { runs, validation };
}

/** Quita el id autoincremental para poder reinserir una entrada importada. */
function r2<T extends { id?: number }>(x: T): Omit<T, 'id'> {
  const { id: _ignored, ...rest } = x;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Configuración local (preferencias de interfaz, no físicas)          */
/* ------------------------------------------------------------------ */

/**
 * Preferencias de la interfaz que SÍ puede tocar el usuario y que sobreviven
 * entre sesiones: vista activa, factor de explosión, sección, visibilidad de
 * cotas y globos. NO incluye materiales ni geometría (bloqueados).
 */
export interface UIPrefs {
  view?: string;
  explodeFactor?: number;
  section?: number;
  dims?: boolean;
  balloons?: boolean;
  cadence?: number;
  /** Flujo de tránsito [personas/hora] para la extrapolación diaria. */
  flowPerHour?: number;
}

const SETTINGS_KEY = 'ui';
const FACTORY_PREFS: UIPrefs = { view: 'perspective', explodeFactor: 0, section: 0, dims: false, balloons: false, cadence: 100, flowPerHour: 100 };

/**
 * Lee la configuración local; `undefined` si aún no hay nada guardado.
 * Migra el viejo default `0.35` (módio desplegado al arrancar): ahora la
 * pieza sólo se despliega cuando el usuario pulsa «desplegar».
 */
export async function get(): Promise<UIPrefs> {
  try {
    const rec = await tx<SettingsRecord | undefined>(STORE_SETTINGS, 'readonly', (s) => s.get(SETTINGS_KEY));
    const merged = { ...FACTORY_PREFS, ...(rec?.value ?? {}) };
    if (merged.explodeFactor === 0.35) merged.explodeFactor = 0;
    return merged;
  } catch {
    return { ...FACTORY_PREFS };
  }
}

/** Escribe la configuración local (parcial: se fusiona con la existente). */
export async function set(prefs: UIPrefs): Promise<void> {
  const cur = await get();
  await tx(STORE_SETTINGS, 'readwrite', (s) => s.put({ key: SETTINGS_KEY, value: { ...cur, ...prefs } }));
}

interface SettingsRecord {
  key: string;
  value: UIPrefs;
}

/** Descarga toda la config local (preferencias + corridas + validaciones). */
export async function exportJSON(filename = 'piezolab_config.json'): Promise<void> {
  const prefs = await get();
  const runs = await listRuns();
  const validation = await listValidation();
  const blob = new Blob([JSON.stringify({ format: 'piezolab-config', version: 2, exportedAt: new Date().toISOString(), prefs, runs, validation }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Importa una config descargada. Devuelve un resumen de lo recuperado. */
export async function importJSON(text: string): Promise<{ prefs: boolean; runs: number; validation: number }> {
  const data = JSON.parse(text) as {
    format?: string;
    prefs?: UIPrefs;
    runs?: StoredRun[];
    validation?: StoredValidation[];
  };
  if (data.format !== 'piezolab-config') throw new Error('No es una configuración de PiezoLab');
  let ok = false;
  if (data.prefs) {
    await tx(STORE_SETTINGS, 'readwrite', (s) => s.put({ key: SETTINGS_KEY, value: data.prefs }));
    ok = true;
  }
  let runs = 0;
  let validation = 0;
  for (const r of data.runs ?? []) {
    await saveRun(r2(r));
    runs++;
  }
  for (const v of data.validation ?? []) {
    await saveValidation(r2(v));
    validation++;
  }
  return { prefs: ok, runs, validation };
}

/** Devuelve las preferencias de interfaz a su estado de fábrica. */
export async function resetToFactory(): Promise<UIPrefs> {
  await tx(STORE_SETTINGS, 'readwrite', (s) => s.delete(SETTINGS_KEY));
  return { ...FACTORY_PREFS };
}
