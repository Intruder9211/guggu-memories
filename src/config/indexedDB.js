const DB_NAME = "guggu_memories_db";
const DB_VERSION = 1;
const STORE_NAME = "memories_store";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Saves a memory and its binary file payload to IndexedDB.
 */
export async function saveMemoryLocal(memory, file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // Strip the object URL if present before saving to DB
    const cleanMemory = { ...memory };
    if (cleanMemory.url && cleanMemory.url.startsWith("blob:")) {
      delete cleanMemory.url;
    }

    const record = {
      ...cleanMemory,
      fileData: file,
      createdAt: cleanMemory.createdAt || new Date().toISOString()
    };
    
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Updates an existing memory metadata in IndexedDB without losing binary file payload.
 */
export async function updateMemoryLocal(id, updatedFields) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        reject(new Error(`Record with ID ${id} not found in IndexedDB`));
        return;
      }
      
      // Merge updated metadata fields
      const updatedRecord = {
        ...record,
        ...updatedFields
      };
      
      // Strip dynamic object URL if it leaked in
      if (updatedRecord.url && updatedRecord.url.startsWith("blob:")) {
        delete updatedRecord.url;
      }

      const putRequest = store.put(updatedRecord);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = (e) => reject(e.target.error);
    };
    getRequest.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retrieves all stored memories from IndexedDB, re-generating Object URLs for images.
 */
export async function getMemoriesLocal() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = (e) => {
      const results = e.target.result || [];
      const memories = results.map(item => {
        if (item.fileData) {
          const url = URL.createObjectURL(item.fileData);
          return { ...item, url };
        }
        return item;
      });
      resolve(memories);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Deletes a memory and its local file from IndexedDB.
 */
export async function deleteMemoryLocal(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record && record.url) {
        try {
          URL.revokeObjectURL(record.url);
        } catch (err) {
          console.warn("Could not revoke object URL during delete:", err);
        }
      }
      
      const deleteRequest = store.delete(id);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = (e) => reject(e.target.error);
    };
    getRequest.onerror = (e) => reject(e.target.error);
  });
}
