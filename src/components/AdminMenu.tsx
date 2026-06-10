import React, { useState, useEffect } from "react";
import { PlusCircle, Edit2, Trash2, HelpCircle, FileText, Sparkles, DollarSign, Tag, Scale } from "lucide-react";
import { Product, Ingredient, ProductIngredientLink } from "../types";

interface AdminMenuProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminMenu({ token, triggerRefresh }: AdminMenuProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Custom Cakes");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [imgUrl, setImgUrl] = useState("");
  
  // Options (simplified list editors)
  const [sizes, setSizes] = useState<{ name: string; priceAdd: number }[]>([]);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<{ name: string; priceAdd: number }[]>([]);
  
  // Ingredient Links for cost accounting
  const [prodIngredients, setProdIngredients] = useState<ProductIngredientLink[]>([]);

  // Helpers for array editors
  const [newSizeName, setNewSizeName] = useState("");
  const [newSizePrice, setNewSizePrice] = useState(0);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newAddOnName, setNewAddOnName] = useState("");
  const [newAddOnPrice, setNewAddOnPrice] = useState(0);

  const [inputIngId, setInputIngId] = useState("");
  const [inputIngQty, setInputIngQty] = useState(0);

  const categories = ["Mini Cakes", "Cupcakes", "Cookies", "Cake Pops", "Dessert Trays", "Custom Cakes", "Seasonal Specials"];

  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const [pRes, iRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/ingredients", {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);
      if (pRes.ok) setProducts(await pRes.json());
      if (iRes.ok) setIngredients(await iRes.json());
    } catch (err) {
      console.error("Failed to load catalog menu assets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, [token]);

  const handleEditClick = (p: Product) => {
    setEditingProduct(p);
    setIsAdding(false);
    
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setBasePrice(p.basePrice);
    setImgUrl(p.imgUrl);
    
    setSizes(p.options.sizes || []);
    setFlavors(p.options.flavors || []);
    setAddOns(p.options.addOns || []);
    setProdIngredients(p.ingredients || []);
  };

  const handleNewClick = () => {
    setEditingProduct(null);
    setIsAdding(true);
    
    setName("");
    setDescription("");
    setCategory("Custom Cakes");
    setBasePrice(0);
    setImgUrl("");
    
    setSizes([]);
    setFlavors([]);
    setAddOns([]);
    setProdIngredients([]);
  };

  const handleAddSizeOption = () => {
    if (!newSizeName) return;
    setSizes([...sizes, { name: newSizeName, priceAdd: Number(newSizePrice) }]);
    setNewSizeName("");
    setNewSizePrice(0);
  };

  const handleRemoveSizeOption = (idx: number) => {
    setSizes(sizes.filter((_, i) => i !== idx));
  };

  const handleAddFlavorOption = () => {
    if (!newFlavorName) return;
    setFlavors([...flavors, newFlavorName]);
    setNewFlavorName("");
  };

  const handleRemoveFlavorOption = (idx: number) => {
    setFlavors(flavors.filter((_, i) => i !== idx));
  };

  const handleAddAddOnOption = () => {
    if (!newAddOnName) return;
    setAddOns([...addOns, { name: newAddOnName, priceAdd: Number(newAddOnPrice) }]);
    setNewAddOnName("");
    setNewAddOnPrice(0);
  };

  const handleRemoveAddOnOption = (idx: number) => {
    setAddOns(addOns.filter((_, i) => i !== idx));
  };

  const handleAddIngLink = () => {
    if (!inputIngId || inputIngQty <= 0) return;
    const exists = prodIngredients.some(x => x.ingredientId === inputIngId);
    if (exists) {
      setProdIngredients(prodIngredients.map(x => x.ingredientId === inputIngId ? { ...x, quantity: x.quantity + inputIngQty } : x));
    } else {
      setProdIngredients([...prodIngredients, { ingredientId: inputIngId, quantity: Number(inputIngQty) }]);
    }
    setInputIngId("");
    setInputIngQty(0);
  };

  const handleRemoveIngLink = (ingId: string) => {
    setProdIngredients(prodIngredients.filter(x => x.ingredientId !== ingId));
  };

  const calculateIngredientTotalCost = (links: ProductIngredientLink[]) => {
    return links.reduce((sum, link) => {
      const ing = ingredients.find(i => i.id === link.ingredientId);
      if (ing) {
        return sum + (ing.costPerUnit * link.quantity);
      }
      return sum;
    }, 0);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || basePrice < 0) return;

    const payload = {
      name,
      description,
      category,
      basePrice: Number(basePrice),
      imgUrl: imgUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500",
      options: { sizes, flavors, addOns },
      ingredients: prodIngredients
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const saved = await res.json();
        if (editingProduct) {
          setProducts(products.map(p => p.id === editingProduct.id ? saved : p));
        } else {
          setProducts([...products, saved]);
        }
        setEditingProduct(null);
        setIsAdding(false);
        triggerRefresh();
        alert("Product menu configuration updated successfully.");
      }
    } catch {
      alert("Error uploading product payload.");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product from Lainie's catalog?")) return;
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setProducts(products.filter(p => p.id !== productId));
        setEditingProduct(null);
        setIsAdding(false);
        triggerRefresh();
      }
    } catch {
       alert("Error deleting product.");
    }
  };

  return (
    <div id="admin-menu-tab" className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center space-x-2">
          <Tag className="h-5 w-5 text-brand-rosegold" />
          <h2 className="text-xl font-bold text-brand-chocolate font-heading">
            Bakery product Catalog
          </h2>
        </div>
        {!isAdding && !editingProduct && (
          <button
            onClick={handleNewClick}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-chocolate text-brand-cream text-xs font-bold rounded-xl hover:opacity-90 transition shadow-xs"
          >
            <PlusCircle className="h-4 w-4 text-brand-pink" />
            <span>Create New Product</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-xs text-brand-chocolate/85">Loading catalog lists...</p>
        </div>
      ) : isAdding || editingProduct ? (
        /* CREATOR OR EDITOR WORKSPACE */
        <form onSubmit={handleSaveProduct} className="bg-white border border-brand-pink/20 rounded-3xl p-6 shadow-xs space-y-6 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center border-b border-brand-pink/10 pb-4">
            <h3 className="text-lg font-bold font-heading text-brand-chocolate">
              {editingProduct ? `Modify: ${editingProduct.name}` : "Compile New Bakery Treat"}
            </h3>
            <div className="flex gap-2">
              {editingProduct && (
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProduct.id)}
                  className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
                >
                  Retire Product
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setIsAdding(false); }}
                className="bg-gray-150 hover:bg-gray-200 text-gray-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition"
              >
                Exit Editor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Basic elements info */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500">Treat Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vanilla Confetti Cupcakes"
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-2.5 mt-1 focus:outline-none focus:ring-1"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-2.5 mt-1"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500">Base Base Selling Price ($)</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-2.5 mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500">Appetizing Photo URL</label>
                <input
                  type="text"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-2.5 mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500">Catalog Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Perfect fluffy sponge cake finished with homemade cream frosting layer sprinkles."
                  className="w-full text-xs bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-2.5 mt-1"
                />
              </div>
            </div>

            {/* Middle Column: Options editor sizes list, flavors, accessories */}
            <div className="space-y-4">
              {/* Sizes section list */}
              <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-pink/15">
                <span className="text-[10px] uppercase font-bold text-brand-chocolate/75">Option Sizes</span>
                <div className="flex gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    placeholder="e.g., Small, Dozen"
                    className="flex-1 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  />
                  <input
                    type="number"
                    value={newSizePrice}
                    onChange={(e) => setNewSizePrice(Number(e.target.value))}
                    placeholder="+$"
                    className="w-12 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddSizeOption}
                    className="bg-brand-chocolate text-white text-[11px] font-bold px-2.5 py-1 rounded-lg"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {sizes.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] bg-white p-1.5 rounded border border-brand-pink/5">
                      <span>{s.name} (+${s.priceAdd})</span>
                      <button type="button" onClick={() => handleRemoveSizeOption(idx)} className="text-red-500 font-bold px-1 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flavors input lists */}
              <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-pink/15">
                <span className="text-[10px] uppercase font-bold text-brand-chocolate/75">Flavors List</span>
                <div className="flex gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newFlavorName}
                    onChange={(e) => setNewFlavorName(e.target.value)}
                    placeholder="e.g., Red Velvet Sponge"
                    className="flex-1 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddFlavorOption}
                    className="bg-brand-chocolate text-white text-[11px] font-bold px-2.5 py-1 rounded-lg"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {flavors.map((f, idx) => (
                    <span key={idx} className="inline-flex items-center text-[10px] bg-white px-2 py-0.5 rounded border border-brand-pink/5 font-medium">
                      {f}
                      <button type="button" onClick={() => handleRemoveFlavorOption(idx)} className="text-red-500 font-bold ml-1 text-xs">✕</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* AddOns select elements */}
              <div className="bg-brand-cream/35 p-3 rounded-2xl border border-brand-pink/15">
                <span className="text-[10px] uppercase font-bold text-brand-chocolate/75">Extra Decoration Add-ons</span>
                <div className="flex gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newAddOnName}
                    onChange={(e) => setNewAddOnName(e.target.value)}
                    placeholder="e.g., Sparkler Candle"
                    className="flex-1 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  />
                  <input
                    type="number"
                    value={newAddOnPrice}
                    onChange={(e) => setNewAddOnPrice(Number(e.target.value))}
                    placeholder="+$"
                    className="w-12 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddAddOnOption}
                    className="bg-brand-chocolate text-white text-[11px] font-bold px-2.5 py-1 rounded-lg"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {addOns.map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] bg-white p-1.5 rounded border border-brand-pink/5">
                      <span>{a.name} (+${a.priceAdd})</span>
                      <button type="button" onClick={() => handleRemoveAddOnOption(idx)} className="text-red-500 font-bold px-1 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Recipe Ingredient and Margins accounting! */}
            <div className="space-y-4">
              <div className="bg-brand-pink/10 p-4 border border-brand-pink/30 rounded-3xl space-y-3">
                <div className="flex items-center space-x-1">
                  <Scale className="h-4 w-4 text-brand-rosegold" />
                  <h4 className="text-xs font-bold text-brand-chocolate uppercase tracking-wider">
                    Recipe Ingredients Cost Tool
                  </h4>
                </div>
                <p className="text-[10px] text-gray-500">
                  Select ingredients and dosages to calculate unit baking resource costs and gross profit margin.
                </p>

                <div className="flex gap-1 mt-2">
                  <select
                    value={inputIngId}
                    onChange={(e) => setInputIngId(e.target.value)}
                    className="flex-1 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  >
                    <option value="">-- Choose Ingredient --</option>
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>{i.name} (${i.costPerUnit}/{i.unit})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={inputIngQty}
                    onChange={(e) => setInputIngQty(Number(e.target.value))}
                    placeholder="Qty"
                    className="w-12 text-[11px] bg-white border border-brand-pink/15 p-1 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngLink}
                    className="bg-brand-chocolate text-white text-[11px] px-2.5 py-1 rounded-lg font-bold"
                  >
                    Add
                  </button>
                </div>

                {/* Grid Links list */}
                {prodIngredients.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {prodIngredients.map((link, idx) => {
                      const ing = ingredients.find(i => i.id === link.ingredientId);
                      const cost = ing ? ing.costPerUnit * link.quantity : 0;
                      return (
                        <div key={idx} className="flex justify-between items-center text-[10px] bg-white p-2 rounded-lg border border-brand-pink/5">
                          <span>{link.quantity}{ing?.unit} {ing?.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-brand-rosegold">${cost.toFixed(2)}</span>
                            <button type="button" onClick={() => handleRemoveIngLink(link.ingredientId)} className="text-red-500 hover:text-red-700">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Cost/Margin indicators */}
                <div className="pt-3 border-t border-brand-pink/20 space-y-1.5 text-xs text-brand-chocolate pt-4">
                  <div className="flex justify-between">
                    <span>Retail Sale Price:</span>
                    <span className="font-bold">${basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Raw Ingredients Cost:</span>
                    <span className="font-bold">${calculateIngredientTotalCost(prodIngredients).toFixed(2)}</span>
                  </div>
                  {basePrice > 0 && (
                    <div className="flex justify-between text-brand-rosegold font-bold pt-2 border-t border-dashed border-brand-pink/10">
                      <span>Bake Gross Margin (%):</span>
                      <span>
                        {(((basePrice - calculateIngredientTotalCost(prodIngredients)) / basePrice) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 py-3.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center space-x-2"
          >
            <Sparkles className="h-4 w-4 text-brand-pink animate-pulse" />
            <span>Publish Catalog changes</span>
          </button>
        </form>
      ) : (
        /* MASTER CATALOG DISPLAYS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => {
            const ingCost = calculateIngredientTotalCost(p.ingredients || []);
            const margin = p.basePrice > 0 ? ((p.basePrice - ingCost) / p.basePrice) * 100 : 0;

            return (
              <div
                key={p.id}
                className="bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-xs hover:shadow-sm transition flex flex-col justify-between group"
              >
                <div>
                  <div className="h-32 bg-brand-pink/10 rounded-xl overflow-hidden mb-4 relative">
                    <img 
                      src={p.imgUrl} 
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-2 left-2 text-[9px] uppercase font-bold bg-brand-chocolate text-brand-cream px-2 py-0.5 rounded-sm">
                      {p.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-brand-chocolate leading-tight">{p.name}</h3>
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-brand-pink/10">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">Price</span>
                      <strong className="text-brand-chocolate font-bold">${p.basePrice.toFixed(2)}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block uppercase">Margin</span>
                      <span className={`font-bold ${margin > 65 ? "text-green-600" : margin > 40 ? "text-blue-600" : "text-yellow-600"}`}>
                        {margin.toFixed(0)}% Profit
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleEditClick(p)}
                    className="w-full mt-4 bg-brand-cream hover:bg-brand-pink/30 text-brand-chocolate border border-brand-pink/20 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1"
                  >
                    <Edit2 className="h-3 w-3 text-brand-rosegold" />
                    <span>Edit Configuration & Costing</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
