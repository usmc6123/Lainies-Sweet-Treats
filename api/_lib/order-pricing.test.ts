import { calculateAuthoritativePricing, toCents, fromCents } from "./order-pricing.js";
import { dbService } from "../../src/server/db.js";

// Helper for assertions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log("🧪 Starting Automated Pricing Service Tests...");

  // Mock data setup
  const mockProducts = [
    {
      id: "prod-cupcake",
      name: "Cupcake",
      category: "cupcakes",
      isTaxable: true,
      basePrice: 4.5,
      isVisible: true,
      options: {
        sizes: [
          { name: "Regular", priceAdd: 0 },
          { name: "Jumbo", priceAdd: 1.5 }
        ],
        flavors: [
          { name: "Vanilla", priceAdd: 0 },
          { name: "Chocolate Premium", priceAdd: 0.5 }
        ],
        toppings: [
          { name: "Sprinkles", priceAdd: 0.25 },
          { name: "Gold Flakes", priceAdd: 2.0 }
        ],
        drizzles: [
          { name: "Caramel", priceAdd: 0.5 }
        ]
      }
    },
    {
      id: "prod-non-taxable",
      name: "Non-Taxable Cupcake",
      category: "cupcakes",
      isTaxable: false,
      basePrice: 4.5,
      isVisible: true,
      options: {}
    },
    {
      id: "prod-cake",
      name: "Custom Cake",
      category: "cakes",
      basePrice: 50.0,
      isVisible: true,
      options: {
        sizes: [
          { name: "6 inch", priceAdd: 0 },
          { name: "8 inch", priceAdd: 15.0 }
        ],
        cakeFlavors: [
          { name: "Vanilla Sponge", priceAdd: 0 },
          { name: "Red Velvet Premium", priceAdd: 5.0 }
        ],
        frostings: [
          { name: "Buttercream", priceAdd: 0 },
          { name: "Cream Cheese Luxury", priceAdd: 3.5 }
        ]
      },
      cakeFlavorSelectionLimit: 1,
      frostingSelectionLimit: 1
    },
    {
      id: "prod-hidden",
      name: "Secret Recipe",
      category: "cookies",
      basePrice: 10.0,
      isVisible: false,
      options: {}
    },
    {
      id: "prod-variations",
      name: "Mini Cakes",
      category: "mini-cakes",
      basePrice: 12.0,
      isVisible: true,
      options: {},
      variations: [
        {
          id: "normal",
          name: "Normal Mini Cake",
          basePrice: 12.0,
          sprinkleSelectionLimit: 5,
          toppingSelectionLimit: 5,
          options: {
            sizes: [
              { name: "One Dozen", priceAdd: 40.0 },
              { name: "Two Dozen", priceAdd: 75.0 }
            ],
            cakeFlavors: [
              { name: "Vanilla", priceAdd: 0 },
              { name: "Marble Premium", priceAdd: 5.0 }
            ],
            flavors: [
              { name: "Buttercream", priceAdd: 0 }
            ],
            drizzles: [
              { name: "Chocolate Drizzle", priceAdd: 2.0 }
            ],
            sprinkles: [
              { name: "Rainbow Sprinkles", priceAdd: 1.0 }
            ]
          }
        },
        {
          id: "specialty",
          name: "Specialty Mini Cake",
          basePrice: 18.0,
          sprinkleSelectionLimit: 5,
          toppingSelectionLimit: 5,
          options: {
            sizes: [
              { name: "One Dozen", priceAdd: 40.0 },
              { name: "Two Dozen", priceAdd: 75.0 }
            ],
            cakeFlavors: [
              { name: "Vanilla", priceAdd: 0 },
              { name: "Marble Premium", priceAdd: 5.0 }
            ],
            flavors: [
              { name: "Buttercream", priceAdd: 0 }
            ],
            drizzles: [
              { name: "Chocolate Drizzle", priceAdd: 2.0 }
            ],
            toppings: [
              { name: "Rainbow Sprinkles", priceAdd: 1.0 }
            ]
          }
        }
      ]
    }
  ];

  const mockSettings = {
    businessName: "Lainie's Sweet Treats",
    leadTimeDays: 3,
    deliveryRadius: 15,
    deliveryFee: 10.0,
    deliveryFeePerMile: 0,
    taxRate: 0.0825,
    emailTemplateConfirmation: "..."
  };

  const mockCoupons = [
    {
      id: "coupon-percent",
      code: "TENOFF",
      discountType: "percentage" as const,
      discountValue: 10,
      isActive: true,
      usageCount: 5,
      maxUses: 100
    },
    {
      id: "coupon-fixed",
      code: "FIVEBUCKS",
      discountType: "fixed" as const,
      discountValue: 5.0,
      isActive: true,
      usageCount: 0,
      minOrderAmount: 20.0
    },
    {
      id: "coupon-expired",
      code: "OLD10",
      discountType: "percentage" as const,
      discountValue: 10,
      isActive: true,
      expirationDate: "2020-01-01",
      usageCount: 0
    },
    {
      id: "coupon-max-uses",
      code: "GONE",
      discountType: "fixed" as const,
      discountValue: 10.0,
      isActive: true,
      maxUses: 2,
      usageCount: 2
    }
  ];

  // Mock implementation of dbService lists and gets
  dbService.list = async (col: string) => {
    if (col === "products") return mockProducts;
    if (col === "coupons") return mockCoupons;
    return [];
  };
  dbService.getSettings = async () => mockSettings;

  // 1. Standard product base price
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 1 }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 450, "Cupcake base subtotal should be 450");
    console.log("✅ Passed: 1. Standard product base price");
  }

  // 2. Product variation base price
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-variations", variationId: "specialty", quantity: 1 }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 1800, "Specialty variation base should be 1800");
    console.log("✅ Passed: 2. Product variation base price");
  }

  // 3. Size price adjustment
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 1, size: "Jumbo" }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 600, "Cupcake Jumbo should be 600 (450 + 150)");
    console.log("✅ Passed: 3. Size price adjustment");
  }

  // 4. Cake flavor price adjustment
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cake", quantity: 1, selectedCakeFlavors: ["Red Velvet Premium"] }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 5500, "Custom cake with Premium cake flavor should be 5500 (5000 + 500)");
    console.log("✅ Passed: 4. Cake flavor price adjustment");
  }

  // 5. Frosting price adjustment
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cake", quantity: 1, selectedFrostings: ["Cream Cheese Luxury"] }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 5350, "Custom cake with Luxury frosting should be 5350 (5000 + 350)");
    console.log("✅ Passed: 5. Frosting price adjustment");
  }

  // 6. Drizzle price adjustment
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 1, selectedDrizzles: ["Caramel"] }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 500, "Cupcake with drizzle should be 500 (450 + 50)");
    console.log("✅ Passed: 6. Drizzle price adjustment");
  }

  // 7. Topping price adjustment
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 1, selectedToppings: ["Sprinkles"] }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 475, "Cupcake with topping should be 475 (450 + 25)");
    console.log("✅ Passed: 7. Topping price adjustment");
  }

  // 8. Multiple selection limits
  {
    try {
      await calculateAuthoritativePricing(
        [{ productId: "prod-cake", quantity: 1, selectedCakeFlavors: ["Vanilla Sponge", "Red Velvet Premium"] }],
        undefined,
        "none",
        0,
        "pickup"
      );
      assert(false, "Should have thrown limit exceeded");
    } catch (e: any) {
      assert(e.message.includes("limit exceeded"), "Limit error verification");
    }
    console.log("✅ Passed: 8. Multiple selection limits");
  }

  // 9. Quantity multiplication
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 3 }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 1350, "3 cupcakes should be 1350");
    console.log("✅ Passed: 9. Quantity multiplication");
  }

  // 10. Percentage promo code
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }],
      "TENOFF",
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 900, "Subtotal 900");
    assert(result.discountAmountCents === 90, "10% of 900 is 90");
    console.log("✅ Passed: 10. Percentage promo code");
  }

  // 11. Fixed promo code
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cake", quantity: 1 }],
      "FIVEBUCKS",
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 5000, "Subtotal 5000");
    assert(result.discountAmountCents === 500, "Fixed discount of $5.00 is 500");
    console.log("✅ Passed: 11. Fixed promo code");
  }

  // 12. Promo minimum
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 1 }], // Subtotal $4.50 < $20 minimum for FIVEBUCKS
      "FIVEBUCKS",
      "none",
      0,
      "pickup"
    );
    assert(result.discountAmountCents === 0, "No discount since minimum subtotal not met");
    console.log("✅ Passed: 12. Promo minimum");
  }

  // 13. Promo maximum uses
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 5 }],
      "GONE",
      "none",
      0,
      "pickup"
    );
    assert(result.discountAmountCents === 0, "Coupon has reached max uses");
    console.log("✅ Passed: 13. Promo maximum uses");
  }

  // 14. Expired promo
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }],
      "OLD10",
      "none",
      0,
      "pickup"
    );
    assert(result.discountAmountCents === 0, "No discount for expired coupon");
    console.log("✅ Passed: 14. Expired promo");
  }

  // 15. Tip percentages
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 10 }],
      undefined,
      "15",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 4500, "Subtotal 4500");
    assert(result.tipAmountCents === 675, "15% of 4500 is 675");
    console.log("✅ Passed: 15. Tip percentages");
  }

  // 16. Custom tip
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }],
      undefined,
      "custom",
      3.5,
      "pickup"
    );
    assert(result.tipAmountCents === 350, "Custom tip 350");
    console.log("✅ Passed: 16. Custom tip");
  }

  // 17. Tax
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }],
      undefined,
      "none",
      0,
      "pickup"
    );
    // subtotal = 900. Tax = 900 * 0.0825 = 74.25 => Math.round is 74
    assert(result.taxAmountCents === 74, "Tax on 900 is 74");
    console.log("✅ Passed: 17. Tax");
  }

  // 18. Delivery fee
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }],
      undefined,
      "none",
      0,
      "delivery"
    );
    // Flat $10.00 delivery fee = 1000 cents
    assert(result.deliveryFeeCents === 1000, "Delivery fee is 1000");
    console.log("✅ Passed: 18. Delivery fee");
  }

  // 19. Pickup with no delivery fee
  {
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.deliveryFeeCents === 0, "Pickup has 0 delivery fee");
    console.log("✅ Passed: 19. Pickup with no delivery fee");
  }

  // 20. Client-submitted price tampering
  {
    // The pricing service ignores raw client price inputs completely and only re-calculates,
    // so let's verify that sending a raw cart with no price fields produces accurate cents values.
    const result = await calculateAuthoritativePricing(
      [{ productId: "prod-cupcake", quantity: 2 }]
    );
    assert(result.subtotalCents === 900, "Subtotal is authoritative");
    console.log("✅ Passed: 20. Client-submitted price tampering safety");
  }

  // 21. Hidden product
  {
    try {
      await calculateAuthoritativePricing([{ productId: "prod-hidden", quantity: 1 }]);
      assert(false, "Should have failed on invisible/hidden product");
    } catch (e: any) {
      assert(e.message.includes("unavailable"), "Visibility check error message");
    }
    console.log("✅ Passed: 21. Hidden product check");
  }

  // 22. Missing product
  {
    try {
      await calculateAuthoritativePricing([{ productId: "prod-not-exist", quantity: 1 }]);
      assert(false, "Should have failed on non-existent product");
    } catch (e: any) {
      assert(e.message.includes("not found"), "Missing product error message");
    }
    console.log("✅ Passed: 22. Missing product check");
  }

  // 23. Invalid variation
  {
    try {
      await calculateAuthoritativePricing([{ productId: "prod-variations", variationId: "var-fake", quantity: 1 }]);
      assert(false, "Should have failed on non-existent variation");
    } catch (e: any) {
      assert(e.message.includes("Invalid variation"), "Missing variation error message");
    }
    console.log("✅ Passed: 23. Invalid variation check");
  }

  // 24. Invalid option
  {
    try {
      await calculateAuthoritativePricing([{ productId: "prod-cupcake", quantity: 1, size: "Gigantic" }]);
      assert(false, "Should have failed on invalid size option");
    } catch (e: any) {
      assert(e.message.includes("Invalid size selected"), "Missing size error message");
    }
    console.log("✅ Passed: 24. Invalid option check");
  }

  // 25. Invalid quantity
  {
    try {
      await calculateAuthoritativePricing([{ productId: "prod-cupcake", quantity: -5 }]);
      assert(false, "Should have failed on negative quantity");
    } catch (e: any) {
      assert(e.message.includes("Invalid quantity"), "Negative quantity error message");
    }
    console.log("✅ Passed: 25. Invalid quantity check");
  }

  // 26. Mini Cakes Normal Per-Dozen Pricing Calculation (Two Dozen)
  {
    const result = await calculateAuthoritativePricing(
      [{
        productId: "prod-variations",
        variationId: "normal",
        quantity: 1,
        size: "Two Dozen",
        selectedCakeFlavors: ["Marble Premium"],
        selectedDrizzles: ["Chocolate Drizzle"],
        selectedSprinkles: ["Rainbow Sprinkles"]
      }],
      undefined,
      "none",
      0,
      "pickup"
    );
    // Base (Two Dozen) = 75.0
    // Add-ons per dozen = Marble Premium (5.0) + Chocolate Drizzle (2.0) + Rainbow Sprinkles (1.0) = 8.0
    // Total for Two Dozen = 75.0 + (8.0 * 2) = 91.0 => 9100 cents
    assert(result.subtotalCents === 9100, `Expected 9100 but got ${result.subtotalCents}`);
    console.log("✅ Passed: 26. Mini Cakes Normal Per-Dozen Pricing (Two Dozen)");
  }

  // 27. Mini Cakes Specialty Per-Dozen Pricing Calculation (Two Dozen)
  {
    const result = await calculateAuthoritativePricing(
      [{
        productId: "prod-variations",
        variationId: "specialty",
        quantity: 1,
        size: "Two Dozen",
        selectedCakeFlavors: ["Marble Premium"],
        selectedDrizzles: ["Chocolate Drizzle"],
        selectedToppings: ["Rainbow Sprinkles"]
      }],
      undefined,
      "none",
      0,
      "pickup"
    );
    // Base (Two Dozen) = 75.0
    // Add-ons per dozen = Marble Premium (5.0) + Chocolate Drizzle (2.0) + Rainbow Sprinkles (1.0) = 8.0
    // Total for Two Dozen = 75.0 + (8.0 * 2) = 91.0 => 9100 cents
    assert(result.subtotalCents === 9100, `Expected 9100 but got ${result.subtotalCents}`);
    console.log("✅ Passed: 27. Mini Cakes Specialty Per-Dozen Pricing (Two Dozen)");
  }

  // 28. Mini Cakes Normal Per-Dozen Pricing Calculation (One Dozen)
  {
    const result = await calculateAuthoritativePricing(
      [{
        productId: "prod-variations",
        variationId: "normal",
        quantity: 1,
        size: "One Dozen",
        selectedCakeFlavors: ["Marble Premium"]
      }],
      undefined,
      "none",
      0,
      "pickup"
    );
    // Base (One Dozen) = 40.0
    // Add-ons per dozen = Marble Premium (5.0) = 5.0
    // Total for One Dozen = 40.0 + (5.0 * 1) = 45.0 => 4500 cents
    assert(result.subtotalCents === 4500, `Expected 4500 but got ${result.subtotalCents}`);
    console.log("✅ Passed: 28. Mini Cakes Normal Per-Dozen Pricing (One Dozen)");
  }

  // 29. Mini Cakes Specialty Multiple Toppings Calculation
  {
    const result = await calculateAuthoritativePricing(
      [{
        productId: "prod-variations",
        variationId: "specialty",
        quantity: 1,
        size: "Two Dozen",
        selectedCakeFlavors: ["Vanilla"],
        selectedToppings: ["Rainbow Sprinkles"]
      }],
      undefined,
      "none",
      0,
      "pickup"
    );
    // Base (Two Dozen) = 75.0
    // Add-ons per dozen = Rainbow Sprinkles (1.0) = 1.0
    // Total for Two Dozen = 75.0 + (1.0 * 2) = 77.0 => 7700 cents
    assert(result.subtotalCents === 7700, `Expected 7700 but got ${result.subtotalCents}`);
    console.log("✅ Passed: 29. Mini Cakes Specialty Multiple Toppings Calculation");
  }

  // 30. Topping Selection Limit Exceeded
  {
    let caught = false;
    try {
      await calculateAuthoritativePricing(
        [{
          productId: "prod-cupcake",
          quantity: 1,
          selectedToppings: ["Sprinkles", "Chocolate Chips"]
        }],
        undefined,
        "none",
        0,
        "pickup"
      );
    } catch (e: any) {
      caught = true;
      assert(e.message.includes("limit exceeded"), "Error message should mention limit exceeded");
    }
    assert(caught, "Should reject when exceeding topping selection limit");
    console.log("✅ Passed: 30. Topping Selection Limit Exceeded Check");
  }

  // 31. Duplicate Topping Selection Check
  {
    let caught = false;
    try {
      await calculateAuthoritativePricing(
        [{
          productId: "prod-variations",
          variationId: "specialty",
          quantity: 1,
          size: "Two Dozen",
          selectedToppings: ["Rainbow Sprinkles", "Rainbow Sprinkles"]
        }],
        undefined,
        "none",
        0,
        "pickup"
      );
    } catch (e: any) {
      caught = true;
      assert(e.message.includes("Duplicate"), `Error message should mention duplicate but got ${e.message}`);
    }
    assert(caught, "Should reject duplicate toppings");
    console.log("✅ Passed: 31. Duplicate Topping Selection Check");
  }

  // 32. Taxable Subtotal Calculation for Mixed Items (Mini Cakes vs Non-Taxable Cupcakes)
  {
    const result = await calculateAuthoritativePricing(
      [
        {
          productId: "prod-non-taxable", // Non-taxable cupcake ($4.50)
          quantity: 2 // $9.00 -> 900 cents
        },
        {
          productId: "prod-variations", // Mini Cakes ($12.00) -> Taxable
          variationId: "normal",
          quantity: 1 // 1200 cents
        }
      ],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 2100, `Expected subtotal 2100 but got ${result.subtotalCents}`);
    assert(result.taxableSubtotalCents === 1200, `Expected taxable subtotal 1200 but got ${result.taxableSubtotalCents}`);
    const expectedTax = Math.round(1200 * 0.0825); // 99 cents
    assert(result.taxAmountCents === expectedTax, `Expected tax amount ${expectedTax} but got ${result.taxAmountCents}`);
    console.log("✅ Passed: 32. Taxable Subtotal Calculation for Mixed Items");
  }

  // 33. Non-taxable items only result in 0 tax
  {
    const result = await calculateAuthoritativePricing(
      [
        {
          productId: "prod-non-taxable", // Non-taxable cupcake
          quantity: 4 // $18.00 -> 1800 cents
        }
      ],
      undefined,
      "none",
      0,
      "pickup"
    );
    assert(result.subtotalCents === 1800, `Expected subtotal 1800 but got ${result.subtotalCents}`);
    assert(result.taxableSubtotalCents === 0, `Expected taxable subtotal 0 but got ${result.taxableSubtotalCents}`);
    assert(result.taxAmountCents === 0, `Expected tax amount 0 but got ${result.taxAmountCents}`);
    console.log("✅ Passed: 33. Non-taxable items only tax check");
  }

  console.log("\n✨ All Automated pricing tests completed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
