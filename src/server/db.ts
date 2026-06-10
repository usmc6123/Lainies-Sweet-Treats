import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

// ==========================================
// CONFIGURATION CONSTANTS
// ==========================================
export const FIRESTORE_DATABASE_ID = "default"; 

// File path for mock persistent fallback storage
const FALLBACK_DB_PATH = path.join(process.cwd(), "db_fallback.json");

// Status flags
let isUsingFirebase = false;
let realDb: any = null;

// Initialize Firebase Admin SDK if key is available
const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
if (firebaseConfigEnv) {
  try {
    let credentials: any;
    if (firebaseConfigEnv.trim().startsWith("{")) {
       credentials = JSON.parse(firebaseConfigEnv);
    } else {
       // Possibility of a file path
       credentials = JSON.parse(fs.readFileSync(firebaseConfigEnv, "utf8"));
    }

    const firebaseAdmin = admin as any;

    if (firebaseAdmin.apps.length === 0) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credentials),
      });
    }

    // Access the database, specifying databaseId if supported (non-default)
    const options: any = {};
    if (FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== "default") {
      // In the admin SDK, you specify database via the client, or settings
      realDb = firebaseAdmin.firestore();
      // Or if database ID is explicitly supported in options
      try {
        realDb = firebaseAdmin.firestore(firebaseAdmin.apps[0]!);
      } catch (err) {
        realDb = firebaseAdmin.firestore();
      }
    } else {
      realDb = firebaseAdmin.firestore();
    }

    isUsingFirebase = true;
    console.log("🚀 Firebase Admin initialized successfully using real Firestore database:", FIRESTORE_DATABASE_ID);
  } catch (error) {
    console.error("⚠️ Firebase Admin initialization failed. Falling back to persistent JSON storage.", error);
  }
} else {
  console.log("ℹ️ FIREBASE_CONFIG was not detected. Operating in persistent local JSON fallback mode.");
}


// ==========================================
// FALLBACK LOCAL PERSISTENT STORAGE CONTROLLER
// ==========================================
interface FallbackSchema {
  products: any[];
  orders: any[];
  quotes: any[];
  customers: any[];
  ingredients: any[];
  settings: any;
  blockedDates: any[];
  expenses: any[];
}

const DEFAULT_MOCK_DATA: FallbackSchema = {
  products: [
    {
      id: "prod-1",
      name: "Chocolate Fudge Celebration Cake",
      description: "Rich layered chocolate cake with dark chocolate ganache, beautiful rosettes, and optional personalized script. Perfect for birthdays!",
      category: "Custom Cakes",
      basePrice: 65.00,
      options: {
        sizes: [
          { name: "6 inch (feeds 8-10)", priceAdd: 0 },
          { name: "8 inch (feeds 12-16)", priceAdd: 20 },
          { name: "10 inch (feeds 20-25)", priceAdd: 45 }
        ],
        flavors: ["Chocolate Fudge", "Vanilla Bean", "Red Velvet", "Salted Caramel"],
        addOns: [
          { name: "Gold Foil Decoration", priceAdd: 5 },
          { name: "Custom Text Script", priceAdd: 8 },
          { name: "Sparkler Candles", priceAdd: 3 }
        ]
      },
      ingredients: [
        { ingredientId: "ing-1", quantity: 500 }, // flour
        { ingredientId: "ing-2", quantity: 450 }, // sugar
        { ingredientId: "ing-3", quantity: 300 }, // butter
        { ingredientId: "ing-4", quantity: 6 },   // eggs
        { ingredientId: "ing-5", quantity: 200 }  // chocolate
      ],
      imgUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "prod-2",
      name: "Classic Vanilla Confetti Cupcakes",
      description: "Fluffy vanilla bean cupcakes topped with our signature creamy buttercream icing and celebratory rainbow sprinkles.",
      category: "Cupcakes",
      basePrice: 32.00, // per dozen
      options: {
        sizes: [
          { name: "1 Dozen (12 pcs)", priceAdd: 0 },
          { name: "2 Dozen (24 pcs)", priceAdd: 30 }
        ],
        flavors: ["Traditional Buttercream", "Strawberry Swirl", "Cream Cheese Frosting"],
        addOns: [
          { name: "Custom Color Palette", priceAdd: 4 },
          { name: "Individual Gift Boxes", priceAdd: 6 }
        ]
      },
      ingredients: [
        { ingredientId: "ing-1", quantity: 250 },
        { ingredientId: "ing-2", quantity: 200 },
        { ingredientId: "ing-3", quantity: 150 },
        { ingredientId: "ing-4", quantity: 3 }
      ],
      imgUrl: "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "prod-3",
      name: "Gourmet Choco-Chip Bakery Cookies",
      description: "Soft-baked, thick bakery level cookies loaded with semi-sweet chocolate chunks and finished with a pinch of Maldon sea salt.",
      category: "Cookies",
      basePrice: 28.00, // per dozen
      options: {
        sizes: [
          { name: "1 Dozen (12 large)", priceAdd: 0 },
          { name: "2 Dozen (24 large)", priceAdd: 25 }
        ],
        flavors: ["Classic Choco-Chip", "Double Chocolate", "White Chocolate Macadamia"],
        addOns: [
          { name: "Individually Heat Sealed", priceAdd: 4 }
        ]
      },
      ingredients: [
        { ingredientId: "ing-1", quantity: 350 },
        { ingredientId: "ing-2", quantity: 250 },
        { ingredientId: "ing-3", quantity: 200 },
        { ingredientId: "ing-4", quantity: 2 },
        { ingredientId: "ing-5", quantity: 250 }
      ],
      imgUrl: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: "prod-4",
      name: "Gourmet Dessert Party Platter",
      description: "An elegant assortment of mini treats including 6 brownie bites, 6 mini cheesecakes, 6 macaroon cookies, and 6 chocolate covered strawberries.",
      category: "Dessert Trays",
      basePrice: 48.00,
      options: {
        sizes: [
          { name: "Small Tray (24 items)", priceAdd: 0 },
          { name: "Large Tray (48 items)", priceAdd: 40 }
        ],
        flavors: ["Standard Variety Collection", "Chocolate Lover Variant", "Gluten-Friendly Variant"],
        addOns: [
          { name: "Premium Covered Display Dome", priceAdd: 5 }
        ]
      },
      ingredients: [
        { ingredientId: "ing-2", quantity: 300 },
        { ingredientId: "ing-3", quantity: 250 },
        { ingredientId: "ing-4", quantity: 4 },
        { ingredientId: "ing-5", quantity: 200 }
      ],
      imgUrl: "https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?w=500&auto=format&fit=crop&q=60"
    }
  ],
  orders: [
    {
      id: "ord-1",
      orderNumber: "LST-1001",
      customerId: "cust-1",
      customerName: "Sarah Jenkins",
      customerEmail: "sarah.jenkins@gmail.com",
      customerPhone: "469-555-0123",
      items: [
        {
          productId: "prod-1",
          name: "Chocolate Fudge Celebration Cake",
          quantity: 1,
          size: "8 inch (feeds 12-16)",
          flavor: "Chocolate Fudge",
          addOns: ["Custom Text Script"],
          unitPrice: 93.00,
          totalPrice: 93.00
        }
      ],
      subtotal: 93.00,
      tax: 7.67,
      deliveryFee: 10.00,
      total: 110.67,
      orderDate: "2026-06-08T14:30:00Z",
      fulfillmentDate: "2026-06-12",
      type: "delivery",
      deliveryAddress: "102 Main St, Royse City, TX 75189",
      status: "Confirmed",
      paymentStatus: "Paid",
      notes: "Allergy Alert: Please ensure no peanut cross-contact. Happy 10th Birthday Logan!"
    },
    {
      id: "ord-2",
      orderNumber: "LST-1002",
      customerId: "cust-2",
      customerName: "Michael Chang",
      customerEmail: "mchang@yahoo.com",
      customerPhone: "214-555-8931",
      items: [
        {
          productId: "prod-2",
          name: "Classic Vanilla Confetti Cupcakes",
          quantity: 2,
          size: "1 Dozen (12 pcs)",
          flavor: "Traditional Buttercream",
          addOns: ["Custom Color Palette"],
          unitPrice: 36.00,
          totalPrice: 72.00
        }
      ],
      subtotal: 72.00,
      tax: 5.94,
      deliveryFee: 0.00,
      total: 77.94,
      orderDate: "2026-06-09T09:15:00Z",
      fulfillmentDate: "2026-06-11",
      type: "pickup",
      status: "Pending",
      paymentStatus: "Unpaid",
      notes: "Cupcakes colored soft light blue and cream for a baby shower. Picking up around 10:00 AM."
    },
    {
      id: "ord-3",
      orderNumber: "LST-1003",
      customerId: "cust-3",
      customerName: "Lindy Evans",
      customerEmail: "lindy.e@outlook.com",
      customerPhone: "972-555-4089",
      items: [
        {
          productId: "prod-3",
          name: "Gourmet Choco-Chip Bakery Cookies",
          quantity: 1,
          size: "1 Dozen (12 large)",
          flavor: "Classic Choco-Chip",
          addOns: ["Individually Heat Sealed"],
          unitPrice: 32.00,
          totalPrice: 32.00
        }
      ],
      subtotal: 32.00,
      tax: 2.64,
      deliveryFee: 0.00,
      total: 34.64,
      orderDate: "2026-06-05T11:00:00Z",
      fulfillmentDate: "2026-06-10",
      type: "pickup",
      status: "Ready",
      paymentStatus: "Paid",
      notes: "Teacher appreciation gift cookies."
    }
  ],
  quotes: [
    {
      id: "q-1",
      quoteNumber: "Q-2001",
      eventType: "Wedding Reception",
      eventDate: "2026-07-15",
      servings: 80,
      flavorPreferences: "Bottom tier vanilla bourbon, top tier strawberry cream",
      designIdeas: "Three tier cake, semi-naked rustic style with fresh blush roses and real Eucalyptus leaves. Need delivery and setup.",
      budgetRange: "$300 - $500",
      contactName: "Rebecca Davis",
      contactEmail: "rebecca.wed2026@gmail.com",
      contactPhone: "469-555-4422",
      status: "Pending Review",
      createdAt: "2026-06-09T18:45:00Z",
      notes: ""
    },
    {
      id: "q-2",
      quoteNumber: "Q-2002",
      eventType: "Corporate Gala",
      eventDate: "2026-06-25",
      servings: 120,
      flavorPreferences: "Assorted tray bites, mini cupcakes with corporate branded blue and gold designs",
      designIdeas: "Need 4 small dessert platters of cookies/bars and 48 custom cupcakes. Needs to be delivered by 4 PM on the 25th.",
      budgetRange: "$200 - $350",
      contactName: "Theresa Reynolds",
      contactEmail: "treynolds@apexcorp.com",
      contactPhone: "214-555-3300",
      status: "Sent",
      createdAt: "2026-06-08T10:00:00Z",
      priceProposal: 310.00,
      proposedItems: [
        {
          productId: "prod-4",
          name: "Gourmet Dessert Party Platter",
          quantity: 4,
          unitPrice: 48.00,
          totalPrice: 192.00
        },
        {
          productId: "prod-2",
          name: "Classic Vanilla Confetti Cupcakes",
          quantity: 4,
          size: "1 Dozen (12 pcs)",
          flavor: "Traditional Buttercream",
          addOns: ["Custom Color Palette"],
          unitPrice: 36.00,
          totalPrice: 144.00
        }
      ],
      notes: "Included 10% volume discount since it is a returning business client."
    }
  ],
  customers: [
    {
      id: "cust-1",
      name: "Sarah Jenkins",
      email: "sarah.jenkins@gmail.com",
      phone: "469-555-0123",
      totalSpent: 110.67,
      orderCount: 1,
      lastOrderDate: "2026-06-08",
      isVIP: false,
      notes: "Prefers low-sugar frosting where possible."
    },
    {
      id: "cust-2",
      name: "Michael Chang",
      email: "mchang@yahoo.com",
      phone: "214-555-8931",
      totalSpent: 77.94,
      orderCount: 1,
      lastOrderDate: "2026-06-09",
      isVIP: false,
      notes: ""
    },
    {
      id: "cust-3",
      name: "Lindy Evans",
      email: "lindy.e@outlook.com",
      phone: "972-555-4089",
      totalSpent: 245.50,
      orderCount: 3,
      lastOrderDate: "2026-06-10",
      isVIP: true,
      notes: "Extremely nice VIP customer, high school teacher."
    }
  ],
  ingredients: [
    { id: "ing-1", name: "Gluten-Free Flour Mix", unit: "g", costPerUnit: 0.005, stock: 5000 },
    { id: "ing-2", name: "Granulated Sugar", unit: "g", costPerUnit: 0.002, stock: 8000 },
    { id: "ing-3", name: "Organic Butter", unit: "g", costPerUnit: 0.012, stock: 4000 },
    { id: "ing-4", name: "Free-Range Large Eggs", unit: "each", costPerUnit: 0.35, stock: 72 },
    { id: "ing-5", name: "Belgian Chocolate Callets", unit: "g", costPerUnit: 0.018, stock: 3000 }
  ],
  settings: {
    businessName: "Lainie's Sweet Treats",
    phone: "214-555-CAKE",
    email: "lainie@sweet-treats.com",
    address: "508 Sweetwood Lane, Royse City, TX 75189",
    leadTimeDays: 3,
    deliveryRadius: 15,
    deliveryFeePerMile: 2.00,
    taxRate: 0.0825, // 8.25% TX Sales Tax
    emailTemplateConfirmation: "Hi {name},\n\nThank you so much for ordering from Lainie's Sweet Treats! We are thrilled to make your sweet celebration perfect. Your order {orderNumber} has been received for {fulfillmentDate} ({type}).\n\nBest,\nLainie"
  },
  blockedDates: [
    { id: "bd-1", date: "2026-07-04", notes: "Independence Day Holiday" },
    { id: "bd-2", date: "2026-06-20", notes: "Lainie's Personal Family Event" }
  ],
  expenses: [
    { id: "exp-1", date: "2026-06-01", category: "Ingredients", description: "Bulk buying flour, sugar, butter from Costco", amount: 145.20 },
    { id: "exp-2", date: "2026-06-05", category: "Packaging", description: "Ordered cake boxes and cupcake inserts on Amazon", amount: 62.50 }
  ]
};

// Initialize file if not exists
if (!fs.existsSync(FALLBACK_DB_PATH)) {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(DEFAULT_MOCK_DATA, null, 2), "utf8");
}

function loadLocalDb(): FallbackSchema {
  try {
    const raw = fs.readFileSync(FALLBACK_DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MOCK_DATA;
  }
}

function saveLocalDb(data: FallbackSchema) {
  try {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write fallback local DB JSON file", error);
  }
}

// ==========================================
// DB SERVICE METHODS (BRIDGED REAL/MOCK)
// ==========================================

export const dbService = {
  isFirebaseConnected() {
    return isUsingFirebase;
  },

  async list(collectionName: string): Promise<any[]> {
    if (isUsingFirebase && realDb) {
      try {
        const snap = await realDb.collection(collectionName).get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error(`Firestore list failed for ${collectionName}, using local fallback.`, err);
      }
    }
    // Fallback mode
    const dbData = loadLocalDb();
    return (dbData as any)[collectionName] || [];
  },

  async get(collectionName: string, id: string): Promise<any | null> {
    if (isUsingFirebase && realDb) {
      try {
        const doc = await realDb.collection(collectionName).doc(id).get();
        if (doc.exists) {
          return { id: doc.id, ...doc.data() };
        }
        return null;
      } catch (err) {
        console.error(`Firestore get failed for ${collectionName}/${id}, using local fallback.`, err);
      }
    }
    // Fallback mode
    const dbData = loadLocalDb();
    const items = (dbData as any)[collectionName] || [];
    return items.find((x: any) => x.id === id) || null;
  },

  async insert(collectionName: string, data: any): Promise<any> {
    const id = data.id || `${collectionName.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const docData = { ...data, id };

    if (isUsingFirebase && realDb) {
      try {
        await realDb.collection(collectionName).doc(id).set(docData);
        return docData;
      } catch (err) {
        console.error(`Firestore insert failed for ${collectionName}/${id}, using local fallback.`, err);
      }
    }
    // Fallback mode
    const dbData = loadLocalDb();
    if (!(dbData as any)[collectionName]) {
      (dbData as any)[collectionName] = [];
    }
    (dbData as any)[collectionName].push(docData);
    saveLocalDb(dbData);
    return docData;
  },

  async update(collectionName: string, id: string, data: any): Promise<any> {
    if (isUsingFirebase && realDb) {
      try {
        await realDb.collection(collectionName).doc(id).update(data);
        const doc = await realDb.collection(collectionName).doc(id).get();
        return { id, ...doc.data() };
      } catch (err) {
        console.error(`Firestore update failed for ${collectionName}/${id}, using local fallback.`, err);
      }
    }
    // Fallback mode
    const dbData = loadLocalDb();
    const items = (dbData as any)[collectionName] || [];
    const index = items.findIndex((x: any) => x.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data, id };
      saveLocalDb(dbData);
      return items[index];
    }
    throw new Error(`Record with ID ${id} not found in collection ${collectionName}`);
  },

  async delete(collectionName: string, id: string): Promise<boolean> {
    if (isUsingFirebase && realDb) {
      try {
        await realDb.collection(collectionName).doc(id).delete();
        return true;
      } catch (err) {
        console.error(`Firestore delete failed for ${collectionName}/${id}, using local fallback.`, err);
      }
    }
    // Fallback mode
    const dbData = loadLocalDb();
    const items = (dbData as any)[collectionName] || [];
    const index = items.findIndex((x: any) => x.id === id);
    if (index !== -1) {
      items.splice(index, 1);
      saveLocalDb(dbData);
      return true;
    }
    return false;
  },

  async getSettings(): Promise<any> {
    if (isUsingFirebase && realDb) {
      try {
        const doc = await realDb.collection("settings").doc("business").get();
        if (doc.exists) {
          return doc.data();
        }
      } catch (err) {
        console.error("Firestore getSettings failed, using local fallback.", err);
      }
    }
    const dbData = loadLocalDb();
    return dbData.settings || DEFAULT_MOCK_DATA.settings;
  },

  async saveSettings(settings: any): Promise<any> {
    if (isUsingFirebase && realDb) {
      try {
        await realDb.collection("settings").doc("business").set(settings);
        return settings;
      } catch (err) {
        console.error("Firestore saveSettings failed, using local fallback.", err);
      }
    }
    const dbData = loadLocalDb();
    dbData.settings = settings;
    saveLocalDb(dbData);
    return settings;
  }
};
