import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export function parseRoute(req: any) {
  // Try to read from query (Vercel rewrites append these)
  let action = req.query?.action;
  let id = req.query?.id;
  let subAction = req.query?.subAction;

  // Fallback to manual pathname parsing if not explicitly provided as query params
  if (!action) {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const parts = url.pathname.split('/').filter(Boolean); // e.g. ["api", "orders", "123", "status"]
      
      const root = parts[1]; // e.g. "orders", "coupons", "settings", "public", "auth", "quotes"
      if (root === "auth" || root === "user") {
        action = root;
        subAction = parts[2]; // "login", "verify", "change-password"
      } else if (root === "public") {
        action = parts[2]; // "menu", "order", "validate-coupon"
      } else if (root === "stripe") {
        action = parts[2]; // "create-checkout-session", "checkout-status", etc.
      } else if (root === "quotes") {
        action = "quotes";
        if (parts[2]) {
          if (parts[3] === "respond") {
            id = parts[2];
            subAction = "respond";
          } else {
            id = parts[2];
          }
        }
      } else if (root === "coupons") {
        action = "coupons";
        if (parts[2]) {
          if (parts[3] === "toggle") {
            id = parts[2];
            subAction = "toggle";
          } else {
            id = parts[2];
          }
        }
      } else if (root === "orders") {
        action = "orders";
        if (parts[2]) {
          if (parts[2] === "receipt" || parts[2] === "labels") {
            if (parts[2] === "labels" && parts[3] === "date") {
              subAction = "labels-date";
            } else {
              subAction = parts[2];
            }
          } else if (parts[2] === "labels-date") {
            subAction = "labels-date";
          } else {
            id = parts[2];
            if (parts[3] === "status") {
              subAction = "status";
            } else if (parts[3] === "labels" || parts[3] === "receipt") {
              subAction = parts[3];
            }
          }
        }
      } else if (root === "ingredients") {
        action = "ingredients";
        if (parts[2]) {
          if (parts[2] === "shopping-list") {
            subAction = "shopping-list";
          } else {
            id = parts[2];
          }
        }
      } else {
        action = root; // "customers", "products", "blocked-dates", "expenses", "analytics", "upload", "settings"
        if (parts[2]) {
          id = parts[2];
        }
      }
    } catch (e) {
      // ignore parsing error
    }
  }

  // Ensure query params are also parsed and handled
  if (!id && req.query?.id) {
    id = req.query.id;
  }
  if (!subAction && req.query?.subAction) {
    subAction = req.query.subAction;
  }

  return { action, id, subAction };
}

export function setCorsHeaders(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function authenticateAdmin(req: any, res: any): any {
  let token = "";
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const queryToken = url.searchParams.get('token');
      if (queryToken) {
        token = queryToken;
      }
    } catch (e) {
      // url parsing fallback
    }
  }

  if (!token) {
    res.status(401).json({ error: "No authentication token provided." });
    return null;
  }
  if (!JWT_SECRET) {
    res.status(500).json({ error: "Access denied. Server is missing JWT_SECRET secret." });
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Explicit single-admin check: must be elainiehoncoop@gmail.com
    if (decoded.email !== "elainiehoncoop@gmail.com" || (decoded.role !== "admin" && decoded.isAdmin !== true)) {
      res.status(403).json({ error: "Access denied. Admin access required." });
      return null;
    }
    
    return decoded;
  } catch (err) {
    res.status(401).json({ error: "Your session has expired or is invalid. Please log in again." });
    return null;
  }
}
