// Helper IndexedDB untuk outbox transaksi offline.
// DB: "pos-outbox", store: "outbox", keyPath: "idempotency_key"

export type OutboxTx = {
  idempotency_key: string;
  items: { produk_id: number; qty: number; nama: string; harga: number }[];
  bayar: number;
  kasir: string;
  client_created_at: string;
};

const DB_NAME = "pos-outbox";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "idempotency_key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const r = fn(store);
      let value: T | undefined;
      if (r instanceof IDBRequest) {
        r.onsuccess = () => {
          value = r.result as T;
        };
        r.onerror = () => reject(r.error);
      } else {
        r.then((v) => (value = v), reject);
      }
      tx.oncomplete = () => resolve(value as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const outbox = {
  async add(tx: OutboxTx): Promise<void> {
    await withStore<void>("readwrite", (s) => {
      const req = s.add(tx);
      return new Promise<void>((res, rej) => {
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
    });
  },
  async all(): Promise<OutboxTx[]> {
    const db = await openDb();
    try {
      return await new Promise<OutboxTx[]>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as OutboxTx[]);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  },
  async remove(key: string): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
  async count(): Promise<number> {
    const db = await openDb();
    try {
      return await new Promise<number>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  },
  async clear(): Promise<void> {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  },
};
