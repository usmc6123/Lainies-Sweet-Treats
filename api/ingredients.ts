import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';
import PDFDocument from 'pdfkit';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  const adminUser = authenticateAdmin(req, res);
  if (!adminUser) return;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2]; // /api/ingredients/:id

    if (req.method === 'GET') {
      // Check if shopping list PDF is requested
      if (id === 'shopping-list') {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        if (!startDate || !endDate) {
          return res.status(400).json({ error: "Missing startDate or endDate query parameters" });
        }

        // 1. Fetch data
        const [orders, products, ingredients] = await Promise.all([
          dbService.list("orders"),
          dbService.list("products"),
          dbService.list("ingredients")
        ]);

        // 2. Filter orders
        const activeOrders = orders.filter((o: any) => {
          return (o.status === "Confirmed" || o.status === "In Progress") &&
                 o.fulfillmentDate >= startDate &&
                 o.fulfillmentDate <= endDate;
        });

        // 3. Process ingredients required
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

        // 4. Categorize ingredients
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

        // 5. Generate PDF
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Lainies-Shopping-List-${startDate}-to-${endDate}.pdf`);
        doc.pipe(res);

        // Render Background
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFF8F0');

        doc.fillColor('#3E2723');
        doc.font('Times-Bold').fontSize(24).text("Lainie's Sweet Treats", { align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('#8D6E63').text("Grocery & Supply Consolidated Shopping List", { align: 'center' });

        // Date Range subtitle
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#3E2723').text(`Range: ${startDate}  to  ${endDate}`, { align: 'center', paragraphGap: 10 });

        // Divider
        doc.strokeColor('#B76E79').lineWidth(2).moveTo(50, 105).lineTo(562, 105).stroke();

        let currentY = 125;

        // Section 1: Need to Buy
        doc.font('Times-Bold').fontSize(14).fillColor('#B76E79').text("SECTION 1: NEED TO BUY (INSUFFICIENT STOCK)", 50, currentY);
        currentY += 18;

        if (needToBuy.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor('#7d6259').text("All recipe items are covered by current in-use inventory levels! No shopping needed.", 60, currentY);
          currentY += 22;
        } else {
          // Table header
          doc.rect(50, currentY, 512, 18).fill('#F2E2D2');
          doc.fillColor('#3E2723').font('Helvetica-Bold').fontSize(9);
          doc.text("Ingredient Name", 60, currentY + 4);
          doc.text("Needed", 300, currentY + 4);
          doc.text("In Stock", 380, currentY + 4);
          doc.text("Deficit to Buy", 460, currentY + 4);
          currentY += 18;

          doc.font('Helvetica').fontSize(9);
          needToBuy.forEach((item) => {
            // Draw thin row border
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

        // Section 2: Already Covered
        doc.font('Times-Bold').fontSize(14).fillColor('#2E7D32').text("SECTION 2: ALREADY COVERED (SUFFICIENT STOCK)", 50, currentY);
        currentY += 18;

        if (alreadyHave.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor('#7d6259').text("No active required ingredients reside in the already covered levels.", 60, currentY);
          currentY += 22;
        } else {
          // Table header
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

        // Section 3: Missing Recipes
        if (missingIngredientProducts.size > 0) {
          doc.font('Times-Bold').fontSize(14).fillColor('#D84315').text("⚠ PRODUCTS WITH NO INGREDIENT DATA (CONFIRM MANUALLY)", 50, currentY);
          currentY += 18;

          doc.font('Helvetica').fontSize(9.5).fillColor('#3E2723');
          missingIngredientProducts.forEach((pName) => {
            doc.text(`• ${pName}`, 60, currentY);
            currentY += 15;
          });
        }

        // Footer
        doc.fillColor('#8D6E63').font('Times-Italic').fontSize(10).text("Lainie's Bake Shop supply compiler.", 50, doc.page.height - 50, { align: 'center', width: 512 });

        doc.end();
        return;
      }

      // Default Ingredients lists
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
