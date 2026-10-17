import {
  Order,
  StockObservation,
  PlanningOptions
} from './planning';
import { RETAIL_PRODUCT_CATALOG } from './generator';

export interface DemonstrationScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  orders: Order[];
  selectedOrderIds: string[];
  observations: StockObservation[];
  options: PlanningOptions;
  expectedCharacteristics: {
    expectShortages: boolean;
    expectConflicts: boolean;
    expectRestricted: boolean;
    expectStale: boolean;
    expectExecutable: boolean;
  };
}

const STATIC_EPOCH = 1713300000000;
const MINUTE = 60 * 1000;

/* ============================================================
   1. NORMAL FULFILLMENT SCENARIO
   ============================================================ */
const normalFulfillmentScenario: DemonstrationScenario = {
  id: 'normal-fulfillment',
  name: '1. Normal Fulfillment',
  description: 'Orders can be completely fulfilled using valid, accessible stock on manual tiers (Level A/B). Zero shortages, zero conflicts.',
  category: 'Standard Operations',
  orders: [
    {
      orderId: '000815296',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 30 * MINUTE,
      notes: 'Priority checkout fulfillment',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 3 },
        { lineId: 'l2', materialSku: '1524289002', materialName: 'Athletic Tee Slim — Black / M', requestedQuantity: 2 }
      ]
    },
    {
      orderId: '000815297',
      priority: 'STANDARD',
      createdAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Standard warehouse dispatch',
      lines: [
        { lineId: 'l3', materialSku: '2841920001', materialName: 'Cargo Trouser Utility — Navy / 30', requestedQuantity: 2 }
      ]
    }
  ],
  selectedOrderIds: ['000815296', '000815297'],
  observations: [
    {
      observationId: 'obs_norm_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6,
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Ground platform box'
    },
    {
      observationId: 'obs_norm_02',
      muId: '502900',
      materialSku: '1524289002',
      observedQuantity: 5,
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Ground platform box'
    },
    {
      observationId: 'obs_norm_03',
      muId: '202005',
      materialSku: '2841920001',
      observedQuantity: 5,
      location: 'EH14B',
      observedAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Mid manual shelf box'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-NORMAL'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: true
  }
};

/* ============================================================
   2. SHARED MU SCENARIO
   ============================================================ */
const sharedMuScenario: DemonstrationScenario = {
  id: 'shared-mu',
  name: '2. Shared MU (Multi-Order Container Consolidation)',
  description: 'Multiple orders require items from the exact same physical MU (502900). Fulcrum groups them into 1 collection task without exceeding stock.',
  category: 'MU Consolidation',
  orders: [
    {
      orderId: '000815296',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 25 * MINUTE,
      notes: 'First batch order',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 2 },
        { lineId: 'l2', materialSku: '1524289002', materialName: 'Athletic Tee Slim — Black / M', requestedQuantity: 2 }
      ]
    },
    {
      orderId: '000815297',
      priority: 'STANDARD',
      createdAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Second batch order sharing same container',
      lines: [
        { lineId: 'l3', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 3 },
        { lineId: 'l4', materialSku: '1524289002', materialName: 'Athletic Tee Slim — Black / M', requestedQuantity: 2 }
      ]
    }
  ],
  selectedOrderIds: ['000815296', '000815297'],
  observations: [
    {
      observationId: 'obs_sh_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6, // 2 for first order + 3 for second = 5 used (under 6)
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 10 * MINUTE,
      notes: 'Container 502900 with Size S'
    },
    {
      observationId: 'obs_sh_02',
      muId: '502900',
      materialSku: '1524289002',
      observedQuantity: 5, // 2 for first order + 2 for second = 4 used (under 5)
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 10 * MINUTE,
      notes: 'Container 502900 with Size M'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-SHARED-MU'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: true
  }
};

/* ============================================================
   3. MULTI-MU ORDER SCENARIO
   ============================================================ */
const multiMuOrderScenario: DemonstrationScenario = {
  id: 'multi-mu-order',
  name: '3. Multi-MU Order',
  description: 'A single customer order requires items located across three distinct physical MUs in different bays.',
  category: 'Complex Orders',
  orders: [
    {
      orderId: '000815301',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 40 * MINUTE,
      notes: 'Comprehensive cross-category customer order',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 2 },
        { lineId: 'l2', materialSku: '3101010001', materialName: 'Ultralight Runner — Jet Black / 8', requestedQuantity: 2 },
        { lineId: 'l3', materialSku: '4201020001', materialName: 'Turkish Bath Towel — Cloud White', requestedQuantity: 2 }
      ]
    }
  ],
  selectedOrderIds: ['000815301'],
  observations: [
    {
      observationId: 'obs_mmu_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6,
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Bay EC07 platform box'
    },
    {
      observationId: 'obs_mmu_02',
      muId: 'A19B72',
      materialSku: '3101010001',
      observedQuantity: 4,
      location: 'EB02B',
      observedAt: STATIC_EPOCH - 25 * MINUTE,
      notes: 'Footwear container'
    },
    {
      observationId: 'obs_mmu_03',
      muId: 'B44C19',
      materialSku: '4201020001',
      observedQuantity: 6,
      location: 'EE07C',
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Home textiles container'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-MULTI-MU'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: true
  }
};

/* ============================================================
   4. SHORTAGE SCENARIO
   ============================================================ */
const shortageScenario: DemonstrationScenario = {
  id: 'shortage',
  name: '4. Shortage & Partial Fulfillment',
  description: 'Demand exceeds observed available stock, demonstrating granular line-level shortage reporting and unfulfilled warnings.',
  category: 'Exceptions',
  orders: [
    {
      orderId: '000815302',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 30 * MINUTE,
      notes: 'High demand exceeding stock',
      lines: [
        { lineId: 'l1', materialSku: '1524295001', materialName: 'Casual Linen Blouse — Sky Blue / S', requestedQuantity: 8 },
        { lineId: 'l2', materialSku: '1524292001', materialName: 'Fleece Pullover Hoodie — Heather Grey / S', requestedQuantity: 4 }
      ]
    }
  ],
  selectedOrderIds: ['000815302'],
  observations: [
    {
      observationId: 'obs_short_01',
      muId: 'C40D81',
      materialSku: '1524295001',
      observedQuantity: 3, // 8 requested, only 3 observed! Shortage = 5
      location: 'ED14A',
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Partial pack in container'
    }
    // Note: SKU 1524292001 has ZERO observations! Shortage = 4 (NO_OBSERVATIONS)
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-SHORTAGE'
  },
  expectedCharacteristics: {
    expectShortages: true,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: true // Executable with partial picks, but flags shortages
  }
};

/* ============================================================
   5. CONFLICTING MU LOCATION SCENARIO
   ============================================================ */
const conflictingMuLocationScenario: DemonstrationScenario = {
  id: 'conflicting-mu-location',
  name: '5. Conflicting MU Location',
  description: 'An MU is reported at multiple contradictory locations. The planner prevents silent guessing, preserves 1 physical MU count, and locks plan readiness.',
  category: 'Safety & Conflicts',
  orders: [
    {
      orderId: '000815296',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 25 * MINUTE,
      notes: 'Order affected by contradictory MU observations',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 3 },
        { lineId: 'l2', materialSku: '1524289002', materialName: 'Athletic Tee Slim — Black / M', requestedQuantity: 2 }
      ]
    }
  ],
  selectedOrderIds: ['000815296'],
  observations: [
    {
      observationId: 'obs_conf_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6,
      location: 'EC07A', // First report: Ground tier Bay EC07
      observedAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Observed at EC07A'
    },
    {
      observationId: 'obs_conf_02',
      muId: '502900',
      materialSku: '1524289002',
      observedQuantity: 5,
      location: 'EH14B', // Second report: Mid tier Bay EH14! CONFLICT!
      observedAt: STATIC_EPOCH - 10 * MINUTE,
      notes: 'Contradictory report at EH14B'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-CONFLICT'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: true,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: false // Blocked due to unresolved location conflict
  }
};

/* ============================================================
   6. KNOWN AND UNSPECIFIED LOCATION SCENARIO
   ============================================================ */
const knownAndUnspecifiedLocationScenario: DemonstrationScenario = {
  id: 'known-and-unspecified-location',
  name: '6. Known and Unspecified Location',
  description: 'Demonstrates graceful handling of incomplete inventory snapshots where some stock has a known bin and other stock has no location.',
  category: 'Incomplete Data',
  orders: [
    {
      orderId: '000815303',
      priority: 'STANDARD',
      createdAt: STATIC_EPOCH - 30 * MINUTE,
      notes: 'Order pulling from both located and unlocated stock',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 2 },
        { lineId: 'l2', materialSku: '5301040001', materialName: 'Ceramide Daily Barrier Face Cream', requestedQuantity: 3 }
      ]
    }
  ],
  selectedOrderIds: ['000815303'],
  observations: [
    {
      observationId: 'obs_ku_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6,
      location: 'EC07A', // Known located container
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Located platform MU'
    },
    {
      observationId: 'obs_ku_02',
      muId: undefined, // Loose stock
      materialSku: '5301040001',
      observedQuantity: 4,
      location: undefined, // Unspecified location!
      observedAt: STATIC_EPOCH - 12 * MINUTE,
      notes: 'Staged without formal bin assignment'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-UNSPEC'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: true
  }
};

/* ============================================================
   7. LEVEL D FORKLIFT & BAY LOCKOUT SCENARIO
   ============================================================ */
const levelDLockoutScenario: DemonstrationScenario = {
  id: 'level-d-lockout',
  name: '7. Level D Forklift & Bay Replenishment Lockout',
  description: 'Demonstrates access restrictions: Bay EH14 is locked out due to replenishment, and Level D stock requires forklift intervention.',
  category: 'Access Restrictions',
  orders: [
    {
      orderId: '000815304',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 25 * MINUTE,
      notes: 'Pick request requiring stock in restricted areas',
      lines: [
        { lineId: 'l1', materialSku: '2841920001', materialName: 'Cargo Trouser Utility — Navy / 30', requestedQuantity: 3 },
        { lineId: 'l2', materialSku: '1524289004', materialName: 'Athletic Tee Slim — Black / XL', requestedQuantity: 2 }
      ]
    }
  ],
  selectedOrderIds: ['000815304'],
  observations: [
    {
      observationId: 'obs_lock_01',
      muId: '202005',
      materialSku: '2841920001',
      observedQuantity: 5,
      location: 'EH14B', // Mid manual level, but Bay EH14 is locked out!
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Bay EH14 currently undergoing pallet replenishment'
    },
    {
      observationId: 'obs_lock_02',
      muId: '101003',
      materialSku: '1524289004',
      observedQuantity: 6,
      location: 'EC07D', // Level D (Forklift only!)
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Stored on upper forklift-only tier'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-LOCKOUT',
    lockedOutBays: ['EH14'], // Active replenishment lockout in bay EH14
    restrictForkliftLocations: true
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: true,
    expectStale: false,
    expectExecutable: false // Blocked: manual picker cannot enter locked-out bay or access Level D
  }
};

/* ============================================================
   8. MIXED RETAIL CATALOG SCENARIO
   ============================================================ */
const mixedRetailCatalogScenario: DemonstrationScenario = {
  id: 'mixed-retail-catalog',
  name: '8. Mixed Retail Catalog (Multi-Category Demand)',
  description: 'Realistic multi-order fulfillment batch spanning Apparel, Footwear, Home Goods, Beauty, and Toys.',
  category: 'Full Catalog',
  orders: [
    {
      orderId: '000815305',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 50 * MINUTE,
      notes: 'Home & Personal Care customer order',
      lines: [
        { lineId: 'l1', materialSku: '4201020001', materialName: 'Turkish Bath Towel — Cloud White', requestedQuantity: 2 },
        { lineId: 'l2', materialSku: '5301010001', materialName: 'Hydrating Botanical Shampoo — 500ml', requestedQuantity: 2 }
      ]
    },
    {
      orderId: '000815306',
      priority: 'STANDARD',
      createdAt: STATIC_EPOCH - 35 * MINUTE,
      notes: 'Apparel & Footwear customer order',
      lines: [
        { lineId: 'l3', materialSku: '1524290002', materialName: 'Classic Pique Polo — Navy / M', requestedQuantity: 2 },
        { lineId: 'l4', materialSku: '3101020002', materialName: 'Canvas Low-Top Sneaker — Off-White / 8', requestedQuantity: 1 }
      ]
    },
    {
      orderId: '000815307',
      priority: 'LOW',
      createdAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Toys customer order',
      lines: [
        { lineId: 'l5', materialSku: '6401010001', materialName: 'Wooden Architectural Block Set', requestedQuantity: 1 }
      ]
    }
  ],
  selectedOrderIds: ['000815305', '000815306', '000815307'],
  observations: [
    {
      observationId: 'obs_mix_01',
      muId: 'B44C19',
      materialSku: '4201020001',
      observedQuantity: 6,
      location: 'EE07B',
      observedAt: STATIC_EPOCH - 25 * MINUTE,
      notes: 'Home goods container'
    },
    {
      observationId: 'obs_mix_02',
      muId: 'D10E05',
      materialSku: '5301010001',
      observedQuantity: 6,
      location: 'EF02A',
      observedAt: STATIC_EPOCH - 25 * MINUTE,
      notes: 'Personal care container'
    },
    {
      observationId: 'obs_mix_03',
      muId: 'F22G11',
      materialSku: '1524290002',
      observedQuantity: 5,
      location: 'EA07A',
      observedAt: STATIC_EPOCH - 30 * MINUTE,
      notes: 'Apparel container'
    },
    {
      observationId: 'obs_mix_04',
      muId: 'A19B72',
      materialSku: '3101020002',
      observedQuantity: 4,
      location: 'EB02B',
      observedAt: STATIC_EPOCH - 35 * MINUTE,
      notes: 'Footwear container'
    },
    {
      observationId: 'obs_mix_05',
      muId: 'T88K99',
      materialSku: '6401010001',
      observedQuantity: 4,
      location: 'EG14A',
      observedAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Toys container'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-MIXED-CATALOG'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: false,
    expectExecutable: true
  }
};

/* ============================================================
   9. STALE OBSERVATIONS SCENARIO
   ============================================================ */
const staleObservationsScenario: DemonstrationScenario = {
  id: 'stale-observations',
  name: '9. Stale Observations Warning',
  description: 'Observations are older than the 60-minute freshness threshold. Triggers operational warnings without invalidating stock.',
  category: 'Freshness & Quality',
  orders: [
    {
      orderId: '000815296',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Order calculated against aged observations',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 2 }
      ]
    }
  ],
  selectedOrderIds: ['000815296'],
  observations: [
    {
      observationId: 'obs_stale_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6,
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 120 * MINUTE, // 2 hours old! Stale threshold is 60m
      notes: 'Aged observation from early shift'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-STALE'
  },
  expectedCharacteristics: {
    expectShortages: false,
    expectConflicts: false,
    expectRestricted: false,
    expectStale: true,
    expectExecutable: true // Executable with warning
  }
};

/* ============================================================
   10. COMBINED EDGE CASES SCENARIO
   ============================================================ */
const combinedEdgeCasesScenario: DemonstrationScenario = {
  id: 'combined-edge-cases',
  name: '10. Combined Edge Cases (Real-World Stress Test)',
  description: 'Simultaneous demonstration of shared MUs, shortages, stale observations, loose stock, and bay lockout in one batch.',
  category: 'Stress Test',
  orders: [
    {
      orderId: '000815310',
      priority: 'HIGH',
      createdAt: STATIC_EPOCH - 45 * MINUTE,
      notes: 'Customer order A',
      lines: [
        { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 3 },
        { lineId: 'l2', materialSku: '2841920001', materialName: 'Cargo Trouser Utility — Navy / 30', requestedQuantity: 2 },
        { lineId: 'l3', materialSku: '8601010001', materialName: 'Orthopedic Bolster Dog Bed', requestedQuantity: 4 } // Shortage!
      ]
    },
    {
      orderId: '000815311',
      priority: 'STANDARD',
      createdAt: STATIC_EPOCH - 30 * MINUTE,
      notes: 'Customer order B (shares MU 502900)',
      lines: [
        { lineId: 'l4', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 2 },
        { lineId: 'l5', materialSku: '5301050001', materialName: 'Sheer Mineral Sunscreen SPF 50', requestedQuantity: 2 } // Loose & Stale!
      ]
    }
  ],
  selectedOrderIds: ['000815310', '000815311'],
  observations: [
    // Shared MU 502900
    {
      observationId: 'obs_cmb_01',
      muId: '502900',
      materialSku: '1524289001',
      observedQuantity: 6,
      location: 'EC07A',
      observedAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Shared container'
    },
    // Stock in a locked-out bay (EH14)
    {
      observationId: 'obs_cmb_02',
      muId: '202005',
      materialSku: '2841920001',
      observedQuantity: 5,
      location: 'EH14B',
      observedAt: STATIC_EPOCH - 20 * MINUTE,
      notes: 'Located in locked-out bay EH14'
    },
    // Limited stock causing shortage (only 1 available, 4 requested)
    {
      observationId: 'obs_cmb_03',
      muId: 'P01P02',
      materialSku: '8601010001',
      observedQuantity: 1,
      location: 'EE14A',
      observedAt: STATIC_EPOCH - 15 * MINUTE,
      notes: 'Single unit on hand'
    },
    // Loose stock that is also stale
    {
      observationId: 'obs_cmb_04',
      muId: undefined, // Loose
      materialSku: '5301050001',
      observedQuantity: 4,
      location: 'EB07A',
      observedAt: STATIC_EPOCH - 95 * MINUTE, // Stale!
      notes: 'Aged loose sunscreen tube pack'
    }
  ],
  options: {
    staleThresholdMinutes: 60,
    referenceTime: STATIC_EPOCH,
    runId: 'RUN-SCEN-COMBINED',
    lockedOutBays: ['EH14'],
    restrictForkliftLocations: true
  },
  expectedCharacteristics: {
    expectShortages: true,
    expectConflicts: false,
    expectRestricted: true,
    expectStale: true,
    expectExecutable: false // Blocked by active bay lockout in EH14
  }
};

/* ============================================================
   11. SCENARIO REGISTRY & ACCESSORS
   ============================================================ */

export const DEMONSTRATION_SCENARIOS: DemonstrationScenario[] = [
  normalFulfillmentScenario,
  sharedMuScenario,
  multiMuOrderScenario,
  shortageScenario,
  conflictingMuLocationScenario,
  knownAndUnspecifiedLocationScenario,
  levelDLockoutScenario,
  mixedRetailCatalogScenario,
  staleObservationsScenario,
  combinedEdgeCasesScenario
];

export const AVAILABLE_SCENARIOS = DEMONSTRATION_SCENARIOS;

export function getScenario(id: string): DemonstrationScenario | undefined {
  return DEMONSTRATION_SCENARIOS.find(s => s.id === id);
}

export function getAllScenarios(): DemonstrationScenario[] {
  return [...DEMONSTRATION_SCENARIOS];
}
