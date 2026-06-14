import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/customers/:id

    if (req.method === 'GET') {
      const customers = await dbService.list("customers");
      return res.status(200).json(customers);
    }

    if (req.method === 'POST') {
      const customer = await dbService.insert("customers", req.body);
      return res.status(201).json(customer);
    }

    if (req.method === 'PUT') {
      if (!id) {
        return res.status(400).json({ error: "Missing customer ID in URL" });
      }
      const customer = await dbService.update("customers", id, req.body);
      return res.status(200).json(customer);
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: "Missing customer ID in URL" });
      }
      await dbService.delete("customers", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Customers API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
