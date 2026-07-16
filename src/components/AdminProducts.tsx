import React, { useState, useEffect } from "react";
import { PlusCircle, Edit2, Trash2, HelpCircle, FileText, Sparkles, DollarSign, Tag, Scale, Search, GripVertical, Check, X } from "lucide-react";
import { Product, Ingredient, ProductIngredientLink, ProductVariation } from "../types";
import {
  normalizeProductNameAndCategory,
  normalizeProductPhotos,
  getPrimaryProductImage,
} from "../utils/productUtils";
import { ProductImage } from "./ProductImage";

interface AdminProductsProps {
  token: string;
  triggerRefresh: () => void;
}

interface AdminProductCardImageProps {
  product: Product;
}

function AdminProductCardImage({ product }: AdminProductCardImageProps) {
  const [aspectType, setAspectType] = useState<"portrait" | "landscape" | "square">("square");

  useEffect(() => {
    setAspectType("square");
  }, [product]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      if (ratio < 0.85) {
        setAspectType("portrait");
      } else if (ratio > 1.15) {
        setAspectType("landscape");
      } else {
        setAspectType("square");
      }
    }
  };

  let aspectClass = "aspect-square";
  if (aspectType === "portrait") {
    aspectClass = "aspect-[4/5]";
  } else if (aspectType === "landscape") {
    aspectClass = "aspect-[4/3]";
  }

  const imageUrl = getPrimaryProductImage(product);

  return (
    <div className={`relative w-full bg-brand-pink/5 rounded-lg overflow-hidden mb-1.5 border border-brand-pink/15 transition-all duration-300 ${aspectClass}`}>
      <ProductImage 
        src={imageUrl} 
        alt={product.name}
        onLoad={handleImageLoad}
        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
      />
      <span className="absolute top-1 left-1 text-[7px] uppercase font-extrabold bg-brand-chocolate text-brand-cream px-1 py-0.25 rounded z-10">
        {product.category}
      </span>
      {product.isVisible === false && (
        <span className="absolute top-1 right-1 text-[7px] uppercase font-extrabold bg-red-600 text-white px-1 py-0.25 rounded shadow z-10">
          HIDDEN
        </span>
      )}
    </div>
  );
}

export default function AdminProducts({ token, triggerRefresh }: AdminProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Search, Filter, and Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("name-asc");

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Mini Cakes");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [basePrice, setBasePrice] = useState<number>(0);
  
  // Feature 1: Catalog visibility toggle state
  const [isVisible, setIsVisible] = useState(true);

  // Feature 2: Photo Gallery state
  const [photos, setPhotos] = useState<{ url: string; isPrimary: boolean }[]>([]);
  const [externalImgUrl, setExternalImgUrl] = useState("");
  const [activeUploadSlot, setActiveUploadSlot] = useState<number | null>(null);
  const [tempUploadId, setTempUploadId] = useState<string>("");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleSlotFileChange = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) {
      setActiveUploadSlot(null);
      return;
    }

    // Validate JPG, JPEG, PNG, and WebP files
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ["jpg", "jpeg", "png", "webp"];
    if (!validTypes.includes(file.type) && (!ext || !validExtensions.includes(ext))) {
      setUploadError("Invalid file format. Please upload JPG, JPEG, PNG, or WebP.");
      setActiveUploadSlot(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image too large. Please select an image under 5MB.");
      setActiveUploadSlot(null);
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || `image/${ext || "jpeg"}`,
              base64: base64String,
              productId: editingProduct ? editingProduct.id : (tempUploadId || "new-product")
            })
          });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(errorData.error || "Upload failed");
          }

          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            const updatedPhotos = [...photos];
            const isPrimary = photos.length === 0 || !photos.some(p => p.isPrimary);
            const newPhoto = { url: uploadData.url, isPrimary };
            
            if (slotIndex < updatedPhotos.length) {
              updatedPhotos[slotIndex] = { ...updatedPhotos[slotIndex], url: uploadData.url };
            } else {
              updatedPhotos.push(newPhoto);
            }
            setPhotos(updatedPhotos);
          } else {
            throw new Error("No URL returned from server");
          }
        } catch (err: any) {
          console.error("Upload error:", err);
          setUploadError(err.message || "Failed to upload image.");
        } finally {
          setUploading(false);
          setActiveUploadSlot(null);
        }
      };
      reader.onerror = () => {
        setUploadError("Failed to read local file.");
        setUploading(false);
        setActiveUploadSlot(null);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || "File reading error.");
      setUploading(false);
      setActiveUploadSlot(null);
    }
  };

  const handleRemovePhoto = (idx: number) => {
    const photoToRemove = photos[idx];
    let updatedPhotos = photos.filter((_, i) => i !== idx);
    
    if (photoToRemove.isPrimary && updatedPhotos.length > 0) {
      updatedPhotos[0].isPrimary = true;
    }
    setPhotos(updatedPhotos);
  };

  const handleSetPrimary = (idx: number) => {
    const updatedPhotos = photos.map((p, i) => ({
      ...p,
      isPrimary: i === idx
    }));
    setPhotos(updatedPhotos);
  };

  const handleAddExternalUrl = () => {
    if (!externalImgUrl) return;
    const isPrimary = photos.length === 0 || !photos.some(p => p.isPrimary);
    setPhotos([...photos, { url: externalImgUrl, isPrimary }]);
    setExternalImgUrl("");
  };
  
  // Options (simplified list editors)
  const [sizes, setSizes] = useState<{ name: string; priceAdd: number }[]>([]);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [toppings, setToppings] = useState<string[]>([]);
  const [drizzles, setDrizzles] = useState<string[]>([]);

  // Product Variations state (Normal / Specialty)
  const [activeVarId, setActiveVarId] = useState<string | null>(null);
  const [currentVariations, setCurrentVariations] = useState<ProductVariation[] | undefined>(undefined);

  const handleSwitchVariation = (nextVarId: string) => {
    if (!activeVarId || !currentVariations) return;
    if (activeVarId === nextVarId) return;

    // 1. Save current form values to active variation
    const updated = currentVariations.map(v => {
      if (v.id === activeVarId) {
        return {
          ...v,
          basePrice: Number(basePrice),
          description,
          photos,
          options: {
            sizes,
            flavors,
            toppings,
            drizzles
          }
        };
      }
      return v;
    });

    // 2. Load next variation values
    const nextVar = updated.find(v => v.id === nextVarId);
    if (nextVar) {
      setBasePrice(nextVar.basePrice);
      setSizes(nextVar.options.sizes || []);
      setFlavors(nextVar.options.flavors || []);
      const rawToppings = nextVar.options.toppings || (nextVar.options.addOns || []).map((x: any) => typeof x === "string" ? x : x.name);
      setToppings(rawToppings);
      const rawDrizzles = nextVar.options.drizzles || [];
      setDrizzles(rawDrizzles);
      setDescription(nextVar.description || "");
      setPhotos(nextVar.photos || []);
    }

    setCurrentVariations(updated);
    setActiveVarId(nextVarId);
  };
  
  // Ingredient Links for cost accounting
  const [prodIngredients, setProdIngredients] = useState<ProductIngredientLink[]>([]);

  // Helpers for array editors
  const [newSizeName, setNewSizeName] = useState("");
  const [newSizePrice, setNewSizePrice] = useState(0);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [newToppingName, setNewToppingName] = useState("");
  const [newDrizzleName, setNewDrizzleName] = useState("");

  // States for inline editing options
  const [editingSizeIdx, setEditingSizeIdx] = useState<number | null>(null);
  const [editingSizeName, setEditingSizeName] = useState("");
  const [editingSizePrice, setEditingSizePrice] = useState<number>(0);

  const [editingFlavorIdx, setEditingFlavorIdx] = useState<number | null>(null);
  const [editingFlavorName, setEditingFlavorName] = useState("");

  const [editingDrizzleIdx, setEditingDrizzleIdx] = useState<number | null>(null);
  const [editingDrizzleName, setEditingDrizzleName] = useState("");

  const [editingToppingIdx, setEditingToppingIdx] = useState<number | null>(null);
  const [editingToppingName, setEditingToppingName] = useState("");

  // Drag and drop states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [draggedType, setDraggedType] = useState<"sizes" | "flavors" | "drizzles" | "toppings" | null>(null);

  const [inputIngId, setInputIngId] = useState("");
  const [inputIngQty, setInputIngQty] = useState(0);

  const defaultCategories = ["Mini Cakes", "Cupcakes", "Cookies", "Seasonal Specials"];
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(defaultCategories);

  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const [pRes, iRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/ingredients", {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);
      if (pRes.ok) {
        const pList = await pRes.json();
        const mappedProducts = pList.map((p: any) => {
          const { name, category } = normalizeProductNameAndCategory(p);
          const photos = normalizeProductPhotos(p);
          const imgUrl = photos.find(ph => ph.isPrimary)?.url || (photos.length > 0 ? photos[0].url : "");
          return {
            ...p,
            name,
            category,
            photos,
            imgUrl
          };
        });
        setProducts(mappedProducts);
        const uniqueCategories = Array.from(new Set([
          ...defaultCategories,
          ...mappedProducts.map((p: any) => p.category).filter(Boolean)
        ]));
        setDynamicCategories(uniqueCategories);
      }
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

  useEffect(() => {
    const isMiniCakes = category === "Mini Cakes" || name === "Mini Cakes";
    if (isMiniCakes && !activeVarId) {
      const productVariations: ProductVariation[] = [
        {
          id: "normal",
          name: "Normal",
          basePrice: basePrice || 40,
          options: {
            sizes: sizes.length > 0 ? sizes : [
              { name: "Dozen", priceAdd: 40 },
              { name: "Two Dozen", priceAdd: 75 },
              { name: "Three Dozen", priceAdd: 105 },
              { name: "Four Dozen", priceAdd: 135 },
              { name: "Five Dozen", priceAdd: 165 }
            ],
            flavors: flavors || [],
            toppings: toppings || [],
            drizzles: drizzles || []
          },
          description: description || "",
          photos: photos || []
        },
        {
          id: "specialty",
          name: "Specialty",
          basePrice: 0,
          options: {
            sizes: [],
            flavors: [],
            toppings: [],
            drizzles: []
          },
          description: "",
          photos: []
        }
      ];
      setCurrentVariations(productVariations);
      setActiveVarId("normal");
      setBasePrice(productVariations[0].basePrice);
      setSizes(productVariations[0].options.sizes || []);
    } else if (!isMiniCakes && activeVarId) {
      if (!editingProduct || (editingProduct.category !== "Mini Cakes" && editingProduct.name !== "Mini Cakes")) {
        setActiveVarId(null);
        setCurrentVariations(undefined);
      }
    }
  }, [category, name, activeVarId]);

  const handleEditClick = (p: Product) => {
    setEditingProduct(p);
    setIsAdding(false);
    
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setUseCustomCategory(false);
    setCustomCategory("");
    
    setIsVisible(p.isVisible !== false);

    const pPhotos = normalizeProductPhotos(p);
    setProdIngredients(p.ingredients || []);

    // Set up variation structure
    let productVariations: ProductVariation[] = p.variations || [];
    if ((p.category === "Mini Cakes" || p.name === "Mini Cakes") && (!p.variations || p.variations.length === 0)) {
      productVariations = [
        {
          id: "normal",
          name: "Normal",
          basePrice: p.basePrice,
          options: {
            sizes: p.options.sizes || [],
            flavors: p.options.flavors || [],
            toppings: p.options.toppings || (p.options.addOns || []).map((x: any) => typeof x === "string" ? x : x.name),
            drizzles: p.options.drizzles || []
          },
          description: p.description,
          photos: pPhotos
        },
        {
          id: "specialty",
          name: "Specialty",
          basePrice: 0,
          options: {
            sizes: [],
            flavors: [],
            toppings: [],
            drizzles: []
          },
          description: "",
          photos: []
        }
      ];
    }

    setCurrentVariations(productVariations.length > 0 ? productVariations : undefined);

    if (productVariations.length > 0) {
      setActiveVarId("normal");
      const norm = productVariations.find(v => v.id === "normal") || productVariations[0];
      setBasePrice(norm.basePrice);
      setSizes(norm.options.sizes || []);
      setFlavors(norm.options.flavors || []);
      setToppings(norm.options.toppings || (norm.options.addOns || []).map((x: any) => typeof x === "string" ? x : x.name));
      setDrizzles(norm.options.drizzles || []);
      setDescription(norm.description || "");
      setPhotos(norm.photos || []);
    } else {
      setActiveVarId(null);
      setBasePrice(p.basePrice);
      setSizes(p.options.sizes || []);
      setFlavors(p.options.flavors || []);
      setToppings(p.options.toppings || (p.options.addOns || []).map((x: any) => typeof x === "string" ? x : x.name));
      setDrizzles(p.options.drizzles || []);
      setDescription(p.description);
      setPhotos(pPhotos);
    }
  };

  const handleNewClick = () => {
    setEditingProduct(null);
    setIsAdding(true);
    
    setName("");
    setDescription("");
    setCategory("Mini Cakes");
    setUseCustomCategory(false);
    setCustomCategory("");
    setBasePrice(0);
    
    setIsVisible(true);
    setPhotos([]);
    setTempUploadId(`new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    
    setSizes([]);
    setFlavors([]);
    setToppings([]);
    setDrizzles([]);
    setProdIngredients([]);

    setActiveVarId(null);
    setCurrentVariations(undefined);
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

  const handleAddToppingOption = () => {
    const trimmed = newToppingName.trim();
    if (!trimmed) return;
    if (toppings.includes(trimmed)) {
      alert("This topping is already in the list!");
      return;
    }
    setToppings([...toppings, trimmed]);
    setNewToppingName("");
  };

  const handleRemoveToppingOption = (idx: number) => {
    setToppings(toppings.filter((_, i) => i !== idx));
  };

  const handleAddDrizzleOption = () => {
    const trimmed = newDrizzleName.trim();
    if (!trimmed) return;
    if (drizzles.includes(trimmed)) {
      alert("This drizzle is already in the list!");
      return;
    }
    setDrizzles([...drizzles, trimmed]);
    setNewDrizzleName("");
  };

  const handleRemoveDrizzleOption = (idx: number) => {
    setDrizzles(drizzles.filter((_, i) => i !== idx));
  };

  // Inline edit handlers
  const handleStartEditSize = (index: number, currentName: string, currentPrice: number) => {
    setEditingSizeIdx(index);
    setEditingSizeName(currentName);
    setEditingSizePrice(currentPrice);
  };

  const handleSaveEditSize = (index: number) => {
    const trimmed = editingSizeName.trim();
    if (!trimmed) return;
    const updated = [...sizes];
    updated[index] = { name: trimmed, priceAdd: Number(editingSizePrice) };
    setSizes(updated);
    setEditingSizeIdx(null);
  };

  const handleStartEditFlavor = (index: number, currentName: string) => {
    setEditingFlavorIdx(index);
    setEditingFlavorName(currentName);
  };

  const handleSaveEditFlavor = (index: number) => {
    const trimmed = editingFlavorName.trim();
    if (!trimmed) return;
    const updated = [...flavors];
    updated[index] = trimmed;
    setFlavors(updated);
    setEditingFlavorIdx(null);
  };

  const handleStartEditDrizzle = (index: number, currentName: string) => {
    setEditingDrizzleIdx(index);
    setEditingDrizzleName(currentName);
  };

  const handleSaveEditDrizzle = (index: number) => {
    const trimmed = editingDrizzleName.trim();
    if (!trimmed) return;
    const updated = [...drizzles];
    updated[index] = trimmed;
    setDrizzles(updated);
    setEditingDrizzleIdx(null);
  };

  const handleStartEditTopping = (index: number, currentName: string) => {
    setEditingToppingIdx(index);
    setEditingToppingName(currentName);
  };

  const handleSaveEditTopping = (index: number) => {
    const trimmed = editingToppingName.trim();
    if (!trimmed) return;
    const updated = [...toppings];
    updated[index] = trimmed;
    setToppings(updated);
    setEditingToppingIdx(null);
  };

  // Drag and drop event handlers
  const handleDragStart = (e: React.DragEvent, index: number, type: "sizes" | "flavors" | "drizzles" | "toppings") => {
    setDraggedIdx(index);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, type: "sizes" | "flavors" | "drizzles" | "toppings") => {
    e.preventDefault();
    if (draggedIdx === null || draggedType !== type || draggedIdx === targetIndex) return;

    if (type === "sizes") {
      const updated = [...sizes];
      const [moved] = updated.splice(draggedIdx, 1);
      updated.splice(targetIndex, 0, moved);
      setSizes(updated);
    } else if (type === "flavors") {
      const updated = [...flavors];
      const [moved] = updated.splice(draggedIdx, 1);
      updated.splice(targetIndex, 0, moved);
      setFlavors(updated);
    } else if (type === "drizzles") {
      const updated = [...drizzles];
      const [moved] = updated.splice(draggedIdx, 1);
      updated.splice(targetIndex, 0, moved);
      setDrizzles(updated);
    } else if (type === "toppings") {
      const updated = [...toppings];
      const [moved] = updated.splice(draggedIdx, 1);
      updated.splice(targetIndex, 0, moved);
      setToppings(updated);
    }

    setDraggedIdx(null);
    setDraggedType(null);
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

  const filteredAndSortedProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === "name-asc") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "name-desc") {
      return b.name.localeCompare(a.name);
    }
    if (sortBy === "price-asc") {
      return a.basePrice - b.basePrice;
    }
    if (sortBy === "price-desc") {
      return b.basePrice - a.basePrice;
    }
    if (sortBy === "margin-desc") {
      const aCost = calculateIngredientTotalCost(a.ingredients || []);
      const aMargin = a.basePrice > 0 ? ((a.basePrice - aCost) / a.basePrice) * 100 : 0;
      const bCost = calculateIngredientTotalCost(b.ingredients || []);
      const bMargin = b.basePrice > 0 ? ((b.basePrice - bCost) / b.basePrice) * 100 : 0;
      return bMargin - aMargin;
    }
    return 0;
  });

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const finalCategory = useCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      alert("Please select or enter a valid category name.");
      return;
    }

    let finalVariations = currentVariations;
    let finalBasePrice = Number(basePrice);
    let finalOptions = { sizes, flavors, toppings, drizzles, addOns: toppings.map(t => ({ name: t, priceAdd: 0 })) };
    let finalDescription = description;
    let finalPhotos = photos;

    if (activeVarId && currentVariations) {
      // 1. Commit current form state to active variation
      const updated = currentVariations.map(v => {
        if (v.id === activeVarId) {
          return {
            ...v,
            basePrice: Number(basePrice),
            description,
            photos,
            options: { sizes, flavors, toppings, drizzles, addOns: toppings.map(t => ({ name: t, priceAdd: 0 })) }
          };
        }
        return v;
      });
      finalVariations = updated;
      
      // Keep the product level basePrice/options/description/photos equal to the "Normal" variation
      // so it remains 100% backward-compatible and does not break list/summary views
      const normalVar = updated.find(v => v.id === "normal") || updated[0];
      finalBasePrice = normalVar.basePrice;
      finalOptions = normalVar.options;
      finalDescription = normalVar.description || description;
      finalPhotos = normalVar.photos || photos;
    }

    // Validation:
    if (finalBasePrice < 0 || isNaN(finalBasePrice)) {
      alert("Price cannot be negative or invalid.");
      return;
    }

    if (finalVariations) {
      const ids = finalVariations.map(v => v.id);
      const duplicate = ids.some((val, i) => ids.indexOf(val) !== i);
      if (duplicate) {
        alert("Duplicate variation IDs are not allowed.");
        return;
      }

      for (const v of finalVariations) {
        if (!v.name || v.name.trim() === "") {
          alert("All variations must have a valid name.");
          return;
        }
        if (v.basePrice < 0 || isNaN(v.basePrice)) {
          alert(`Variation ${v.name} cannot have a negative or invalid price.`);
          return;
        }
      }
    }

    const primaryPhoto = finalPhotos.find(ph => ph.isPrimary) || finalPhotos[0];
    const finalImgUrl = primaryPhoto ? primaryPhoto.url : "";

    const payload: any = {
      name,
      description: finalDescription,
      category: finalCategory,
      basePrice: Number(finalBasePrice),
      imgUrl: finalImgUrl,
      photos: finalPhotos,
      isVisible: isVisible !== false,
      options: finalOptions,
      ingredients: prodIngredients
    };

    if (finalVariations) {
      payload.variations = finalVariations;
    }

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
        
        if (useCustomCategory && customCategory.trim()) {
          const newCat = customCategory.trim();
          if (!dynamicCategories.includes(newCat)) {
            setDynamicCategories([...dynamicCategories, newCat]);
          }
        }

        setEditingProduct(null);
        setIsAdding(false);
        triggerRefresh();
        alert("Product catalog changes saved successfully.");
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
            <div className="space-y-6">
              {/* PRODUCT INFORMATION */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">PRODUCT INFORMATION</h4>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">Configure the basic details of this bakery item.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">Product Name</label>
                    <span className="text-[8px] bg-brand-chocolate text-white px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Storefront View</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">The name customers will see on your storefront.</p>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Vanilla Confetti Cupcakes"
                    className="w-full text-sm bg-white border border-brand-pink/20 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">Category</label>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Choose which category this product belongs to.</p>
                  <div className="space-y-2">
                    <select
                      value={useCustomCategory ? "custom_other" : category}
                      onChange={(e) => {
                        if (e.target.value === "custom_other") {
                          setUseCustomCategory(true);
                        } else {
                          setUseCustomCategory(false);
                          setCategory(e.target.value);
                        }
                      }}
                      className="w-full text-sm bg-white border border-brand-pink/20 rounded-xl p-3 text-brand-chocolate font-medium focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    >
                      {dynamicCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="custom_other">+ Enter Custom Category...</option>
                    </select>
                    {useCustomCategory && (
                      <input
                        type="text"
                        required
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. Dessert Trays, Macarons, Pies"
                        className="w-full text-sm bg-white border border-brand-pink/20 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium animate-in slide-in-from-top duration-200"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">Base Selling Price</label>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Starting price before size or customization selections.</p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.01"
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full text-sm bg-white border border-brand-pink/20 rounded-xl p-3 pl-8 text-brand-chocolate font-bold focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-brand-chocolate uppercase tracking-wider block">Visibility</label>
                  <p className="text-[10px] text-gray-500 font-semibold mb-2.5">Hide or display this product on your website.</p>
                  <div className="flex items-center justify-between p-3.5 bg-white border border-brand-pink/15 rounded-xl">
                    <span className="text-[11px] text-brand-chocolate font-semibold">{isVisible ? "Visible on website" : "Hidden from website"}</span>
                    <button
                      type="button"
                      onClick={() => setIsVisible(!isVisible)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isVisible ? 'bg-brand-rosegold' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isVisible ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* PRODUCT PHOTO GALLERY */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">PRODUCT PHOTO GALLERY</h4>
                    <span className="text-[9px] bg-[#B76E79]/10 text-[#B76E79] px-2 py-0.5 rounded-full font-bold">{photos.length}/4 Slots</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight mt-0.5">Upload up to 4 images. The starred image becomes the primary storefront image.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, index) => {
                    const photo = photos[index];
                    if (photo) {
                      return (
                        <div key={index} className="relative group w-full h-24 bg-gray-50 rounded-xl overflow-hidden border border-brand-pink/15 flex flex-col justify-end shadow-xs">
                          <img 
                            src={photo.url} 
                            alt={`Product gallery slot ${index + 1}`} 
                            className="absolute inset-0 w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-1 right-1">
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(index)}
                              className="bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-90 hover:opacity-100 hover:bg-red-600 transition cursor-pointer"
                              title="Delete photo"
                            >
                              <span className="block text-[9px] font-extrabold leading-none">✕</span>
                            </button>
                          </div>
                          
                          <div 
                            className={`absolute bottom-0 inset-x-0 p-1 text-center text-[9px] font-black tracking-wide leading-none transition-all select-none cursor-pointer ${
                              photo.isPrimary ? 'bg-brand-chocolate text-brand-cream' : 'bg-black/45 text-gray-200 hover:bg-[#B76E79] hover:text-white'
                            }`}
                            onClick={() => !photo.isPrimary && handleSetPrimary(index)}
                            title={photo.isPrimary ? "Primary photo" : "Click to make primary"}
                          >
                            {photo.isPrimary ? "★ Primary Photo" : "Set as Primary"}
                          </div>
                        </div>
                      );
                    } else {
                      const isUploadingCurrent = uploading && activeUploadSlot === index;
                      return (
                        <div key={index} className="relative border border-dashed border-brand-pink/30 hover:border-[#B76E79] rounded-xl h-24 flex flex-col items-center justify-center bg-white hover:bg-brand-cream/10 transition overflow-hidden shadow-xs cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              setActiveUploadSlot(index);
                              handleSlotFileChange(e, index);
                            }}
                            disabled={uploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <PlusCircle className="h-4 w-4 text-[#B76E79] mb-1" />
                          <span className="text-[10px] font-extrabold text-brand-chocolate text-center px-1">
                            {isUploadingCurrent ? "Uploading..." : "Add Photo"}
                          </span>
                        </div>
                      );
                    }
                  })}
                </div>

                {uploadError && (
                  <p className="text-xs text-red-600 font-semibold">{uploadError}</p>
                )}

                {/* Manual Add external URL */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-gray-400 block">Add Image via external Link</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={externalImgUrl}
                      onChange={(e) => setExternalImgUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 text-xs bg-white border border-brand-pink/20 rounded-xl p-2 text-brand-chocolate focus:ring-1 focus:ring-brand-rosegold focus:outline-none font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddExternalUrl}
                      className="bg-brand-chocolate text-brand-cream hover:opacity-90 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Add URL
                    </button>
                  </div>
                </div>
              </div>

              {/* PRODUCT DESCRIPTION */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">PRODUCT DESCRIPTION</h4>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">This description is displayed on your storefront product page.</p>
                </div>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Perfect fluffy sponge cake finished with homemade cream frosting layer sprinkles."
                  className="w-full text-sm bg-white border border-brand-pink/20 rounded-xl p-3 text-brand-chocolate font-medium focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
                />
              </div>
            </div>

            {/* Middle Column: Options editor sizes list, flavors, accessories */}
            <div className="space-y-6">
              {/* PRODUCT VARIATIONS section */}
              {(category === "Mini Cakes" || name === "Mini Cakes" || currentVariations) && (
                <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                  <div className="border-b border-brand-pink/10 pb-2.5">
                    <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">PRODUCT VARIATIONS</h4>
                    <p className="text-[10px] text-gray-500 font-semibold leading-tight">Create different versions of this product that have their own pricing and customization options.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSwitchVariation("normal")}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs duration-200 cursor-pointer ${
                        activeVarId === "normal"
                          ? "bg-brand-chocolate text-brand-cream border-2 border-brand-chocolate scale-[1.02]"
                          : "bg-white text-brand-chocolate hover:bg-brand-pink/5 border border-brand-pink/15"
                      }`}
                    >
                      Normal
                      <span className="block text-[10px] opacity-75 mt-0.5 font-medium">
                        (Starting at ${currentVariations?.find(v => v.id === "normal")?.basePrice ?? 40})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchVariation("specialty")}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs duration-200 cursor-pointer ${
                        activeVarId === "specialty"
                          ? "bg-brand-chocolate text-brand-cream border-2 border-brand-chocolate scale-[1.02]"
                          : "bg-white text-brand-chocolate hover:bg-brand-pink/5 border border-brand-pink/15"
                      }`}
                    >
                      Specialty
                      <span className="block text-[10px] opacity-75 mt-0.5 font-medium">
                        (Starting at ${currentVariations?.find(v => v.id === "specialty")?.basePrice ?? 0})
                      </span>
                    </button>
                  </div>
                  <div className="bg-brand-pink/5 p-2.5 rounded-xl text-center border border-brand-pink/15">
                    <p className="text-[10px] text-brand-chocolate font-bold leading-tight uppercase tracking-wider">
                      Now Editing: <span className="text-[#B76E79] font-black">{activeVarId === "normal" ? "Normal Settings" : "Specialty Settings"}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* SIZE OPTIONS */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">SIZE OPTIONS</h4>
                    <span className="text-[8px] bg-brand-chocolate text-white px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Storefront Choice</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">Create the size choices customers can purchase.</p>
                </div>

                <div className="flex gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/15 shadow-xs">
                  <input
                    type="text"
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    placeholder="e.g., Half Dozen"
                    className="flex-1 text-sm bg-brand-cream/5 border border-brand-pink/10 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                  />
                  <div className="relative w-20">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      value={newSizePrice || ""}
                      onChange={(e) => setNewSizePrice(Number(e.target.value))}
                      placeholder="Price"
                      className="w-full text-sm bg-brand-cream/5 border border-brand-pink/10 p-2 pl-5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#B76E79] font-bold text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSizeOption}
                    className="bg-brand-chocolate text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm"
                    title="Add Size"
                  >
                    Add
                  </button>
                </div>

                {/* Draggable and Editable Sizes List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {sizes.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic text-center py-2">No size options added yet.</p>
                  ) : (
                    sizes.map((s, idx) => {
                      const isEditing = editingSizeIdx === idx;
                      const isDragging = draggedIdx === idx && draggedType === "sizes";
                      return (
                        <div
                          key={idx}
                          draggable={!isEditing}
                          onDragStart={(e) => handleDragStart(e, idx, "sizes")}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx, "sizes")}
                          onDragEnd={() => { setDraggedIdx(null); setDraggedType(null); }}
                          className={`flex items-center gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/10 transition-all ${
                            isDragging ? "opacity-30 border-dashed border-[#B76E79]" : "hover:border-[#B76E79]/50"
                          }`}
                        >
                          {!isEditing && (
                            <div className="cursor-grab text-gray-300 hover:text-gray-500 transition px-1">
                              <GripVertical className="h-4.5 w-4.5" />
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex gap-1.5 items-center">
                              <input
                                type="text"
                                value={editingSizeName}
                                onChange={(e) => setEditingSizeName(e.target.value)}
                                className="flex-1 text-xs bg-brand-cream/5 border border-brand-pink/20 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                              />
                              <div className="relative w-16">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">$</span>
                                <input
                                  type="number"
                                  value={editingSizePrice}
                                  onChange={(e) => setEditingSizePrice(Number(e.target.value))}
                                  className="w-full text-xs bg-brand-cream/5 border border-brand-pink/20 p-1.5 pl-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#B76E79] text-center font-bold"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSaveEditSize(idx)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg cursor-pointer animate-pulse"
                                title="Save changes"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSizeIdx(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-lg cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex justify-between items-center text-xs">
                              <span className="font-bold text-brand-chocolate">{s.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-brand-rosegold font-bold bg-brand-pink/5 px-2.5 py-0.5 rounded-md">
                                  +${s.priceAdd.toFixed(2)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditSize(idx, s.name, s.priceAdd)}
                                    className="text-[#B76E79] hover:text-[#B76E79]/80 p-1 hover:bg-[#B76E79]/5 rounded transition cursor-pointer"
                                    title="Edit size name/price"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSizeOption(idx)}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition cursor-pointer"
                                    title="Delete size option"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AVAILABLE FLAVORS */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">AVAILABLE FLAVORS</h4>
                    <span className="text-[8px] bg-brand-chocolate text-white px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Storefront Choice</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">These are the buttercream or cake flavors customers can choose from.</p>
                </div>

                <div className="flex gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/15 shadow-xs">
                  <input
                    type="text"
                    value={newFlavorName}
                    onChange={(e) => setNewFlavorName(e.target.value)}
                    placeholder="e.g., Red Velvet Sponge"
                    className="flex-1 text-sm bg-brand-cream/5 border border-brand-pink/10 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                  />
                  <button
                    type="button"
                    onClick={handleAddFlavorOption}
                    className="bg-brand-chocolate text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Draggable and Editable Flavors List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {flavors.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic text-center py-2">No flavor options added yet.</p>
                  ) : (
                    flavors.map((f, idx) => {
                      const isEditing = editingFlavorIdx === idx;
                      const isDragging = draggedIdx === idx && draggedType === "flavors";
                      return (
                        <div
                          key={idx}
                          draggable={!isEditing}
                          onDragStart={(e) => handleDragStart(e, idx, "flavors")}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx, "flavors")}
                          onDragEnd={() => { setDraggedIdx(null); setDraggedType(null); }}
                          className={`flex items-center gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/10 transition-all ${
                            isDragging ? "opacity-30 border-dashed border-[#B76E79]" : "hover:border-[#B76E79]/50"
                          }`}
                        >
                          {!isEditing && (
                            <div className="cursor-grab text-gray-300 hover:text-gray-500 transition px-1">
                              <GripVertical className="h-4.5 w-4.5" />
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex gap-1.5 items-center">
                              <input
                                type="text"
                                value={editingFlavorName}
                                onChange={(e) => setEditingFlavorName(e.target.value)}
                                className="flex-1 text-xs bg-brand-cream/5 border border-brand-pink/20 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditFlavor(idx)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg cursor-pointer"
                                title="Save changes"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFlavorIdx(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-lg cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex justify-between items-center text-xs">
                              <span className="font-bold text-brand-chocolate">{f}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditFlavor(idx, f)}
                                  className="text-[#B76E79] hover:text-[#B76E79]/80 p-1 hover:bg-[#B76E79]/5 rounded transition cursor-pointer"
                                  title="Edit flavor name"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFlavorOption(idx)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition cursor-pointer"
                                  title="Delete flavor option"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AVAILABLE DRIZZLES */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">AVAILABLE DRIZZLES</h4>
                    <span className="text-[8px] bg-brand-chocolate text-white px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Storefront Choice</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">Select the drizzle options customers can choose from.</p>
                </div>

                <div className="flex gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/15 shadow-xs">
                  <input
                    type="text"
                    value={newDrizzleName}
                    onChange={(e) => setNewDrizzleName(e.target.value)}
                    placeholder="e.g., Chocolate Drizzle"
                    className="flex-1 text-sm bg-brand-cream/5 border border-brand-pink/10 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                  />
                  <button
                    type="button"
                    onClick={handleAddDrizzleOption}
                    className="bg-brand-chocolate text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Draggable and Editable Drizzles List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {drizzles.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic text-center py-2">No drizzle options added yet.</p>
                  ) : (
                    drizzles.map((d, idx) => {
                      const isEditing = editingDrizzleIdx === idx;
                      const isDragging = draggedIdx === idx && draggedType === "drizzles";
                      return (
                        <div
                          key={idx}
                          draggable={!isEditing}
                          onDragStart={(e) => handleDragStart(e, idx, "drizzles")}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx, "drizzles")}
                          onDragEnd={() => { setDraggedIdx(null); setDraggedType(null); }}
                          className={`flex items-center gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/10 transition-all ${
                            isDragging ? "opacity-30 border-dashed border-[#B76E79]" : "hover:border-[#B76E79]/50"
                          }`}
                        >
                          {!isEditing && (
                            <div className="cursor-grab text-gray-300 hover:text-gray-500 transition px-1">
                              <GripVertical className="h-4.5 w-4.5" />
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex gap-1.5 items-center">
                              <input
                                type="text"
                                value={editingDrizzleName}
                                onChange={(e) => setEditingDrizzleName(e.target.value)}
                                className="flex-1 text-xs bg-brand-cream/5 border border-brand-pink/20 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditDrizzle(idx)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg cursor-pointer"
                                title="Save changes"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDrizzleIdx(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-lg cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex justify-between items-center text-xs">
                              <span className="font-bold text-brand-chocolate">{d}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDrizzle(idx, d)}
                                  className="text-[#B76E79] hover:text-[#B76E79]/80 p-1 hover:bg-[#B76E79]/5 rounded transition cursor-pointer"
                                  title="Edit drizzle name"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDrizzleOption(idx)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition cursor-pointer"
                                  title="Delete drizzle option"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AVAILABLE TOPPINGS */}
              <div className="bg-brand-cream/15 p-5 rounded-[2rem] border-2 border-brand-pink/20 space-y-4">
                <div className="border-b border-brand-pink/10 pb-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-[#B76E79] uppercase tracking-wider">AVAILABLE TOPPINGS</h4>
                    <span className="text-[8px] bg-brand-chocolate text-white px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Storefront Choice</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold leading-tight">Choose the toppings customers can select.</p>
                </div>

                <div className="flex gap-2 bg-white p-2.5 rounded-xl border border-[#B76E79]/20 shadow-xs">
                  <input
                    type="text"
                    value={newToppingName}
                    onChange={(e) => setNewToppingName(e.target.value)}
                    placeholder="e.g., Reese's Pieces"
                    className="flex-1 text-sm bg-brand-cream/5 border border-brand-pink/10 p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                  />
                  <button
                    type="button"
                    onClick={handleAddToppingOption}
                    className="bg-brand-chocolate text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm"
                  >
                    Add
                  </button>
                </div>

                {/* Draggable and Editable Toppings List */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {toppings.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic text-center py-2">No topping options added yet.</p>
                  ) : (
                    toppings.map((t, idx) => {
                      const isEditing = editingToppingIdx === idx;
                      const isDragging = draggedIdx === idx && draggedType === "toppings";
                      return (
                        <div
                          key={idx}
                          draggable={!isEditing}
                          onDragStart={(e) => handleDragStart(e, idx, "toppings")}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx, "toppings")}
                          onDragEnd={() => { setDraggedIdx(null); setDraggedType(null); }}
                          className={`flex items-center gap-2 bg-white p-2.5 rounded-xl border border-brand-pink/10 transition-all ${
                            isDragging ? "opacity-30 border-dashed border-[#B76E79]" : "hover:border-[#B76E79]/50"
                          }`}
                        >
                          {!isEditing && (
                            <div className="cursor-grab text-gray-300 hover:text-gray-500 transition px-1">
                              <GripVertical className="h-4.5 w-4.5" />
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex-1 flex gap-1.5 items-center">
                              <input
                                type="text"
                                value={editingToppingName}
                                onChange={(e) => setEditingToppingName(e.target.value)}
                                className="flex-1 text-xs bg-brand-cream/5 border border-brand-pink/20 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#B76E79]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditTopping(idx)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg cursor-pointer"
                                title="Save changes"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingToppingIdx(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-lg cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex justify-between items-center text-xs">
                              <span className="font-bold text-brand-chocolate">{t}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTopping(idx, t)}
                                  className="text-[#B76E79] hover:text-[#B76E79]/80 p-1 hover:bg-[#B76E79]/5 rounded transition cursor-pointer"
                                  title="Edit topping name"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveToppingOption(idx)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition cursor-pointer"
                                  title="Delete topping option"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
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
            disabled={uploading}
            className={`w-full py-4 rounded-xl text-sm font-bold transition shadow-sm flex items-center justify-center space-x-2 ${
              uploading 
                ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-75" 
                : "bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/95 cursor-pointer"
            }`}
          >
            <Sparkles className="h-5 w-5 text-brand-pink animate-pulse" />
            <span>{uploading ? "Image Uploading..." : "Publish Catalog Changes"}</span>
          </button>
        </form>
      ) : (
      /* MASTER CATALOG DISPLAYS WITH SEARCH & FILTER PANEL */
      <div className="space-y-5">
        <div className="bg-white border border-brand-pink/15 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            {/* Real-time Search input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-brand-chocolate/50" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Lainie's catalog by product name..."
                className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50/50 border border-brand-pink/20 rounded-xl text-brand-chocolate font-medium placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-rosegold focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-chocolate/50 hover:text-brand-chocolate text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort query dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-brand-chocolate uppercase tracking-wider shrink-0">Sorted By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-brand-pink/15 rounded-xl px-3 py-2 text-xs text-brand-chocolate font-semibold focus:outline-none focus:ring-1 focus:ring-brand-rosegold cursor-pointer"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
                <option value="margin-desc">Profit Margin (High to Low)</option>
              </select>
            </div>
          </div>

          {/* Category filter pills */}
          <div className="border-t border-brand-pink/10 pt-3">
            <label className="text-[10px] font-extrabold text-brand-chocolate uppercase tracking-wider block mb-2">
              Filter by Category:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {["All", ...dynamicCategories].map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer select-none ${
                      isActive
                        ? "bg-brand-rosegold text-white shadow-xs"
                        : "bg-brand-cream/40 text-brand-chocolate border border-brand-pink/10 hover:bg-brand-pink/20"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dense Responsive catalog grid */}
        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-16 bg-white border border-brand-pink/10 rounded-2xl">
            <p className="text-sm text-brand-chocolate/60">No treats match your active filters or search term.</p>
            <button
              onClick={() => { setSearchTerm(""); setSelectedCategory("All"); }}
              className="mt-3 text-xs font-semibold text-brand-rosegold hover:underline"
            >
              Clear filter presets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5">
            {filteredAndSortedProducts.map(p => {
              const ingCost = calculateIngredientTotalCost(p.ingredients || []);
              const margin = p.basePrice > 0 ? ((p.basePrice - ingCost) / p.basePrice) * 100 : 0;

              return (
                <div
                  key={p.id}
                  className={`border rounded-xl p-2.5 shadow-xs hover:shadow-sm transition flex flex-col justify-between group ${
                    p.isVisible === false 
                      ? "bg-slate-50/70 border-slate-200 opacity-70" 
                      : "bg-white border-brand-pink/20"
                  }`}
                >
                  <div>
                    <AdminProductCardImage product={p} />

                    <h3 className="font-extrabold text-[11px] text-brand-chocolate leading-tight font-heading line-clamp-1" title={p.name}>
                      {p.name}
                    </h3>
                    <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2 font-medium leading-tight">
                      {p.description}
                    </p>
                  </div>

                  <div className="mt-1.5 text-left">
                    <div className="flex justify-between items-center text-[9px] font-semibold pt-1.5 border-t border-brand-pink/10">
                      <div>
                        <span className="text-[7px] text-gray-400 block uppercase font-bold tracking-wider leading-none">Price</span>
                        <strong className="text-brand-chocolate font-extrabold text-[10px]">${p.basePrice.toFixed(2)}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[7px] text-gray-400 block uppercase font-bold tracking-wider leading-none">Margin</span>
                        <span className={`font-extrabold text-[8px] px-1 py-0.25 rounded ${
                          margin > 65 ? "bg-green-50 text-green-700" : margin > 40 ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-755"
                        }`}>
                          {margin.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEditClick(p)}
                      className="w-full mt-1.5 bg-brand-cream hover:bg-brand-pink/30 text-brand-chocolate border border-brand-pink/20 py-1 rounded-lg text-[9px] font-extrabold transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Edit2 className="h-2.5 w-2.5 text-brand-rosegold" />
                      <span>Configure</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
