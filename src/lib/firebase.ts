import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword as realSignInWithEmailAndPassword 
} from "firebase/auth";
import { 
  getFirestore, 
  collection as realCollection, 
  addDoc as realAddDoc, 
  serverTimestamp as realServerTimestamp, 
  doc as realDoc, 
  getDoc as realGetDoc, 
  runTransaction as realRunTransaction, 
  query as realQuery, 
  where as realWhere, 
  getDocs as realGetDocs 
} from "firebase/firestore";

// ==========================================
// CONFIGURACIÓN DE MODO MOCK (BASE DE DATOS LOCAL)
// ==========================================
// Cambia esto a `true` si quieres conectar a una base de datos simulada local.
// Está en `false` para que se conecte a la base de datos real en la nube y se sincronice con tu app móvil.
let USE_MOCK = false;

// ==========================================
// CONFIGURACIÓN DE FIREBASE REAL
// ==========================================
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app: any;
let auth: any;
let db: any;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Error al inicializar Firebase Real, activando modo Mock automáticamente:", error);
  USE_MOCK = true;
}

// ==========================================
// MOCK DE BASE DE DATOS (LOCALSTORAGE)
// ==========================================

// Seed inicial de datos para pruebas offline
function seedDatabase() {
  if (typeof window === 'undefined') return;
  
  const cardsKey = 'tappay_mock_db_cards';
  if (!localStorage.getItem(cardsKey)) {
    const defaultCards = {
      'mock-cashier-uid': {
        name: 'Cajero Principal',
        email: 'cajero@tappay.com',
        role: 'cashier',
        pin: '1234',
        balance: 0
      },
      'client-1': {
        name: 'Juan Pérez',
        email: 'cliente@email.com',
        role: 'client',
        pin: '0000',
        balance: 150
      },
      'client-2': {
        name: 'María Gómez',
        email: 'maria@email.com',
        role: 'client',
        pin: '1111',
        balance: 350
      }
    };
    localStorage.setItem(cardsKey, JSON.stringify(defaultCards));
    console.log("✓ Base de datos simulada inicializada con datos de prueba.");
  }
}

// Inicializar el sembrado de datos si estamos en modo mock
if (USE_MOCK) {
  seedDatabase();
}

// --- Autenticación Mock ---
const listeners: Array<(user: any) => void> = [];

const mockAuth = {
  currentUser: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('tappay_mock_user') || 'null') : null,
  onAuthStateChanged: (callback: (user: any) => void) => {
    listeners.push(callback);
    // Ejecutar callback inmediatamente con el estado actual
    setTimeout(() => {
      callback(mockAuth.currentUser);
    }, 0);
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  },
  notifyListeners: (user: any) => {
    mockAuth.currentUser = user;
    listeners.forEach(cb => cb(user));
  },
  signOut: async () => {
    mockAuth.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tappay_mock_user');
    }
    mockAuth.notifyListeners(null);
  }
};

const mockDb = { _isMock: true };

// --- Funciones Exportadas de Auth ---
export async function signInWithEmailAndPassword(authObj: any, email: string, pass: string) {
  if (!USE_MOCK) {
    return realSignInWithEmailAndPassword(authObj, email, pass);
  }

  // En modo mock, permitimos iniciar sesión a cualquier cajero
  console.log(`[MOCK AUTH] Intentando iniciar sesión para: ${email}`);
  const user = { uid: 'mock-cashier-uid', email: email };
  mockAuth.notifyListeners(user);
  if (typeof window !== 'undefined') {
    localStorage.setItem('tappay_mock_user', JSON.stringify(user));
  }
  return { user };
}

// --- Funciones Exportadas de Firestore Mock ---
export function collection(dbObj: any, path: string) {
  if (!USE_MOCK) return realCollection(dbObj, path);
  return { _type: 'collection', path };
}

export function doc(dbObjOrColl: any, pathOrId?: string, id?: string) {
  if (!USE_MOCK) {
    if (id !== undefined) {
      return realDoc(dbObjOrColl, pathOrId!, id);
    }
    if (pathOrId !== undefined) {
      return realDoc(dbObjOrColl, pathOrId);
    }
    return realDoc(dbObjOrColl);
  }

  let collectionName = '';
  let docId = '';

  if (dbObjOrColl?._type === 'collection') {
    collectionName = dbObjOrColl.path;
    docId = pathOrId || Math.random().toString(36).substring(2, 11);
  } else {
    collectionName = pathOrId || '';
    docId = id || Math.random().toString(36).substring(2, 11);
  }

  return { _type: 'doc', collection: collectionName, id: docId };
}

export async function addDoc(collRef: any, data: any) {
  if (!USE_MOCK) return realAddDoc(collRef, data);

  const collectionName = collRef.path;
  const docId = Math.random().toString(36).substring(2, 11);
  const key = `tappay_mock_db_${collectionName}`;

  if (typeof window !== 'undefined') {
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing[docId] = {
      ...data,
      id: docId,
      fecha_creacion: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(existing));
  }

  console.log(`[MOCK FIRESTORE] Documento añadido a '${collectionName}' con ID: ${docId}`, data);
  return { id: docId };
}

export async function getDoc(docRef: any) {
  if (!USE_MOCK) return realGetDoc(docRef);

  const collectionName = docRef.collection;
  const docId = docRef.id;
  const key = `tappay_mock_db_${collectionName}`;

  let data: any = null;
  if (typeof window !== 'undefined') {
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    data = existing[docId] || null;
  }

  return {
    exists: () => data !== null,
    data: () => data,
    id: docId
  };
}

export function query(collRef: any, ...constraints: any[]) {
  if (!USE_MOCK) return realQuery(collRef, ...constraints);
  return { _type: 'query', collection: collRef.path, constraints };
}

export function where(field: string, operator: any, value: any) {
  if (!USE_MOCK) return realWhere(field, operator, value);
  return { field, operator, value };
}

export async function getDocs(queryObj: any) {
  if (!USE_MOCK) return realGetDocs(queryObj);

  const collectionName = queryObj.collection || queryObj.path;
  const constraints = queryObj.constraints || [];
  const key = `tappay_mock_db_${collectionName}`;

  let results: any[] = [];
  if (typeof window !== 'undefined') {
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    results = Object.keys(existing).map(id => ({ id, ...existing[id] }));
  }

  // Filtrar según restricciones where básica ('==')
  for (const constraint of constraints) {
    if (constraint.operator === '==') {
      results = results.filter(item => item[constraint.field] === constraint.value);
    }
  }

  const docs = results.map(item => ({
    id: item.id,
    data: () => item
  }));

  return {
    empty: docs.length === 0,
    docs: docs
  };
}

export async function runTransaction(dbObj: any, updateFunction: (transaction: any) => Promise<any>) {
  if (!USE_MOCK) return realRunTransaction(dbObj, updateFunction);

  const transactionMock = {
    get: async (docRef: any) => {
      return getDoc(docRef);
    },
    update: (docRef: any, updateData: any) => {
      const collectionName = docRef.collection;
      const docId = docRef.id;
      const key = `tappay_mock_db_${collectionName}`;
      
      if (typeof window !== 'undefined') {
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        if (existing[docId]) {
          existing[docId] = { ...existing[docId], ...updateData };
          localStorage.setItem(key, JSON.stringify(existing));
        }
      }
      console.log(`[MOCK TRANSACTION] Update en ${collectionName}/${docId}:`, updateData);
    },
    set: (docRef: any, setData: any) => {
      const collectionName = docRef.collection;
      const docId = docRef.id;
      const key = `tappay_mock_db_${collectionName}`;
      
      if (typeof window !== 'undefined') {
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        existing[docId] = { ...setData, id: docId };
        localStorage.setItem(key, JSON.stringify(existing));
      }
      console.log(`[MOCK TRANSACTION] Set en ${collectionName}/${docId}:`, setData);
    }
  };

  return updateFunction(transactionMock);
}

export function serverTimestamp() {
  if (!USE_MOCK) return realServerTimestamp();
  return new Date().toISOString();
}

// Asignar condicionalmente auth y db reales o mock
const finalAuth = USE_MOCK ? mockAuth : auth;
const finalDb = USE_MOCK ? mockDb : db;

export { app, finalAuth as auth, finalDb as db };
