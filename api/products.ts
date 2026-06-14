import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/products/:id

    if (req.method === 'GET') {
      const products = await dbService.list("products");
      return res.status(200).json(products);
    }

    // Creating, Updating, or Deleting products requires admin authorization
    const adminUser = authenticateAdmin(req, res);
    if (!adminUser) return;

    if (req.method === 'POST') {
      const newProduct = await dbService.insert("products", req.body);
      return res.status(201).json(newProduct);
    }

    if (req.method === 'PUT') {
      if (!id) {
        return res.status(400).json({ error: "Missing product ID in URL" });
      }
      const updatedProduct = await dbService.update("products", id, req.body);
      return res.status(200).json(updatedProduct);
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: "Missing product ID in URL" });
      }
      await dbService.delete("products", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Products API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
