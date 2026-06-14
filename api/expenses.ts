import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/expenses/:id

    if (req.method === 'GET') {
      const expenses = await dbService.list("expenses");
      return res.status(200).json(expenses);
    }

    if (req.method === 'POST') {
      const newExp = await dbService.insert("expenses", req.body);
      return res.status(201).json(newExp);
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: "Missing expense ID in URL" });
      }
      await dbService.delete("expenses", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Expenses API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
