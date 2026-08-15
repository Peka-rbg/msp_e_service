/* =====================================================
   MSP e-SERVICES – IndexedDB Database Layer
   Stores applications + binary files (images / PDFs)
   ===================================================== */

const DB_NAME = "MSP_eServices_DB";
const DB_VERSION = 1;
const STORE_APPS = "applications";
const STORE_FILES = "files";

let dbInstance = null;

function openDB() {
  return new Promise(function (resolve, reject) {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      // Applications store
      if (!db.objectStoreNames.contains(STORE_APPS)) {
        const appStore = db.createObjectStore(STORE_APPS, { keyPath: "application_id" });
        appStore.createIndex("status", "status", { unique: false });
        appStore.createIndex("full_name", "full_name", { unique: false });
        appStore.createIndex("phone_number", "phone_number", { unique: false });
        appStore.createIndex("otr_number", "otr_number", { unique: false });
        appStore.createIndex("created_at", "created_at", { unique: false });
      }

      // Files store – stores actual binary Blobs
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        const fileStore = db.createObjectStore(STORE_FILES, { keyPath: "id" });
        fileStore.createIndex("application_id", "application_id", { unique: false });
      }
    };

    request.onsuccess = function (event) {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = function (event) {
      console.error("IndexedDB open error:", event.target.error);
      reject(event.target.error);
    };
  });
}

/* ---------- Counter for Application IDs ---------- */
async function getNextApplicationId() {
  const apps = await getAllApplications();
  let max = 0;
  apps.forEach(function (a) {
    const match = (a.application_id || "").match(/MSP-SCH-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  });
  const next = max + 1;
  return "MSP-SCH-" + String(next).padStart(6, "0");
}

/* ---------- Applications ---------- */
async function saveApplication(application) {
  const db = await openDB();
  return new Promise(function (resolve, reject) {
    const tx = db.transaction(STORE_APPS, "readwrite");
    const store = tx.objectStore(STORE_APPS);
    const request = store.put(application);

    request.onsuccess = function () { resolve(application); };
    request.onerror = function (e) { reject(e.target.error); };
  });
}

async function getApplication(applicationId) {
  const db = await openDB();
  return new Promise(function (resolve, reject) {
    const tx = db.transaction(STORE_APPS, "readonly");
    const store = tx.objectStore(STORE_APPS);
    const request = store.get(applicationId);

    request.onsuccess = function () { resolve(request.result || null); };
    request.onerror = function (e) { reject(e.target.error); };
  });
}

async function getAllApplications() {
  const db = await openDB();
  return new Promise(function (resolve, reject) {
    const tx = db.transaction(STORE_APPS, "readonly");
    const store = tx.objectStore(STORE_APPS);
    const request = store.getAll();

    request.onsuccess = function () {
      const results = request.result || [];
      // Sort newest first
      results.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      resolve(results);
    };
    request.onerror = function (e) { reject(e.target.error); };
  });
}

async function updateApplicationStatus(applicationId, status, adminNote) {
  const app = await getApplication(applicationId);
  if (!app) throw new Error("Application not found");

  app.status = status;
  app.admin_note = adminNote || "";
  app.updated_at = new Date().toISOString();

  return saveApplication(app);
}

/* ---------- Files (Blobs) ---------- */
async function saveFile(applicationId, docKey, fileMeta, blob) {
  const db = await openDB();
  const id = applicationId + "::" + docKey;

  return new Promise(function (resolve, reject) {
    const tx = db.transaction(STORE_FILES, "readwrite");
    const store = tx.objectStore(STORE_FILES);

    const record = {
      id: id,
      application_id: applicationId,
      doc_key: docKey,
      label: fileMeta.label,
      name: fileMeta.name,
      type: fileMeta.type,
      size: fileMeta.size,
      blob: blob,          // actual binary data
      created_at: new Date().toISOString()
    };

    const request = store.put(record);
    request.onsuccess = function () { resolve(record); };
    request.onerror = function (e) { reject(e.target.error); };
  });
}

async function getFilesForApplication(applicationId) {
  const db = await openDB();
  return new Promise(function (resolve, reject) {
    const tx = db.transaction(STORE_FILES, "readonly");
    const store = tx.objectStore(STORE_FILES);
    const index = store.index("application_id");
    const request = index.getAll(applicationId);

    request.onsuccess = function () { resolve(request.result || []); };
    request.onerror = function (e) { reject(e.target.error); };
  });
}

async function getFile(applicationId, docKey) {
  const db = await openDB();
  const id = applicationId + "::" + docKey;

  return new Promise(function (resolve, reject) {
    const tx = db.transaction(STORE_FILES, "readonly");
    const store = tx.objectStore(STORE_FILES);
    const request = store.get(id);

    request.onsuccess = function () { resolve(request.result || null); };
    request.onerror = function (e) { reject(e.target.error); };
  });
}

/* ---------- High-level submit helper ---------- */
async function submitScholarshipApplication(formData, uploadedFilesMap) {
  const applicationId = await getNextApplicationId();
  const now = new Date().toISOString();

  // Save each file as a Blob in the files store
  const documentMeta = {};
  const docKeys = Object.keys(uploadedFilesMap);

  for (let i = 0; i < docKeys.length; i++) {
    const key = docKeys[i];
    const f = uploadedFilesMap[key];
    if (!f || !f.blob) continue;

    await saveFile(applicationId, key, {
      label: f.label,
      name: f.name,
      type: f.type,
      size: f.size
    }, f.blob);

    documentMeta[key] = {
      label: f.label,
      name: f.name,
      type: f.type,
      size: f.size
    };
  }

  const application = {
    application_id: applicationId,
    full_name: formData.fullName,
    phone_number: formData.phone,
    present_course: formData.course,
    class_start_date: formData.startDate,
    roll_number: formData.rollNumber,
    section: formData.section || "",
    otr_number: formData.otrNumber,
    status: "Submitted",
    admin_note: "",
    documents: documentMeta,   // metadata only – binary is in files store
    created_at: now,
    updated_at: now
  };

  await saveApplication(application);
  return application;
}

/* ---------- Compatibility helpers (used by older code) ---------- */
function getApplications() {
  // Synchronous fallback is no longer possible; callers should use async version
  console.warn("getApplications() is deprecated – use getAllApplications() async");
  return [];
}

function saveApplications() {
  console.warn("saveApplications() is deprecated");
}

function generateApplicationId() {
  console.warn("generateApplicationId() is deprecated – use getNextApplicationId()");
  return "MSP-SCH-000000";
}