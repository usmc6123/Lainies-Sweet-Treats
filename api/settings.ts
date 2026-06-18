import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const isCouponsPath = url.pathname.includes('/coupons');

    if (isCouponsPath) {
      const adminUser = authenticateAdmin(req, res);
      if (!adminUser) return; // Handled by security gate

      if (req.method === 'GET') {
        const coupons = await dbService.list("coupons");
        return res.status(200).json(coupons);
      }

      if (req.method === 'POST') {
        const couponId = req.body.id;
        if (couponId) {
          const updated = await dbService.update("coupons", couponId, req.body);
          return res.status(200).json(updated);
        } else {
          const cleanData = {
            ...req.body,
            usageCount: 0
          };
          const inserted = await dbService.insert("coupons", cleanData);
          return res.status(201).json(inserted);
        }
      }

      if (req.method === 'DELETE') {
        const parts = url.pathname.split('/').filter(Boolean);
        const id = parts[2]; // ["api", "coupons", "some-id"]
        if (!id) {
          return res.status(400).json({ error: "Missing coupon ID in URL" });
        }
        await dbService.delete("coupons", id);
        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (req.method === 'GET') {
      const settings = await dbService.getSettings();
      return res.status(200).json(settings);
    }

    if (req.method === 'POST') {
      const adminUser = authenticateAdmin(req, res);
      if (!adminUser) return; // Response is already handled by authenticateAdmin helper

      const updatedSettings = await dbService.saveSettings(req.body);
      return res.status(200).json(updatedSettings);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Settings API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
