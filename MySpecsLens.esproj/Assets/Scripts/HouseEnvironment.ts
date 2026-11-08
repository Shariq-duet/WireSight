import { ReferenceWall } from "./ReferenceWall";
import { ConduitRun } from "./ConduitTypes";

export interface RoomZoneInfo {
    id: string;
    name: string;
    icon: string;
    label: string;
    center: vec3;
    cameraPos: vec3;
    cameraRot: quat;
}

export const HOUSE_ROOMS: RoomZoneInfo[] = [
    {
        id: "hallway",
        name: "Central Hallway",
        icon: "🚪",
        label: "CENTRAL ENTRANCE THRESHOLD",
        center: new vec3(50, 120, 0),
        cameraPos: new vec3(50, 120, 220),
        cameraRot: quat.fromEulerAngles(0, 0, 0)
    },
    {
        id: "kitchen",
        name: "Kitchen Zone",
        icon: "🍳",
        label: "KITCHEN (20A GFCI & WATER RISERS)",
        center: new vec3(112.5, 120, -225),
        cameraPos: new vec3(112.5, 120, 100),
        cameraRot: quat.fromEulerAngles(0, 0, 0)
    },
    {
        id: "living",
        name: "Living Room (Scenario 2 & 3)",
        icon: "🛋️",
        label: "LIVING ROOM (TV, HIDDEN J-BOX & SOFA TAP-IN)",
        center: new vec3(112.5, 120, -225),
        cameraPos: new vec3(112.5, 120, 100),
        cameraRot: quat.fromEulerAngles(0, 0, 0)
    },
    {
        id: "utility",
        name: "Electrical Room (Scenario 1 & 4)",
        icon: "⚡",
        label: "ELECTRICAL MEP ROOM (200A SERVICE & BREAKER HUB)",
        center: new vec3(425, 120, -225),
        cameraPos: new vec3(380, 140, 30),
        cameraRot: quat.fromEulerAngles(0, 0, 0)
    },
    {
        id: "bedroom",
        name: "Master Bedroom (Scenario 1)",
        icon: "🛏️",
        label: "MASTER BEDROOM (BED, NIGHTSTANDS & WIRE TRACING)",
        center: new vec3(-262.5, 120, -225),
        cameraPos: new vec3(-262.5, 120, 100),
        cameraRot: quat.fromEulerAngles(0, 0, 0)
    },
    {
        id: "overview",
        name: "Architectural Cutaway Overview",
        icon: "📐",
        label: "BIRD'S-EYE 45° ISOMETRIC HOUSE OVERVIEW",
        center: new vec3(50, 0, 0),
        cameraPos: new vec3(50, 480, 480),
        cameraRot: quat.fromEulerAngles(-0.70, 0, 0)
    }
];

@component
export class HouseEnvironment extends BaseScriptComponent {
    private houseRoot: SceneObject | null = null;
    private walls: ReferenceWall[] = [];
    private floorLabels: SceneObject[] = [];
    private isXRayMode: boolean = true;
    private floorGridLines: { a: vec3; b: vec3; col: vec4 }[] = [];
    private doorwayHeaders: { a: vec3; b: vec3; col: vec4 }[] = [];

    onAwake() {
        this.houseRoot = this.getSceneObject();
        this.buildFloorGridLines();
        this.buildRoomFloorBadges();
        this.createEvent("UpdateEvent").bind(() => this.renderHouseVisuals());
    }

    // Architectural boundary lines (cleared to avoid wireframe box obstruction in room)
    private buildFloorGridLines() {
        this.floorGridLines = [];
        this.doorwayHeaders = [];
    }

    // Creates high-contrast floating room banners anchored to each room's floor
    private buildRoomFloorBadges() {
        this.floorLabels = [];
    }

    // Instantiates primary 3X Large ReferenceWalls (720cm W x 360cm H)
    public setupHouseWalls(conduitMain: any): ReferenceWall[] {
        this.walls = [];

        // 1. Kitchen North Wall
        const wall1Obj = global.scene.createSceneObject("HouseWall_North_Kitchen");
        const wall1 = wall1Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
        wall1.wallIndex = 1;
        wall1.wallId = "wall-kitchen";
        wall1.widthCm = 720.0;
        wall1.heightCm = 360.0;
        wall1.initialPosition = new vec3(-500, 0, -800);
        wall1.initialRotation = quat.fromEulerAngles(0, 0, 0);
        wall1.setIsActiveWall(true);
        this.walls.push(wall1);

        // 2. Living Room North Media Wall
        const wall2Obj = global.scene.createSceneObject("HouseWall_North_Living");
        const wall2 = wall2Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
        wall2.wallIndex = 2;
        wall2.wallId = "wall-living";
        wall2.widthCm = 720.0;
        wall2.heightCm = 360.0;
        wall2.initialPosition = new vec3(500, 0, -800);
        wall2.initialRotation = quat.fromEulerAngles(0, 0, 0);
        wall2.setIsActiveWall(false);
        this.walls.push(wall2);

        // 3. Utility Room Main Breaker Panel Wall
        const wall3Obj = global.scene.createSceneObject("HouseWall_Utility");
        const wall3 = wall3Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
        wall3.wallIndex = 3;
        wall3.wallId = "wall-utility";
        wall3.widthCm = 720.0;
        wall3.heightCm = 360.0;
        wall3.initialPosition = new vec3(-500, 0, 400);
        wall3.initialRotation = quat.fromEulerAngles(0, Math.PI, 0);
        wall3.setIsActiveWall(false);
        this.walls.push(wall3);

        // 4. Master Bedroom Bed Wall
        const wall4Obj = global.scene.createSceneObject("HouseWall_Bedroom");
        const wall4 = wall4Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
        wall4.wallIndex = 4;
        wall4.wallId = "wall-bedroom";
        wall4.widthCm = 720.0;
        wall4.heightCm = 360.0;
        wall4.initialPosition = new vec3(500, 0, 400);
        wall4.initialRotation = quat.fromEulerAngles(0, Math.PI, 0);
        wall4.setIsActiveWall(false);
        this.walls.push(wall4);

        print(`[HouseEnvironment] Built ${this.walls.length} architectural 3X large estate walls.`);
        return this.walls;
    }

    // Creates the complete pre-wired residential MEP BIM infrastructure across the 3X house
    public getPrewiredHouseConduits(): ConduitRun[] {
        return [
            // =========================================================================
            // 1. UTILITY ROOM: 400A Service Entrance & Main Breaker Hub (South-West)
            // =========================================================================
            {
                id: "elec-main-service-drop",
                name: "Utility Service Entrance (400A Main Overhead Drop)",
                layer: "electrical",
                voltageOrType: "240V Split-Phase 400A Main Service",
                installer: "Regional Grid Authority",
                installDate: "Oct 15, 2026",
                status: "HIGH VOLTAGE ENERGIZED",
                color: new vec4(0.4, 0.95, 1.0, 1.0),
                startPoint: new vec3(-500, 180, 390),
                endPoint: new vec3(-500, 60, 390),
                isWorldCoords: true,
                roomZone: "Utility",
                gauge: "10 AWG (30A Heavy/HVAC)",
                isLive: true,
                thickness: 14.0
            },
            {
                id: "elec-utility-hvac-feed",
                name: "HVAC Compressor 240V Dedicated Feeder (Breaker B5)",
                layer: "electrical",
                voltageOrType: "240V AC - 40A Heavy",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B5)",
                color: new vec4(1.0, 0.5, 0.2, 1.0),
                startPoint: new vec3(-480, 20, 390),
                endPoint: new vec3(-750, -40, 390),
                isWorldCoords: true,
                roomZone: "Utility",
                gauge: "10 AWG (30A Heavy/HVAC)",
                isLive: true,
                thickness: 8.5
            },
            {
                id: "elec-utility-water-heater",
                name: "Electric Water Heater 240V Circuit (Breaker B6)",
                layer: "electrical",
                voltageOrType: "240V AC - 30A",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B6)",
                color: new vec4(1.0, 0.7, 0.2, 1.0),
                startPoint: new vec3(-480, 0, 390),
                endPoint: new vec3(-650, -120, 390),
                isWorldCoords: true,
                roomZone: "Utility",
                gauge: "10 AWG (30A Heavy/HVAC)",
                isLive: true,
                thickness: 7.0
            },
            {
                id: "elec-utility-gfci-outlet",
                name: "Utility Workstation GFCI Duplex Outlet",
                layer: "electrical",
                voltageOrType: "120V AC - 20A GFCI",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED",
                color: new vec4(1.0, 0.88, 0.20, 1.0),
                startPoint: new vec3(-480, -20, 390),
                endPoint: new vec3(-380, -135, 390),
                isWorldCoords: true,
                roomZone: "Utility",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.5
            },

            // =========================================================================
            // 2. CENTRAL ATTIC HOME-RUN TRUNKS (Connecting Panel to Each Room)
            // =========================================================================
            {
                id: "elec-corridor-feeder-kitchen",
                name: "Main Feeder Trunk -> Kitchen Circuit B1 (Attic Raceway)",
                layer: "electrical",
                voltageOrType: "230V AC - 20A Home-Run",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B1)",
                color: new vec4(1.0, 0.85, 0.20, 1.0),
                startPoint: new vec3(-500, 40, 390),
                endPoint: new vec3(-500, 160, -790),
                isWorldCoords: true,
                roomZone: "Kitchen",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 6.5
            },
            {
                id: "elec-corridor-feeder-living",
                name: "Main Feeder Trunk -> Living Room Circuit B2 (Attic Raceway)",
                layer: "electrical",
                voltageOrType: "230V AC - 15A Home-Run",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B2)",
                color: new vec4(1.0, 0.85, 0.20, 1.0),
                startPoint: new vec3(-500, 30, 390),
                endPoint: new vec3(500, 160, -790),
                isWorldCoords: true,
                roomZone: "Living Room",
                gauge: "14 AWG (15A)",
                isLive: true,
                thickness: 6.0
            },
            {
                id: "elec-corridor-feeder-bedroom",
                name: "Main Feeder Trunk -> Bedroom Circuit B3 (Attic Raceway)",
                layer: "electrical",
                voltageOrType: "230V AC - 16A Home-Run",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Nov 01, 2026",
                status: "ENERGIZED (Breaker B3)",
                color: new vec4(1.0, 0.90, 0.25, 1.0),
                startPoint: new vec3(-500, 20, 390),
                endPoint: new vec3(500, 160, 390),
                isWorldCoords: true,
                roomZone: "Master Bedroom",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 6.0
            },

            // =========================================================================
            // 3. KITCHEN ZONE: 20A GFCI Outlets & Water Lines (North-West)
            // =========================================================================
            {
                id: "elec-kitchen-feed-b1",
                name: "Kitchen Circuit 1 (20A GFCI Countertop Feeder)",
                layer: "electrical",
                voltageOrType: "230V AC - 20A - 3.5mm²",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B1)",
                color: new vec4(1.0, 0.88, 0.20, 1.0),
                startPoint: new vec3(-500, 160, -790),
                endPoint: new vec3(-500, -85, -790),
                isWorldCoords: true,
                roomZone: "Kitchen",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.5
            },
            {
                id: "elec-kitchen-counter-run",
                name: "Kitchen Countertop Outlets Branch",
                layer: "electrical",
                voltageOrType: "230V AC - 20A",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B1)",
                color: new vec4(1.0, 0.88, 0.20, 1.0),
                startPoint: new vec3(-500, -85, -790),
                endPoint: new vec3(-300, -85, -790),
                isWorldCoords: true,
                roomZone: "Kitchen",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.5
            },
            {
                id: "elec-kitchen-refrigerator",
                name: "Dedicated Refrigerator 120V 20A Home-Run",
                layer: "electrical",
                voltageOrType: "120V AC - 20A Dedicated",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED",
                color: new vec4(1.0, 0.88, 0.20, 1.0),
                startPoint: new vec3(-500, -85, -790),
                endPoint: new vec3(-720, -135, -790),
                isWorldCoords: true,
                roomZone: "Kitchen",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.5
            },
            {
                id: "plumb-kitchen-cold",
                name: "Kitchen Potable Cold Water Riser",
                layer: "plumbing",
                voltageOrType: "Cold Potable Water (60 PSI)",
                installer: "M. Rossi (Licensed Master Plumber)",
                installDate: "Oct 29, 2026",
                status: "PRESSURIZED (60 PSI)",
                color: new vec4(0.20, 0.75, 1.0, 1.0),
                startPoint: new vec3(-620, -180, -790),
                endPoint: new vec3(-620, -60, -790),
                isWorldCoords: true,
                roomZone: "Kitchen",
                gauge: "1/2\" PEX",
                thickness: 8.5
            },
            {
                id: "plumb-kitchen-hot",
                name: "Kitchen Hot Water Loop (CLEARANCE HAZARD)",
                layer: "plumbing",
                voltageOrType: "Domestic Hot Water (140°F / 55 PSI)",
                installer: "M. Rossi (Licensed Master Plumber)",
                installDate: "Oct 29, 2026",
                status: "PRESSURIZED (140°F)",
                color: new vec4(1.0, 0.35, 0.30, 1.0),
                startPoint: new vec3(-650, -70, -790),
                endPoint: new vec3(-450, -70, -790),
                isConflict: true,
                conflictWarning: "⚠️ CLEARANCE VIOLATION: Hot water pipe is 5cm from live 230V conduit (Min 10cm required by NEC 300.3)",
                isWorldCoords: true,
                roomZone: "Kitchen",
                gauge: "1/2\" PEX",
                thickness: 8.5
            },

            // =========================================================================
            // 4. LIVING ROOM: 15A Receptacles & 85" Media Console (North-East)
            // =========================================================================
            {
                id: "elec-living-tv",
                name: "Living Room 85\" TV Media Center Quad Receptacle",
                layer: "electrical",
                voltageOrType: "230V AC - 15A - 2.5mm²",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B2)",
                color: new vec4(1.0, 0.85, 0.20, 1.0),
                startPoint: new vec3(500, 160, -790),
                endPoint: new vec3(500, -50, -790),
                isWorldCoords: true,
                roomZone: "Living Room",
                gauge: "14 AWG (15A)",
                isLive: true,
                thickness: 4.5
            },
            {
                id: "elec-living-perimeter",
                name: "Living Room East Wall Baseboard Run",
                layer: "electrical",
                voltageOrType: "230V AC - 15A",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED (Breaker B2)",
                color: new vec4(1.0, 0.85, 0.20, 1.0),
                startPoint: new vec3(500, -135, -790),
                endPoint: new vec3(750, -135, -790),
                isWorldCoords: true,
                roomZone: "Living Room",
                gauge: "14 AWG (15A)",
                isLive: true,
                thickness: 4.2
            },
            {
                id: "elec-living-switch",
                name: "Living Room Entryway Wall Switch Drop",
                layer: "electrical",
                voltageOrType: "120V AC - 15A Switch",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Oct 28, 2026",
                status: "ENERGIZED",
                color: new vec4(1.0, 0.85, 0.20, 1.0),
                startPoint: new vec3(220, 160, -790),
                endPoint: new vec3(220, -80, -790),
                isWorldCoords: true,
                roomZone: "Living Room",
                gauge: "14 AWG (15A)",
                isLive: true,
                thickness: 4.2
            },

            // =========================================================================
            // 5. MASTER BEDROOM: Circuit 4B & Dual Nightstand Outlets (South-East)
            // =========================================================================
            {
                id: "elec-bedroom-overhead-4b",
                name: "Bedroom Circuit 4B (Overhead Live Feed)",
                layer: "electrical",
                voltageOrType: "230V AC - 16A - 2.5mm²",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Nov 01, 2026",
                status: "ENERGIZED (Breaker B3)",
                color: new vec4(1.0, 0.90, 0.25, 1.0),
                startPoint: new vec3(500, 160, 390),
                endPoint: new vec3(500, -80, 390),
                isWorldCoords: true,
                roomZone: "Master Bedroom",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.5
            },
            {
                id: "elec-bedroom-left-nightstand",
                name: "Master Bedroom Left Nightstand 120V Duplex Outlet",
                layer: "electrical",
                voltageOrType: "120V AC - 15A",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Nov 01, 2026",
                status: "ENERGIZED",
                color: new vec4(1.0, 0.90, 0.25, 1.0),
                startPoint: new vec3(500, -80, 390),
                endPoint: new vec3(350, -135, 390),
                isWorldCoords: true,
                roomZone: "Master Bedroom",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.0
            },
            {
                id: "elec-bedroom-right-nightstand",
                name: "Master Bedroom Right Nightstand 120V Duplex Outlet",
                layer: "electrical",
                voltageOrType: "120V AC - 15A",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Nov 01, 2026",
                status: "ENERGIZED",
                color: new vec4(1.0, 0.90, 0.25, 1.0),
                startPoint: new vec3(500, -80, 390),
                endPoint: new vec3(650, -135, 390),
                isWorldCoords: true,
                roomZone: "Master Bedroom",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.0
            },
            {
                id: "elec-bedroom-switch",
                name: "Bedroom Bedside 3-Way Light Switch Drop",
                layer: "electrical",
                voltageOrType: "230V AC - 16A",
                installer: "A. Khan (Cert. Master Electrician)",
                installDate: "Nov 01, 2026",
                status: "ENERGIZED (Breaker B3)",
                color: new vec4(1.0, 0.90, 0.25, 1.0),
                startPoint: new vec3(220, 160, 390),
                endPoint: new vec3(220, -80, 390),
                isWorldCoords: true,
                roomZone: "Master Bedroom",
                gauge: "12 AWG (20A)",
                isLive: true,
                thickness: 5.0
            }
        ];
    }

    public toggleXRayMode(): boolean {
        this.isXRayMode = !this.isXRayMode;
        return this.isXRayMode;
    }

    public setXRayMode(val: boolean): void {
        this.isXRayMode = val;
    }

    public getIsXRayMode(): boolean {
        return this.isXRayMode;
    }

    // Real-time architectural lines (only rendered if user explicitly requests X-Ray overlay)
    private renderHouseVisuals() {
        if (!global.debugRenderSystem || !this.isXRayMode) return;

        // 1. Draw Architectural Floor & Ceiling Grid Lines
        for (const line of this.floorGridLines) {
            global.debugRenderSystem.drawLine(line.a, line.b, line.col);
        }

        // 2. Draw Walk-through Doorway Framing Headers
        for (const door of this.doorwayHeaders) {
            global.debugRenderSystem.drawLine(door.a, door.b, door.col);
        }
    }
}
