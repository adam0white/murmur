/** Complete source custody uses IndexedDB; localStorage keeps only a verifiable receipt. */
import { type CompactNotebook, expandNotebook, type Notebook } from './notebook.ts';

const DB = 'murmur-source-archives';
const STORE = 'full-sources';
export interface SourceArchiveReceipt {
  format: 'murmur-source-archive-ref/1';
  revision: string;
  sha256: string;
  bytes: number;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'revision' });
    request.onerror = () => reject(request.error ?? new Error('Source archive storage could not open.'));
    request.onblocked = () => reject(new Error('Another page is blocking source archive storage.'));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function storeSourceArchive(
  revision: string,
  notebook: CompactNotebook,
): Promise<SourceArchiveReceipt> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('The complete source archive could not be saved.'));
      tx.onabort = () => reject(tx.error ?? new Error('The complete source archive save was interrupted.'));
      tx.objectStore(STORE).put({ revision, notebook });
    });
  } finally {
    db.close();
  }
  return { format: 'murmur-source-archive-ref/1', revision, sha256: notebook.sha256, bytes: notebook.bytes };
}
export async function readSourceArchive(receipt: SourceArchiveReceipt): Promise<Notebook> {
  if (receipt.format !== 'murmur-source-archive-ref/1') throw new Error('Unknown source archive receipt.');
  const db = await open();
  let row: { revision: string; notebook: CompactNotebook } | undefined;
  try {
    row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(receipt.revision);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('The complete source archive could not be read.'));
    });
  } finally {
    db.close();
  }
  if (
    !row ||
    row.revision !== receipt.revision ||
    row.notebook.sha256 !== receipt.sha256 ||
    row.notebook.bytes !== receipt.bytes
  )
    throw new Error('The source archive does not match its saved receipt.');
  return expandNotebook(row.notebook);
}
