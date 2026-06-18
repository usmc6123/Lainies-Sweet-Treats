import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

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
