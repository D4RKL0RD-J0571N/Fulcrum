import {
  Order,
  OrderRequirementLine,
  StockObservation,
  parseLocationBayAndLevel
} from './planning';
import { SimulationInputSnapshot, SimulationStrategy } from '@fulcrum/contracts';

/* ============================================================
   1. RETAIL PRODUCT CATALOG DATA STRUCTURES
   ============================================================ */

export type RetailCategory =
  | 'Apparel'
  | 'Footwear'
  | 'Home Goods'
  | 'Beauty & Care'
  | 'Toys & Accessories'
  | 'Seasonal'
  | 'Pet Products';

export interface ProductVariant {
  sku: string; // 10-digit numeric tracking code (e.g. "1524289001")
  name: string;
  sizeVariant?: string; // e.g. "S", "M", "L", "XL", "30", "32"
  colorOrStyle?: string; // e.g. "Black", "Navy", "Citrus"
  unitOfMeasure: 'PIECE' | 'PAIR' | 'SET';
  piecesPerPack: number; // e.g. 5 or 6 pieces per pack for apparel
  weightKg: number;
}

export interface RetailProduct {
  productId: string; // e.g. "PROD-APP-001"
  name: string;
  category: RetailCategory;
  description: string;
  variants: ProductVariant[];
}

export interface SyntheticWarehouseDataConfig {
  seed: number;
  baseTime?: number;
  productCount?: number; // target: 40-60 products
  muCount?: number; // target: 100-180 MUs
  orderCount?: number; // target: 25-50 orders
  bayCount?: number; // target: 20-30 bays
  looseStockRatio?: number; // default: 0.08 (8% loose)
}

export interface SyntheticWarehouseDataset {
  seed: number;
  baseTime: number;
  catalog: RetailProduct[];
  allVariants: ProductVariant[];
  bays: string[]; // e.g. ["EA01", "EA02", ..., "EH14"]
  locations: string[]; // e.g. ["EA01A", "EA01B", "EA01D", ...]
  muIds: string[]; // 6-digit alphanumeric IDs (e.g. ["502900", "A19B72", ...])
  orders: Order[];
  observations: StockObservation[];
  stats: {
    productCount: number;
    skuCount: number;
    muCount: number;
    orderCount: number;
    observationCount: number;
    totalPiecesInStock: number;
    looseObservationCount: number;
  };
}

/* ============================================================
   2. DETERMINISTIC PSEUDO-RANDOM NUMBER GENERATOR
   ============================================================ */

export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed ^ 0x6d2b79f5) >>> 0;
    if (this.state === 0) this.state = 1;
  }

  /**
   * Returns a float in [0, 1)
   */
  public nextFloat(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /**
   * Returns an integer in [min, max] inclusive
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(min + this.nextFloat() * (max - min + 1));
  }

  /**
   * Picks a random element from an array
   */
  public pick<T>(array: T[]): T {
    const idx = this.nextInt(0, array.length - 1);
    return array[idx];
  }

  /**
   * Shuffles an array deterministically (returns new array)
   */
  public shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Generates a unique 6-character alphanumeric MU ID (e.g. "502900", "A19B72")
   */
  public nextMuId(seq: number): string {
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    // Incorporate sequence number and pseudo-random entropy for guaranteed uniqueness
    let val = ((this.state ^ (seq * 2654435761)) >>> 0) % 2176782336; // 36^6
    let id = '';
    for (let i = 0; i < 6; i++) {
      id = chars[val % chars.length] + id;
      val = Math.floor(val / chars.length);
    }
    return id.padStart(6, '0');
  }
}

/* ============================================================
   3. CURATED RETAIL PRODUCT CATALOG (48 Products, 110 SKUs)
   ============================================================ */

export const RETAIL_PRODUCT_CATALOG: RetailProduct[] = [
  // --- APPAREL (15 Base Products) ---
  {
    productId: 'PROD-APP-001',
    name: 'Athletic Tee Slim',
    category: 'Apparel',
    description: 'Moisture-wicking athletic crewneck tee with four-way stretch.',
    variants: [
      { sku: '1524289001', name: 'Athletic Tee Slim — Black / S', sizeVariant: 'S', colorOrStyle: 'Black', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.18 },
      { sku: '1524289002', name: 'Athletic Tee Slim — Black / M', sizeVariant: 'M', colorOrStyle: 'Black', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.20 },
      { sku: '1524289003', name: 'Athletic Tee Slim — Black / L', sizeVariant: 'L', colorOrStyle: 'Black', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.22 },
      { sku: '1524289004', name: 'Athletic Tee Slim — Black / XL', sizeVariant: 'XL', colorOrStyle: 'Black', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.24 }
    ]
  },
  {
    productId: 'PROD-APP-002',
    name: 'Classic Pique Polo',
    category: 'Apparel',
    description: 'Breathable combed cotton pique polo with ribbed collar.',
    variants: [
      { sku: '1524290001', name: 'Classic Pique Polo — Navy / S', sizeVariant: 'S', colorOrStyle: 'Navy', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.25 },
      { sku: '1524290002', name: 'Classic Pique Polo — Navy / M', sizeVariant: 'M', colorOrStyle: 'Navy', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.27 },
      { sku: '1524290003', name: 'Classic Pique Polo — Navy / L', sizeVariant: 'L', colorOrStyle: 'Navy', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.29 }
    ]
  },
  {
    productId: 'PROD-APP-003',
    name: 'Comfort Stretch Denim Jeans',
    category: 'Apparel',
    description: 'Mid-rise straight-fit durable denim with flex elastane.',
    variants: [
      { sku: '1524291001', name: 'Comfort Stretch Jeans — Dark Indigo / 30', sizeVariant: '30', colorOrStyle: 'Dark Indigo', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.65 },
      { sku: '1524291002', name: 'Comfort Stretch Jeans — Dark Indigo / 32', sizeVariant: '32', colorOrStyle: 'Dark Indigo', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.68 },
      { sku: '1524291003', name: 'Comfort Stretch Jeans — Dark Indigo / 34', sizeVariant: '34', colorOrStyle: 'Dark Indigo', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.72 }
    ]
  },
  {
    productId: 'PROD-APP-004',
    name: 'Fleece Pullover Hoodie',
    category: 'Apparel',
    description: 'Heavyweight brushed fleece hoodie with kangaroo pocket.',
    variants: [
      { sku: '1524292001', name: 'Fleece Pullover Hoodie — Heather Grey / S', sizeVariant: 'S', colorOrStyle: 'Heather Grey', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.55 },
      { sku: '1524292002', name: 'Fleece Pullover Hoodie — Heather Grey / M', sizeVariant: 'M', colorOrStyle: 'Heather Grey', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.58 },
      { sku: '1524292003', name: 'Fleece Pullover Hoodie — Heather Grey / L', sizeVariant: 'L', colorOrStyle: 'Heather Grey', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.62 }
    ]
  },
  {
    productId: 'PROD-APP-005',
    name: 'Women’s Soft Touch V-Neck',
    category: 'Apparel',
    description: 'Modal-cotton blend everyday casual tee with relaxed drape.',
    variants: [
      { sku: '1524293001', name: 'Soft Touch V-Neck — White / XS', sizeVariant: 'XS', colorOrStyle: 'White', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.15 },
      { sku: '1524293002', name: 'Soft Touch V-Neck — White / S', sizeVariant: 'S', colorOrStyle: 'White', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.16 },
      { sku: '1524293003', name: 'Soft Touch V-Neck — White / M', sizeVariant: 'M', colorOrStyle: 'White', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.17 },
      { sku: '1524293004', name: 'Soft Touch V-Neck — White / L', sizeVariant: 'L', colorOrStyle: 'White', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.19 }
    ]
  },
  {
    productId: 'PROD-APP-006',
    name: 'High-Rise Seamless Leggings',
    category: 'Apparel',
    description: 'Compression performance leggings with reinforced waistband.',
    variants: [
      { sku: '1524294001', name: 'Seamless Leggings — Olive / S', sizeVariant: 'S', colorOrStyle: 'Olive', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.22 },
      { sku: '1524294002', name: 'Seamless Leggings — Olive / M', sizeVariant: 'M', colorOrStyle: 'Olive', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.24 },
      { sku: '1524294003', name: 'Seamless Leggings — Olive / L', sizeVariant: 'L', colorOrStyle: 'Olive', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.26 }
    ]
  },
  {
    productId: 'PROD-APP-007',
    name: 'Casual Linen Blend Blouse',
    category: 'Apparel',
    description: 'Airy summer button-up blouse with rolled-tab cuffs.',
    variants: [
      { sku: '1524295001', name: 'Linen Blouse — Sky Blue / S', sizeVariant: 'S', colorOrStyle: 'Sky Blue', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.20 },
      { sku: '1524295002', name: 'Linen Blouse — Sky Blue / M', sizeVariant: 'M', colorOrStyle: 'Sky Blue', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.22 },
      { sku: '1524295003', name: 'Linen Blouse — Sky Blue / L', sizeVariant: 'L', colorOrStyle: 'Sky Blue', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.24 }
    ]
  },
  {
    productId: 'PROD-APP-008',
    name: 'Tiered Floral Midi Dress',
    category: 'Apparel',
    description: 'Lightweight chiffon floral print sundress with smocked bodice.',
    variants: [
      { sku: '1524296001', name: 'Floral Midi Dress — Blush / S', sizeVariant: 'S', colorOrStyle: 'Blush', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.32 },
      { sku: '1524296002', name: 'Floral Midi Dress — Blush / M', sizeVariant: 'M', colorOrStyle: 'Blush', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.35 },
      { sku: '1524296003', name: 'Floral Midi Dress — Blush / L', sizeVariant: 'L', colorOrStyle: 'Blush', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.38 }
    ]
  },
  {
    productId: 'PROD-APP-009',
    name: 'Kids Organic Cotton Pajamas',
    category: 'Apparel',
    description: 'Two-piece snug-fitting ribbed cotton pajama set.',
    variants: [
      { sku: '1524297001', name: 'Kids Pajama Set — Stars / 4T', sizeVariant: '4T', colorOrStyle: 'Stars', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.22 },
      { sku: '1524297002', name: 'Kids Pajama Set — Stars / 6', sizeVariant: '6', colorOrStyle: 'Stars', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.25 },
      { sku: '1524297003', name: 'Kids Pajama Set — Stars / 8', sizeVariant: '8', colorOrStyle: 'Stars', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.28 }
    ]
  },
  {
    productId: 'PROD-APP-010',
    name: 'Kids Graphic Cotton Tee',
    category: 'Apparel',
    description: 'Durable pre-shrunk cotton tee with playful screen print.',
    variants: [
      { sku: '1524298001', name: 'Kids Graphic Tee — Dino / S', sizeVariant: 'S', colorOrStyle: 'Dino Green', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.12 },
      { sku: '1524298002', name: 'Kids Graphic Tee — Dino / M', sizeVariant: 'M', colorOrStyle: 'Dino Green', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.14 },
      { sku: '1524298003', name: 'Kids Graphic Tee — Dino / L', sizeVariant: 'L', colorOrStyle: 'Dino Green', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.16 }
    ]
  },
  {
    productId: 'PROD-APP-011',
    name: 'Packable Windbreaker Jacket',
    category: 'Apparel',
    description: 'Water-resistant ripstop nylon shell with adjustable hood.',
    variants: [
      { sku: '1524299001', name: 'Packable Windbreaker — Cobalt / M', sizeVariant: 'M', colorOrStyle: 'Cobalt', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.30 },
      { sku: '1524299002', name: 'Packable Windbreaker — Cobalt / L', sizeVariant: 'L', colorOrStyle: 'Cobalt', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.33 },
      { sku: '1524299003', name: 'Packable Windbreaker — Cobalt / XL', sizeVariant: 'XL', colorOrStyle: 'Cobalt', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.36 }
    ]
  },
  {
    productId: 'PROD-APP-012',
    name: 'Chino Flat-Front Shorts',
    category: 'Apparel',
    description: 'Classic 9-inch inseam stretch chino shorts with slant pockets.',
    variants: [
      { sku: '1524300001', name: 'Chino Shorts — Khaki / 30', sizeVariant: '30', colorOrStyle: 'Khaki', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.35 },
      { sku: '1524300002', name: 'Chino Shorts — Khaki / 32', sizeVariant: '32', colorOrStyle: 'Khaki', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.37 },
      { sku: '1524300003', name: 'Chino Shorts — Khaki / 34', sizeVariant: '34', colorOrStyle: 'Khaki', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.40 }
    ]
  },
  {
    productId: 'PROD-APP-013',
    name: 'Cargo Trouser Utility',
    category: 'Apparel',
    description: 'Reinforced tactical utility cargo trousers with articulated knees.',
    variants: [
      { sku: '2841920001', name: 'Cargo Trouser Utility — Navy / 30', sizeVariant: '30', colorOrStyle: 'Navy', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.60 },
      { sku: '2841920002', name: 'Cargo Trouser Utility — Navy / 32', sizeVariant: '32', colorOrStyle: 'Navy', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.63 },
      { sku: '2841920003', name: 'Cargo Trouser Utility — Navy / 34', sizeVariant: '34', colorOrStyle: 'Navy', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.66 }
    ]
  },
  {
    productId: 'PROD-APP-014',
    name: 'Waffle Knit Thermal Henley',
    category: 'Apparel',
    description: 'Textured thermal waffle knit shirt with button placket.',
    variants: [
      { sku: '2841930001', name: 'Thermal Henley — Charcoal / M', sizeVariant: 'M', colorOrStyle: 'Charcoal', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.38 },
      { sku: '2841930002', name: 'Thermal Henley — Charcoal / L', sizeVariant: 'L', colorOrStyle: 'Charcoal', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.41 }
    ]
  },
  {
    productId: 'PROD-APP-015',
    name: 'Crewneck Lambswool Sweater',
    category: 'Apparel',
    description: 'Soft knit winter sweater with ribbed cuffs and hem.',
    variants: [
      { sku: '2841940001', name: 'Lambswool Sweater — Burgundy / S', sizeVariant: 'S', colorOrStyle: 'Burgundy', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.45 },
      { sku: '2841940002', name: 'Lambswool Sweater — Burgundy / M', sizeVariant: 'M', colorOrStyle: 'Burgundy', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.48 },
      { sku: '2841940003', name: 'Lambswool Sweater — Burgundy / L', sizeVariant: 'L', colorOrStyle: 'Burgundy', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.52 }
    ]
  },

  // --- FOOTWEAR (6 Base Products) ---
  {
    productId: 'PROD-FTW-001',
    name: 'Ultralight Road Runner',
    category: 'Footwear',
    description: 'Engineered mesh running shoes with responsive EVA foam cushioning.',
    variants: [
      { sku: '3101010001', name: 'Ultralight Runner — Jet Black / 8', sizeVariant: '8', colorOrStyle: 'Jet Black', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.75 },
      { sku: '3101010002', name: 'Ultralight Runner — Jet Black / 9', sizeVariant: '9', colorOrStyle: 'Jet Black', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.80 },
      { sku: '3101010003', name: 'Ultralight Runner — Jet Black / 10', sizeVariant: '10', colorOrStyle: 'Jet Black', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.85 }
    ]
  },
  {
    productId: 'PROD-FTW-002',
    name: 'Canvas Low-Top Sneaker',
    category: 'Footwear',
    description: 'Vulcanized rubber sole casual canvas walking sneaker.',
    variants: [
      { sku: '3101020001', name: 'Canvas Low-Top — Off-White / 7', sizeVariant: '7', colorOrStyle: 'Off-White', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.70 },
      { sku: '3101020002', name: 'Canvas Low-Top — Off-White / 8', sizeVariant: '8', colorOrStyle: 'Off-White', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.75 },
      { sku: '3101020003', name: 'Canvas Low-Top — Off-White / 9', sizeVariant: '9', colorOrStyle: 'Off-White', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.80 }
    ]
  },
  {
    productId: 'PROD-FTW-003',
    name: 'Recovery Foam Slide Sandals',
    category: 'Footwear',
    description: 'Waterproof contoured footbed slides for post-workout comfort.',
    variants: [
      { sku: '3101030001', name: 'Foam Slides — Slate / 8', sizeVariant: '8', colorOrStyle: 'Slate', unitOfMeasure: 'PAIR', piecesPerPack: 6, weightKg: 0.40 },
      { sku: '3101030002', name: 'Foam Slides — Slate / 10', sizeVariant: '10', colorOrStyle: 'Slate', unitOfMeasure: 'PAIR', piecesPerPack: 6, weightKg: 0.45 }
    ]
  },
  {
    productId: 'PROD-FTW-004',
    name: 'All-Terrain Hiking Boot',
    category: 'Footwear',
    description: 'Waterproof suede trail boot with high-traction lugged outsole.',
    variants: [
      { sku: '3101040001', name: 'Hiking Boot — Olive / 9', sizeVariant: '9', colorOrStyle: 'Olive Brown', unitOfMeasure: 'PAIR', piecesPerPack: 3, weightKg: 1.25 },
      { sku: '3101040002', name: 'Hiking Boot — Olive / 10', sizeVariant: '10', colorOrStyle: 'Olive Brown', unitOfMeasure: 'PAIR', piecesPerPack: 3, weightKg: 1.30 }
    ]
  },
  {
    productId: 'PROD-FTW-005',
    name: 'Classic Slip-On Espadrille',
    category: 'Footwear',
    description: 'Jute-wrapped sole casual slip-on with breathable linen upper.',
    variants: [
      { sku: '3101050001', name: 'Slip-On Espadrille — Natural / 7', sizeVariant: '7', colorOrStyle: 'Natural', unitOfMeasure: 'PAIR', piecesPerPack: 5, weightKg: 0.50 },
      { sku: '3101050002', name: 'Slip-On Espadrille — Natural / 8', sizeVariant: '8', colorOrStyle: 'Natural', unitOfMeasure: 'PAIR', piecesPerPack: 5, weightKg: 0.52 }
    ]
  },
  {
    productId: 'PROD-FTW-006',
    name: 'Kids Light-Up Sport Sneaker',
    category: 'Footwear',
    description: 'Velcro strap lightweight trainer with motion-activated sole lights.',
    variants: [
      { sku: '3101060001', name: 'Kids Light-Up — Blue Neon / 12', sizeVariant: '12', colorOrStyle: 'Blue Neon', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.45 },
      { sku: '3101060002', name: 'Kids Light-Up — Blue Neon / 1', sizeVariant: '1', colorOrStyle: 'Blue Neon', unitOfMeasure: 'PAIR', piecesPerPack: 4, weightKg: 0.48 }
    ]
  },

  // --- HOME GOODS & HOUSEHOLD (8 Base Products) ---
  {
    productId: 'PROD-HOM-001',
    name: 'Silky Microfiber Bed Sheet Set',
    category: 'Home Goods',
    description: 'Double-brushed microfiber sheet set with deep-pocket fitted sheet.',
    variants: [
      { sku: '4201010001', name: 'Microfiber Sheets — Grey / Twin', sizeVariant: 'Twin', colorOrStyle: 'Grey', unitOfMeasure: 'SET', piecesPerPack: 4, weightKg: 1.10 },
      { sku: '4201010002', name: 'Microfiber Sheets — Grey / Queen', sizeVariant: 'Queen', colorOrStyle: 'Grey', unitOfMeasure: 'SET', piecesPerPack: 4, weightKg: 1.45 },
      { sku: '4201010003', name: 'Microfiber Sheets — Grey / King', sizeVariant: 'King', colorOrStyle: 'Grey', unitOfMeasure: 'SET', piecesPerPack: 3, weightKg: 1.70 }
    ]
  },
  {
    productId: 'PROD-HOM-002',
    name: 'Turkish Cotton Bath Towel',
    category: 'Home Goods',
    description: '600 GSM zero-twist Turkish ring-spun cotton luxury bath towel.',
    variants: [
      { sku: '4201020001', name: 'Turkish Bath Towel — Cloud White', colorOrStyle: 'Cloud White', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.58 },
      { sku: '4201020002', name: 'Turkish Bath Towel — Mineral Grey', colorOrStyle: 'Mineral Grey', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.58 }
    ]
  },
  {
    productId: 'PROD-HOM-003',
    name: 'Non-Stick Ceramic Skillet 3-Piece Set',
    category: 'Home Goods',
    description: 'PTFE/PFOA-free non-stick aluminum frying pans (8", 10", 12").',
    variants: [
      { sku: '4201030001', name: 'Ceramic Skillet Set — Matte Black', colorOrStyle: 'Matte Black', unitOfMeasure: 'SET', piecesPerPack: 2, weightKg: 2.80 }
    ]
  },
  {
    productId: 'PROD-HOM-004',
    name: 'Foldable Fabric Organizer Cube',
    category: 'Home Goods',
    description: 'Collapsible non-woven storage bins with dual grommet handles.',
    variants: [
      { sku: '4201040001', name: 'Storage Cube — Charcoal / Medium', sizeVariant: 'Medium', colorOrStyle: 'Charcoal', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.40 },
      { sku: '4201040002', name: 'Storage Cube — Charcoal / Large', sizeVariant: 'Large', colorOrStyle: 'Charcoal', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.55 }
    ]
  },
  {
    productId: 'PROD-HOM-005',
    name: 'Vacuum Insulated Travel Tumbler',
    category: 'Home Goods',
    description: 'Double-walled stainless steel thermal tumbler with splash-proof lid.',
    variants: [
      { sku: '4201050001', name: 'Insulated Tumbler — Sage Green / 20oz', sizeVariant: '20oz', colorOrStyle: 'Sage Green', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.35 },
      { sku: '4201050002', name: 'Insulated Tumbler — Sage Green / 32oz', sizeVariant: '32oz', colorOrStyle: 'Sage Green', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.48 }
    ]
  },
  {
    productId: 'PROD-HOM-006',
    name: 'Silicone Cooking Utensil 6-Piece Set',
    category: 'Home Goods',
    description: 'Heat-resistant non-scratch kitchen tool set with natural acacia wood handles.',
    variants: [
      { sku: '4201060001', name: 'Silicone Utensil Set — Warm Sand', colorOrStyle: 'Warm Sand', unitOfMeasure: 'SET', piecesPerPack: 4, weightKg: 0.65 }
    ]
  },
  {
    productId: 'PROD-HOM-007',
    name: 'Aromatherapy Essential Oil Diffuser',
    category: 'Home Goods',
    description: 'Ultrasonic cool-mist aroma diffuser with ambient LED nightlight.',
    variants: [
      { sku: '4201070001', name: 'Aroma Diffuser — Lavender Breeze', colorOrStyle: 'Lavender Breeze', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.52 },
      { sku: '4201070002', name: 'Aroma Diffuser — French Vanilla', colorOrStyle: 'French Vanilla', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.52 }
    ]
  },
  {
    productId: 'PROD-HOM-008',
    name: 'Ribbed Flannel Plush Throw Blanket',
    category: 'Home Goods',
    description: 'Velvety microfiber flannel throw blanket (50" x 60").',
    variants: [
      { sku: '4201080001', name: 'Flannel Throw — Oatmeal / 50x60', sizeVariant: '50x60', colorOrStyle: 'Oatmeal', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.85 }
    ]
  },

  // --- BEAUTY & PERSONAL CARE (6 Base Products) ---
  {
    productId: 'PROD-BTY-001',
    name: 'Botanical Hydrating Shampoo',
    category: 'Beauty & Care',
    description: 'Sulfate-free nourishing argan and rosemary clarifying shampoo (500ml).',
    variants: [
      { sku: '5301010001', name: 'Hydrating Shampoo — 500ml', sizeVariant: '500ml', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.55 }
    ]
  },
  {
    productId: 'PROD-BTY-002',
    name: 'Deep Repair Keratin Conditioner',
    category: 'Beauty & Care',
    description: 'Fortifying moisture mask conditioner with keratin and shea butter (500ml).',
    variants: [
      { sku: '5301020001', name: 'Keratin Conditioner — 500ml', sizeVariant: '500ml', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.55 }
    ]
  },
  {
    productId: 'PROD-BTY-003',
    name: 'Invigorating Citrus Body Wash',
    category: 'Beauty & Care',
    description: 'Gentle exfoliating foaming body cleanser with vitamin C and citrus extract.',
    variants: [
      { sku: '5301030001', name: 'Citrus Body Wash — Sweet Mandarin / 400ml', colorOrStyle: 'Sweet Mandarin', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.45 },
      { sku: '5301030002', name: 'Citrus Body Wash — Eucalyptus Mint / 400ml', colorOrStyle: 'Eucalyptus Mint', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.45 }
    ]
  },
  {
    productId: 'PROD-BTY-004',
    name: 'Ceramide Daily Barrier Face Cream',
    category: 'Beauty & Care',
    description: 'Fragrance-free hyaluronic acid barrier repair daily moisturizer (100ml).',
    variants: [
      { sku: '5301040001', name: 'Ceramide Barrier Cream — 100ml', sizeVariant: '100ml', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.15 }
    ]
  },
  {
    productId: 'PROD-BTY-005',
    name: 'Sheer Mineral Sunscreen SPF 50',
    category: 'Beauty & Care',
    description: 'Broad-spectrum non-nano zinc oxide water-resistant face sunscreen (75ml).',
    variants: [
      { sku: '5301050001', name: 'Mineral Sunscreen SPF 50 — 75ml', sizeVariant: '75ml', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.12 }
    ]
  },
  {
    productId: 'PROD-BTY-006',
    name: 'Ultra-Rich Shea Butter Hand Cream',
    category: 'Beauty & Care',
    description: 'Fast-absorbing soothing hand salve with 20% organic shea butter.',
    variants: [
      { sku: '5301060001', name: 'Shea Hand Cream 3-Pack — Assorted', colorOrStyle: 'Assorted 3-Pack', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.25 }
    ]
  },

  // --- TOYS & ACCESSORIES (5 Base Products) ---
  {
    productId: 'PROD-TOY-001',
    name: 'Wooden Architectural Block Set',
    category: 'Toys & Accessories',
    description: 'Natural solid beechwood 60-piece open-ended construction block set.',
    variants: [
      { sku: '6401010001', name: 'Wooden Blocks — 60-Piece Classic', colorOrStyle: 'Classic', unitOfMeasure: 'SET', piecesPerPack: 4, weightKg: 1.60 }
    ]
  },
  {
    productId: 'PROD-TOY-002',
    name: 'Plush Stuffed Sleepy Bear',
    category: 'Toys & Accessories',
    description: 'Super-soft huggable plush animal with embroidered safety eyes.',
    variants: [
      { sku: '6401020001', name: 'Plush Bear — Honey Brown / 12in', colorOrStyle: 'Honey Brown', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.30 },
      { sku: '6401020002', name: 'Plush Bear — Vanilla Cream / 12in', colorOrStyle: 'Vanilla Cream', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.30 }
    ]
  },
  {
    productId: 'PROD-TOY-003',
    name: 'High-Speed All-Terrain RC Buggy',
    category: 'Toys & Accessories',
    description: '1:18 scale rechargeable remote control electric dune buggy.',
    variants: [
      { sku: '6401030001', name: 'RC Buggy — Flame Red', colorOrStyle: 'Flame Red', unitOfMeasure: 'PIECE', piecesPerPack: 2, weightKg: 1.15 },
      { sku: '6401030002', name: 'RC Buggy — Sonic Blue', colorOrStyle: 'Sonic Blue', unitOfMeasure: 'PIECE', piecesPerPack: 2, weightKg: 1.15 }
    ]
  },
  {
    productId: 'PROD-TOY-004',
    name: 'Water-Resistant Canvas Commuter Backpack',
    category: 'Toys & Accessories',
    description: 'Padded 15.6-inch laptop compartment daypack with dual water bottle holders.',
    variants: [
      { sku: '6401040001', name: 'Commuter Backpack — Stealth Black', colorOrStyle: 'Stealth Black', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.65 },
      { sku: '6401040002', name: 'Commuter Backpack — Forest Olive', colorOrStyle: 'Forest Olive', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.65 }
    ]
  },
  {
    productId: 'PROD-TOY-005',
    name: 'RFID-Shielded Slim Leather Bifold Wallet',
    category: 'Toys & Accessories',
    description: 'Top-grain genuine cowhide minimalist cardholder wallet.',
    variants: [
      { sku: '6401050001', name: 'Leather Bifold — Saddle Brown', colorOrStyle: 'Saddle Brown', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.12 }
    ]
  },

  // --- SEASONAL MERCHANDISE (4 Base Products) ---
  {
    productId: 'PROD-SEA-001',
    name: 'Cabana Striped Quick-Dry Beach Towel',
    category: 'Seasonal',
    description: 'Oversized sand-resistant microfiber outdoor pool and beach towel.',
    variants: [
      { sku: '7501010001', name: 'Cabana Beach Towel — Ocean Blue / 35x70', colorOrStyle: 'Ocean Blue', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.48 },
      { sku: '7501010002', name: 'Cabana Beach Towel — Coral Sunset / 35x70', colorOrStyle: 'Coral Sunset', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.48 }
    ]
  },
  {
    productId: 'PROD-SEA-002',
    name: 'Wide-Brim Woven Paper Straw Sun Hat',
    category: 'Seasonal',
    description: 'UPF 50+ foldable sun hat with interior drawstring sweatband.',
    variants: [
      { sku: '7501020001', name: 'Woven Sun Hat — Natural Wheat', colorOrStyle: 'Natural Wheat', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.22 }
    ]
  },
  {
    productId: 'PROD-SEA-003',
    name: 'Warm White LED Holiday String Lights',
    category: 'Seasonal',
    description: '100-count commercial-grade connectable outdoor fairy string lights (33ft).',
    variants: [
      { sku: '7501030001', name: 'Holiday LED Lights — Warm White / 33ft', colorOrStyle: 'Warm White', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.38 },
      { sku: '7501030002', name: 'Holiday LED Lights — Multicolor / 33ft', colorOrStyle: 'Multicolor', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.38 }
    ]
  },
  {
    productId: 'PROD-SEA-004',
    name: 'Inflatable Lounger Pool Float',
    category: 'Seasonal',
    description: 'Durable puncture-resistant vinyl floating hammock with built-in headrest.',
    variants: [
      { sku: '7501040001', name: 'Inflatable Pool Float — Aqua Teal', colorOrStyle: 'Aqua Teal', unitOfMeasure: 'PIECE', piecesPerPack: 4, weightKg: 0.95 }
    ]
  },

  // --- PET PRODUCTS (4 Base Products) ---
  {
    productId: 'PROD-PET-001',
    name: 'Orthopedic Bolster Dog Bed',
    category: 'Pet Products',
    description: 'High-density egg-crate therapeutic memory foam washable dog couch.',
    variants: [
      { sku: '8601010001', name: 'Orthopedic Bed — Slate Grey / Medium', sizeVariant: 'Medium', colorOrStyle: 'Slate Grey', unitOfMeasure: 'PIECE', piecesPerPack: 2, weightKg: 2.40 },
      { sku: '8601010002', name: 'Orthopedic Bed — Slate Grey / Large', sizeVariant: 'Large', colorOrStyle: 'Slate Grey', unitOfMeasure: 'PIECE', piecesPerPack: 2, weightKg: 3.50 }
    ]
  },
  {
    productId: 'PROD-PET-002',
    name: 'Tough Dental Chew Ring Dog Toy',
    category: 'Pet Products',
    description: 'BPA-free natural textured rubber teething toy with treat pocket.',
    variants: [
      { sku: '8601020001', name: 'Dental Chew Ring — Vibrant Red', colorOrStyle: 'Vibrant Red', unitOfMeasure: 'PIECE', piecesPerPack: 6, weightKg: 0.28 }
    ]
  },
  {
    productId: 'PROD-PET-003',
    name: 'Non-Skid Stainless Steel Pet Dish 2-Pack',
    category: 'Pet Products',
    description: 'Rust-proof hygienic stainless feeding bowls with bonded silicone non-slip base.',
    variants: [
      { sku: '8601030001', name: 'Pet Dish 2-Pack — 32oz Medium', colorOrStyle: 'Polished Steel', unitOfMeasure: 'SET', piecesPerPack: 6, weightKg: 0.42 }
    ]
  },
  {
    productId: 'PROD-PET-004',
    name: 'No-Pull Reflective Dog Harness',
    category: 'Pet Products',
    description: 'Breathable air-mesh vest harness with front and back leash attachment clips.',
    variants: [
      { sku: '8601040001', name: 'Reflective Harness — Blaze Orange / S', sizeVariant: 'S', colorOrStyle: 'Blaze Orange', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.18 },
      { sku: '8601040002', name: 'Reflective Harness — Blaze Orange / M', sizeVariant: 'M', colorOrStyle: 'Blaze Orange', unitOfMeasure: 'PIECE', piecesPerPack: 5, weightKg: 0.22 }
    ]
  }
];

/* ============================================================
   4. DETERMINISTIC SYNTHETIC WAREHOUSE DATA GENERATOR
   ============================================================ */

/**
 * Generates a fully coherent, deterministic synthetic warehouse dataset
 * adhering to existing Fulcrum domain invariants, Layout A location formats,
 * 6-character MUs, and pack-to-piece internal consistency.
 */
export function generateSyntheticWarehouseData(
  config: SyntheticWarehouseDataConfig
): SyntheticWarehouseDataset {
  const seed = config.seed;
  const rng = new DeterministicRng(seed);
  const baseTime = config.baseTime ?? 1713300000000; // Fixed baseline epoch
  const MINUTE = 60 * 1000;

  // Flatten catalog variants
  const catalog = [...RETAIL_PRODUCT_CATALOG];
  const allVariants: ProductVariant[] = [];
  for (const prod of catalog) {
    allVariants.push(...prod.variants);
  }

  // 1. Build canonical warehouse bays from Layout A (prefix 'E', rows EA..EH, bays 01..14)
  // Target: 24 active bays across warehouse
  const bayRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const bays: string[] = [];
  for (const r of bayRows) {
    // Generate 3 representative bays per row
    bays.push(`E${r}02`);
    bays.push(`E${r}07`);
    bays.push(`E${r}14`);
  }

  // Locations across standard levels:
  // Level A (Ground manual), Level B (Mid manual), Level C (Top manual), Level D (Forklift only)
  const locations: string[] = [];
  for (const bay of bays) {
    locations.push(`${bay}A`);
    locations.push(`${bay}B`);
    locations.push(`${bay}C`);
    locations.push(`${bay}D`);
  }

  // 2. Generate unique 6-character alphanumeric MU IDs
  const targetMuCount = config.muCount ?? 140;
  const muIds: string[] = [];
  const usedMuSet = new Set<string>();

  // Include established canonical MUs first for fixture compatibility
  const canonicalMus = ['502900', '502901', '202005', '101003', 'A19B72', 'B44C19'];
  for (const mu of canonicalMus) {
    if (!usedMuSet.has(mu)) {
      usedMuSet.add(mu);
      muIds.push(mu);
    }
  }

  let seq = 1;
  while (muIds.length < targetMuCount) {
    const nextId = rng.nextMuId(seq++);
    if (!usedMuSet.has(nextId)) {
      usedMuSet.add(nextId);
      muIds.push(nextId);
    }
  }

  // 3. Assign MUs to physical locations
  // Singularity invariant: each physical MU is assigned to exactly one location in the consistent snapshot
  const muLocationAssignment = new Map<string, string>();
  for (const mu of muIds) {
    // 85% of MUs are assigned to manual tiers (A, B, C); 15% to Level D (Forklift)
    const isLevelD = rng.nextFloat() < 0.15;
    const targetBay = rng.pick(bays);
    const tier = isLevelD ? 'D' : rng.pick(['A', 'B', 'C']);
    muLocationAssignment.set(mu, `${targetBay}${tier}`);
  }

  // Explicit canonical location overrides for determinism:
  muLocationAssignment.set('502900', 'EC07A'); // Ground manual tier
  muLocationAssignment.set('502901', 'EH14A'); // Ground manual tier
  muLocationAssignment.set('202005', 'EH14B'); // Mid manual tier
  muLocationAssignment.set('101003', 'EH14D'); // Level D forklift tier

  // 4. Generate stock observations
  // MUs hold packs of variants. For apparel: sequential sizes (S, M, L) often share an MU.
  const observations: StockObservation[] = [];
  let obsSeq = 100;
  let totalPiecesInStock = 0;
  let looseCount = 0;

  // Track contents per MU to avoid duplicate (MU, SKU) observations in same snapshot
  const muContents = new Map<string, Set<string>>();

  // Populate containerized MUs
  for (const mu of muIds) {
    muContents.set(mu, new Set());
    const loc = muLocationAssignment.get(mu)!;
    // An MU contains 1 to 3 related variants (e.g. size variants of same product)
    const baseProduct = rng.pick(catalog);
    const variantCount = Math.min(baseProduct.variants.length, rng.nextInt(1, 3));
    const selectedVariants = rng.shuffle(baseProduct.variants).slice(0, variantCount);

    for (const variant of selectedVariants) {
      if (muContents.get(mu)!.has(variant.sku)) continue;
      muContents.get(mu)!.add(variant.sku);

      // Model packs: 1 to 3 packs of variant's piecesPerPack
      const packs = rng.nextInt(1, 3);
      const pieceCount = packs * variant.piecesPerPack;

      // Realistic observation freshness: 5 to 75 minutes ago
      const ageMinutes = rng.nextInt(5, 75);
      const obsTime = baseTime - ageMinutes * MINUTE;

      observations.push({
        observationId: `obs_${obsSeq++}`,
        muId: mu,
        materialSku: variant.sku,
        observedQuantity: pieceCount,
        location: loc,
        observedAt: obsTime,
        notes: `Pack qty: ${packs}x${variant.piecesPerPack}u in container ${mu}`
      });
      totalPiecesInStock += pieceCount;
    }
  }

  // Populate some loose/uncontainerized stock (approx 8% of observations)
  const looseRatio = config.looseStockRatio ?? 0.08;
  const looseTarget = Math.round(observations.length * looseRatio);

  for (let i = 0; i < looseTarget; i++) {
    const variant = rng.pick(allVariants);
    const loc = rng.pick(locations);
    const pieceCount = rng.nextInt(2, 6);
    const ageMinutes = rng.nextInt(10, 50);

    observations.push({
      observationId: `obs_${obsSeq++}`,
      muId: undefined, // Loose uncontainerized stock
      materialSku: variant.sku,
      observedQuantity: pieceCount,
      location: loc,
      observedAt: baseTime - ageMinutes * MINUTE,
      notes: 'Loose uncontainerized shelf stock'
    });
    totalPiecesInStock += pieceCount;
    looseCount++;
  }

  // 5. Generate realistic customer orders
  const targetOrderCount = config.orderCount ?? 30;
  const orders: Order[] = [];
  const priorityWeights: ('HIGH' | 'STANDARD' | 'LOW')[] = ['STANDARD', 'STANDARD', 'HIGH', 'STANDARD', 'LOW'];

  for (let oIdx = 1; oIdx <= targetOrderCount; oIdx++) {
    const orderId = `000${(815290 + oIdx).toString().padStart(6, '0')}`;
    const priority = rng.pick(priorityWeights);
    const orderAgeMinutes = rng.nextInt(5, 120);
    const orderCreatedAt = baseTime - orderAgeMinutes * MINUTE;

    // Determine line count: 1 line (45%), 2 lines (35%), 3 lines (15%), 4 lines (5%)
    const roll = rng.nextFloat();
    const lineCount = roll < 0.45 ? 1 : roll < 0.80 ? 2 : roll < 0.95 ? 3 : 4;

    const lines: OrderRequirementLine[] = [];
    const usedSkusInOrder = new Set<string>();

    for (let lIdx = 1; lIdx <= lineCount; lIdx++) {
      let chosenVariant: ProductVariant;
      // 50% chance to request an apparel size variant, 50% from other categories
      if (rng.nextFloat() < 0.5) {
        const apparelProd = rng.pick(catalog.filter(p => p.category === 'Apparel'));
        chosenVariant = rng.pick(apparelProd.variants);
      } else {
        chosenVariant = rng.pick(allVariants);
      }

      if (usedSkusInOrder.has(chosenVariant.sku)) continue;
      usedSkusInOrder.add(chosenVariant.sku);

      // Realistic piece requests: 1 to 5 pieces
      const reqPieces = rng.nextInt(1, 5);

      lines.push({
        lineId: `line_${orderId}_${lIdx}`,
        materialSku: chosenVariant.sku,
        materialName: chosenVariant.name,
        requestedQuantity: reqPieces
      });
    }

    if (lines.length > 0) {
      orders.push({
        orderId,
        priority,
        createdAt: orderCreatedAt,
        notes: `${priority} priority customer dispatch`,
        lines
      });
    }
  }

  return {
    seed,
    baseTime,
    catalog,
    allVariants,
    bays,
    locations,
    muIds,
    orders,
    observations,
    stats: {
      productCount: catalog.length,
      skuCount: allVariants.length,
      muCount: muIds.length,
      orderCount: orders.length,
      observationCount: observations.length,
      totalPiecesInStock,
      looseObservationCount: looseCount
    }
  };
}

/**
 * Bridges a synthetic dataset into a strictly typed SimulationInputSnapshot
 * for the deterministic simulation engine (@fulcrum/sim-engine).
 */
export function buildSimulationSnapshotFromDataset(
  dataset: SyntheticWarehouseDataset,
  strategy: SimulationStrategy = 'BASELINE'
): SimulationInputSnapshot {
  // Convert dataset locations to SimulationLocation entities with coordinates
  const locations = dataset.locations.map(locCode => {
    const { bay, level, isLevelD } = parseLocationBayAndLevel(locCode);
    const rowChar = bay.length >= 2 ? bay.charAt(1) : 'A';
    const rowIndex = Math.max(0, rowChar.charCodeAt(0) - 65);
    const bayNum = parseInt(bay.slice(2), 10) || 1;

    const x = bayNum * 1.2;
    const y = rowIndex * 2.5;
    const z = level === 'A' ? 0.5 : level === 'B' ? 2.0 : level === 'C' ? 3.5 : 5.5;

    return {
      id: `loc_${locCode}`,
      x,
      y,
      z,
      access_type: (isLevelD ? 'forklift' : 'manual') as 'forklift' | 'manual',
      capacity: 2,
      is_blocked: false
    };
  });

  // Convert observations to inventory items
  const inventory = dataset.observations
    .filter(obs => !!obs.muId && obs.observedQuantity > 0)
    .map(obs => ({
      mu_id: obs.muId!,
      location_id: `loc_${obs.location || 'EC07A'}`,
      sku: obs.materialSku,
      quantity_units: obs.observedQuantity
    }));

  // Convert orders to simulation workload
  const workloadOrders = dataset.orders.map(o => ({
    order_id: o.orderId,
    arrival_time: Math.max(0, Math.floor((o.createdAt - dataset.baseTime) / 1000)),
    deadline: 3600,
    priority: (o.priority ?? 'STANDARD') as 'HIGH' | 'STANDARD' | 'LOW' | 'CRITICAL',
    items: o.lines.map(l => ({
      line_id: l.lineId,
      sku: l.materialSku,
      quantity_units: l.requestedQuantity
    }))
  }));

  return {
    contract_version: '1.0.0',
    snapshot_id: `snap_synth_${dataset.seed}`,
    snapshot_hash: `hash_${dataset.seed}`,
    workspace_id: 'ws_default',
    seed: dataset.seed,
    config: {
      start_time_seconds: 0,
      duration_seconds: 28800,
      strategy
    },
    rules: {
      congestion_radius_meters: 2.5,
      congestion_slowdown_factor: 0.5,
      forklift_lockout_duration_seconds: 180,
      picker_walking_speed_mps: 1.2,
      forklift_speed_mps: 2.0,
      platform_draw_penalty_seconds: 18,
      box_shuffle_penalty_seconds: 25,
      piece_pick_seconds: 6
    },
    locations,
    inventory,
    workload: {
      orders: workloadOrders,
      replenishment_triggers: []
    },
    resources: {
      manual_pickers: [{ id: 'picker_1', name: 'Floor Picker 1', speed_mps: 1.2 }],
      forklifts: [{ id: 'forklift_1', name: 'Forklift Operator 1', speed_mps: 2.0 }]
    }
  };
}
