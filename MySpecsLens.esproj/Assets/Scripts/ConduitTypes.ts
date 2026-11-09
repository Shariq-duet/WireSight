export interface RoomPreset {
    id: string;
    name: string;
    icon: string;
    label: string;
}

export const ROOM_PRESETS: RoomPreset[] = [
    { id: "all", name: "All Rooms", icon: "🏠", label: "🏠 ALL ROOMS" },
    { id: "kitchen", name: "Kitchen", icon: "🍳", label: "🍳 KITCHEN" },
    { id: "living", name: "Living Room", icon: "🛋️", label: "🛋️ LIVING ROOM" },
    { id: "bedroom", name: "Master Bedroom", icon: "🛏️", label: "🛏️ BEDROOM" },
    { id: "bathroom", name: "Bathroom", icon: "🚿", label: "🚿 BATHROOM" },
    { id: "garage", name: "Garage / Utility", icon: "🚗", label: "🚗 GARAGE" },
    { id: "panel", name: "Main Panel Zone", icon: "⚡", label: "⚡ PANEL ZONE" }
];

export interface ConduitRun {
    id: string;
    name: string;
    layer: "electrical" | "plumbing";
    voltageOrType: string;
    installer: string;
    installDate: string;
    status: string;
    color: vec4;
    startPoint: vec3;
    endPoint: vec3;
    isConflict?: boolean;
    conflictWarning?: string;
    isWorldCoords?: boolean;
    roomZone?: string;
    gauge?: string;
    isLive?: boolean;
    thickness?: number;
}

export interface WallConfig {
    wallIndex: number;
    wallId: string;
    widthCm: number;
    heightCm: number;
    pos: [number, number, number];
    yawDeg: number;
}

export const INITIAL_WALL_CONFIGS: WallConfig[] = [
    {
        wallIndex: 1,
        wallId: "wall-bedroom",
        widthCm: 375.0,
        heightCm: 240.0,
        pos: [-262.5, 120.0, -225.0],
        yawDeg: 0.0
    },
    {
        wallIndex: 2,
        wallId: "wall-corner",
        widthCm: 450.0,
        heightCm: 240.0,
        pos: [-450.0, 120.0, 0.0],
        yawDeg: 90.0
    },
    {
        wallIndex: 3,
        wallId: "wall-living",
        widthCm: 375.0,
        heightCm: 240.0,
        pos: [112.5, 120.0, -225.0],
        yawDeg: 0.0
    },
    {
        wallIndex: 4,
        wallId: "wall-utility",
        widthCm: 250.0,
        heightCm: 240.0,
        pos: [425.0, 120.0, -225.0],
        yawDeg: 0.0
    }
];



export const SCENARIO_HOUSE_RUNS: ConduitRun[] = [
    // -------------------------------------------------------------------------
    // CIRCUIT 1 (BREAKER B1 - 20A): Master Bedroom Outlets & Lighting
    // Terminating directly at Breaker #1 Terminal: (366, 157, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen1-outlet-bed-left",
        name: "[Bedroom] 120V 20A Duplex Outlet (Left Bedside)",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(-402.5, 40.0, -223.0),
        endPoint: new vec3(-402.5, 0.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-outlet-bed-right",
        name: "[Bedroom] 120V 20A Duplex Outlet (Right Bedside)",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(-122.5, 40.0, -223.0),
        endPoint: new vec3(-122.5, 0.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-bed-horizontal",
        name: "[Bedroom] Nightstand Circuit In-Wall Cross",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(-402.5, 40.0, -223.0),
        endPoint: new vec3(-122.5, 40.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-bed-to-door",
        name: "[Bedroom] Accent Wall to Door Riser Feeder",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(-122.5, 40.0, -223.0),
        endPoint: new vec3(-80.0, 40.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-bed-switch-riser",
        name: "[Bedroom] Single-Pole Switch Drop",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(-80.0, 40.0, -223.0),
        endPoint: new vec3(-80.0, 120.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-bed-header-riser",
        name: "[Bedroom] Wall Header Riser to Ceiling",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(-80.0, 120.0, -223.0),
        endPoint: new vec3(-80.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-cross-to-living",
        name: "[Living] Bedroom-to-Living Partition Cross",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(-80.0, 225.0, -223.0),
        endPoint: new vec3(10.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-living-ceiling-trunk",
        name: "[Living] Main Ceiling Conduit Run to Electrical Room",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(10.0, 225.0, -223.0),
        endPoint: new vec3(300.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-elec-infeed",
        name: "[Electrical] Utility Room Ceiling Infeed",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(300.0, 225.0, -223.0),
        endPoint: new vec3(366.0, 225.0, -205.0),
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen1-panel-drop-b1",
        name: "[Electrical] Breaker B1 (Master Bedroom 20A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(366.0, 225.0, -205.0),
        endPoint: new vec3(366.0, 157.0, -201.0), // <-- Exact Breaker B1 Terminal
        isWorldCoords: true,
        roomZone: "bedroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 2 (BREAKER B2 - 15A): Living Room 65" TV & Media Console
    // Terminating directly at Breaker #2 Terminal: (394, 157, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen2-outlet-tv-quad",
        name: "[Living] 120V 20A Quad Outlet (65in TV Mount)",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(112.5, 110.0, -223.0),
        endPoint: new vec3(112.5, 110.0, -221.0),
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen2-tv-drop-to-jbox",
        name: "[Living] TV In-Wall Drop to Hidden J-Box",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(112.5, 110.0, -223.0),
        endPoint: new vec3(112.5, 40.0, -223.0), // <-- HIDDEN JUNCTION BOX
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen2-outlet-console",
        name: "[Living] 120V 15A Duplex Outlet (Media Console)",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(45.0, 40.0, -223.0),
        endPoint: new vec3(45.0, 0.0, -223.0),
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen2-jbox-to-console",
        name: "[Living] Hidden J-Box to Console Branch",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(112.5, 40.0, -223.0), // <-- Spliced at Hidden J-Box
        endPoint: new vec3(45.0, 40.0, -223.0),
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen2-jbox-homerun",
        name: "[Living] Hidden J-Box Homerun to Electrical Partition",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(112.5, 40.0, -223.0), // <-- Spliced at Hidden J-Box
        endPoint: new vec3(300.0, 40.0, -223.0),
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen2-elec-entry",
        name: "[Electrical] TV In-Wall Entry to Utility Room",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(300.0, 40.0, -223.0),
        endPoint: new vec3(394.0, 40.0, -205.0),
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen2-panel-riser-b2",
        name: "[Electrical] Breaker B2 (Living Room TV 15A) Terminal Feed",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(394.0, 40.0, -205.0),
        endPoint: new vec3(394.0, 157.0, -201.0), // <-- Exact Breaker B2 Terminal
        isWorldCoords: true,
        roomZone: "living",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 3 (BREAKER B3 - 15A): Living Room Sofa & Corner Lamp Tap-In
    // Terminating directly at Breaker #3 Terminal: (366, 145, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen3-outlet-floor-lamp",
        name: "[Living] 120V 15A Duplex Outlet (Corner Lamp)",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(285.0, 40.0, -190.0),
        endPoint: new vec3(285.0, 0.0, -190.0),
        isWorldCoords: true,
        roomZone: "sofa",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen3-panel-to-lamp",
        name: "[Electrical] Breaker B3 (Living Sofa & Lamp 15A) Terminal Feed",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.85, 0.10, 1.00),
        startPoint: new vec3(366.0, 145.0, -201.0), // <-- Exact Breaker B3 Terminal
        endPoint: new vec3(285.0, 40.0, -190.0),
        isWorldCoords: true,
        roomZone: "sofa",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen3-outlet-sofa",
        name: "[Living] 120V 15A Duplex Outlet (Sofa Tap-In)",
        layer: "electrical",
        voltageOrType: "Proposed 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "PROPOSED RETROFIT CABLE (FISH ROUTE)",
        color: new vec4(0.30, 1.00, 0.60, 1.00), // Vibrant Green highlight
        startPoint: new vec3(290.0, 40.0, 30.0),
        endPoint: new vec3(290.0, 0.0, 30.0),
        isWorldCoords: true,
        roomZone: "sofa",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 6.0
    },
    {
        id: "scen3-sofa-fish-pull",
        name: "[Living] In-Wall Cable Fish Route (Lamp J-Box to Sofa)",
        layer: "electrical",
        voltageOrType: "Proposed 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "PROPOSED RETROFIT CABLE (FISH ROUTE)",
        color: new vec4(0.30, 1.00, 0.60, 1.00), // Vibrant Green highlight
        startPoint: new vec3(285.0, 40.0, -190.0), // <-- Tap-in splice point at Lamp J-Box
        endPoint: new vec3(290.0, 40.0, 30.0),
        isWorldCoords: true,
        roomZone: "sofa",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 6.0
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 4 (BREAKER B4 - 30A): Utility & Battery Energy Storage System
    // Terminating directly at Breaker #4 Terminal: (394, 145, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen4-panel-to-disconnect",
        name: "[Electrical] Breaker B4 (Utility & Battery 30A) Terminal Feed",
        layer: "electrical",
        voltageOrType: "Live 240V (10 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 240V AC (ENERGIZED)",
        color: new vec4(1.00, 0.50, 0.10, 1.00),
        startPoint: new vec3(394.0, 145.0, -201.0), // <-- Exact Breaker B4 Terminal
        endPoint: new vec3(452.5, 140.0, -205.0), // Red Safety Disconnect
        isWorldCoords: true,
        roomZone: "utility",
        gauge: "10 AWG (30A)",
        isLive: true,
        thickness: 6.0
    },
    {
        id: "scen4-disconnect-to-battery",
        name: "[Electrical] Inverter Feeder to Powerwall Battery",
        layer: "electrical",
        voltageOrType: "Live 240V (10 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 240V AC (ENERGIZED)",
        color: new vec4(1.00, 0.50, 0.10, 1.00),
        startPoint: new vec3(452.5, 140.0, -205.0),
        endPoint: new vec3(542.5, 110.0, -100.0), // Powerwall
        isWorldCoords: true,
        roomZone: "utility",
        gauge: "10 AWG (30A)",
        isLive: true,
        thickness: 6.0
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 5 (BREAKER B5 - 20A GFCI): Modern Gourmet Kitchen Zone
    // Terminating directly at Breaker #5 Terminal: (366, 133, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen5-panel-feed-b5",
        name: "[Electrical] Breaker B5 (Kitchen Island & GFCI 20A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(1.00, 0.70, 0.15, 1.00),
        startPoint: new vec3(366.0, 133.0, -201.0), // <-- Exact Breaker B5 Terminal
        endPoint: new vec3(366.0, 225.0, -205.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen5-utility-to-living-ceiling",
        name: "[Kitchen] Utility Ceiling Header to Living Partition",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(1.00, 0.70, 0.15, 1.00),
        startPoint: new vec3(366.0, 225.0, -205.0),
        endPoint: new vec3(220.0, 225.0, -205.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen5-living-ceiling-to-kitchen",
        name: "[Kitchen] Ceiling Jumper to Kitchen Island Header",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(1.00, 0.70, 0.15, 1.00),
        startPoint: new vec3(220.0, 225.0, -205.0),
        endPoint: new vec3(95.0, 225.0, 340.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen5-kitchen-ceiling-drop",
        name: "[Kitchen] Island In-Chase Conduit Drop to Sub-Junction",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(1.00, 0.70, 0.15, 1.00),
        startPoint: new vec3(95.0, 225.0, 340.0),
        endPoint: new vec3(95.0, 40.0, 390.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen5-island-gfci-outlet",
        name: "[Kitchen] 120V 20A Island GFCI Duplex Receptacle",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(95.0, 40.0, 390.0),
        endPoint: new vec3(95.0, 80.0, 442.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen5-island-to-counter-branch",
        name: "[Kitchen] In-Slab Branch to Countertop Backsplash GFCI",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(1.00, 0.70, 0.15, 1.00),
        startPoint: new vec3(95.0, 40.0, 390.0),
        endPoint: new vec3(240.0, 110.0, 360.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen5-counter-to-fridge-run",
        name: "[Kitchen] Dedicated 20A Circuit to Refrigerator",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(1.00, 0.70, 0.15, 1.00),
        startPoint: new vec3(240.0, 110.0, 360.0),
        endPoint: new vec3(240.0, 40.0, 530.0),
        isWorldCoords: true,
        roomZone: "kitchen",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 6 (BREAKER B6 - 50A 240V): Garage & Workshop Level-2 EV Fast Charger
    // Terminating directly at Breaker #6 Terminal: (394, 133, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen6-panel-feed-b6",
        name: "[Electrical] Breaker B6 (Garage EV Fast Charger 50A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 240V (6 AWG Heavy)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "HIGH VOLTAGE 240V AC 50A (ENERGIZED)",
        color: new vec4(1.00, 0.22, 0.22, 1.00),
        startPoint: new vec3(394.0, 133.0, -201.0), // <-- Exact Breaker B6 Terminal
        endPoint: new vec3(557.0, 133.0, -190.0),
        isWorldCoords: true,
        roomZone: "garage",
        gauge: "6 AWG (50A Heavy)",
        isLive: true,
        thickness: 7.0
    },
    {
        id: "scen6-garage-north-wall-run",
        name: "[Garage] Industrial EMT North Wall Run to Workbench",
        layer: "electrical",
        voltageOrType: "Live 240V (6 AWG Heavy)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "HIGH VOLTAGE 240V AC 50A (ENERGIZED)",
        color: new vec4(1.00, 0.22, 0.22, 1.00),
        startPoint: new vec3(557.0, 133.0, -190.0),
        endPoint: new vec3(750.0, 133.0, -220.0),
        isWorldCoords: true,
        roomZone: "garage",
        gauge: "6 AWG (50A Heavy)",
        isLive: true,
        thickness: 7.0
    },
    {
        id: "scen6-workbench-quad-outlet",
        name: "[Garage] Heavy-Duty Steel Workbench 20A Quad Receptacle",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(750.0, 133.0, -220.0),
        endPoint: new vec3(670.0, 110.0, -222.0),
        isWorldCoords: true,
        roomZone: "garage",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen6-north-to-east-corner",
        name: "[Garage] EMT Feeder to East Corner Wall",
        layer: "electrical",
        voltageOrType: "Live 240V (6 AWG Heavy)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "HIGH VOLTAGE 240V AC 50A (ENERGIZED)",
        color: new vec4(1.00, 0.22, 0.22, 1.00),
        startPoint: new vec3(750.0, 133.0, -220.0),
        endPoint: new vec3(945.0, 133.0, -220.0),
        isWorldCoords: true,
        roomZone: "garage",
        gauge: "6 AWG (50A Heavy)",
        isLive: true,
        thickness: 7.0
    },
    {
        id: "scen6-ev-charger-homerun",
        name: "[Garage] 50A Feeder Homerun to EV Charger Station",
        layer: "electrical",
        voltageOrType: "Live 240V (6 AWG Heavy)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "HIGH VOLTAGE 240V AC 50A (ENERGIZED)",
        color: new vec4(1.00, 0.22, 0.22, 1.00),
        startPoint: new vec3(945.0, 133.0, -220.0),
        endPoint: new vec3(945.0, 133.0, 10.0),
        isWorldCoords: true,
        roomZone: "garage",
        gauge: "6 AWG (50A Heavy)",
        isLive: true,
        thickness: 7.0
    },
    {
        id: "scen6-ev-charger-disconnect",
        name: "[Garage] Level-2 50A 240V NEMA 14-50 EV Fast Charger Station",
        layer: "electrical",
        voltageOrType: "Live 240V (6 AWG Heavy)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "HIGH VOLTAGE 240V AC 50A (ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(945.0, 133.0, 10.0),
        endPoint: new vec3(945.0, 115.0, 10.0),
        isWorldCoords: true,
        roomZone: "garage",
        gauge: "6 AWG (50A Heavy)",
        isLive: true,
        thickness: 7.0
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 7 (BREAKER B7 - 20A GFCI): Luxury En-Suite Bathroom
    // Terminating directly at Breaker #7 Terminal: (366, 121, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen7-panel-feed-b7",
        name: "[Electrical] Breaker B7 (Bathroom Vanity GFCI 20A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(366.0, 121.0, -201.0), // <-- Exact Breaker B7 Terminal
        endPoint: new vec3(366.0, 225.0, -205.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-trunk-to-bed-partition",
        name: "[Bathroom] High-Level Ceiling Trunk West across Living",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(366.0, 225.0, -205.0),
        endPoint: new vec3(-80.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-bed-ceiling-to-bath",
        name: "[Bathroom] Header Conduit West across Bedroom Ceiling",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(-80.0, 225.0, -223.0),
        endPoint: new vec3(-450.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-bath-ceiling-infeed",
        name: "[Bathroom] Infeed into Bathroom North Ceiling Header",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(-450.0, 225.0, -223.0),
        endPoint: new vec3(-540.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-vanity-drop",
        name: "[Bathroom] In-Wall Stud Drop to Double Vanity J-Box",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(-540.0, 225.0, -223.0),
        endPoint: new vec3(-540.0, 110.0, -223.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-vanity-gfci-outlet",
        name: "[Bathroom] 120V 20A Dual Vanity GFCI Receptacle",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(-540.0, 110.0, -223.0),
        endPoint: new vec3(-475.0, 110.0, -223.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-vanity-mirror-light",
        name: "[Bathroom] Backlit Mirror & Sconce Lighting Bar Riser",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(-540.0, 110.0, -223.0),
        endPoint: new vec3(-540.0, 190.0, -223.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen7-shower-exhaust-fan",
        name: "[Bathroom] Ceiling Branch to Shower Exhaust Fan / Heat Lamp",
        layer: "electrical",
        voltageOrType: "Live 120V (12 AWG GFCI)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (GFCI ENERGIZED)",
        color: new vec4(0.20, 0.90, 1.00, 1.00),
        startPoint: new vec3(-540.0, 225.0, -223.0),
        endPoint: new vec3(-675.0, 235.0, -165.0),
        isWorldCoords: true,
        roomZone: "bathroom",
        gauge: "12 AWG (20A)",
        isLive: true,
        thickness: 5.5
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 8 (BREAKER B8 - 15A CLEAN POWER): Home Office & Tech Lab
    // Terminating directly at Breaker #8 Terminal: (394, 121, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen8-panel-feed-b8",
        name: "[Electrical] Breaker B8 (Office Tech Workstation 15A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG Clean)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (CLEAN SURGE-PROTECTED)",
        color: new vec4(0.25, 1.00, 0.55, 1.00),
        startPoint: new vec3(394.0, 121.0, -201.0), // <-- Exact Breaker B8 Terminal
        endPoint: new vec3(394.0, 40.0, -205.0),
        isWorldCoords: true,
        roomZone: "office",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen8-office-partition-entry",
        name: "[Office] Under-Wall Raceway South into Home Office",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG Clean)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (CLEAN SURGE-PROTECTED)",
        color: new vec4(0.25, 1.00, 0.55, 1.00),
        startPoint: new vec3(394.0, 40.0, -205.0),
        endPoint: new vec3(394.0, 40.0, 240.0),
        isWorldCoords: true,
        roomZone: "office",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen8-office-wall-run",
        name: "[Office] Baseboard Framing Run to Desk J-Box",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG Clean)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (CLEAN SURGE-PROTECTED)",
        color: new vec4(0.25, 1.00, 0.55, 1.00),
        startPoint: new vec3(394.0, 40.0, 240.0),
        endPoint: new vec3(394.0, 40.0, 460.0),
        isWorldCoords: true,
        roomZone: "office",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen8-desk-workstation-quad",
        name: "[Office] 120V 15A Clean-Power Dual-Monitor Desk Quad Receptacle",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG Clean)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (CLEAN SURGE-PROTECTED)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(394.0, 40.0, 460.0),
        endPoint: new vec3(394.0, 75.0, 460.0),
        isWorldCoords: true,
        roomZone: "office",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen8-desk-to-printer-branch",
        name: "[Office] Baseboard Branch to Bookshelf & Network Cabinet",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG Clean)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (CLEAN SURGE-PROTECTED)",
        color: new vec4(0.25, 1.00, 0.55, 1.00),
        startPoint: new vec3(394.0, 40.0, 460.0),
        endPoint: new vec3(610.0, 40.0, 360.0),
        isWorldCoords: true,
        roomZone: "office",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 9 (BREAKER B9 - 15A): Formal Dining Room Lighting & Chandelier
    // Terminating directly at Breaker #9 Terminal: (366, 109, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen9-panel-feed-b9",
        name: "[Electrical] Breaker B9 (Dining Chandelier 15A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (DIMMABLE LIGHTING)",
        color: new vec4(1.00, 0.92, 0.35, 1.00),
        startPoint: new vec3(366.0, 109.0, -201.0), // <-- Exact Breaker B9 Terminal
        endPoint: new vec3(366.0, 225.0, -205.0),
        isWorldCoords: true,
        roomZone: "dining",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen9-ceiling-west-trunk",
        name: "[Dining] Ceiling Trunk West across Bedroom Header",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (DIMMABLE LIGHTING)",
        color: new vec4(1.00, 0.92, 0.35, 1.00),
        startPoint: new vec3(366.0, 225.0, -205.0),
        endPoint: new vec3(-260.0, 225.0, -223.0),
        isWorldCoords: true,
        roomZone: "dining",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen9-dining-arch-jumper",
        name: "[Dining] Ceiling Jumper South over Grand Archway",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (DIMMABLE LIGHTING)",
        color: new vec4(1.00, 0.92, 0.35, 1.00),
        startPoint: new vec3(-260.0, 225.0, -223.0),
        endPoint: new vec3(-260.0, 225.0, 420.0),
        isWorldCoords: true,
        roomZone: "dining",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen9-chandelier-pendant-drop",
        name: "[Dining] Vertical Pendant Drop to Hanging Chandelier Canopy",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (DIMMABLE LIGHTING)",
        color: new vec4(1.00, 0.92, 0.35, 1.00),
        startPoint: new vec3(-260.0, 225.0, 420.0),
        endPoint: new vec3(-260.0, 195.0, 420.0),
        isWorldCoords: true,
        roomZone: "dining",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },
    {
        id: "scen9-dining-dimmer-switch",
        name: "[Dining] Wall Drop to Modern Smart Dimmer Switch",
        layer: "electrical",
        voltageOrType: "Live 120V (14 AWG)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "LIVE 120V AC (DIMMABLE LIGHTING)",
        color: new vec4(0.30, 0.95, 1.00, 1.00),
        startPoint: new vec3(-260.0, 225.0, 420.0),
        endPoint: new vec3(-340.0, 120.0, 240.0),
        isWorldCoords: true,
        roomZone: "dining",
        gauge: "14 AWG (15A)",
        isLive: true,
        thickness: 5.5
    },

    // -------------------------------------------------------------------------
    // CIRCUIT 10 (BREAKER B10 - 30A 240V): Central HVAC Sub-System & Air Handler
    // Terminating directly at Breaker #10 Terminal: (394, 109, -201)
    // -------------------------------------------------------------------------
    {
        id: "scen10-panel-feed-b10",
        name: "[Electrical] Breaker B10 (HVAC Air Handler 30A) Terminal Feeder",
        layer: "electrical",
        voltageOrType: "Live 240V (10 AWG Heavy)",
        installer: "Master AR Electrician",
        installDate: "11/08/2026",
        status: "HIGH VOLTAGE 240V AC 30A (ENERGIZED)",
        color: new vec4(1.00, 0.45, 0.10, 1.00),
        startPoint: new vec3(394.0, 109.0, -201.0), // <-- Exact Breaker B10 Terminal
        endPoint: new vec3(460.0, 50.0, 130.0),
        isWorldCoords: true,
        roomZone: "utility",
        gauge: "10 AWG (30A)",
        isLive: true,
        thickness: 6.5
    }
];

export const INITIAL_CONDUIT_RUNS: ConduitRun[] = [
    ...SCENARIO_HOUSE_RUNS
];
