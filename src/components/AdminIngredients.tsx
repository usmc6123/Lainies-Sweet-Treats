import React, { useState, useEffect } from "react";
import { PlusCircle, Search, Trash2, ClipboardList, Package, HelpCircle, FileText, ShoppingBag, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { Ingredient, Expense } from "../types";

interface AdminIngredientsProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminIngredients({ token, triggerRefresh }: AdminIngredientsProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Shopping list generator states
  const [shoppingStartDate, setShoppingStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shoppingEndDate, setShoppingEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [shoppingListInput, setShoppingListInput] = useState<any | null>(null);
  const [calculatingList, setCalculatingList] = useState(false);

  const handleGenerateShoppingList = async () => {
    setCalculatingList(true);
    setShoppingListInput(null);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch("/api/orders", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("/api/products", {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (ordersRes.ok && productsRes.ok) {
        const ordersData = await ordersRes.json();
        const productsData = await productsRes.json();

        // Filter active orders (Confirmed or In Progress within range)
        const activeOrders = ordersData.filter((o: any) => {
          return (o.status === "Confirmed" || o.status === "In Progress") &&
                 o.fulfillmentDate >= shoppingStartDate &&
                 o.fulfillmentDate <= shoppingEndDate;
        });

        // Map requirements
        const requiredMap: { [id: string]: number } = {};
        const missingIngredientProducts = new Set<string>();

        activeOrders.forEach((order: any) => {
          order.items.forEach((item: any) => {
            const p = productsData.find((prod: any) => prod.id === item.productId);
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

        // Form results lists
        const needToBuy: any[] = [];
        const alreadyHave: any[] = [];

        ingredients.forEach((ing: any) => {
          const needed = requiredMap[ing.id] || 0;
          if (needed > 0) {
            const stock = ing.stock || 0;
            const diff = needed - stock;
            const row = {
              id: ing.id,
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

        setShoppingListInput({
          needToBuy,
          alreadyHave,
          missingProducts: Array.from(missingIngredientProducts)
        });
      } else {
        alert("Could not load backend products or orders data.");
      }
    } catch (err) {
      console.error(err);
      alert("Error calculating shopping list details.");
    } finally {
      setCalculatingList(false);
    }
  };

  // Ingredient Form
  const [ingName, setIngName] = useState("");
  const [ingCostUnit, setIngCostUnit] = useState<number>(0);
  const [ingUnit, setIngUnit] = useState("oz");
  const [ingCategory, setIngCategory] = useState("Pantry Staple");

  // Expense Form
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState("");
  const [expCategory, setExpCategory] = useState("Bakery Ingredients");

  const [searchQuery, setSearchQuery] = useState("");

  const loadIngredientsAndExpenses = async () => {
    setLoading(true);
    try {
      const [ingRes, expRes] = await Promise.all([
        fetch("/api/ingredients", {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch("/api/expenses", {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);
      if (ingRes.ok) setIngredients(await ingRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
    } catch (err) {
      console.error("Failed to fetch ingredients/expenses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngredientsAndExpenses();
  }, [token]);

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName || ingCostUnit <= 0) return;

    const payload = {
      name: ingName,
      costPerUnit: Number(ingCostUnit),
      unit: ingUnit,
      category: ingCategory
    };

    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const added = await res.json();
        setIngredients([...ingredients, added]);
        setIngName("");
        setIngCostUnit(0);
        triggerRefresh();
        alert("Ingredient added to the library sheet.");
      }
    } catch {
      alert("Error saving ingredient specs.");
    }
  };

  const handleDeleteIngredient = async (ingId: string) => {
    if (!confirm("Remove this ingredient from recipe cost calculator?")) return;
    try {
      const res = await fetch(`/api/ingredients/${ingId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setIngredients(ingredients.filter(i => i.id !== ingId));
        triggerRefresh();
      }
    } catch {
      alert("Error deleting ingredient.");
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc || expAmount <= 0) return;

    const payload = {
      description: expDesc,
      amount: Number(expAmount),
      date: expDate || new Date().toISOString().split("T")[0],
      category: expCategory
    };

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const added = await res.json();
        setExpenses([...expenses, added]);
        setExpDesc("");
        setExpAmount(0);
        setExpDate("");
        triggerRefresh();
        alert("Expense entry added successfully.");
      }
    } catch {
      alert("Error writing expense log.");
    }
  };

  const handleDeleteExpense = async (expId: string) => {
    if (!confirm("Are you sure you want to delete this expense history row?")) return;
    try {
      const res = await fetch(`/api/expenses/${expId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setExpenses(expenses.filter(e => e.id !== expId));
        triggerRefresh();
      }
    } catch {
      alert("Error removing expense.");
    }
  };

  const filteredIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalExpensesSum = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div id="admin-ingredients-tab" className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Ledger stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-brand-pink/20 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#B76E79] block uppercase font-extrabold tracking-wider">Tracked Ingredients</span>
            <span className="text-2xl font-black text-brand-chocolate mt-1 block">{ingredients.length} items</span>
          </div>
          <Package className="h-6 w-6 text-brand-rosegold" />
        </div>
        
        <div className="bg-white border border-brand-pink/20 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#B76E79] block uppercase font-extrabold tracking-wider">Total Expenses Logged</span>
            <span className="text-2xl font-black text-brand-chocolate mt-1 block">${totalExpensesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <DollarSign className="h-6 w-6 text-red-500" />
        </div>

        <div className="bg-white border border-brand-pink/20 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-[#B76E79] block uppercase font-extrabold tracking-wider">Ledger Balance Status</span>
            <span className="text-xs text-green-700 font-extrabold bg-green-50 px-3 py-1.5 rounded-full border border-green-200 mt-2 inline-block">ACTIVE SHEETS</span>
          </div>
          <TrendingUp className="h-6 w-6 text-emerald-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Ingredient Library ledger Left column */}
        <div className="bg-white border border-brand-pink/25 rounded-[2rem] p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-brand-pink/10">
            <h3 className="text-lg lg:text-xl font-bold text-brand-chocolate flex items-center space-x-2 font-heading">
              <Package className="h-5.5 w-5.5 text-brand-rosegold" />
              <span>Ingredient Pricing Library</span>
            </h3>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="text-xs bg-brand-cream/20 border border-brand-pink/15 px-3 py-2 rounded-xl w-48 font-medium focus:none"
            />
          </div>

          <form onSubmit={handleAddIngredient} className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-cream/20 p-4 rounded-3xl border border-brand-pink/10 text-xs">
            <div className="col-span-2">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Ingredient Name</label>
              <input
                type="text"
                required
                value={ingName}
                onChange={(e) => setIngName(e.target.value)}
                placeholder="Bulk Cake Flour"
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Cost/Unit ($)</label>
              <input
                type="number"
                required
                step="0.0001"
                min="0.0001"
                value={ingCostUnit}
                onChange={(e) => setIngCostUnit(Number(e.target.value))}
                placeholder="0.08"
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Unit Type</label>
              <select
                value={ingUnit}
                onChange={(e) => setIngUnit(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block"
              >
                <option value="oz">Ounces (oz)</option>
                <option value="g">Grams (g)</option>
                <option value="lbs">Pounds (lbs)</option>
                <option value="count">Count (ea)</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Classification</label>
              <select
                value={ingCategory}
                onChange={(e) => setIngCategory(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block"
              >
                <option value="Pantry Staple">Pantry Staple (Sugar, Flour)</option>
                <option value="Dairy & Fresh">Dairy & Fresh (Butter, Eggs)</option>
                <option value="Flavorings">Extracts & Flavorings (Vanilla, Lemon)</option>
                <option value="Toppings & Decor">Toppings & Decor (Sprinkles, Fondant)</option>
                <option value="Packaging">Packaging (Cake Boxes, Ribbons)</option>
              </select>
            </div>
            <div className="col-span-1 pt-4.5">
              <button
                type="submit"
                className="w-full bg-brand-chocolate text-white hover:opacity-95 transition font-bold py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer"
              >
                Save
              </button>
            </div>
          </form>

          {/* Table display */}
          <div className="max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-xs sm:text-sm text-left text-brand-chocolate">
              <thead>
                <tr className="border-b border-brand-pink/15 text-gray-400 font-extrabold text-[10px] uppercase tracking-wider">
                  <th className="py-3">Name</th>
                  <th className="py-3">Classification</th>
                  <th className="py-3">Unit Cost</th>
                  <th className="py-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-pink/5 font-semibold">
                {filteredIngredients.map(item => (
                  <tr key={item.id} className="hover:bg-brand-pink/5">
                    <td className="py-3.5 font-bold">{item.name}</td>
                    <td className="py-3.5 text-xs text-gray-500 font-bold">{item.category}</td>
                    <td className="py-3.5 font-mono text-xs font-bold text-brand-chocolate">${item.costPerUnit.toFixed(4)} / {item.unit}</td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteIngredient(item.id)}
                        className="text-red-500 hover:text-red-700 p-1.5 font-extrabold"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>        {/* Expenses Book Right column */}
        <div className="bg-white border border-brand-pink/25 rounded-[2rem] p-6 shadow-sm space-y-5">
          <div className="pb-3 border-b border-brand-pink/10">
            <h3 className="text-lg lg:text-xl font-bold text-brand-chocolate flex items-center space-x-2 font-heading">
              <ShoppingBag className="h-5.5 w-5.5 text-red-500" />
              <span>Business Outlays & Expenses Book</span>
            </h3>
          </div>

          <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-3 bg-brand-cream/15 p-4 rounded-3xl border border-brand-pink/10 text-xs">
            <div className="col-span-2">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Expense Label / Description</label>
              <input
                type="text"
                required
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Stand Mixer Beater attachment"
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Amount ($)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0.1"
                value={expAmount}
                onChange={(e) => setExpAmount(Number(e.target.value))}
                placeholder="49.99"
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate mt-1 inline-block font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Billing Date</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-2 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-gray-500 block">Expense Category</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-2.5 rounded-xl text-xs sm:text-sm text-brand-chocolate font-medium mt-1 inline-block"
              >
                <option value="Bakery Ingredients">Bakery Ingredients (Bulk stock flour, icing)</option>
                <option value="Baking Utilities">Baking Utilities (Pans, offset spatulas, parchment)</option>
                <option value="GCP Cloud & Web Hosting">GCP Cloud & Web Hosting (Database, squarespace, email)</option>
                <option value="Local Marketing">Local Marketing & Flyers (Royse City market booths, stickers)</option>
                <option value="Fulfillment Fuel">Fulfillment Fuel (Gasoline, delivery boxes)</option>
              </select>
            </div>
            <div className="col-span-2 pt-2">
              <button
                type="submit"
                className="w-full bg-brand-chocolate text-brand-cream hover:opacity-95 font-bold py-3.5 rounded-xl text-xs sm:text-sm cursor-pointer shadow-sm transition"
              >
                Record Outlay Transaction
              </button>
            </div>
          </form>

          {/* Expenses ledgers list */}
          <div className="max-h-80 overflow-y-auto pr-1 space-y-2.5">
            {expenses.map(exp => (
              <div key={exp.id} className="p-3.5 bg-brand-pink/5 hover:bg-brand-pink/10 transition rounded-xl border border-brand-pink/5 flex justify-between items-center text-sm font-semibold">
                <div>
                  <h4 className="font-extrabold text-[#B76E79] lg:text-base">{exp.description}</h4>
                  <p className="text-xs text-gray-500 mt-0.5 font-bold">{exp.date} • {exp.category}</p>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="font-mono text-base font-extrabold text-red-650">-${exp.amount.toFixed(2)}</span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-red-500 hover:text-red-800 font-extrabold p-1 text-sm bg-red-50 rounded"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Feature 3: Consolidated Shopping List Generator */}
      <div className="bg-white border border-brand-pink/25 rounded-[2.5rem] p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-brand-pink/10 pb-4 gap-4">
          <div className="flex items-center space-x-2.5">
            <ClipboardList className="h-6 w-6 text-brand-rosegold" />
            <div>
              <h3 className="text-xl font-bold text-brand-chocolate font-heading">
                Consolidated Grocery & Supply Shopping List
              </h3>
              <p className="text-xs text-brand-chocolate/65">
                Aggregate supply requirements across confirmed upcoming bakes within a delivery date range.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs">
            <div className="flex items-center gap-2 bg-brand-cream/35 border border-brand-pink/15 px-3 py-2 rounded-xl">
              <span className="font-bold text-brand-chocolate/75">From:</span>
              <input
                type="date"
                value={shoppingStartDate}
                onChange={(e) => setShoppingStartDate(e.target.value)}
                className="bg-transparent font-bold text-brand-chocolate focus:outline-none"
              />
              <span className="font-bold text-brand-chocolate/75 ml-1">To:</span>
              <input
                type="date"
                value={shoppingEndDate}
                onChange={(e) => setShoppingEndDate(e.target.value)}
                className="bg-transparent font-bold text-brand-chocolate focus:outline-none"
              />
            </div>
            
            <button
               type="button"
               disabled={calculatingList}
               onClick={handleGenerateShoppingList}
               className="bg-[#B76E79] hover:opacity-95 text-white px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {calculatingList ? "Calculating..." : "Generate List"}
            </button>
            
            {shoppingListInput && (
              <a
                href={`/api/ingredients/shopping-list?startDate=${shoppingStartDate}&endDate=${shoppingEndDate}&token=${token}`}
                target="_blank"
                rel="noreferrer"
                className="bg-brand-chocolate text-brand-cream text-center px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider hover:opacity-90 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                Download PDF
              </a>
            )}
          </div>
        </div>

        {/* Results Screen */}
        {shoppingListInput ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {/* Column 1: Need to buy */}
            <div className="bg-red-50/20 border border-red-200/50 p-5 rounded-3xl space-y-3.5">
              <div className="flex justify-between items-center pb-2 border-b border-red-200/45">
                <h4 className="font-bold text-red-800 text-sm flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-650 animate-pulse" />
                  <span>Out of Stock deficit ("Need to shop")</span>
                </h4>
                <span className="text-xs bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md">
                  {shoppingListInput.needToBuy.length} items deficit
                </span>
              </div>
              
              {shoppingListInput.needToBuy.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  Perfect! All items are fully covered by in-store ingredients inventory.
                </p>
              ) : (
                <div className="divide-y divide-red-100/40 max-h-80 overflow-y-auto pr-1">
                  {shoppingListInput.needToBuy.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2.5 text-xs">
                      <span className="font-semibold text-brand-chocolate">{item.name}</span>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-gray-500 font-medium">Req: {item.need.toFixed(1)} / Has: {item.have.toFixed(1)}</p>
                        <p className="text-[11px] text-red-700 font-bold">To Buy: {item.toBuy.toFixed(1)} {item.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Already have enough */}
            <div className="bg-green-50/25 border border-green-200/50 p-5 rounded-3xl space-y-3.5">
              <div className="flex justify-between items-center pb-2 border-b border-green-200/40">
                <h4 className="font-bold text-green-800 text-sm flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-650" />
                  <span>Inventory Sufficient ("Already covered")</span>
                </h4>
                <span className="text-xs bg-green-150 text-green-800 font-bold px-2 py-0.5 rounded-md">
                  {shoppingListInput.alreadyHave.length} items ok
                </span>
              </div>
              
              {shoppingListInput.alreadyHave.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">
                  No active ingredients have already satisfied conditions.
                </p>
              ) : (
                <div className="divide-y divide-green-100/40 max-h-80 overflow-y-auto pr-1">
                  {shoppingListInput.alreadyHave.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2.5 text-xs">
                      <span className="font-medium text-brand-chocolate/75">{item.name}</span>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-gray-500">Needed: {item.need.toFixed(1)} {item.unit}</p>
                        <p className="text-[11px] text-green-700 font-bold">Covered (Instore: {item.have.toFixed(1)})</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Products missing recipe profiles */}
            {shoppingListInput.missingProducts.length > 0 && (
              <div className="md:col-span-2 bg-yellow-50/30 border border-yellow-200/60 p-5 rounded-3xl space-y-2">
                <h4 className="font-bold text-yellow-800 text-sm">
                  ⚠️ Products with no ingredient database metrics — check profiles manually:
                </h4>
                <div className="flex flex-wrap gap-2 pt-1 font-medium text-xs">
                  {shoppingListInput.missingProducts.map((pName: string, idx: number) => (
                    <span key={idx} className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-lg border border-yellow-250">
                      • {pName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-brand-cream/5 border border-dashed border-brand-pink/20 rounded-3xl">
            <ClipboardList className="h-8 w-8 text-brand-pink mb-2" />
            <p className="text-sm font-semibold text-brand-chocolate/70">Shopping aggregation list is uncalculated yet.</p>
            <p className="text-xs text-gray-400 mt-1 text-center max-w-sm">
              Press "Generate List" to automatically compute deficits against your real-time ingredients repository stock!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
