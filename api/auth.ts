import adminModule from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { setCorsHeaders } from './_lib/helper.js';

const admin = (adminModule as any).default || (adminModule as any);
const JWT_SECRET = process.env.JWT_SECRET as string;

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  // Handle Login
  if (req.method === 'POST') {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const emailLower = email.toLowerCase().trim();

      // Only allow the single admin
      if (emailLower !== 'elainiehoncoop@gmail.com') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
      if (!firebaseConfigEnv) {
        return res.status(500).json({ error: 'Firestore configuration missing. Login unavailable.' });
      }

      if (admin.apps.length === 0) {
        const credentials = JSON.parse(firebaseConfigEnv);
        if (credentials.private_key || credentials.client_email) {
          admin.initializeApp({ credential: admin.credential.cert(credentials) });
        } else {
          admin.initializeApp({ projectId: credentials.projectId || 'lainies-sweet-treats' });
        }
      }

      const db = getFirestore(admin.app());
      const userUid = 'ek8gF35yuiWH7VXEzjUsTFdLANG3';
      
      const adminDoc = await db.collection('admins').doc(userUid).get();
      if (!adminDoc.exists) {
        return res.status(401).json({ error: 'Admin account not set up.' });
      }

      const targetAdmin = adminDoc.data() as any;
      if (targetAdmin.isDisabled) {
        return res.status(403).json({ error: 'Account disabled' });
      }

      const isMatch = await bcrypt.compare(password.trim(), targetAdmin.passwordHash);
      if (!isMatch) {
         return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { email: targetAdmin.email, isAdmin: true, uid: userUid, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        isAdmin: true,
        admin: {
          uid: userUid,
          email: targetAdmin.email,
          role: 'admin'
        },
        user: {
          uid: userUid,
          email: targetAdmin.email,
          name: targetAdmin.name || "Lainie",
          displayName: targetAdmin.displayName || "Lainie",
          isAdmin: true
        }
      });
    } catch (error: any) {
      console.error('Login Handler Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  // Handle Verify
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ valid: false });
    const token = authHeader.split(" ")[1];
    if (!JWT_SECRET) {
      return res.status(500).json({ valid: false, error: "JWT_SECRET is missing." });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.email !== "elainiehoncoop@gmail.com" || (decoded.role !== "admin" && decoded.isAdmin !== true)) {
        return res.status(403).json({ valid: false, error: "Not an authorized admin." });
      }
      return res.json({ valid: true, admin: decoded });
    } catch {
      return res.status(401).json({ valid: false });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
