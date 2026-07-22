import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin, parseRoute } from './_lib/helper.js';
import { Order, Customer, Product, Ingredient, BlockedDate, Quote } from '../src/types.js';
import PDFDocument from 'pdfkit';
import { getStorage } from "firebase-admin/storage";
import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import crypto from "crypto";

// Helper for drawing PDF labels (reused from orders.ts)
function drawLabel(doc: any, order: any, startY: number) {
  const xStart = 50;
  const xEnd = 562;
  const width = xEnd - xStart;
  const height = 350;

  doc.rect(xStart, startY, width, height).lineWidth(2).strokeColor('#000000').stroke();

  let currentY = startY + 15;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
     .text("🍰 LAINIE'S SWEET TREATS", xStart + 15, currentY);
  
  doc.font('Helvetica').fontSize(10).fillColor('#000000')
     .text("Royse City, TX", xStart + 15, currentY + 18, { align: 'left' });

  currentY += 40;
  doc.moveTo(xStart, currentY).lineTo(xEnd, currentY).lineWidth(1).strokeColor('#000000').stroke();

  currentY += 10;
  doc.font('Helvetica-Bold').fontSize(12).text(`ORDER #${order.orderNumber}`, xStart + 15, currentY);
  doc.font('Helvetica-Bold').fontSize(11).text(`For: ${order.customerName}`, xStart + 15, currentY + 18);
  doc.font('Helvetica').fontSize(11).text(`📞 ${order.customerPhone || 'No Phone'}`, xStart + 15, currentY + 34);

  currentY += 55;
  doc.moveTo(xStart, currentY).lineTo(xEnd, currentY).stroke();

  currentY += 10;
  doc.font('Helvetica-Bold').fontSize(11).text("ITEMS:", xStart + 15, currentY);
  currentY += 16;
  doc.font('Helvetica').fontSize(10);
  
  order.items.forEach((item: any) => {
    let itemText = `• ${item.name} x${item.quantity}`;
    const descParts = [];
    if (item.size) descParts.push(`Scale: ${item.size}`);
    if (item.selectedCakeFlavors && item.selectedCakeFlavors.length > 0) {
      descParts.push(`Cake Flavor: ${item.selectedCakeFlavors.join(', ')}`);
    }
    if (item.selectedFrostings && item.selectedFrostings.length > 0) {
      descParts.push(`Frosting: ${item.selectedFrostings.join(', ')}`);
    } else if (item.flavor) {
      descParts.push(`Frosting: ${item.flavor}`);
    }
    const dText = item.selectedDrizzles && item.selectedDrizzles.length > 0 ? item.selectedDrizzles.join(', ') : item.selectedDrizzle;
    if (dText) descParts.push(`Drizzle: ${dText}`);
    const toppingsList = (item.selectedToppings && item.selectedToppings.length > 0) ? item.selectedToppings : item.addOns;
    if (toppingsList && toppingsList.length > 0) descParts.push(`Toppings: ${toppingsList.join(', ')}`);
    if (item.selectedSprinkles && item.selectedSprinkles.length > 0) descParts.push(`Sprinkles: ${item.selectedSprinkles.join(', ')}`);
    
    if (descParts.length > 0) {
      itemText += ` (${descParts.join(' | ')})`;
    }
    
    doc.text(itemText, xStart + 25, currentY, { width: width - 40 });
    currentY += doc.heightOfString(itemText, { width: width - 40 }) + 3;
  });

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
    const totalBoxY = startY + 310;
    doc.moveTo(xStart, totalBoxY).lineTo(xEnd, totalBoxY).stroke();
    doc.font('Helvetica-Bold').fontSize(11)
       .text(`Total Due: $${parseFloat(order.total).toFixed(2)}  |  Baking Surcharge Tip: $${parseFloat(order.tipAmount || 0).toFixed(2)}`, xStart + 15, totalBoxY + 8);
  }
}

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    const { action, id, subAction } = parseRoute(req);

    // ==========================================
    // PUBLIC READ ACTIONS (Settings, Blocked Dates, Products GET)
    // ==========================================
    if (action === "settings" && req.method === "GET") {
      const settings = await dbService.getSettings();
      return res.status(200).json(settings);
    }

    if (action === "blocked-dates" && req.method === "GET") {
      const dates = await dbService.list("blockedDates");
      return res.status(200).json(dates);
    }

    if (action === "products" && req.method === "GET") {
      const products = await dbService.list("products");
      return res.status(200).json(products);
    }

    // ==========================================
    // ALL OTHER ACTIONS REQUIRE ADMIN AUTHENTICATION
    // ==========================================
    const isPublicQuoteAction = (action === "quotes" && req.method === "POST");

    let adminUser = null;
    if (!isPublicQuoteAction) {
      adminUser = authenticateAdmin(req, res);
      if (!adminUser) return; // Handled by helper
    }

    switch (action) {
      // ------------------------------------------
      // SETTINGS
      // ------------------------------------------
      case "settings": {
        if (req.method === 'POST') {
          const updatedSettings = await dbService.saveSettings(req.body);
          return res.status(200).json(updatedSettings);
        }
        break;
      }

      // ------------------------------------------
      // COUPONS
      // ------------------------------------------
      case "coupons": {
        if (req.method === 'GET') {
          const coupons = await dbService.list("coupons");
          return res.status(200).json(coupons);
        }

        if (req.method === 'POST') {
          if (subAction === "toggle" && id) {
            // Support toggle action
            const coupon = await dbService.get("coupons", id);
            if (!coupon) return res.status(404).json({ error: "Coupon not found" });
            const updated = await dbService.update("coupons", id, { isActive: !coupon.isActive });
            return res.status(200).json(updated);
          }

          const couponId = req.body.id || id;
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
          if (!id) return res.status(400).json({ error: "Missing coupon ID in URL" });
          await dbService.delete("coupons", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // BLOCKED DATES
      // ------------------------------------------
      case "blocked-dates": {
        if (req.method === 'POST') {
          const newDate = await dbService.insert("blockedDates", req.body);
          return res.status(201).json(newDate);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error: "Missing blocked date ID in URL" });
          await dbService.delete("blockedDates", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // INGREDIENTS
      // ------------------------------------------
      case "ingredients": {
        if (req.method === 'GET') {
          if (subAction === "shopping-list") {
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            const startDate = url.searchParams.get('startDate');
            const endDate = url.searchParams.get('endDate');
            if (!startDate || !endDate) {
              return res.status(400).json({ error: "Missing startDate or endDate query parameters" });
            }

            const [orders, products, ingredients] = await Promise.all([
              dbService.list("orders"),
              dbService.list("products"),
              dbService.list("ingredients")
            ]);

            const activeOrders = orders.filter((o: any) => {
              return (o.status === "Confirmed" || o.status === "In Progress") &&
                     o.fulfillmentDate >= startDate &&
                     o.fulfillmentDate <= endDate;
            });

            const requiredMap: { [id: string]: number } = {};
            const missingIngredientProducts = new Set<string>();

            activeOrders.forEach((order: any) => {
              order.items.forEach((item: any) => {
                const p = products.find((prod: any) => prod.id === item.productId);
                if (!p || !p.ingredients || p.ingredients.length === 0) {
                  missingIngredientProducts.add(item.name);
                } else {
                  p.ingredients.forEach((link: any) => {
                    const qtyRequired = parseFloat(link.quantity) * parseInt(item.quantity);
                    requiredMap[link.ingredientId] = (requiredMap[link.ingredientId] || 0) + qtyRequired;
                  });
                }
              });
            });

            const needToBuy: any[] = [];
            const alreadyHave: any[] = [];

            ingredients.forEach((ing: any) => {
              const needed = requiredMap[ing.id] || 0;
              if (needed > 0) {
                const stock = ing.stock || 0;
                const diff = needed - stock;
                const row = {
                  name: ing.name,
                  unit: ing.unit,
                  need: needed,
                  have: stock,
                  toBuy: diff > 0 ? diff : 0
                };
                if (diff > 0) {
                  needToBuy.push(row);
                } else {
                  alreadyHave.push(row);
                }
              }
            });

            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Lainies-Shopping-List-${startDate}-to-${endDate}.pdf`);
            doc.pipe(res);

            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFF8F0');

            doc.fillColor('#3E2723');
            doc.font('Times-Bold').fontSize(24).text("Lainie's Sweet Treats", { align: 'center' });
            doc.font('Helvetica').fontSize(10).fillColor('#8D6E63').text("Grocery & Supply Consolidated Shopping List", { align: 'center' });
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#3E2723').text(`Range: ${startDate}  to  ${endDate}`, { align: 'center', paragraphGap: 10 });

            doc.strokeColor('#B76E79').lineWidth(2).moveTo(50, 105).lineTo(562, 105).stroke();

            let currentY = 125;

            doc.font('Times-Bold').fontSize(14).fillColor('#B76E79').text("SECTION 1: NEED TO BUY (INSUFFICIENT STOCK)", 50, currentY);
            currentY += 18;

            if (needToBuy.length === 0) {
              doc.font('Helvetica-Oblique').fontSize(10).fillColor('#7d6259').text("All recipe items are covered by current in-use inventory levels! No shopping needed.", 60, currentY);
              currentY += 22;
            } else {
              doc.rect(50, currentY, 512, 18).fill('#F2E2D2');
              doc.fillColor('#3E2723').font('Helvetica-Bold').fontSize(9);
              doc.text("Ingredient Name", 60, currentY + 4);
              doc.text("Needed", 300, currentY + 4);
              doc.text("In Stock", 380, currentY + 4);
              doc.text("Deficit to Buy", 460, currentY + 4);
              currentY += 18;

              doc.font('Helvetica').fontSize(9);
              needToBuy.forEach((item) => {
                doc.rect(50, currentY, 512, 18).lineWidth(0.5).strokeColor('#EAD5C3').stroke();
                doc.text(item.name, 60, currentY + 4);
                doc.text(`${item.need.toFixed(1)} ${item.unit}`, 300, currentY + 4);
                doc.text(`${item.have.toFixed(1)} ${item.unit}`, 380, currentY + 4);
                
                doc.font('Helvetica-Bold').fillColor('#C62828');
                doc.text(`${item.toBuy.toFixed(1)} ${item.unit}`, 460, currentY + 4);
                doc.font('Helvetica').fillColor('#3E2723');
                currentY += 18;
              });
              currentY += 15;
            }

            doc.font('Times-Bold').fontSize(14).fillColor('#2E7D32').text("SECTION 2: ALREADY COVERED (SUFFICIENT STOCK)", 50, currentY);
            currentY += 18;

            if (alreadyHave.length === 0) {
              doc.font('Helvetica-Oblique').fontSize(10).fillColor('#7d6259').text("No active required ingredients reside in the already covered levels.", 60, currentY);
              currentY += 22;
            } else {
              doc.rect(50, currentY, 512, 18).fill('#E8F5E9');
              doc.fillColor('#3E2723').font('Helvetica-Bold').fontSize(9);
              doc.text("Ingredient Name", 60, currentY + 4);
              doc.text("Needed", 300, currentY + 4);
              doc.text("In Stock", 380, currentY + 4);
              doc.text("Deficit to Buy", 460, currentY + 4);
              currentY += 18;

              doc.font('Helvetica').fontSize(9);
              alreadyHave.forEach((item) => {
                doc.rect(50, currentY, 512, 18).lineWidth(0.5).strokeColor('#C8E6C9').stroke();
                doc.text(item.name, 60, currentY + 4);
                doc.text(`${item.need.toFixed(1)} ${item.unit}`, 300, currentY + 4);
                doc.text(`${item.have.toFixed(1)} ${item.unit}`, 380, currentY + 4);
                doc.text(`Covered`, 460, currentY + 4);
                currentY += 18;
              });
              currentY += 15;
            }

            if (missingIngredientProducts.size > 0) {
              doc.font('Times-Bold').fontSize(14).fillColor('#D84315').text("⚠ PRODUCTS WITH NO INGREDIENT DATA (CONFIRM MANUALLY)", 50, currentY);
              currentY += 18;

              doc.font('Helvetica').fontSize(9.5).fillColor('#3E2723');
              missingIngredientProducts.forEach((pName) => {
                doc.text(`• ${pName}`, 60, currentY);
                currentY += 15;
              });
            }

            doc.fillColor('#8D6E63').font('Times-Italic').fontSize(10).text("Lainie's Bake Shop supply compiler.", 50, doc.page.height - 50, { align: 'center', width: 512 });

            doc.end();
            return;
          }

          const ingredients = await dbService.list("ingredients");
          return res.status(200).json(ingredients);
        }

        if (req.method === 'POST') {
          const newIng = await dbService.insert("ingredients", req.body);
          return res.status(201).json(newIng);
        }

        if (req.method === 'PUT') {
          if (!id) return res.status(400).json({ error: "Missing ingredient ID in URL" });
          const updatedIng = await dbService.update("ingredients", id, req.body);
          return res.status(200).json(updatedIng);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error: "Missing ingredient ID in URL" });
          await dbService.delete("ingredients", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // EXPENSES
      // ------------------------------------------
      case "expenses": {
        if (req.method === 'GET') {
          const expenses = await dbService.list("expenses");
          return res.status(200).json(expenses);
        }

        if (req.method === 'POST') {
          const newExp = await dbService.insert("expenses", req.body);
          return res.status(201).json(newExp);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error: "Missing expense ID in URL" });
          await dbService.delete("expenses", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // ORDERS
      // ------------------------------------------
      case "orders": {
        if (req.method === 'GET') {
          const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const orderIdQuery = url.searchParams.get('orderId');

          // receipt PDF
          if (subAction === 'receipt') {
            const orderId = orderIdQuery || id;
            if (!orderId) return res.status(400).json({ error: "Missing orderId" });
            const order = await dbService.get("orders", orderId);
            if (!order) return res.status(404).json({ error: "Order not found" });

            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Lainies-Sweet-Treats-Order-${order.orderNumber}.pdf`);
            doc.pipe(res);
            
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFF8F0');
            doc.fillColor('#3E2723');
            doc.font('Times-Bold').fontSize(26).text("Lainie's Sweet Treats", { align: 'center' });
            doc.font('Helvetica').fontSize(10).fillColor('#8D6E63').text("Royse City, TX  |  elainiehoncoop@gmail.com", { align: 'center' });
            
            const yLine = 90;
            doc.strokeColor('#B76E79').lineWidth(2).moveTo(50, yLine).lineTo(562, yLine).stroke();
            
            doc.fillColor('#3E2723');
            doc.font('Times-Bold').fontSize(18).text(`ORDER INVOICE & RECEIPT`, 50, 110);
            doc.font('Helvetica-Bold').fontSize(11).text(`Order Number: ${order.orderNumber}`, 50, 132);
            doc.font('Helvetica').fontSize(10).text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`, 50, 147);
            doc.text(`Fulfillment Date: ${order.fulfillmentDate} (${order.type === 'delivery' ? 'Local Delivery' : 'Store Pickup'})`, 50, 160);
            
            doc.rect(50, 180, 512, 65).lineWidth(1).strokeColor('#E0D0C0').stroke();
            doc.font('Helvetica-Bold').fontSize(11).text("CUSTOMER DETAILS", 60, 190);
            doc.font('Helvetica').fontSize(10).text(`Name: ${order.customerName}   |   Email: ${order.customerEmail}   |   Phone: ${order.customerPhone || 'N/A'}`, 60, 205);
            if (order.type === 'delivery') {
              doc.text(`Local Delivery Address: ${order.deliveryAddress || 'Not specified'}`, 60, 220, { width: 490 });
            } else {
              doc.text("Fulfillment Method: Store Pickup (508 Sweetwood Lane, Royse City, TX 75189)", 60, 220);
            }
            
            let yTable = 265;
            doc.rect(50, yTable, 512, 22).fill('#B76E79');
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
            doc.text("Item & Custom Specifications", 60, yTable + 6);
            doc.text("Qty", 380, yTable + 6);
            doc.text("Unit Cost", 440, yTable + 6);
            doc.text("Total", 500, yTable + 6);
            
            yTable += 22;
            doc.fillColor('#3E2723').font('Helvetica').fontSize(9);
            
            order.items.forEach((item: any) => {
              doc.rect(50, yTable, 512, 38).lineWidth(1).strokeColor('#F2E2D2').stroke();
              
              doc.font('Helvetica-Bold').fontSize(10).text(item.name, 60, yTable + 6, { width: 300 });
              const specParts = [];
              if (item.size) specParts.push(`Scale: ${item.size}`);
              if (item.selectedCakeFlavors && item.selectedCakeFlavors.length > 0) {
                specParts.push(`Cake Flavor: ${item.selectedCakeFlavors.join(', ')}`);
              }
              if (item.selectedFrostings && item.selectedFrostings.length > 0) {
                specParts.push(`Frosting: ${item.selectedFrostings.join(', ')}`);
              } else if (item.flavor) {
                specParts.push(`Frosting: ${item.flavor}`);
              }
              const dText = item.selectedDrizzles && item.selectedDrizzles.length > 0 ? item.selectedDrizzles.join(', ') : item.selectedDrizzle;
              if (dText) specParts.push(`Drizzle: ${dText}`);
              const tList = (item.selectedToppings && item.selectedToppings.length > 0) ? item.selectedToppings : item.addOns;
              if (tList && tList.length > 0) specParts.push(`Toppings: ${tList.join(', ')}`);
              if (item.selectedSprinkles && item.selectedSprinkles.length > 0) specParts.push(`Sprinkles: ${item.selectedSprinkles.join(', ')}`);
              if (specParts.length > 0) {
                doc.font('Helvetica').fontSize(8.5).fillColor('#7d6259').text(specParts.join('  |  '), 60, yTable + 20, { width: 300 });
              }
              
              doc.fillColor('#3E2723').font('Helvetica-Bold').fontSize(10);
              doc.text(String(item.quantity), 380, yTable + 14);
              doc.text(`$${parseFloat(item.unitPrice || 0).toFixed(2)}`, 440, yTable + 14);
              doc.text(`$${parseFloat(item.totalPrice || 0).toFixed(2)}`, 500, yTable + 14);
              
              yTable += 38;
            });
            
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
            
            yTable += 40;
            const isPaid = order.paymentStatus === 'Paid';
            doc.rect(50, yTable, 120, 32).fill(isPaid ? '#E8F5E9' : '#FFEBEE');
            doc.strokeColor(isPaid ? '#2E7D32' : '#C62828').lineWidth(1.5).rect(50, yTable, 120, 32).stroke();
            doc.fillColor(isPaid ? '#2E7D32' : '#C62828').font('Helvetica-Bold').fontSize(11).text(isPaid ? "✓ PAID IN FULL" : "✖ UNPAID", 62, yTable + 10);
            
            doc.fillColor('#8D6E63').font('Times-Italic').fontSize(11).text("Thank you for your order! Custom-baked with love in Royse City, TX.", 50, doc.page.height - 100, { align: 'center', width: 512 });
            doc.font('Helvetica').fontSize(9).text("Lainie's Sweet Treats  |  Questions? contact elainiehoncoop@gmail.com", 50, doc.page.height - 80, { align: 'center', width: 512 });
            
            doc.end();
            return;
          }

          // batch labels-date PDF
          if (subAction === 'labels-date') {
            const selectedDate = url.searchParams.get('date');
            if (!selectedDate) return res.status(400).json({ error: "Missing date query parameter" });
            
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
            
            for (let i = 0; i < targetOrders.length; i += 2) {
              if (i > 0) doc.addPage();
              drawLabel(doc, targetOrders[i], 25);
              if (i + 1 < targetOrders.length) {
                doc.strokeColor('#777777').lineWidth(1).dash(5, { space: 5 }).moveTo(50, 396).lineTo(562, 396).stroke();
                doc.undash();
                drawLabel(doc, targetOrders[i + 1], 415);
              }
            }
            
            doc.end();
            return;
          }

          // single label PDF
          if (subAction === 'labels') {
            const orderId = orderIdQuery || id;
            if (!orderId) return res.status(400).json({ error: "Missing orderId" });
            const order = await dbService.get("orders", orderId);
            if (!order) return res.status(404).json({ error: "Order not found" });
            
            const doc = new PDFDocument({ margin: 0, size: 'LETTER' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Lainies-Label-Order-${order.orderNumber}.pdf`);
            doc.pipe(res);
            
            drawLabel(doc, order, 25);
            doc.end();
            return;
          }

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
          if (!id) return res.status(400).json({ error: "Missing order ID in URL" });

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
          if (!id) return res.status(400).json({ error: "Missing order ID in URL" });
          await dbService.delete("orders", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // CUSTOMERS
      // ------------------------------------------
      case "customers": {
        if (req.method === 'GET') {
          const customers = await dbService.list("customers");
          return res.status(200).json(customers);
        }

        if (req.method === 'POST') {
          const customer = await dbService.insert("customers", req.body);
          return res.status(201).json(customer);
        }

        if (req.method === 'PUT') {
          if (!id) return res.status(400).json({ error: "Missing customer ID in URL" });
          const customer = await dbService.update("customers", id, req.body);
          return res.status(200).json(customer);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error: "Missing customer ID in URL" });
          await dbService.delete("customers", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // ANALYTICS
      // ------------------------------------------
      case "analytics": {
        if (req.method === 'GET') {
          const orders: Order[] = await dbService.list("orders");
          const customers: Customer[] = await dbService.list("customers");
          const products: Product[] = await dbService.list("products");
          const ingredients: Ingredient[] = await dbService.list("ingredients");

          const validOrders = orders.filter(o => o.status !== "Cancelled");
          const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
          const averageOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
          const returnees = customers.filter(c => c.orderCount > 1).length;
          const returnRate = customers.length > 0 ? (returnees / customers.length) * 100 : 0;

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

          const calculatedMargins = products.map(p => {
            let cost = 0;
            p.ingredients.forEach(link => {
              const ing = ingredients.find(i => i.id === link.ingredientId);
              if (ing) cost += ing.costPerUnit * link.quantity;
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
        }
        break;
      }

      // ------------------------------------------
      // PRODUCTS
      // ------------------------------------------
      case "products": {
        try {
          if (req.method === 'POST') {
            const newProduct = await dbService.insert("products", req.body);
            return res.status(201).json(newProduct);
          }

          if (req.method === 'PUT') {
            if (!id) return res.status(400).json({ error: "Missing product ID in URL" });
            const updatedProduct = await dbService.update("products", id, req.body);
            return res.status(200).json(updatedProduct);
          }

          if (req.method === 'DELETE') {
            if (!id) return res.status(400).json({ error: "Missing product ID in URL" });
            await dbService.delete("products", id);
            return res.status(200).json({ success: true });
          }
        } catch (dbError: any) {
          console.error("[Diagnostics] Firestore Product Operation Failed:", {
            action: req.method === 'POST' ? 'INSERT' : req.method === 'PUT' ? 'UPDATE' : 'DELETE',
            collection: 'products',
            documentId: id || 'N/A',
            payloadKeys: req.body ? Object.keys(req.body) : [],
            payloadKeysCount: req.body ? Object.keys(req.body).length : 0,
            errorMessage: dbError.message,
            stack: dbError.stack
          });
          return res.status(500).json({
            error: `Database save failed: ${dbError.message}`,
            details: dbError.stack || dbError.message
          });
        }
        break;
      }

      // ------------------------------------------
      // QUOTES
      // ------------------------------------------
      case "quotes": {
        if (req.method === 'GET') {
          const quotes = await dbService.list("quotes");
          return res.status(200).json(quotes);
        }

        if (req.method === 'POST') {
          if (id && subAction === "respond") {
            const { action: decision } = req.body; // "accept" or "decline"
            const quote: Quote | null = await dbService.get("quotes", id);
            if (!quote) {
              return res.status(404).json({ error: "Quote not found." });
            }

            if (decision === "accept") {
              const updatedQuote = await dbService.update("quotes", quote.id, { status: "Accepted" });
              const orders = await dbService.list("orders");
              const orderNum = `LST-${1000 + orders.length + 1}`;
              const settings = await dbService.getSettings();
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
            } else if (decision === "decline") {
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

        if (req.method === 'PUT') {
          if (!id) return res.status(400).json({ error: "Missing quote ID in URL" });
          const updatedQuote = await dbService.update("quotes", id, req.body);
          return res.status(200).json(updatedQuote);
        }

        if (req.method === 'DELETE') {
          if (!id) return res.status(400).json({ error: "Missing quote ID in URL" });
          await dbService.delete("quotes", id);
          return res.status(200).json({ success: true });
        }
        break;
      }

      // ------------------------------------------
      // UPLOAD (Authenticated Media Uploads)
      // ------------------------------------------
      case "upload": {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

        const firebaseConfigEnv = process.env.FIREBASE_CONFIG;
        if (!firebaseConfigEnv) {
          return res.status(500).json({ error: "FIREBASE_CONFIG environment variable is missing" });
        }

        const credentials = JSON.parse(firebaseConfigEnv);

        if (getApps().length === 0) {
          if (credentials.private_key || credentials.client_email) {
            initializeApp({ credential: cert(credentials) });
          } else {
            initializeApp({ projectId: credentials.projectId || 'lainies-sweet-treats' });
          }
        }

        const { filename, contentType, base64, productId } = req.body;
        if (!base64 || !filename) {
          return res.status(400).json({ error: "Missing file base64 data or filename in request" });
        }

        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const app = getApp();
        
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET ||
                           credentials.storageBucket ||
                           credentials.storage_bucket ||
                           "lainies-sweet-treats.firebasestorage.app";

        const storage = getStorage(app);
        const bucket = storage.bucket(bucketName);

        const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const folderId = productId ? productId : "new-product";
        const filePath = `products/${folderId}/photo_${Date.now()}_${cleanFilename}`;
        const file = bucket.file(filePath);

        const downloadToken = crypto.randomUUID();

        await file.save(buffer, {
          metadata: {
            contentType: contentType || "image/jpeg",
            cacheControl: 'public, max-age=31536000',
            metadata: { firebaseStorageDownloadTokens: downloadToken }
          }
        });

        try {
          await file.makePublic();
        } catch (makePublicErr) {
          console.warn("makePublic failed. Proceeding with signed/token url format:", makePublicErr);
        }

        const encodedFilePath = encodeURIComponent(filePath);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedFilePath}?alt=media&token=${downloadToken}`;

        return res.status(200).json({
          success: true,
          url: publicUrl,
          filePath: filePath
        });
      }

      default:
        return res.status(404).json({ error: `Action ${action} is not supported.` });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
