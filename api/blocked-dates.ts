import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/blocked-dates/:id

    if (req.method === 'GET') {
      const dates = await dbService.list("blockedDates");
      return res.status(200).json(dates);
    }

    if (req.method === 'POST') {
      const adminUser = authenticateAdmin(req, res);
      if (!adminUser) return;

      const newDate = await dbService.insert("blockedDates", req.body);
      return res.status(201).json(newDate);
    }

    if (req.method === 'DELETE') {
      const adminUser = authenticateAdmin(req, res);
      if (!adminUser) return;

      if (!id) {
        return res.status(400).json({ error: "Missing blocked date ID in URL" });
      }

      await dbService.delete("blockedDates", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Blocked Dates API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
