import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/orders/:id
    const subAction = parts[3]; // /api/orders/:id/status

    if (req.method === 'GET') {
      const orders = await dbService.list("orders");
      return res.status(200).json(orders);
    }

    if (req.method === 'POST') {
      const data = req.body;
      const orders = await dbService.list("orders");
      const orderNum = `LST-${1000 + orders.length + 1}`;
      data.orderNumber = orderNum;
      data.orderDate = new Date().toISOString();
      const newOrder = await dbService.insert("orders", data);
      return res.status(201).json(newOrder);
    }

    if (req.method === 'PUT') {
      if (!id) {
        return res.status(400).json({ error: "Missing order ID in URL" });
      }

      if (subAction === "status") {
        // Special case: PUT /api/orders/:id/status
        const { status, paymentStatus } = req.body;
        const updateData: any = {};
        if (status) updateData.status = status;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;

        const updated = await dbService.update("orders", id, updateData);
        return res.status(200).json(updated);
      }

      // Normal case: PUT /api/orders/:id
      const updatedOrder = await dbService.update("orders", id, req.body);
      return res.status(200).json(updatedOrder);
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: "Missing order ID in URL" });
      }
      await dbService.delete("orders", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Orders API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
