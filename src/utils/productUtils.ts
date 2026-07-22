export const DEFAULT_FALLBACK_IMAGE = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%20fill%3D%22none%22%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20rx%3D%2216%22%20fill%3D%22%23FFF5F6%22%2F%3E%3Cpath%20d%3D%22M60%20140h80v15H60zm10-35h60v35H70zm10-30h40v30H80z%22%20fill%3D%22white%22%20stroke%3D%22%23FF2D96%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3Ccircle%20cx%3D%22100%20%22%20cy%3D%2260%22%20r%3D%226%22%20fill%3D%22%23FF2D96%22%2F%3E%3Cpath%20d%3D%22M100%2042v12%22%20stroke%3D%22%236EEFD8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E`;

export function isValidProductImageUrl(value: any): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const trimmed = value.trim();
  // Filter out development-only src/assets reference or legacy placeholder
  if (trimmed.includes("/src/assets/")) return false;
  return true;
}

export function normalizeProductPhotos(product: any, selectedVariationId?: string): { url: string; isPrimary: boolean }[] {
  if (!product) return [];

  // If a variation is selected and it has its own photos, use them
  if (selectedVariationId && Array.isArray(product.variations)) {
    const variation = product.variations.find((v: any) => v.id === selectedVariationId);
    if (variation && Array.isArray(variation.photos) && variation.photos.length > 0) {
      const validVarPhotos = variation.photos
        .filter((photo: any) => photo && typeof photo === "object" && isValidProductImageUrl(photo.url))
        .map((photo: any) => ({
          url: photo.url.trim(),
          isPrimary: !!photo.isPrimary,
        }));
      if (validVarPhotos.length > 0) {
        const primaryCount = validVarPhotos.filter((p) => p.isPrimary).length;
        if (primaryCount !== 1) {
          validVarPhotos.forEach((p) => (p.isPrimary = false));
          validVarPhotos[0].isPrimary = true;
        }
        return validVarPhotos;
      }
    }
  }

  let validPhotos: { url: string; isPrimary: boolean }[] = [];

  // 1. Process photos array if it exists
  if (Array.isArray(product.photos)) {
    validPhotos = product.photos
      .filter((photo: any) => photo && typeof photo === "object" && isValidProductImageUrl(photo.url))
      .map((photo: any) => ({
        url: photo.url.trim(),
        isPrimary: !!photo.isPrimary,
      }));
  }

  // 2. If no valid photos array but has a valid imgUrl, convert it to a photo item
  if (validPhotos.length === 0 && isValidProductImageUrl(product.imgUrl)) {
    validPhotos = [{ url: product.imgUrl!.trim(), isPrimary: true }];
  }

  // 3. Ensure exactly one photo is marked as primary if any photos exist
  if (validPhotos.length > 0) {
    const primaryCount = validPhotos.filter((p) => p.isPrimary).length;
    if (primaryCount !== 1) {
      // Reset all primary flags
      validPhotos.forEach((p) => (p.isPrimary = false));
      // Mark the first valid photo as primary
      validPhotos[0].isPrimary = true;
    }
  }

  return validPhotos;
}

export function getPrimaryProductImage(product: any, selectedVariationId?: string): string {
  const normalized = normalizeProductPhotos(product, selectedVariationId);
  const primary = normalized.find((p) => p.isPrimary);
  if (primary) return primary.url;
  if (normalized.length > 0) return normalized[0].url;
  return DEFAULT_FALLBACK_IMAGE;
}

export function normalizeProductNameAndCategory(product: any): { name: string; category: string } {
  if (!product) return { name: "", category: "" };

  let name = product.name || "";
  let category = product.category || "";
  const nameLower = name.toLowerCase();

  // Normalize legacy names
  if (name === "Custom Cakes" || name === "Custom Cake" || nameLower === "beautiful kittens") {
    name = "Mini Cakes";
  } else if (nameLower.includes("cure kittens") || nameLower.includes("cute kittens")) {
    name = "Cupcakes";
  } else if (nameLower.includes("cookies that people like")) {
    name = "Jumbo Cookies";
  }

  // Normalize legacy categories
  if (category === "Custom Cakes") {
    category = "Mini Cakes";
  } else if (nameLower.includes("cure kittens") || nameLower.includes("cute kittens") || name === "Cupcakes") {
    category = "Cupcakes";
  } else if (name === "Mini Cakes") {
    category = "Mini Cakes";
  } else if (name === "Jumbo Cookies" || category === "Cookies that people like") {
    category = "Cookies";
  } else if (category === "Seasonal Specials" || name === "Seasonal Specials") {
    category = "Dipped Pretzels";
  }

  return { name, category };
}
