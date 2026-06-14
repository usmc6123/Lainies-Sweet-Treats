import adminModule from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbService } from '../../src/server/db.js';

const admin = adminModule as any;

const JWT_SECRET = process.env.JWT_SECRET as string;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Safety protection against missing JWT_SECRET secret
  if (!JWT_SECRET) {
    console.error("JWT_SECRET environment variable is missing.");
    return res.status(500).json({ error: "Server misconfiguration: JWT_SECRET must be defined." });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const emailLower = email.toLowerCase().trim();

    let targetUser: any = null;
    let isAdminUser = false;
    let userUid = '';

    // Initialize the Firebase Admin SDK if key is present
    const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
    let hasFirebase = false;

    if (firebaseConfigEnv) {
      try {
        if (admin.apps.length === 0) {
          let credentials: any;
          if (firebaseConfigEnv.trim().startsWith("{")) {
            credentials = JSON.parse(firebaseConfigEnv);
          } else {
            credentials = { projectId: 'lainies-sweet-treats' };
          }

          if (credentials.private_key || credentials.client_email) {
            admin.initializeApp({
              credential: admin.credential.cert(credentials),
            });
          } else {
            admin.initializeApp({
              projectId: credentials.projectId || 'lainies-sweet-treats',
            });
          }
        }
        hasFirebase = true;
      } catch (error) {
        console.error('Error parsing or initializing FIREBASE_CONFIG env:', error);
      }
    }

    if (hasFirebase) {
      const db = getFirestore(admin.app());

      const adminsQuery = await db.collection('admins')
        .where('email', '==', emailLower)
        .limit(1)
        .get();

      if (!adminsQuery.empty) {
        const adminDoc = adminsQuery.docs[0];
        targetUser = adminDoc.data();
        userUid = adminDoc.id;
        isAdminUser = true;
      } else {
        const usersQuery = await db.collection('users')
          .where('email', '==', emailLower)
          .limit(1)
          .get();

        if (!usersQuery.empty) {
          const userDoc = usersQuery.docs[0];
          targetUser = userDoc.data();
          userUid = userDoc.id;
          isAdminUser = false;
        }
      }
    } else {
      // Fallback local memory / JSON database
      const localAdmins = await dbService.list('admins');
      const foundAdmin = localAdmins.find(a => a.email && a.email.toLowerCase() === emailLower);
      if (foundAdmin) {
        targetUser = foundAdmin;
        userUid = foundAdmin.id;
        isAdminUser = true;
      } else {
        const localUsers = await dbService.list('users');
        const foundUser = localUsers.find(u => u.email && u.email.toLowerCase() === emailLower);
        if (foundUser) {
          targetUser = foundUser;
          userUid = foundUser.id;
          isAdminUser = false;
        }
      }
    }

    if (!targetUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (targetUser.isDisabled) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const isMatch = await bcrypt.compare(password.trim(), targetUser.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Force values specified by user for the admin email
    if (emailLower === 'elainiehoncoop@gmail.com') {
      userUid = 'ek8gF35yuiWH7VXEzjUsTFdLANG3';
      isAdminUser = true;
    }

    const token = jwt.sign(
      { email: targetUser.email, isAdmin: isAdminUser, uid: userUid, role: isAdminUser ? 'admin' : 'user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      isAdmin: isAdminUser,
      admin: {
        uid: userUid,
        email: targetUser.email,
        role: isAdminUser ? 'admin' : 'user'
      },
      user: {
        uid: userUid,
        email: targetUser.email,
        name: targetUser.name || targetUser.displayName || '',
        displayName: targetUser.displayName || targetUser.name || '',
        tier: targetUser.tier || targetUser.subscriptionTier || 'free',
        subscriptionTier: targetUser.subscriptionTier || targetUser.tier || 'free',
        isAdmin: isAdminUser
      }
    });

  } catch (error: any) {
    console.error('Server Login Handler Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
