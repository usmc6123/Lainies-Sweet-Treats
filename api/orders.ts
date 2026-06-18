import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';
import { Quote, Order } from '../src/types.js';
import PDFDocument from 'pdfkit';

function drawLabel(doc: any, order: any, startY: number) {
  // width: 512 pt (from x = 50 to x = 562)
  const xStart = 50;
  const xEnd = 562;
  const width = xEnd - xStart;
  const height = 350;

  // Draw outer box
  doc.rect(xStart, startY, width, height).lineWidth(2).strokeColor('#000000').stroke();

  // Draw Cake emoji & Business Name
  let currentY = startY + 15;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
     .text("🍰 LAINIE'S SWEET TREATS", xStart + 15, currentY);
  
  doc.font('Helvetica').fontSize(10).fillColor('#000000')
     .text("Royse City, TX", xStart + 15, currentY + 18, { align: 'left' });

  // Divider line
  currentY += 40;
  doc.moveTo(xStart, currentY).lineTo(xEnd, currentY).lineWidth(1).strokeColor('#000000').stroke();

  // Order Info
  currentY += 10;
  doc.font('Helvetica-Bold').fontSize(12).text(`ORDER #${order.orderNumber}`, xStart + 15, currentY);
  doc.font('Helvetica-Bold').fontSize(11).text(`For: ${order.customerName}`, xStart + 15, currentY + 18);
  doc.font('Helvetica').fontSize(11).text(`📞 ${order.customerPhone || 'No Phone'}`, xStart + 15, currentY + 34);

  // Divider line
  currentY += 55;
  doc.moveTo(xStart, currentY).lineTo(xEnd, currentY).stroke();

  // Items List
  currentY += 10;
  doc.font('Helvetica-Bold').fontSize(11).text("ITEMS:", xStart + 15, currentY);
  currentY += 16;
  doc.font('Helvetica').fontSize(10);
  
  order.items.forEach((item: any) => {
    let itemText = `• ${item.name} x${item.quantity}`;
    const descParts = [];
    if (item.size) descParts.push(`Scale: ${item.size}`);
    if (item.flavor) descParts.push(`Icing/Flavor: ${item.flavor}`);
    if (item.addOns && item.addOns.length > 0) descParts.push(`Decor: ${item.addOns.join(', ')}`);
    
    if (descParts.length > 0) {
      itemText += ` (${descParts.join(' | ')})`;
    }
    
    doc.text(itemText, xStart + 25, currentY, { width: width - 40 });
    currentY += doc.heightOfString(itemText, { width: width - 40 }) + 3;
  });

  // Let's reposition for Ready Date & Delivery
  currentY = startY + 235;
  doc.moveTo(xStart, currentY).lineTo(xEnd, currentY).stroke();

  currentY += 8;
  doc.font('Helvetica-Bold').fontSize(11).text(`READY BY: ${order.fulfillmentDate}`, xStart + 15, currentY);
  
  if (order.type === 'delivery') {
    doc.font('Helvetica-Bold').fontSize(11).text("🚗 LOCAL DELIVERY TO:", xStart + 15, currentY + 16);
    doc.font('Helvetica').fontSize(10).text(order.deliveryAddress || "Address details on invoice", xStart + 15, currentY + 30, { width: width - 40 });
  } else {
    doc.font('Helvetica-Bold').fontSize(11).text("🎁 STORE PICKUP", xStart + 15, currentY + 16);
  }

  // Allergy notes section (at fixed bottom if exists)
  const notesText = (order.notes || "").toLowerCase();
  const isAllergy = notesText.includes("allergy") || notesText.includes("allerg") || notesText.includes("gluten") || notesText.includes("nut") || notesText.includes("vegan") || notesText.includes("dairy") || notesText.includes("restrict") || notesText.includes("severe") || notesText.includes("free");
  
  if (isAllergy) {
    const allergyBoxY = startY + 295;
    doc.moveTo(xStart, allergyBoxY).lineTo(xEnd, allergyBoxY).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
       .text("⚠ ALLERGY NOTES / SPECIAL INSTRUCTIONS:", xStart + 15, allergyBoxY + 5);
    doc.font('Helvetica').fontSize(9)
       .text(order.notes, xStart + 15, allergyBoxY + 18, { width: width - 40, height: 30 });
  } else {
    // Just display totals at bottom
    const totalBoxY = startY + 310;
    doc.moveTo(xStart, totalBoxY).lineTo(xEnd, totalBoxY).stroke();
    doc.font('Helvetica-Bold').fontSize(11)
       .text(`Total Due: $${parseFloat(order.total).toFixed(2)}  |  Baking Surcharge Tip: $${parseFloat(order.tipAmount || 0).toFixed(2)}`, xStart + 15, totalBoxY + 8);
  }
}

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/orders/:id
    const subAction = parts[3]; // /api/orders/:id/status
    const orderIdQuery = url.searchParams.get('orderId');

    if (req.method === 'GET') {
      // 1. Check if it's receipt request
      if (id === 'receipt' || parts[2] === 'receipt') {
        const orderId = orderIdQuery || id;
        if (!orderId || orderId === 'receipt') {
          return res.status(400).json({ error: "Missing orderId in query parameter" });
        }
        const order = await dbService.get("orders", orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Lainies-Sweet-Treats-Order-${order.orderNumber}.pdf`);
        doc.pipe(res);
        
        // Render beautiful brand background & header
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFF8F0');
        
        doc.fillColor('#3E2723');
        doc.font('Times-Bold').fontSize(26).text("Lainie's Sweet Treats", { align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('#8D6E63').text("Royse City, TX  |  elainiehoncoop@gmail.com", { align: 'center' });
        
        // Rose Gold Divider Line
        const yLine = 90;
        doc.strokeColor('#B76E79').lineWidth(2).moveTo(50, yLine).lineTo(562, yLine).stroke();
        
        doc.fillColor('#3E2723');
        doc.font('Times-Bold').fontSize(18).text(`ORDER INVOICE & RECEIPT`, 50, 110);
        doc.font('Helvetica-Bold').fontSize(11).text(`Order Number: ${order.orderNumber}`, 50, 132);
        doc.font('Helvetica').fontSize(10).text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`, 50, 147);
        doc.text(`Fulfillment Date: ${order.fulfillmentDate} (${order.type === 'delivery' ? 'Local Delivery' : 'Store Pickup'})`, 50, 160);
        
        // Customer Box
        doc.rect(50, 180, 512, 65).lineWidth(1).strokeColor('#E0D0C0').stroke();
        doc.font('Helvetica-Bold').fontSize(11).text("CUSTOMER DETAILS", 60, 190);
        doc.font('Helvetica').fontSize(10).text(`Name: ${order.customerName}   |   Email: ${order.customerEmail}   |   Phone: ${order.customerPhone || 'N/A'}`, 60, 205);
        if (order.type === 'delivery') {
          doc.text(`Local Delivery Address: ${order.deliveryAddress || 'Not specified'}`, 60, 220, { width: 490 });
        } else {
          doc.text("Fulfillment Method: Store Pickup (508 Sweetwood Lane, Royse City, TX 75189)", 60, 220);
        }
        
        // Table Header
        let yTable = 265;
        doc.rect(50, yTable, 512, 22).fill('#B76E79');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
        doc.text("Item & Custom Specifications", 60, yTable + 6);
        doc.text("Qty", 380, yTable + 6);
        doc.text("Unit Cost", 440, yTable + 6);
        doc.text("Total", 500, yTable + 6);
        
        yTable += 22;
        doc.fillColor('#3E2723').font('Helvetica').fontSize(9);
        
        // Items
        order.items.forEach((item: any) => {
          doc.rect(50, yTable, 512, 38).lineWidth(1).strokeColor('#F2E2D2').stroke();
          
          doc.font('Helvetica-Bold').fontSize(10).text(item.name, 60, yTable + 6, { width: 300 });
          const specParts = [];
          if (item.size) specParts.push(`Scale: ${item.size}`);
          if (item.flavor) specParts.push(`Icing/Flavor: ${item.flavor}`);
          if (item.addOns && item.addOns.length > 0) specParts.push(`Decor: ${item.addOns.join(', ')}`);
          if (specParts.length > 0) {
            doc.font('Helvetica').fontSize(8.5).fillColor('#7d6259').text(specParts.join('  |  '), 60, yTable + 20, { width: 300 });
          }
          
          doc.fillColor('#3E2723').font('Helvetica-Bold').fontSize(10);
          doc.text(String(item.quantity), 380, yTable + 14);
          doc.text(`$${parseFloat(item.unitPrice || 0).toFixed(2)}`, 440, yTable + 14);
          doc.text(`$${parseFloat(item.totalPrice || 0).toFixed(2)}`, 500, yTable + 14);
          
          yTable += 38;
        });
        
        // Totals
        yTable += 15;
        doc.font('Helvetica').fontSize(10);
        doc.text("Subtotal:", 380, yTable);
        doc.text(`$${parseFloat(order.subtotal || 0).toFixed(2)}`, 500, yTable, { align: 'right' });
        
        if (order.discountAmount) {
          yTable += 18;
          doc.font('Helvetica-Bold').fillColor('#2E7D32').text(`Promo Discount (${order.couponCode || 'Promo'}):`, 300, yTable, { width: 180 });
          doc.text(`-$${parseFloat(order.discountAmount || 0).toFixed(2)}`, 500, yTable, { align: 'right' });
        }
        
        if (order.tipAmount) {
          yTable += 18;
          doc.font('Helvetica-Bold').fillColor('#3E2723').text("Baking Surcharge Tip:", 340, yTable);
          doc.text(`$${parseFloat(order.tipAmount).toFixed(2)}`, 500, yTable, { align: 'right' });
        }
        
        yTable += 18;
        doc.font('Helvetica').fillColor('#3E2723').text("Sales Tax (TX 8.25%):", 350, yTable);
        doc.text(`$${parseFloat(order.tax || 0).toFixed(2)}`, 500, yTable, { align: 'right' });
        
        if (order.deliveryFee) {
          yTable += 18;
          doc.text("Delivery Surcharge:", 355, yTable);
          doc.text(`$${parseFloat(order.deliveryFee).toFixed(2)}`, 500, yTable, { align: 'right' });
        }
        
        yTable += 25;
        doc.strokeColor('#B76E79').lineWidth(1.5).moveTo(350, yTable - 5).lineTo(562, yTable - 5).stroke();
        doc.font('Helvetica-Bold').fontSize(13).text("GRAND TOTAL DUE:", 330, yTable);
        doc.font('Times-Bold').fontSize(15).fillColor('#B76E79').text(`$${parseFloat(order.total || 0).toFixed(2)}`, 500, yTable, { align: 'right' });
        
        // Status indicator stamp
        yTable += 40;
        const isPaid = order.paymentStatus === 'Paid';
        doc.rect(50, yTable, 120, 32).fill(isPaid ? '#E8F5E9' : '#FFEBEE');
        doc.strokeColor(isPaid ? '#2E7D32' : '#C62828').lineWidth(1.5).rect(50, yTable, 120, 32).stroke();
        doc.fillColor(isPaid ? '#2E7D32' : '#C62828').font('Helvetica-Bold').fontSize(11).text(isPaid ? "✓ PAID IN FULL" : "✖ UNPAID", 62, yTable + 10);
        
        // Thank you footer
        doc.fillColor('#8D6E63').font('Times-Italic').fontSize(11).text("Thank you for your order! Custom-baked with love in Royse City, TX.", 50, doc.page.height - 100, { align: 'center', width: 512 });
        doc.font('Helvetica').fontSize(9).text("Lainie's Sweet Treats  |  Questions? contact elainiehoncoop@gmail.com", 50, doc.page.height - 80, { align: 'center', width: 512 });
        
        doc.end();
        return;
      }
      
      // 2. Batch Labels for Date (e.g., /api/orders/labels/date)
      if (id === 'labels' && (parts[3] === 'date' || parts[2] === 'labels-date')) {
        const selectedDate = url.searchParams.get('date');
        if (!selectedDate) {
          return res.status(400).json({ error: "Missing date query parameter" });
        }
        
        const allOrders = await dbService.list("orders");
        const targetOrders = allOrders.filter(o => o.fulfillmentDate === selectedDate && o.status !== 'Cancelled');
        
        const doc = new PDFDocument({ margin: 0, size: 'LETTER' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Lainies-Labels-${selectedDate}.pdf`);
        doc.pipe(res);
        
        if (targetOrders.length === 0) {
          doc.font('Helvetica-Bold').fontSize(18).text(`NO CONFIRMED ORDERS FOUND FOR ${selectedDate}`, 50, 100, { align: 'center' });
          doc.end();
          return;
        }
        
        // Draw 2 labels per page
        for (let i = 0; i < targetOrders.length; i += 2) {
          if (i > 0) {
            doc.addPage();
          }
          
          drawLabel(doc, targetOrders[i], 25);
          
          if (i + 1 < targetOrders.length) {
            doc.strokeColor('#777777').lineWidth(1).dash(5, { space: 5 }).moveTo(50, 396).lineTo(562, 396).stroke();
            doc.undash(); // reset line dash
            
            drawLabel(doc, targetOrders[i + 1], 415);
          }
        }
        
        doc.end();
        return;
      }
      
      // 3. Single Label (e.g. /api/orders/labels?orderId=...)
      if (id === 'labels' || parts[2] === 'labels') {
        const orderId = orderIdQuery || id;
        if (!orderId || orderId === 'labels') {
          return res.status(400).json({ error: "Missing orderId in query parameter" });
        }
        const order = await dbService.get("orders", orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        
        const doc = new PDFDocument({ margin: 0, size: 'LETTER' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Lainies-Label-Order-${order.orderNumber}.pdf`);
        doc.pipe(res);
        
        drawLabel(doc, order, 25);
        
        doc.end();
        return;
      }

      // Default orders listing
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
        const { status, paymentStatus } = req.body;
        const updateData: any = {};
        if (status) updateData.status = status;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;

        const updated = await dbService.update("orders", id, updateData);
        return res.status(200).json(updated);
      }

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
