import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';
import { Quote, Order } from '../src/types.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/quotes/:id
    const subAction = parts[3]; // /api/quotes/:id/respond

    // 1. PUBLIC: POST /api/quotes / Respond Quote accepts from clients or submit quote requests
    if (req.method === 'POST') {
      if (id && subAction === "respond") {
        const { action } = req.body; // "accept" or "decline"
        const quote: Quote | null = await dbService.get("quotes", id);
        if (!quote) {
          return res.status(404).json({ error: "Quote not found." });
        }

        if (action === "accept") {
          // Mark Quote as Accepted
          const updatedQuote = await dbService.update("quotes", quote.id, { status: "Accepted" });
          
          // Form a corresponding Order
          const orders = await dbService.list("orders");
          const orderNum = `LST-${1000 + orders.length + 1}`;
          const settings = await dbService.getSettings();
          
          // Find or Create Customer
          const customers = await dbService.list("customers");
          let customer = customers.find((c: any) => c.email.toLowerCase() === quote.contactEmail.toLowerCase());
          let customerId: string;
          
          const subtotal = quote.priceProposal || 0;
          const taxRate = settings.taxRate || 0.0825;
          const tax = parseFloat((subtotal * taxRate).toFixed(2));
          const total = parseFloat((subtotal + tax).toFixed(2));

          if (!customer) {
            const newCust = await dbService.insert("customers", {
              name: quote.contactName,
              email: quote.contactEmail.toLowerCase(),
              phone: quote.contactPhone,
              totalSpent: total,
              orderCount: 1,
              lastOrderDate: quote.eventDate,
              isVIP: false,
              notes: "Created automatically from accepted wedding/custom quote request."
            });
            customerId = newCust.id;
          } else {
            customerId = customer.id;
            await dbService.update("customers", customer.id, {
              totalSpent: parseFloat((customer.totalSpent + total).toFixed(2)),
              orderCount: customer.orderCount + 1,
              lastOrderDate: quote.eventDate
            });
          }

          const newOrder: Partial<Order> = {
            orderNumber: orderNum,
            customerId,
            customerName: quote.contactName,
            customerEmail: quote.contactEmail,
            customerPhone: quote.contactPhone,
            items: quote.proposedItems || [
              {
                productId: "custom-dessert",
                name: `Custom Custom Cake: ${quote.eventType}`,
                quantity: 1,
                unitPrice: quote.priceProposal || 0,
                totalPrice: quote.priceProposal || 0,
                notes: quote.designIdeas
              } as any
            ],
            subtotal,
            tax,
            deliveryFee: 0,
            total,
            orderDate: new Date().toISOString(),
            fulfillmentDate: quote.eventDate,
            type: "pickup",
            status: "Confirmed",
            paymentStatus: "Unpaid",
            notes: `Event: ${quote.eventType}.\nFlavor Preferences: ${quote.flavorPreferences}.\nDesign Ideas: ${quote.designIdeas}.\nServings: ${quote.servings}`
          };

          const createdOrder = await dbService.insert("orders", newOrder);
          return res.status(200).json({ status: "Accepted", order: createdOrder, quote: updatedQuote });
        } else if (action === "decline") {
          const updatedQuote = await dbService.update("quotes", quote.id, { status: "Declined" });
          return res.status(200).json({ status: "Declined", quote: updatedQuote });
        } else {
          return res.status(400).json({ error: "Invalid action. Must be accept or decline." });
        }
      }

      // PUBLIC: Request Quote (POST /api/quotes)
      const data = req.body;
      const quotes = await dbService.list("quotes");
      const quoteNum = `Q-${2000 + quotes.length + 1}`;
      data.quoteNumber = quoteNum;
      data.createdAt = new Date().toISOString();
      if (!data.status) data.status = "Pending Review";
      const newQuote = await dbService.insert("quotes", data);
      return res.status(201).json(newQuote);
    }

    // 2. ADMIN AUTHENTICATED ENDPOINTS (GET, PUT, DELETE)
    const adminUser = authenticateAdmin(req, res);
    if (!adminUser) return;

    if (req.method === 'GET') {
      const quotes = await dbService.list("quotes");
      return res.status(200).json(quotes);
    }

    if (req.method === 'PUT') {
      if (!id) {
        return res.status(400).json({ error: "Missing quote ID in URL" });
      }
      const updatedQuote = await dbService.update("quotes", id, req.body);
      return res.status(200).json(updatedQuote);
    }

    if (req.method === 'DELETE') {
      if (!id) {
        return res.status(400).json({ error: "Missing quote ID in URL" });
      }
      await dbService.delete("quotes", id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Quotes API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
