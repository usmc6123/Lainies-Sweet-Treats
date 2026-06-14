import { getStorage } from "firebase-admin/storage";
import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { setCorsHeaders, authenticateAdmin } from "./_lib/helper.js";

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Ensure authorized admin access only
  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
  if (!firebaseConfigEnv) {
    return res.status(500).json({ error: "FIREBASE_CONFIG environment variable is missing" });
  }

  try {
    if (getApps().length === 0) {
      const credentials = JSON.parse(firebaseConfigEnv);
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

    const { filename, contentType, base64 } = req.body;
    if (!base64 || !filename) {
      return res.status(400).json({ error: "Missing file base64 data or filename in request" });
    }

    // Decode base64 to buffer
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const app = getApp();
    let bucketName = "";
    try {
      const credentials = JSON.parse(firebaseConfigEnv);
      bucketName = credentials.storageBucket || `${credentials.projectId}.appspot.com` || `${credentials.projectId}.firebasestorage.app`;
    } catch {
      bucketName = "lainies-sweet-treats.appspot.com";
    }

    if (!bucketName) {
      bucketName = "lainies-sweet-treats.appspot.com";
    }

    // Clean bucket prefix if configured as ga://
    bucketName = bucketName.replace(/^gs:\/\//, "");

    const storage = getStorage(app);
    const bucket = storage.bucket(bucketName);

    // Sanitize filename and create a unique path
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `products/${Date.now()}-${cleanFilename}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: contentType || "image/jpeg",
        cacheControl: 'public, max-age=31536000'
      }
    });

    // Construct the direct download URL for Firebase Storage
    const encodedFilePath = encodeURIComponent(filePath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedFilePath}?alt=media`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      filePath: filePath
    });

  } catch (error: any) {
    console.error("Upload API error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error during file upload" });
  }
}
