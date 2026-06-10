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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-brand-pink/20 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase font-bold">Tracked Ingredients</span>
            <span className="text-xl font-bold text-brand-chocolate">{ingredients.length} items</span>
          </div>
          <Package className="h-5 w-5 text-brand-rosegold" />
        </div>
        
        <div className="bg-white border border-brand-pink/20 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Expenses Logged</span>
            <span className="text-xl font-bold text-brand-chocolate">${totalExpensesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <DollarSign className="h-5 w-5 text-red-500" />
        </div>

        <div className="bg-white border border-brand-pink/20 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase font-bold">Ledger Balance status</span>
            <span className="text-xs text-green-700 font-bold bg-green-50 px-2.5 py-1 rounded-full border border-green-200">ACTIVE SHEETS</span>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Ingredient Library ledger Left column */}
        <div className="bg-white border border-brand-pink/25 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-brand-pink/10">
            <h3 className="text-base font-bold text-brand-chocolate flex items-center space-x-1.5">
              <Package className="h-4.5 w-4.5 text-brand-rosegold" />
              <span>Ingredient Pricing Library</span>
            </h3>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="text-[11px] bg-brand-cream/20 border border-brand-pink/15 px-3 py-1 rounded-lg w-40"
            />
          </div>

          <form onSubmit={handleAddIngredient} className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-brand-cream/20 p-3 rounded-2xl border border-brand-pink/10 text-xs">
            <div className="col-span-2">
              <label className="text-[9px] uppercase font-bold text-gray-400">Ingredient Name</label>
              <input
                type="text"
                required
                value={ingName}
                onChange={(e) => setIngName(e.target.value)}
                placeholder="Bulk Cake Flour"
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-gray-400">Cost/Unit ($)</label>
              <input
                type="number"
                required
                step="0.0001"
                min="0.0001"
                value={ingCostUnit}
                onChange={(e) => setIngCostUnit(Number(e.target.value))}
                placeholder="0.08"
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-gray-400">Unit Type</label>
              <select
                value={ingUnit}
                onChange={(e) => setIngUnit(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
              >
                <option value="oz">Ounces (oz)</option>
                <option value="g">Grams (g)</option>
                <option value="lbs">Pounds (lbs)</option>
                <option value="count">Count (ea)</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-[9px] uppercase font-bold text-gray-400">Classification</label>
              <select
                value={ingCategory}
                onChange={(e) => setIngCategory(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
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
                className="w-full bg-brand-chocolate text-white hover:opacity-90 transition font-bold py-1.5 rounded-lg text-[11px]"
              >
                Save
              </button>
            </div>
          </form>

          {/* Table display */}
          <div className="max-h-72 overflow-y-auto pr-1">
            <table className="w-full text-xs text-left text-brand-chocolate">
              <thead>
                <tr className="border-b border-brand-pink/15 text-gray-400 font-semibold text-[9px] uppercase tracking-wider">
                  <th className="py-2.5">Name</th>
                  <th className="py-2.5">Classification</th>
                  <th className="py-2.5">Unit Cost</th>
                  <th className="py-2.5 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-pink/5">
                {filteredIngredients.map(item => (
                  <tr key={item.id} className="hover:bg-brand-pink/5">
                    <td className="py-3 font-semibold">{item.name}</td>
                    <td className="py-3 text-[11px] text-gray-500">{item.category}</td>
                    <td className="py-3 font-mono text-xs font-bold">${item.costPerUnit.toFixed(4)} / {item.unit}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDeleteIngredient(item.id)}
                        className="text-red-500 hover:text-red-700 p-1 font-bold"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses Book Right column */}
        <div className="bg-white border border-brand-pink/25 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-brand-pink/10">
            <h3 className="text-base font-bold text-brand-chocolate flex items-center space-x-1.5">
              <ShoppingBag className="h-4.5 w-4.5 text-red-500" />
              <span>Business Outlays & Expenses Book</span>
            </h3>
          </div>

          <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-2 bg-brand-cream/15 p-3 rounded-2xl border border-brand-pink/10 text-xs">
            <div className="col-span-2">
              <label className="text-[9px] uppercase font-bold text-gray-400">Expense Label / Description</label>
              <input
                type="text"
                required
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Stand Mixer Beater attachment"
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-gray-400">Amount ($)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0.1"
                value={expAmount}
                onChange={(e) => setExpAmount(Number(e.target.value))}
                placeholder="49.99"
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-gray-400">Billing Date</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[9px] uppercase font-bold text-gray-400">Expense Category</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="w-full bg-white border border-brand-pink/15 p-1.5 rounded-lg text-[11px] mt-1"
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
                className="w-full bg-brand-chocolate text-brand-cream hover:opacity-90 font-bold py-2 rounded-lg text-[11px]"
              >
                Record Outlay Transaction
              </button>
            </div>
          </form>

          {/* Expenses ledgers list */}
          <div className="max-h-70 overflow-y-auto pr-1 space-y-2">
            {expenses.map(exp => (
              <div key={exp.id} className="p-3 bg-brand-pink/5 hover:bg-brand-pink/10 transition rounded-xl border border-brand-pink/5 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-brand-chocolate">{exp.description}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">{exp.date} • {exp.category}</p>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="font-mono text-sm font-bold text-red-600">-${exp.amount.toFixed(2)}</span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-red-500 hover:text-red-800 font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
