import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const WORKSPACE_PATH = ['workspaces', 'ts-construction-shared'];
const MAX_WORKSPACE_BYTES = 900 * 1024;

function toWorkspace(snapshot) {
  if (!snapshot.exists()) return { initialized: false, revision: 0, data: null };
  const value = snapshot.data();
  return {
    initialized: true,
    revision: Number(value.revision) || 0,
    data: value.payload || { sites: [] },
    updatedAt: value.updatedAt?.toDate?.().toISOString() || null,
  };
}

function cleanWorkspace(data) {
  if (!Array.isArray(data?.sites)) throw new Error('공유 자료에서 현장 목록을 찾지 못했습니다.');
  const payload = {
    sites: data.sites.map(({ pdfFiles, ...site }) => ({
      ...site,
      phases: Array.isArray(site.phases) ? site.phases : [],
      tasks: Array.isArray(site.tasks) ? site.tasks : [],
      equipment: Array.isArray(site.equipment) ? site.equipment.filter(item => !item?._draft) : [],
      specs: Array.isArray(site.specs) ? site.specs : [],
    })),
  };
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (size > MAX_WORKSPACE_BYTES) {
    throw new Error('현재 Firestore 저장 방식은 자료가 약 900KB를 넘으면 저장할 수 없습니다. 현장별 문서 구조로 분리해야 합니다.');
  }
  return payload;
}

export function initializeFirebase(config) {
  if (!config?.projectId || !config?.apiKey) throw new Error('Firebase 설정을 확인해 주세요.');
  const app = initializeApp(config);
  const db = getFirestore(app);
  const workspaceRef = doc(db, ...WORKSPACE_PATH);

  window.firebaseCloud = {
    async read() {
      return toWorkspace(await getDoc(workspaceRef));
    },
    async write(expectedRevision, data) {
      const payload = cleanWorkspace(data);
      return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(workspaceRef);
        const current = toWorkspace(snapshot);
        if (current.revision !== Number(expectedRevision)) {
          return { ok: false, status: 409, data: { error: 'revision_conflict', ...current } };
        }
        const revision = current.revision + 1;
        transaction.set(workspaceRef, { revision, payload, updatedAt: serverTimestamp() });
        return { ok: true, status: 200, data: { initialized: true, revision, data: payload, updatedAt: null } };
      });
    },
    subscribe(onChange, onError) {
      return onSnapshot(workspaceRef, snapshot => onChange(toWorkspace(snapshot)), onError);
    },
  };
}
