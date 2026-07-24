import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const FIRESTORE_DATABASE_ID = "default";

let realDb: any = null;

export function getDb(): any {
  if (realDb) return realDb;

  const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
  if (!firebaseConfigEnv) {
    throw new Error("FIREBASE_CONFIG environment variable is required. Local fallback is disabled.");
  }

  try {
    if (getApps().length === 0) {
      let credentials: any;
      if (firebaseConfigEnv.trim().startsWith("{")) {
        credentials = JSON.parse(firebaseConfigEnv);
      } else {
        throw new Error("FIREBASE_CONFIG is not a valid JSON string.");
      }

      if (credentials.private_key || credentials.client_email) {
        initializeApp({
          credential: cert(credentials),
        });
      } else {
        initializeApp({
          projectId: credentials.projectId || 'lainies-sweet-treats',
        });
      }
    }

    realDb = getFirestore(getApp());
    // Firestore rejects `undefined` values in nested fields (e.g. optional order item
    // properties like variationId on non-variation products). Since the app relies on
    // undefined-to-omit optional fields throughout, tell the SDK to strip them instead
    // of throwing on every write that includes one.
    realDb.settings({ ignoreUndefinedProperties: true });
    return realDb;
  } catch (error: any) {
    console.error("Firebase Admin initialization failed:", error);
    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

export const dbService = {
  isFirebaseConnected() {
    return !!process.env.FIREBASE_CONFIG;
  },

  async list(collectionName: string): Promise<any[]> {
    const db = getDb();
    const snap = await db.collection(collectionName).get();
    return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  },

  async get(collectionName: string, id: string): Promise<any | null> {
    const db = getDb();
    const doc = await db.collection(collectionName).doc(id).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },

  async insert(collectionName: string, data: any): Promise<any> {
    const db = getDb();
    const id = data.id || `${collectionName.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const docData = { ...data, id };
    await db.collection(collectionName).doc(id).set(docData);
    return docData;
  },

  async update(collectionName: string, id: string, data: any): Promise<any> {
    const db = getDb();
    await db.collection(collectionName).doc(id).update(data);
    const doc = await db.collection(collectionName).doc(id).get();
    return { id, ...doc.data() };
  },

  async delete(collectionName: string, id: string): Promise<boolean> {
    const db = getDb();
    await db.collection(collectionName).doc(id).delete();
    return true;
  },

  async getSettings(): Promise<any> {
    const db = getDb();
    const doc = await db.collection("settings").doc("business").get();
    if (doc.exists) {
      return doc.data();
    }
    return {
      businessName: "Lainie's Sweet Treats",
      phone: "214-555-CAKE",
      email: "elainiehoncoop@gmail.com",
      address: "508 Sweetwood Lane, Royse City, TX 75189",
      leadTimeDays: 3,
      deliveryRadius: 15,
      deliveryFeePerMile: 2.00,
      taxRate: 0.0825,
      emailTemplateConfirmation: "Hi {name},\n\nThank you so much for ordering from Lainie's Sweet Treats! We are thrilled to make your sweet celebration perfect. Your order {orderNumber} has been received for {fulfillmentDate} ({type}).\n\nBest,\nLainie"
    };
  },

  async saveSettings(settings: any): Promise<any> {
    const db = getDb();
    await db.collection("settings").doc("business").set(settings);
    return settings;
  }
};
