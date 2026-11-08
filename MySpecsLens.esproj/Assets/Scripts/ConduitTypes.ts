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
    }
];

export const INITIAL_CONDUIT_RUNS: ConduitRun[] = [
    ...SCENARIO_HOUSE_RUNS
];
