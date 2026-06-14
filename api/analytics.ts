import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';
import { Order, Customer, Product, Ingredient } from '../src/types.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const orders: Order[] = await dbService.list("orders");
    const customers: Customer[] = await dbService.list("customers");
    const products: Product[] = await dbService.list("products");
    const ingredients: Ingredient[] = await dbService.list("ingredients");

    // Filter non-cancelled orders for accurate revenue analysis
    const validOrders = orders.filter(o => o.status !== "Cancelled");

    // 1. Total revenue
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);

    // 2. Average Order Value
    const averageOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

    // 3. Customer Return Rate
    const returnees = customers.filter(c => c.orderCount > 1).length;
    const returnRate = customers.length > 0 ? (returnees / customers.length) * 100 : 0;

    // 4. Busiest Days of Week (0 = Sunday, 1 = Monday ...)
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    validOrders.forEach(o => {
      const d = new Date(o.fulfillmentDate);
      if (!isNaN(d.getTime())) {
        dayCounts[d.getDay()] = dayCounts[d.getDay()] + 1;
      }
    });

    const busiestDays = dayLabels.map((lbl, idx) => ({
      day: lbl,
      ordersCount: dayCounts[idx]
    }));

    // 5. Popular Products frequency
    const productFreq: { [key: string]: { name: string; qty: number; revenue: number } } = {};
    validOrders.forEach(o => {
      o.items.forEach(item => {
        if (!productFreq[item.productId]) {
          productFreq[item.productId] = { name: item.name, qty: 0, revenue: 0 };
        }
        productFreq[item.productId].qty += item.quantity;
        productFreq[item.productId].revenue += item.totalPrice;
      });
    });

    const popularProducts = Object.values(productFreq)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 6. Revenue by Month
    const monthlyData: { [key: string]: number } = {};
    validOrders.forEach(o => {
      const d = new Date(o.fulfillmentDate);
      if (!isNaN(d.getTime())) {
        const monthYear = d.toLocaleString("default", { month: "short", year: "numeric" });
        monthlyData[monthYear] = (monthlyData[monthYear] || 0) + o.total;
      }
    });

    const revenueByMonth = Object.entries(monthlyData).map(([month, rev]) => ({
      month,
      revenue: parseFloat(rev.toFixed(2))
    }));

    // 7. Ingredient Margin analysis (Base price vs Ingredient Cost)
    const calculatedMargins = products.map(p => {
      let cost = 0;
      p.ingredients.forEach(link => {
        const ing = ingredients.find(i => i.id === link.ingredientId);
        if (ing) {
          cost += ing.costPerUnit * link.quantity;
        }
      });
      
      const profit = p.basePrice - cost;
      const marginPct = p.basePrice > 0 ? (profit / p.basePrice) * 100 : 0;
      
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        basePrice: p.basePrice,
        ingredientCost: parseFloat(cost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        marginPercent: parseFloat(marginPct.toFixed(2))
      };
    });

    return res.status(200).json({
      overview: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        returnRate: parseFloat(returnRate.toFixed(2)),
        activeOrders: validOrders.filter(o => o.status !== "Delivered/Picked Up").length,
        totalOrdersCount: validOrders.length,
        totalCustomersCount: customers.length
      },
      revenueByMonth,
      popularProducts,
      busiestDays,
      productCostMargins: calculatedMargins
    });
  } catch (error: any) {
    console.error('Analytics API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
