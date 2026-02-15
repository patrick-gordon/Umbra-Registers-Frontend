export const REGISTER_TIERS = [
  {
    level: 1,
    name: "Starter Terminal",
    processingMs: 7000,
    ringUpErrorChance: 0.2,
    autoDiscountAssist: false,
    stealMinigameDurationMs: 10000,
    employeeDefenseBonus: 0,
    instantStealBlockChance: 0,
    unlocks: [
      "Basic ring-up only",
      "Long processing with buffer bar",
      "High jam risk, no automation",
    ],
  },
  {
    level: 2,
    name: "Refit Terminal",
    processingMs: 2800,
    ringUpErrorChance: 0.16,
    autoDiscountAssist: false,
    stealMinigameDurationMs: 10000,
    employeeDefenseBonus: 0,
    instantStealBlockChance: 0,
    unlocks: [
      "Faster total calculation",
      "Better keypad responsiveness",
      "Slightly stabilized internals",
    ],
  },
  {
    level: 3,
    name: "Shift Pro Register",
    processingMs: 2100,
    ringUpErrorChance: 0.12,
    autoDiscountAssist: true,
    stealMinigameDurationMs: 10000,
    employeeDefenseBonus: 1,
    instantStealBlockChance: 0,
    unlocks: [
      "Auto Discount Assist",
      "Smoother tray updates",
      "Theft defense starts +1",
    ],
  },
  {
    level: 4,
    name: "Service Lane Unit",
    processingMs: 1600,
    ringUpErrorChance: 0.09,
    autoDiscountAssist: true,
    stealMinigameDurationMs: 9200,
    employeeDefenseBonus: 2,
    instantStealBlockChance: 0,
    unlocks: [
      "Accelerated ring-up pipeline",
      "Auto Discount Assist",
      "Shorter theft minigame window",
    ],
  },
  {
    level: 5,
    name: "Rush Hour Console",
    processingMs: 1200,
    ringUpErrorChance: 0.06,
    autoDiscountAssist: true,
    stealMinigameDurationMs: 8600,
    employeeDefenseBonus: 3,
    instantStealBlockChance: 0.08,
    unlocks: [
      "High-volume queue handling",
      "Theft defense starts +3",
      "8% instant theft auto-block",
    ],
  },
  {
    level: 6,
    name: "Executive POS",
    processingMs: 850,
    ringUpErrorChance: 0.035,
    autoDiscountAssist: true,
    stealMinigameDurationMs: 8000,
    employeeDefenseBonus: 4,
    instantStealBlockChance: 0.14,
    unlocks: [
      "Near-instant ring-up",
      "Theft defense starts +4",
      "14% instant theft auto-block",
    ],
  },
  {
    level: 7,
    name: "Quantum Checkout Core",
    processingMs: 500,
    ringUpErrorChance: 0.015,
    autoDiscountAssist: true,
    stealMinigameDurationMs: 7000,
    employeeDefenseBonus: 5,
    instantStealBlockChance: 0.22,
    unlocks: [
      "Top-tier instant checkout",
      "Theft defense starts +5",
      "22% instant theft auto-block",
    ],
  },
];

export const MAX_REGISTER_TIER = REGISTER_TIERS[REGISTER_TIERS.length - 1].level;

export function getRegisterTier(level) {
  return REGISTER_TIERS.find((tier) => tier.level === level) ?? REGISTER_TIERS[0];
}
