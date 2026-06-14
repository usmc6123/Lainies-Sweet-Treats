import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/ingredients/:id

    if (req.method === 'GET') {
      const ingredients = await dbService.list("ingredients");
      return res.status(200).json(ingredients);
    }

    if (req.method === 'POST') {
      const newIng = await dbService.insert("ingredients", req.body);
      return res.status(201).json(newIng);
    }

    if (req.method === 'PUT') {
      if (!id) {
        return res.status(400).json({ error: "Missing ingredient ID in URL" });
      }
      const updatedIng = await dbService.update("ingredients", id, req.body);
      return res.status(200).json(updatedIng);
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: "Missing ingredient ID in URL" });
      }
      await dbService.delete("ingredients", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Ingredients API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
