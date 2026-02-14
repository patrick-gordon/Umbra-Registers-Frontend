// Prototype-only interaction map for backend + frontend alignment.
// Backend can mirror this structure in Lua/JS and hydrate the UI via `syncState`.
export const businessInteractions = [
  {
    businessId: "burgershot",
    label: "Burger Shot",
    interactionPoints: [
      {
        // `polyzone` points represent area triggers (ex: qb-target/polyzone).
        id: "bs-register-zone-1",
        type: "polyzone",
        label: "Front Counter Zone",
        // Register id that should be opened when this interaction is used.
        registerId: "store-1-register-1",
        coords: { x: -1193.2, y: -892.1, z: 13.9 },
        size: { x: 2.2, y: 1.2, z: 2.0 },
        heading: 35.0,
        minZ: 12.8,
        maxZ: 14.8,
      },
      {
        // `prop` points represent interactable world entities/models.
        id: "bs-register-prop-1",
        type: "prop",
        label: "Counter Till Prop",
        registerId: "store-1-register-1",
        model: "prop_till_01",
        coords: { x: -1194.1, y: -893.0, z: 13.95 },
        heading: 35.0,
        interactDistance: 1.5,
      },
    ],
  },
  {
    businessId: "uwucafe",
    label: "UwU Cafe",
    interactionPoints: [
      {
        id: "uwu-register-zone-1",
        type: "polyzone",
        label: "Main Register Zone",
        registerId: "store-1-register-1",
        coords: { x: -584.9, y: -1061.4, z: 22.3 },
        size: { x: 1.8, y: 1.0, z: 2.0 },
        heading: 90.0,
        minZ: 21.5,
        maxZ: 23.4,
      },
      {
        id: "uwu-register-prop-1",
        type: "prop",
        label: "Cafe Till Prop",
        registerId: "store-1-register-1",
        model: "prop_till_01",
        coords: { x: -585.2, y: -1061.5, z: 22.35 },
        heading: 90.0,
        interactDistance: 1.4,
      },
    ],
  },
];
