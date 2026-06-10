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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white border border-brand-pink/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center space-x-2">
          <Tag className="h-6 w-6 text-brand-rosegold" />
          <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading">
            Bakery Product Catalog
          </h2>
        </div>
        {!isAdding && !editingProduct && (
          <button
            onClick={handleNewClick}
            className="flex items-center space-x-1.5 px-5 py-3 bg-brand-chocolate text-brand-cream text-xs sm:text-sm font-bold rounded-xl hover:opacity-90 transition shadow-sm cursor-pointer"
          >
            <PlusCircle className="h-4.5 w-4.5 text-brand-pink" />
            <span>Create New Product</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
          <p className="mt-4 text-sm text-brand-chocolate/85">Loading catalog lists...</p>
        </div>
      ) : isAdding || editingProduct ? (
        /* CREATOR OR EDITOR WORKSPACE */
        <form onSubmit={handleSaveProduct} className="bg-white border border-brand-pink/20 rounded-[2.5rem] p-8 shadow-sm space-y-6 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center border-b border-brand-pink/10 pb-4">
            <h3 className="text-xl lg:text-2xl font-bold font-heading text-brand-chocolate">
              {editingProduct ? `Modify: ${editingProduct.name}` : "Compile New Bakery Treat"}
            </h3>
            <div className="flex gap-2.5">
              {editingProduct && (
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProduct.id)}
                  className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer"
                >
                  Retire Product
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditingProduct(null); setIsAdding(false); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer"
              >
                Exit Editor
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Basic elements info */}
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase font-extrabold tracking-wider text-gray-500 block">Treat Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vanilla Confetti Cupcakes"
                  className="w-full text-sm bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-3 mt-1.5 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-extrabold tracking-wider text-gray-500 block">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-3 mt-1.5 text-brand-chocolate font-medium focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase font-extrabold tracking-wider text-gray-500 block">Base Selling Price ($)</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  className="w-full text-sm bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-3 mt-1.5 text-brand-chocolate font-bold focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-extrabold tracking-wider text-gray-500 block">Appetizing Photo URL</label>
                <input
                  type="text"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full text-sm bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-3 mt-1.5 text-brand-chocolate font-medium focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-extrabold tracking-wider text-gray-500 block">Catalog Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Perfect fluffy sponge cake finished with homemade cream frosting layer sprinkles."
                  className="w-full text-sm bg-brand-cream/10 border border-brand-pink/15 rounded-xl p-3 mt-1.5 text-brand-chocolate font-medium focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>
            </div>

            {/* Middle Column: Options editor sizes list, flavors, accessories */}
            <div className="space-y-4">
              {/* Sizes section list */}
              <div className="bg-brand-cream/35 p-4 rounded-2xl border border-brand-pink/15 space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#B76E79]">Option Sizes</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    placeholder="e.g., Small, Dozen"
                    className="flex-1 text-sm bg-white border border-brand-pink/15 p-2 rounded-xl focus:outline-none"
                  />
                  <input
                    type="number"
                    value={newSizePrice}
                    onChange={(e) => setNewSizePrice(Number(e.target.value))}
                    placeholder="+$"
                    className="w-16 text-sm bg-white border border-brand-pink/15 p-2 rounded-xl focus:outline-none font-bold text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddSizeOption}
                    className="bg-brand-chocolate text-white text-sm font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 space-y-1.5 font-semibold">
                  {sizes.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-brand-pink/10">
                      <span>{s.name} (+${s.priceAdd})</span>
                      <button type="button" onClick={() => handleRemoveSizeOption(idx)} className="text-red-500 font-extrabold px-1 text-sm leading-none bg-red-50 rounded p-0.5">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flavors input lists */}
              <div className="bg-brand-cream/35 p-4 rounded-2xl border border-brand-pink/15 space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#B76E79]">Flavors List</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFlavorName}
                    onChange={(e) => setNewFlavorName(e.target.value)}
                    placeholder="e.g., Red Velvet Sponge"
                    className="flex-1 text-sm bg-white border border-brand-pink/15 p-2 rounded-xl focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFlavorOption}
                    className="bg-brand-chocolate text-white text-sm font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 font-semibold">
                  {flavors.map((f, idx) => (
                    <span key={idx} className="inline-flex items-center text-xs bg-white px-2.5 py-1 rounded-lg border border-brand-pink/10">
                      {f}
                      <button type="button" onClick={() => handleRemoveFlavorOption(idx)} className="text-red-500 font-extrabold ml-2 text-xs">✕</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* AddOns select elements */}
              <div className="bg-brand-cream/35 p-4 rounded-2xl border border-brand-pink/15 space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#B76E79]">Extra Decoration Add-ons</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAddOnName}
                    onChange={(e) => setNewAddOnName(e.target.value)}
                    placeholder="e.g., Sparkler Candle"
                    className="flex-1 text-sm bg-white border border-brand-pink/15 p-2 rounded-xl focus:outline-none"
                  />
                  <input
                    type="number"
                    value={newAddOnPrice}
                    onChange={(e) => setNewAddOnPrice(Number(e.target.value))}
                    placeholder="+$"
                    className="w-16 text-sm bg-white border border-brand-pink/15 p-2 rounded-xl focus:outline-none font-bold text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddAddOnOption}
                    className="bg-brand-chocolate text-white text-sm font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2 space-y-1.5 font-semibold">
                  {addOns.map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-brand-pink/10">
                      <span>{a.name} (+${a.priceAdd})</span>
                      <button type="button" onClick={() => handleRemoveAddOnOption(idx)} className="text-red-500 font-extrabold px-1 text-sm leading-none bg-red-50 rounded p-0.5">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Recipe Ingredient and Margins accounting! */}
            <div className="space-y-4">
              <div className="bg-brand-pink/10 p-5 border border-brand-pink/30 rounded-3xl space-y-3">
                <div className="flex items-center space-x-1.5">
                  <Scale className="h-5 w-5 text-brand-rosegold" />
                  <h4 className="text-sm font-extrabold text-brand-chocolate uppercase tracking-wider">
                    Recipe Ingredients Cost Tool
                  </h4>
                </div>
                <p className="text-xs text-gray-500 font-semibold mb-2">
                  Select ingredients and dosages to calculate unit baking resource costs and gross profit margin.
                </p>

                <div className="flex gap-2 mt-3">
                  <select
                    value={inputIngId}
                    onChange={(e) => setInputIngId(e.target.value)}
                    className="flex-1 text-sm bg-white border border-brand-pink/15 p-2.5 rounded-xl text-brand-chocolate font-medium focus:none"
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
                    className="w-16 text-sm bg-white border border-brand-pink/15 p-2.5 rounded-xl font-bold text-center focus:none"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngLink}
                    className="bg-brand-chocolate text-white text-xs px-4 py-2.5 rounded-xl font-bold hover:opacity-90 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Grid Links list */}
                {prodIngredients.length > 0 && (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {prodIngredients.map((link, idx) => {
                      const ing = ingredients.find(i => i.id === link.ingredientId);
                      const cost = ing ? ing.costPerUnit * link.quantity : 0;
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-brand-pink/10 font-bold">
                          <span>{link.quantity}{ing?.unit} {ing?.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-brand-rosegold">${cost.toFixed(2)}</span>
                            <button type="button" onClick={() => handleRemoveIngLink(link.ingredientId)} className="text-red-500 hover:text-red-700 font-bold text-sm px-1">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Cost/Margin indicators */}
                <div className="pt-4 border-t border-brand-pink/20 space-y-2 text-sm text-brand-chocolate font-semibold">
                  <div className="flex justify-between">
                    <span>Retail Sale Price:</span>
                    <span className="font-extrabold">${basePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Raw Ingredients Cost:</span>
                    <span className="font-extrabold text-red-700">${calculateIngredientTotalCost(prodIngredients).toFixed(2)}</span>
                  </div>
                  {basePrice > 0 && (
                    <div className="flex justify-between text-brand-rosegold font-extrabold pt-3 border-t border-dashed border-brand-pink/20 text-base">
                      <span>Bake Gross Margin (%):</span>
                      <span className="bg-brand-pink/20 px-2 py-0.5 rounded-lg">
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
            className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/95 py-4 rounded-xl text-sm font-bold transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Sparkles className="h-5 w-5 text-brand-pink animate-pulse" />
            <span>Publish Catalog Changes</span>
          </button>
        </form>
      ) : (
        /* MASTER CATALOG DISPLAYS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map(p => {
            const ingCost = calculateIngredientTotalCost(p.ingredients || []);
            const margin = p.basePrice > 0 ? ((p.basePrice - ingCost) / p.basePrice) * 100 : 0;

            return (
              <div
                key={p.id}
                className="bg-white border border-brand-pink/20 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <div className="h-44 bg-brand-pink/10 rounded-2xl overflow-hidden mb-5 relative">
                    <img 
                      src={p.imgUrl} 
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute top-3 left-3 text-[10px] uppercase font-extrabold bg-brand-chocolate text-brand-cream px-3 py-1 rounded-lg">
                      {p.category}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg lg:text-xl text-brand-chocolate leading-tight font-heading">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-3 font-medium leading-relaxed">{p.description}</p>
                </div>

                <div className="mt-5 pt-4 border-t border-brand-pink/10">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Price</span>
                      <strong className="text-brand-chocolate font-extrabold text-lg">${p.basePrice.toFixed(2)}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Margin</span>
                      <span className={`font-extrabold text-sm px-2 py-0.5 rounded-lg ${
                        margin > 65 ? "bg-green-50 text-green-700" : margin > 40 ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-750"
                      }`}>
                        {margin.toFixed(0)}% Profit
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleEditClick(p)}
                    className="w-full mt-4 bg-brand-cream hover:bg-brand-pink/30 text-brand-chocolate border border-brand-pink/20 py-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4 text-brand-rosegold" />
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
