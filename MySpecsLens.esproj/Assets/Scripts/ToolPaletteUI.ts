import { RoomPreset, ROOM_PRESETS } from "./ConduitTypes";

export interface WireGaugeDef {
    label: string;
    name: string;
    thickness: number;
    voltage: string;
}

export const WIRE_GAUGES: WireGaugeDef[] = [
    { label: "12 AWG (20A)", name: "12 AWG (20A Outlets)", thickness: 5.5, voltage: "230V AC - 20A" },
    { label: "14 AWG (15A)", name: "14 AWG (15A Lighting)", thickness: 4.2, voltage: "230V AC - 15A" },
    { label: "10 AWG (30A)", name: "10 AWG (30A Heavy/HVAC)", thickness: 7.0, voltage: "230V AC - 30A" },
    { label: "1/2\" PEX", name: "1/2\" PEX Water Line", thickness: 8.5, voltage: "Cold Water Riser (60 PSI)" }
];

interface ButtonItem {
    name: string;
    obj: SceneObject;
    label: Text;
    baseColor: vec4;
    borderColor: vec4;
    onClick: () => void;
}

@component
export class ToolPaletteUI extends BaseScriptComponent {
    private paletteRoot: SceneObject | null = null;
    private camera: Camera | null = null;
    
    // Sub-containers for Expandable Dock architecture
    private collapsedRoot: SceneObject | null = null;
    private drawerRoot: SceneObject | null = null;

    // Mode tabs: "wire" (Draw & Edit) | "wall" (Framing & Rotation) | "specs" (Electrical & Layers)
    private activeTab: "wire" | "wall" | "specs" = "wire";
    private tabWireRoot: SceneObject | null = null;
    private tabWallRoot: SceneObject | null = null;
    private tabSpecsRoot: SceneObject | null = null;

    // Tab buttons for dynamic styling
    private btnTabWire: ButtonItem | null = null;
    private btnTabWall: ButtonItem | null = null;
    private btnTabSpecs: ButtonItem | null = null;

    // UI References
    private textLayerCycle: Text | null = null;
    private textRoomFilter: Text | null = null;
    private textRoomAssign: Text | null = null;
    private textExpandBtn: Text | null = null;
    private textStatus: Text | null = null;
    private textMarkLine: Text | null = null;
    private textPushBack: Text | null = null;
    private textPullCloser: Text | null = null;
    private textDeleteRun: Text | null = null;
    private textGaugeCycle: Text | null = null;
    private textLiveState: Text | null = null;
    private textDrill: Text | null = null;
    private textClearAll: Text | null = null;
    private textElectrical: Text | null = null;
    private textPlumbing: Text | null = null;

    // Button tracking for pixel-perfect click detection
    private buttons: ButtonItem[] = [];

    // States
    private isExpanded: boolean = false;
    private activeHoldBtn: string | null = null;
    private holdStartTime: number = 0;
    private lastHoldTickTime: number = 0;
    private layerMode: "electrical" | "plumbing" | "all" = "electrical";
    private currentRoomFilterIndex: number = 0; // 0 = "all"
    private currentActiveRoomIndex: number = 1; // 1 = "kitchen"
    private currentGaugeIndex: number = 0;
    private isWireLive: boolean = true;
    private isElectricalOn: boolean = true;
    private isPlumbingOn: boolean = true;
    private isDrillToolOn: boolean = false;
    private isMarkingOn: boolean = false;
    private isWireSightOn: boolean = true;
    private textWireSightPuck: Text | null = null;
    private textWireSightSpecs: Text | null = null;

    // Event callbacks
    public onToggleWireSight: (() => void) | null = null;
    public onCycleLayer: ((mode: "electrical" | "plumbing" | "all") => void) | null = null;
    public onCycleRoomFilter: ((room: RoomPreset) => void) | null = null;
    public onAssignRoom: ((room: RoomPreset) => void) | null = null;
    public onWireEntireHouse: (() => void) | null = null;
    public onCycleGauge: ((gauge: WireGaugeDef) => void) | null = null;
    public onToggleWireLiveState: ((isLive: boolean) => void) | null = null;
    public onToggleElectrical: (() => void) | null = null;
    public onTogglePlumbing: (() => void) | null = null;
    public onToggleDrill: (() => void) | null = null;
    public onToggleMarkLine: (() => void) | null = null;
    public onPushBack: (() => void) | null = null;
    public onPullCloser: (() => void) | null = null;
    public onDeleteRun: (() => void) | null = null;
    public onClearAll: (() => void) | null = null;
    public onAddOutlet: (() => void) | null = null;
    public onToggleMode: (() => void) | null = null;
    public onUndoNode: (() => void) | null = null;
    public onToggleCameraView: (() => void) | null = null;
    public onCycleCameraPreset: (() => void) | null = null;
    public onDropNode: (() => void) | null = null;
    public onDockToWall: (() => void) | null = null;
    public onHidePalette: (() => void) | null = null;
    public onStartCreateWall: (() => void) | null = null;
    public onCycleWallSize: (() => void) | null = null;
    public onCycleWallDistance: (() => void) | null = null;
    public onRotateWall: ((deltaDegrees: number) => void) | null = null;
    public onCycleActiveWall: (() => void) | null = null;
    public onAddWall: (() => void) | null = null;
    public onDeleteWall: (() => void) | null = null;
    public onToggleWallEditMode: (() => void) | null = null;
    public onPushWall: ((deltaCm: number) => void) | null = null;
    public onSaveWiring: (() => void) | null = null;
    public onExportJson: (() => void) | null = null;
    public onImportJson: (() => void) | null = null;
    public onToggleUserWires: (() => void) | null = null;
    public onCycleBreakerTrip: (() => void) | null = null;
    public onTeleportRoom: ((roomIdx: number) => void) | null = null;

    private isWallEditActive: boolean = false;
    private textWallEditMode: Text | null = null;
    private textCameraToggle: Text | null = null;
    private textCameraPreset: Text | null = null;
    private btnCameraPresetObj: SceneObject | null = null;
    private textWallSize: Text | null = null;
    private textWallRotate: Text | null = null;
    private textWallCycle: Text | null = null;
    private textDropNode: Text | null = null;
    private attachedCameraObj: SceneObject | null = null;
    private isWorldLocked: boolean = true;
    private isDocked: boolean = false;

    onAwake() {
        this.paletteRoot = this.getSceneObject();
        this.buildUnifiedHUD();
        this.registerTouchClicks();
    }

    public setCamera(cam: Camera) {
        this.camera = cam;
    }

    public attachToCamera(camObj: SceneObject) {
        this.attachedCameraObj = camObj;
        // The Tool Palette is strictly world-locked and never childed to the camera.
    }

    // Summons palette into world space directly in front of current camera gaze
    public summonInWorld(camObj?: SceneObject) {
        if (!this.paletteRoot) return;

        let spawnPos = new vec3(0, -12, -120);
        let spawnRot = quat.fromEulerAngles(0, 0, 0);

        if (this.camera) {
            // Compute true camera eye origin and gaze direction in world space
            const rayNear = this.camera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 1.0);
            const rayFar = this.camera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 120.0);
            const gazeDir = rayFar.sub(rayNear).normalize();

            // Spawn 110cm in front of eyes, lowered 14cm to comfortable chest height
            spawnPos = rayNear.add(gazeDir.uniformScale(110.0));
            spawnPos.y -= 14.0;

            // Upright gravity-aligned orientation facing the user
            const yaw = Math.atan2(-gazeDir.x, -gazeDir.z);
            spawnRot = quat.fromEulerAngles(0, yaw, 0);
        }

        this.paletteRoot.setParent(null);
        this.paletteRoot.getTransform().setWorldPosition(spawnPos);
        this.paletteRoot.getTransform().setWorldRotation(spawnRot);
        this.paletteRoot.getTransform().setWorldScale(new vec3(6.6, 6.6, 6.6));
        this.paletteRoot.enabled = true;
        this.isWorldLocked = true;
        this.isDocked = false;

        this.setExpanded(true);
        this.setStatusMessage("✨ Tools summoned directly in front of you", new vec4(0.3, 1.0, 0.7, 1.0));
    }

    // Docks the tool palette directly onto the Reference Wall as an interactive blueprint station
    public dockToWall(dockPos: vec3, dockRot: quat) {
        if (!this.paletteRoot) return;
        this.paletteRoot.setParent(null);
        this.paletteRoot.getTransform().setWorldPosition(dockPos);
        this.paletteRoot.getTransform().setWorldRotation(dockRot);
        this.paletteRoot.getTransform().setWorldScale(new vec3(5.5, 5.5, 5.5)); // Ergonomic wall-mount scale
        this.paletteRoot.enabled = true;
        this.isWorldLocked = true;
        this.isDocked = true;
        this.setExpanded(true);
        this.setStatusMessage("📌 Mounted to Wall Blueprint Station", new vec4(0.2, 1.0, 0.6, 1.0));
    }

    public hidePalette() {
        this.setExpanded(false);
        if (this.paletteRoot) {
            this.paletteRoot.enabled = false;
        }
        this.setStatusMessage("○ Clean Room Mode (Press [Space] or [W] anytime)", new vec4(0.4, 0.8, 1.0, 0.9));
        if (this.onHidePalette) this.onHidePalette();
    }

    public triggerDockToWall() {
        if (this.onDockToWall) this.onDockToWall();
    }

    private buildUnifiedHUD() {
        if (!this.paletteRoot) return;

        // Container for full expandable spatial suite
        this.drawerRoot = global.scene.createSceneObject("ComfortArcDashboard");
        this.drawerRoot.setParent(this.paletteRoot);
        this.drawerRoot.getTransform().setLocalPosition(new vec3(0, 0, 0));

        // =========================================================================
        // 1. TOP TAB NAVIGATION BAR (y = 1.35) — Generous Spacing, Zero Overlap
        // =========================================================================
        this.btnTabWire = this.createPillButton(
            "TabBtnWire",
            this.drawerRoot,
            new vec3(-2.80, 1.35, 1),
            " WIRE ",
            new vec4(0.2, 1.0, 0.85, 1.0),
            new vec4(0.2, 0.95, 1.0, 1.0),
            () => this.switchTab("wire"),
            11,
            new vec3(1.3, 0.8, 1.5)
        );

        this.btnTabWall = this.createPillButton(
            "TabBtnWall",
            this.drawerRoot,
            new vec3(-1.40, 1.35, 1),
            " WALL ",
            new vec4(0.55, 0.70, 0.80, 0.75),
            new vec4(0.2, 0.40, 0.55, 0.45),
            () => this.switchTab("wall"),
            11,
            new vec3(1.3, 0.8, 1.5)
        );

        this.btnTabSpecs = this.createPillButton(
            "TabBtnSpecs",
            this.drawerRoot,
            new vec3(0.00, 1.35, 1),
            " SPECS ",
            new vec4(0.55, 0.70, 0.80, 0.75),
            new vec4(0.2, 0.40, 0.55, 0.45),
            () => this.switchTab("specs"),
            11,
            new vec3(1.3, 0.8, 1.5)
        );

        this.createPillButton(
            "BtnDockWall",
            this.drawerRoot,
            new vec3(1.45, 1.35, 1),
            " DOCK ",
            new vec4(0.2, 1.0, 0.8, 1.0),
            new vec4(0.1, 0.9, 0.7, 0.95),
            () => this.triggerDockToWall(),
            11,
            new vec3(1.2, 0.8, 1.5)
        );

        this.createPillButton(
            "BtnClosePalette",
            this.drawerRoot,
            new vec3(2.65, 1.35, 1),
            " ✕ ",
            new vec4(1.0, 0.45, 0.4, 1.0),
            new vec4(1.0, 0.35, 0.3, 0.95),
            () => this.hidePalette(),
            11,
            new vec3(0.8, 0.8, 1.5)
        );

        // =========================================================================
        // 2. TAB 1: WIRE CAD WORKFLOW (Active by Default)
        // =========================================================================
        this.tabWireRoot = global.scene.createSceneObject("TabWireRoot");
        this.tabWireRoot.setParent(this.drawerRoot);
        this.tabWireRoot.getTransform().setLocalPosition(new vec3(0, 0, 0));

        // Row 1 (y = 0.45): Hero Wire Actions (Draw Wire, Drop Node, Add Outlet)
        const btnMark = this.createPillButton(
            "BtnMark",
            this.tabWireRoot,
            new vec3(-2.20, 0.45, 1),
            " ✏️ DRAW WIRE ",
            new vec4(1.0, 0.85, 0.0, 1.0),
            new vec4(1.0, 0.75, 0.0, 0.95),
            () => this.toggleMarkLine(),
            12,
            new vec3(1.9, 1.0, 1.5)
        );
        this.textMarkLine = btnMark.label;

        const btnDrop = this.createPillButton(
            "BtnDropNode",
            this.tabWireRoot,
            new vec3(0.00, 0.45, 1),
            " ➕ DROP NODE ",
            new vec4(0.2, 1.0, 0.55, 1.0),
            new vec4(0.15, 0.9, 0.45, 0.95),
            () => this.triggerDropNode(),
            12,
            new vec3(1.9, 1.0, 1.5)
        );
        this.textDropNode = btnDrop.label;

        this.createPillButton(
            "BtnAddOutletWire",
            this.tabWireRoot,
            new vec3(2.20, 0.45, 1),
            " 🔌 + OUTLET ",
            new vec4(0.2, 1.0, 0.6, 1.0),
            new vec4(0.1, 0.9, 0.5, 0.95),
            () => this.triggerAddOutlet(),
            12,
            new vec3(1.9, 1.0, 1.5)
        );

        // Row 2 (y = -0.45): 5-Column Utility Grid (-2.80, -1.40, 0.00, +1.40, +2.80)
        this.createPillButton(
            "BtnUndo",
            this.tabWireRoot,
            new vec3(-2.80, -0.45, 1),
            " ↩ UNDO ",
            new vec4(1.0, 0.75, 0.2, 1.0),
            new vec4(1.0, 0.65, 0.1, 0.9),
            () => this.triggerUndoNode(),
            11,
            new vec3(1.2, 0.8, 1.5)
        );

        this.createPillButton(
            "BtnSave",
            this.tabWireRoot,
            new vec3(-1.40, -0.45, 1),
            " 💾 SAVE ",
            new vec4(0.2, 1.0, 0.6, 1.0),
            new vec4(0.1, 0.9, 0.5, 0.95),
            () => this.triggerSaveWiring(),
            11,
            new vec3(1.2, 0.8, 1.5)
        );

        const btnPush = this.createPillButton(
            "BtnPush",
            this.tabWireRoot,
            new vec3(0.00, -0.45, 1),
            " ⬆️ PUSH ",
            new vec4(0.0, 1.0, 0.9, 1.0),
            new vec4(0.0, 0.9, 0.85, 0.9),
            () => this.triggerPushBack(),
            11,
            new vec3(1.2, 0.8, 1.5)
        );
        this.textPushBack = btnPush.label;

        const btnDel = this.createPillButton(
            "BtnDel",
            this.tabWireRoot,
            new vec3(1.40, -0.45, 1),
            " 🗑️ DEL ",
            new vec4(1.0, 0.45, 0.35, 1.0),
            new vec4(1.0, 0.35, 0.25, 0.9),
            () => this.triggerDeleteRun(),
            11,
            new vec3(1.2, 0.8, 1.5)
        );
        this.textDeleteRun = btnDel.label;

        const btnClear = this.createPillButton(
            "BtnClear",
            this.tabWireRoot,
            new vec3(2.80, -0.45, 1),
            " 🧹 CLEAR ",
            new vec4(1.0, 0.45, 0.4, 1.0),
            new vec4(1.0, 0.35, 0.3, 0.9),
            () => this.triggerClearAll(),
            11,
            new vec3(1.2, 0.8, 1.5)
        );
        this.textClearAll = btnClear.label;

        // Row 3 (y = -1.15): Soft Copy JSON Export & Import + Toggle User Wires + Breaker Trip
        this.createPillButton(
            "BtnExportJson",
            this.tabWireRoot,
            new vec3(-2.25, -1.15, 1),
            " 📤 EXPORT ",
            new vec4(0.2, 0.95, 1.0, 1.0),
            new vec4(0.1, 0.85, 0.95, 0.95),
            () => this.triggerExportJson(),
            10,
            new vec3(1.10, 0.75, 1.5)
        );

        this.createPillButton(
            "BtnImportJson",
            this.tabWireRoot,
            new vec3(-1.05, -1.15, 1),
            " 📥 IMPORT ",
            new vec4(0.3, 1.0, 0.6, 1.0),
            new vec4(0.2, 0.9, 0.5, 0.95),
            () => this.triggerImportJson(),
            10,
            new vec3(1.10, 0.75, 1.5)
        );

        this.createPillButton(
            "BtnToggleUserWires",
            this.tabWireRoot,
            new vec3(0.45, -1.15, 1),
            " 👁️ WIRES [U] ",
            new vec4(1.0, 0.85, 0.2, 1.0),
            new vec4(0.9, 0.7, 0.1, 0.95),
            () => {
                if (this.onToggleUserWires) {
                    this.onToggleUserWires();
                }
            },
            10,
            new vec3(1.4, 0.75, 1.5)
        );

        this.createPillButton(
            "BtnTripBreakerWire",
            this.tabWireRoot,
            new vec3(2.15, -1.15, 1),
            " ⚡ TRIP [B] ",
            new vec4(1.0, 0.40, 0.30, 1.0),
            new vec4(0.9, 0.25, 0.20, 0.95),
            () => {
                if (this.onCycleBreakerTrip) {
                    this.onCycleBreakerTrip();
                }
            },
            10,
            new vec3(1.4, 0.75, 1.5)
        );

        // =========================================================================
        // 3. TAB 2: WALL FRAMING, RESIZE & POSITION (Zero Overlap)
        // =========================================================================
        this.tabWallRoot = global.scene.createSceneObject("TabWallRoot");
        this.tabWallRoot.setParent(this.drawerRoot);
        this.tabWallRoot.getTransform().setLocalPosition(new vec3(0, 0, 0));
        this.tabWallRoot.enabled = false;

        // Row 1 (y = 0.45): Wall Management & Interactive Resize View (-2.70, -0.90, +0.90, +2.70)
        const btnWallCycle = this.createPillButton(
            "BtnWallCycle",
            this.tabWallRoot,
            new vec3(-2.70, 0.45, 1),
            " W 1/1 ⟳ ",
            new vec4(0.3, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.75, 1.0, 0.95),
            () => this.triggerCycleActiveWall(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textWallCycle = btnWallCycle.label;

        this.createPillButton(
            "BtnAddWall",
            this.tabWallRoot,
            new vec3(-0.90, 0.45, 1),
            " + WALL ",
            new vec4(0.2, 1.0, 0.5, 1.0),
            new vec4(0.1, 0.9, 0.4, 0.95),
            () => this.triggerAddWall(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );

        this.createPillButton(
            "BtnDelWall",
            this.tabWallRoot,
            new vec3(0.90, 0.45, 1),
            " DEL WALL ",
            new vec4(1.0, 0.45, 0.35, 1.0),
            new vec4(1.0, 0.35, 0.25, 0.9),
            () => this.triggerDeleteWall(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );

        const btnToggleResize = this.createPillButton(
            "BtnToggleWallResize",
            this.tabWallRoot,
            new vec3(2.70, 0.45, 1),
            " ⤢ RESIZE ",
            new vec4(1.0, 0.85, 0.15, 1.0),
            new vec4(1.0, 0.75, 0.1, 0.95),
            () => this.triggerToggleWallEditMode(),
            11,
            new vec3(1.4, 0.8, 1.5)
        );
        this.textWallEditMode = btnToggleResize.label;

        // Row 2 (y = -0.45): Push/Pull Depth & Rotation & Sizing (-2.80, -1.40, 0.00, +1.40, +2.80)
        this.createPillButton(
            "BtnWallPush",
            this.tabWallRoot,
            new vec3(-2.80, -0.45, 1),
            " ⬆️ PUSH ",
            new vec4(0.0, 1.0, 0.85, 1.0),
            new vec4(0.0, 0.9, 0.75, 0.9),
            () => this.triggerPushWall(20.0),
            10,
            new vec3(1.2, 0.8, 1.5)
        );

        this.createPillButton(
            "BtnWallPull",
            this.tabWallRoot,
            new vec3(-1.40, -0.45, 1),
            " ⬇️ PULL ",
            new vec4(0.0, 1.0, 0.85, 1.0),
            new vec4(0.0, 0.9, 0.75, 0.9),
            () => this.triggerPushWall(-20.0),
            10,
            new vec3(1.2, 0.8, 1.5)
        );

        this.createPillButton(
            "BtnWallRotMinus",
            this.tabWallRoot,
            new vec3(0.00, -0.45, 1),
            " -1° ",
            new vec4(0.35, 1.0, 0.7, 1.0),
            new vec4(0.2, 0.85, 0.55, 0.9),
            () => this.triggerRotateWall(-1.0),
            10,
            new vec3(1.0, 0.8, 1.5)
        );

        const btnWallRot = this.createPillButton(
            "BtnWallRotPlus",
            this.tabWallRoot,
            new vec3(1.40, -0.45, 1),
            " +1° ⟳ ",
            new vec4(0.35, 1.0, 0.7, 1.0),
            new vec4(0.2, 0.85, 0.55, 0.9),
            () => this.triggerRotateWall(1.0),
            10,
            new vec3(1.1, 0.8, 1.5)
        );
        this.textWallRotate = btnWallRot.label;

        const btnWall = this.createPillButton(
            "BtnWallSize",
            this.tabWallRoot,
            new vec3(2.80, -0.45, 1),
            " 2.4m ⟳ ",
            new vec4(0.2, 0.95, 1.0, 1.0),
            new vec4(0.1, 0.85, 0.95, 0.95),
            () => this.triggerCycleWallSize(),
            10,
            new vec3(1.2, 0.8, 1.5)
        );
        this.textWallSize = btnWall.label;

        // =========================================================================
        // 4. TAB 3: ELECTRICAL SPECS, ROOMS & SAFETY (-2.70, -0.90, +0.90, +2.70)
        // =========================================================================
        this.tabSpecsRoot = global.scene.createSceneObject("TabSpecsRoot");
        this.tabSpecsRoot.setParent(this.drawerRoot);
        this.tabSpecsRoot.getTransform().setLocalPosition(new vec3(0, 0, 0));
        this.tabSpecsRoot.enabled = false;

        // Row 1 (y = 0.45): Circuit Properties
        const btnLayer = this.createPillButton(
            "BtnLayerCycle",
            this.tabSpecsRoot,
            new vec3(-2.70, 0.45, 1),
            " ⚡ ELEC ▾ ",
            new vec4(1.0, 0.9, 0.15, 1.0),
            new vec4(1.0, 0.8, 0.1, 0.95),
            () => this.cycleLayer(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textLayerCycle = btnLayer.label;
        this.textElectrical = btnLayer.label;

        const btnGauge = this.createPillButton(
            "BtnGauge",
            this.tabSpecsRoot,
            new vec3(-0.90, 0.45, 1),
            " 12 AWG ⟳ ",
            new vec4(0.2, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.8, 1.0, 0.95),
            () => this.cycleGauge(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textGaugeCycle = btnGauge.label;

        const btnLive = this.createPillButton(
            "BtnLive",
            this.tabSpecsRoot,
            new vec3(0.90, 0.45, 1),
            " LIVE ⟳ ",
            new vec4(1.0, 0.88, 0.15, 1.0),
            new vec4(1.0, 0.8, 0.1, 0.95),
            () => this.toggleWireLiveState(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textLiveState = btnLive.label;

        const btnWireSightSpecs = this.createPillButton(
            "BtnWireSightSpecs",
            this.tabSpecsRoot,
            new vec3(2.70, 0.45, 1),
            " 👁️ WIRESIGHT: ON ",
            new vec4(0.2, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.8, 1.0, 0.9),
            () => {
                if (this.onToggleWireSight) this.onToggleWireSight();
            },
            11,
            new vec3(1.5, 0.8, 1.5)
        );
        this.textWireSightSpecs = btnWireSightSpecs.label;

        // Row 2 (y = -0.45): Room Zones & Camera (-2.70, -0.90, +0.90, +2.70)
        const activeRoom = ROOM_PRESETS[this.currentActiveRoomIndex] || ROOM_PRESETS[1];
        const btnRoom = this.createPillButton(
            "BtnRoomAssign",
            this.tabSpecsRoot,
            new vec3(-2.70, -0.45, 1),
            ` ${activeRoom.id.toUpperCase()} ⟳ `,
            new vec4(1.0, 0.68, 0.2, 1.0),
            new vec4(1.0, 0.58, 0.15, 0.95),
            () => this.cycleActiveRoom(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textRoomAssign = btnRoom.label;

        const btnRoomFilter = this.createPillButton(
            "BtnRoomFilter",
            this.tabSpecsRoot,
            new vec3(-0.90, -0.45, 1),
            " ALL ▾ ",
            new vec4(0.4, 0.95, 0.65, 1.0),
            new vec4(0.3, 0.85, 0.55, 0.95),
            () => this.cycleRoomFilter(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textRoomFilter = btnRoomFilter.label;

        const btnAddOutlet = this.createPillButton(
            "BtnAddOutletSpecs",
            this.tabSpecsRoot,
            new vec3(0.90, -0.45, 1),
            " 🔌 + OUTLET ",
            new vec4(0.2, 1.0, 0.6, 1.0),
            new vec4(0.1, 0.9, 0.5, 0.95),
            () => this.triggerAddOutlet(),
            10,
            new vec3(1.3, 0.8, 1.5)
        );

        const btnCamera = this.createPillButton(
            "BtnCameraToggle",
            this.tabSpecsRoot,
            new vec3(2.70, -0.45, 1),
            " GLASSES ",
            new vec4(0.3, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.8, 1.0, 0.95),
            () => this.toggleCameraView(),
            11,
            new vec3(1.3, 0.8, 1.5)
        );
        this.textCameraToggle = btnCamera.label;

        // Row 3 (y = -0.95): Quick Room Teleports for Demo Recording
        this.createPillButton(
            "BtnTeleportBed",
            this.tabSpecsRoot,
            new vec3(-2.25, -0.95, 1),
            " 🛏️ BEDROOM [7] ",
            new vec4(0.3, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.80, 0.95, 0.95),
            () => {
                if (this.onTeleportRoom) this.onTeleportRoom(4);
            },
            10,
            new vec3(1.3, 0.75, 1.5)
        );

        this.createPillButton(
            "BtnTeleportElec",
            this.tabSpecsRoot,
            new vec3(-0.75, -0.95, 1),
            " ⚡ ELEC ROOM [6] ",
            new vec4(1.0, 0.85, 0.2, 1.0),
            new vec4(0.9, 0.70, 0.1, 0.95),
            () => {
                if (this.onTeleportRoom) this.onTeleportRoom(3);
            },
            10,
            new vec3(1.3, 0.75, 1.5)
        );

        this.createPillButton(
            "BtnTeleportLiving",
            this.tabSpecsRoot,
            new vec3(0.75, -0.95, 1),
            " 🛋️ LIVING [5] ",
            new vec4(0.4, 0.95, 0.65, 1.0),
            new vec4(0.3, 0.85, 0.55, 0.95),
            () => {
                if (this.onTeleportRoom) this.onTeleportRoom(2);
            },
            10,
            new vec3(1.3, 0.75, 1.5)
        );

        const btnCamPreset = this.createPillButton(
            "BtnCameraPreset",
            this.tabSpecsRoot,
            new vec3(2.25, -0.95, 1),
            " 45° ISO ",
            new vec4(0.9, 0.7, 1.0, 1.0),
            new vec4(0.7, 0.4, 0.95, 0.95),
            () => this.cycleCameraPreset(),
            10,
            new vec3(1.1, 0.75, 1.5)
        );
        this.textCameraPreset = btnCamPreset.label;
        this.btnCameraPresetObj = btnCamPreset.obj;
        this.btnCameraPresetObj.enabled = false;

        // =========================================================================
        // 5. STATUS BAR (y = -1.35) — Single Compact Line at Bottom of Pad
        // =========================================================================
        const statusObj = global.scene.createSceneObject("RearviewStatus");
        statusObj.setParent(this.drawerRoot);
        statusObj.getTransform().setLocalPosition(new vec3(0.0, -1.35, 1));
        this.textStatus = statusObj.createComponent("Component.Text") as Text;
        this.textStatus.text = "● CONDUIT-XR // 12 AWG • ENERGIZED 230V • READY";
        this.textStatus.size = 11;
        this.textStatus.horizontalAlignment = HorizontalAlignment.Center;
        this.textStatus.verticalAlignment = VerticalAlignment.Center;
        this.textStatus.textFill.color = new vec4(0.35, 0.95, 1.0, 1.0);
        this.textStatus.backgroundSettings.enabled = true;
        this.textStatus.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.10, 0.50);
        this.textStatus.backgroundSettings.cornerRadius = 0.45;
        this.textStatus.outlineSettings.enabled = true;
        this.textStatus.outlineSettings.fill.color = new vec4(0.2, 0.75, 1.0, 0.65);
        this.textStatus.outlineSettings.size = 0.10;

        // =========================================================================
        // 6. MINIMAL SUMMON PUCK (Always available in clean room mode)
        // =========================================================================
        this.collapsedRoot = global.scene.createSceneObject("CollapsedDock");
        this.collapsedRoot.setParent(this.paletteRoot);
        this.collapsedRoot.getTransform().setLocalPosition(new vec3(0, 0, 0));

        const btnExp = this.createPillButton(
            "BtnExpandDock",
            this.collapsedRoot,
            new vec3(-1.70, -2.0, 1),
            " 🛠️ TOOLS ▸ ",
            new vec4(0.3, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.75, 1.0, 0.95),
            () => this.summonInWorld(),
            16,
            new vec3(2.6, 1.2, 2)
        );
        this.textExpandBtn = btnExp.label;

        const btnWireSightPuck = this.createPillButton(
            "BtnWireSightPuck",
            this.collapsedRoot,
            new vec3(1.70, -2.0, 1),
            " 👁️ WIRESIGHT: ON ",
            new vec4(0.2, 0.95, 1.0, 1.0),
            new vec4(0.2, 0.8, 1.0, 0.95),
            () => {
                if (this.onToggleWireSight) this.onToggleWireSight();
            },
            16,
            new vec3(2.8, 1.2, 2)
        );
        this.textWireSightPuck = btnWireSightPuck.label;

        // Activate Tab 1 (Wire) by default
        this.switchTab("wire");

        // Initial view state: Clean room mode by default (unobstructed vision)
        this.setExpanded(false);
    }

    public switchTab(tab: "wire" | "wall" | "specs") {
        this.activeTab = tab;
        if (this.tabWireRoot) this.tabWireRoot.enabled = (tab === "wire");
        if (this.tabWallRoot) this.tabWallRoot.enabled = (tab === "wall");
        if (this.tabSpecsRoot) this.tabSpecsRoot.enabled = (tab === "specs");
        this.updateTabHighlights();

        if (tab === "wall" && !this.isWallEditActive) {
            this.triggerToggleWallEditMode();
        } else if (tab !== "wall" && this.isWallEditActive) {
            this.triggerToggleWallEditMode();
        }

        if (tab === "wire") {
            this.setStatusMessage("✏️ Wire CAD: Tap [DRAW WIRE] then [DROP NODE] on wall", new vec4(1.0, 0.85, 0.2, 1.0));
        } else if (tab === "wall") {
            this.setStatusMessage("🧱 Wall Framing: Pinch 4 corners to resize (opposite pinned), center to move", new vec4(0.35, 1.0, 0.7, 1.0));
        } else if (tab === "specs") {
            this.setStatusMessage("⚡ Specs & House: Tap [🔌 + OUTLET] to mount receptacle • [ROOM ⟳] to tour", new vec4(0.3, 0.95, 1.0, 1.0));
        }
    }

    public getActiveTab(): "wire" | "wall" | "specs" {
        return this.activeTab;
    }

    private updateTabHighlights() {
        const tabs = [
            { btn: this.btnTabWire, name: "wire" },
            { btn: this.btnTabWall, name: "wall" },
            { btn: this.btnTabSpecs, name: "specs" }
        ];

        for (const t of tabs) {
            if (!t.btn) continue;
            const isActive = (this.activeTab === t.name);
            if (isActive) {
                t.btn.label.textFill.color = new vec4(0.2, 1.0, 0.85, 1.0);
                t.btn.label.backgroundSettings.fill.color = new vec4(0.02, 0.14, 0.22, 0.85);
                t.btn.label.outlineSettings.fill.color = new vec4(0.2, 0.95, 1.0, 1.0);
                t.btn.label.outlineSettings.size = 0.22;
            } else {
                t.btn.label.textFill.color = new vec4(0.55, 0.70, 0.80, 0.75);
                t.btn.label.backgroundSettings.fill.color = new vec4(0.01, 0.03, 0.08, 0.50);
                t.btn.label.outlineSettings.fill.color = new vec4(0.2, 0.40, 0.55, 0.45);
                t.btn.label.outlineSettings.size = 0.12;
            }
        }
    }

    private createPillButton(
        name: string,
        parentObj: SceneObject,
        pos: vec3, 
        labelText: string, 
        textColor: vec4, 
        borderColor: vec4, 
        onClick: () => void,
        fontSize: number = 20,
        colliderSize: vec3 = new vec3(3.4, 1.8, 2)
    ): ButtonItem {
        const btnObj = global.scene.createSceneObject(name);
        btnObj.setParent(parentObj);
        btnObj.getTransform().setLocalPosition(pos);

        const textComp = btnObj.createComponent("Component.Text") as Text;
        textComp.text = labelText;
        textComp.size = fontSize;
        textComp.textFill.color = textColor;
        textComp.horizontalAlignment = HorizontalAlignment.Center;
        textComp.verticalAlignment = VerticalAlignment.Center;

        // 100% See-Through Default (Sleek dark frosted glass tint, high contrast)
        textComp.backgroundSettings.enabled = true;
        textComp.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.12, 0.55);
        textComp.backgroundSettings.cornerRadius = 0.45;

        // High-Contrast Luminous Neon Outline Border — visible in bright AR environments
        textComp.outlineSettings.enabled = true;
        textComp.outlineSettings.fill.color = borderColor;
        textComp.outlineSettings.size = 0.18;

        // Collider for raycast / depth hit
        const collider = btnObj.createComponent("Physics.ColliderComponent") as ColliderComponent;
        const box = Shape.createBoxShape();
        box.size = colliderSize;
        collider.shape = box;

        const item: ButtonItem = {
            name,
            obj: btnObj,
            label: textComp,
            baseColor: textColor,
            borderColor: borderColor,
            onClick
        };
        this.buttons.push(item);
        return item;
    }

    public setExpanded(expanded: boolean) {
        this.isExpanded = expanded;
        if (this.collapsedRoot) this.collapsedRoot.enabled = !expanded;
        if (this.drawerRoot) this.drawerRoot.enabled = expanded;
    }

    public toggleExpand(): boolean {
        this.setExpanded(!this.isExpanded);
        return this.isExpanded;
    }

    public getIsExpanded(): boolean {
        return this.isExpanded;
    }

    // Cycles between Electrical -> Plumbing -> All Layers
    public cycleLayer(): "electrical" | "plumbing" | "all" {
        if (this.layerMode === "electrical") {
            this.layerMode = "plumbing";
            this.isElectricalOn = false;
            this.isPlumbingOn = true;
            if (this.textLayerCycle) {
                this.textLayerCycle.text = " 💧 PLUMB ▾ ";
                this.textLayerCycle.textFill.color = new vec4(0.25, 0.85, 1.0, 1.0);
                this.textLayerCycle.outlineSettings.fill.color = new vec4(0.2, 0.8, 1.0, 0.95);
            }
        } else if (this.layerMode === "plumbing") {
            this.layerMode = "all";
            this.isElectricalOn = true;
            this.isPlumbingOn = true;
            if (this.textLayerCycle) {
                this.textLayerCycle.text = " 🔲 ALL ▾ ";
                this.textLayerCycle.textFill.color = new vec4(0.4, 1.0, 0.7, 1.0);
                this.textLayerCycle.outlineSettings.fill.color = new vec4(0.3, 1.0, 0.6, 0.95);
            }
        } else {
            this.layerMode = "electrical";
            this.isElectricalOn = true;
            this.isPlumbingOn = false;
            if (this.textLayerCycle) {
                this.textLayerCycle.text = " ⚡ ELEC ▾ ";
                this.textLayerCycle.textFill.color = new vec4(1.0, 0.9, 0.15, 1.0);
                this.textLayerCycle.outlineSettings.fill.color = new vec4(1.0, 0.8, 0.1, 0.95);
            }
        }

        print(`[ToolPalette] Switched layer mode to: ${this.layerMode}`);
        if (this.onCycleLayer) this.onCycleLayer(this.layerMode);
        if (this.onToggleElectrical) this.onToggleElectrical();
        if (this.onTogglePlumbing) this.onTogglePlumbing();
        return this.layerMode;
    }

    // Cycles Room Filter (ALL -> KITCHEN -> LIVING -> BEDROOM -> BATHROOM -> GARAGE -> PANEL)
    public cycleRoomFilter(): RoomPreset {
        this.currentRoomFilterIndex = (this.currentRoomFilterIndex + 1) % ROOM_PRESETS.length;
        const room = ROOM_PRESETS[this.currentRoomFilterIndex];

        if (this.textRoomFilter) {
            this.textRoomFilter.text = ` ${room.icon} ${room.id.toUpperCase()} ▾ `;
            if (room.id === "all") {
                this.textRoomFilter.textFill.color = new vec4(0.4, 0.95, 0.65, 1.0);
                this.textRoomFilter.outlineSettings.fill.color = new vec4(0.3, 0.85, 0.55, 0.95);
            } else {
                this.textRoomFilter.textFill.color = new vec4(1.0, 0.85, 0.25, 1.0);
                this.textRoomFilter.outlineSettings.fill.color = new vec4(1.0, 0.75, 0.15, 0.95);
            }
        }

        const msg = room.id === "all"
            ? "🏠 VIEW: ALL ROOMS visible"
            : `🏠 ISOLATED: ${room.name} circuits in focus`;
        this.setStatusMessage(msg, new vec4(0.4, 0.9, 1.0, 1.0));

        if (this.onCycleRoomFilter) this.onCycleRoomFilter(room);
        return room;
    }

    // Cycles the Active Drawing / Assignment Room (Kitchen -> Living -> Bedroom -> Bath -> Garage -> Panel)
    public cycleActiveRoom(): RoomPreset {
        // Skip index 0 ("all") because "all" is a filter, not an assignable room
        this.currentActiveRoomIndex = (this.currentActiveRoomIndex % (ROOM_PRESETS.length - 1)) + 1;
        const room = ROOM_PRESETS[this.currentActiveRoomIndex];

        if (this.textRoomAssign) {
            this.textRoomAssign.text = ` ${room.icon} ${room.id.toUpperCase()} ⟳ `;
        }
        this.setStatusMessage(`🏷️ Active Room: ${room.name}`, new vec4(1.0, 0.75, 0.2, 1.0));

        if (this.onAssignRoom) this.onAssignRoom(room);
        return room;
    }

    public getCurrentRoomFilter(): RoomPreset {
        return ROOM_PRESETS[this.currentRoomFilterIndex];
    }

    public getCurrentActiveRoom(): RoomPreset {
        return ROOM_PRESETS[this.currentActiveRoomIndex];
    }

    public getCurrentRoomZone(): string {
        return ROOM_PRESETS[this.currentActiveRoomIndex].name;
    }

    public updateCameraBtnText(text: string) {
        if (this.textCameraToggle) {
            this.textCameraToggle.text = ` ${text} ⟳ `;
        }
    }

    public updateCameraPresetText(text: string, isVisible: boolean) {
        if (this.btnCameraPresetObj) {
            this.btnCameraPresetObj.enabled = isVisible;
        }
        if (this.textCameraPreset) {
            this.textCameraPreset.text = ` 📐 ${text} ⟳ `;
        }
    }

    public toggleCameraView() {
        if (this.onToggleCameraView) this.onToggleCameraView();
    }

    public cycleCameraPreset() {
        if (this.onCycleCameraPreset) this.onCycleCameraPreset();
    }

    public triggerDropNode() {
        if (this.onDropNode) this.onDropNode();
    }

    public triggerStartCreateWall() {
        this.setExpanded(false);
        if (this.onStartCreateWall) this.onStartCreateWall();
    }

    public triggerCycleWallSize() {
        if (this.onCycleWallSize) this.onCycleWallSize();
    }

    public updateWallSizeText(presetName: string) {
        if (this.textWallSize) {
            const shortName = presetName.split(" ")[0];
            this.textWallSize.text = ` ${shortName} ⟳ `;
        }
    }

    public updateWallCycleText(activeIdx: number, totalCount: number) {
        if (this.textWallCycle) {
            this.textWallCycle.text = totalCount > 0 ? ` W ${activeIdx}/${totalCount} ⟳ ` : " NO WALL ";
        }
    }

    public triggerRotateWall(delta: number = 5.0) {
        if (this.onRotateWall) this.onRotateWall(delta);
    }

    public triggerWireEntireHouse() {
        if (this.onWireEntireHouse) this.onWireEntireHouse();
    }

    public triggerCycleActiveWall() {
        if (this.onCycleActiveWall) this.onCycleActiveWall();
    }

    public triggerAddWall() {
        if (this.onAddWall) this.onAddWall();
    }

    public triggerDeleteWall() {
        if (this.onDeleteWall) this.onDeleteWall();
    }

    public triggerToggleWallEditMode() {
        this.isWallEditActive = !this.isWallEditActive;
        if (this.textWallEditMode) {
            this.textWallEditMode.text = this.isWallEditActive ? " ● EDITING " : " ⤢ RESIZE ";
            this.textWallEditMode.textFill.color = this.isWallEditActive ? new vec4(0.2, 1.0, 0.6, 1.0) : new vec4(1.0, 0.85, 0.15, 1.0);
        }
        if (this.onToggleWallEditMode) this.onToggleWallEditMode();
    }

    public triggerPushWall(deltaCm: number) {
        if (this.onPushWall) this.onPushWall(deltaCm);
    }

    public updateWallInfo(activeIdx: number, totalCount: number, yawDeg: number, sizeName?: string) {
        if (this.textWallCycle) {
            this.textWallCycle.text = totalCount > 0 ? ` W ${activeIdx}/${totalCount} ⟳ ` : " NO WALL ";
        }
        if (this.textWallRotate) {
            this.textWallRotate.text = ` ${yawDeg}° ⟳ `;
        }
        if (this.textWallSize && sizeName) {
            const shortName = sizeName.split(" ")[0];
            this.textWallSize.text = ` ${shortName} ⟳ `;
        }
    }

    // Cycles wire gauges live (12 AWG -> 14 AWG -> 10 AWG -> 1/2" PEX)
    public cycleGauge(): WireGaugeDef {
        this.currentGaugeIndex = (this.currentGaugeIndex + 1) % WIRE_GAUGES.length;
        const gauge = WIRE_GAUGES[this.currentGaugeIndex];

        if (this.textGaugeCycle) {
            this.textGaugeCycle.text = ` 📐 ${gauge.label} ⟳ `;
        }
        this.setStatusMessage(`📐 Gauge set to: ${gauge.name}`, new vec4(0.2, 0.95, 1.0, 1.0));

        if (this.onCycleGauge) this.onCycleGauge(gauge);
        return gauge;
    }

    // Toggles between LIVE 230V and DE-ENERGIZED (SAFE/COLD)
    public toggleWireLiveState(): boolean {
        this.isWireLive = !this.isWireLive;
        if (this.textLiveState) {
            if (this.isWireLive) {
                this.textLiveState.text = " ⚡ LIVE ⟳ ";
                this.textLiveState.textFill.color = new vec4(1.0, 0.88, 0.15, 1.0);
                this.textLiveState.outlineSettings.fill.color = new vec4(1.0, 0.8, 0.1, 0.95);
                this.setStatusMessage("⚡ Status: ENERGIZED (Live 230V)", new vec4(1.0, 0.85, 0.2, 1.0));
            } else {
                this.textLiveState.text = " ○ COLD ⟳ ";
                this.textLiveState.textFill.color = new vec4(0.4, 0.75, 1.0, 0.9);
                this.textLiveState.outlineSettings.fill.color = new vec4(0.3, 0.65, 0.9, 0.85);
                this.setStatusMessage("○ Status: DE-ENERGIZED (Safe/Cold)", new vec4(0.4, 0.8, 1.0, 1.0));
            }
        }

        if (this.onToggleWireLiveState) this.onToggleWireLiveState(this.isWireLive);
        return this.isWireLive;
    }

    public getIsWireLive(): boolean {
        return this.isWireLive;
    }

    public getCurrentGauge(): WireGaugeDef {
        return WIRE_GAUGES[this.currentGaugeIndex];
    }

    public getLayerMode(): "electrical" | "plumbing" | "all" {
        return this.layerMode;
    }

    private registerTouchClicks() {
        this.createEvent("TouchStartEvent").bind((event: TouchStartEvent) => {
            const pos = event.getTouchPosition(); // Normalized (x: 0..1, y: 0..1)
            this.handleScreenClick(pos);
        });

        this.createEvent("TouchEndEvent").bind(() => {
            this.activeHoldBtn = null;
        });

        this.createEvent("UpdateEvent").bind(() => {
            if (this.activeHoldBtn) {
                const now = typeof getTime === "function" ? getTime() : Date.now() / 1000;
                const holdDur = now - this.holdStartTime;
                if (holdDur >= 0.18) { // After holding pinch for 180ms, rapid auto-repeat engages
                    const sinceTick = now - this.lastHoldTickTime;
                    if (sinceTick >= 0.04) { // Tick every 40ms (25 fps)
                        this.lastHoldTickTime = now;
                        // Smoothly accelerates: 2.5° -> 4.5° -> 8.0° per tick (up to 160°/sec)
                        const speed = holdDur > 1.2 ? 7.0 : (holdDur > 0.5 ? 4.0 : 2.5);
                        if (this.activeHoldBtn === "BtnWallRotPlus") {
                            this.triggerRotateWall(speed);
                        } else if (this.activeHoldBtn === "BtnWallRotMinus") {
                            this.triggerRotateWall(-speed);
                        }
                    }
                }
            }
        });
    }

    private isObjectActiveInHierarchy(obj: SceneObject | null): boolean {
        let curr = obj;
        while (curr) {
            if (!curr.enabled) return false;
            curr = curr.getParent();
        }
        return true;
    }

    // Mathematical 1:1 Pixel-Accurate Click Detection using Camera Screen-Space Projection
    public handleScreenClick(pos: vec2): boolean {
        if (!this.isExpanded) return false;
        if (this.camera) {
            let closestBtn: ButtonItem | null = null;
            let minDistance = 999;

            for (const btn of this.buttons) {
                // If button or any ancestor in hierarchy is disabled, skip hit test
                if (!this.isObjectActiveInHierarchy(btn.obj)) continue;

                const worldPos = btn.obj.getTransform().getWorldPosition();
                const screenPos = this.camera.worldSpaceToScreenSpace(worldPos);
                
                const dx = Math.abs(pos.x - screenPos.x);
                const dy = Math.abs(pos.y - screenPos.y);

                // Precision button hit tolerance: ~8.5% screen width, ~5.5% screen height
                if (dx <= 0.085 && dy <= 0.055) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestBtn = btn;
                    }
                }
            }

            if (closestBtn) {
                print(`[ToolPalette] Clicked button: ${closestBtn.name}`);
                closestBtn.onClick();
                if (closestBtn.name === "BtnWallRotPlus" || closestBtn.name === "BtnWallRotMinus") {
                    this.activeHoldBtn = closestBtn.name;
                    const now = typeof getTime === "function" ? getTime() : Date.now() / 1000;
                    this.holdStartTime = now;
                    this.lastHoldTickTime = now;
                }
                return true;
            }
        }
        return false;
    }

    public isClickOnToolbar(pos: vec2): boolean {
        if (!this.isExpanded) return false;
        if (this.camera) {
            for (const btn of this.buttons) {
                if (!this.isObjectActiveInHierarchy(btn.obj)) continue;

                const worldPos = btn.obj.getTransform().getWorldPosition();
                const screenPos = this.camera.worldSpaceToScreenSpace(worldPos);
                if (Math.abs(pos.x - screenPos.x) <= 0.085 && Math.abs(pos.y - screenPos.y) <= 0.055) {
                    return true;
                }
            }
        }
        return false;
    }

    public setStatusMessage(msg: string, color?: vec4) {
        if (this.textStatus) {
            this.textStatus.text = msg;
            if (color) this.textStatus.textFill.color = color;
        }
    }

    public toggleElectrical(): boolean {
        this.isElectricalOn = !this.isElectricalOn;
        if (this.onToggleElectrical) this.onToggleElectrical();
        return this.isElectricalOn;
    }

    public togglePlumbing(): boolean {
        this.isPlumbingOn = !this.isPlumbingOn;
        if (this.onTogglePlumbing) this.onTogglePlumbing();
        return this.isPlumbingOn;
    }

    public setWireSightState(isActive: boolean) {
        this.isWireSightOn = isActive;
        const labelText = isActive ? " 👁️ WIRESIGHT: ON " : " ○ WIRESIGHT: OFF ";
        const textColor = isActive ? new vec4(0.2, 0.95, 1.0, 1.0) : new vec4(0.65, 0.70, 0.75, 0.85);
        const outlineColor = isActive ? new vec4(0.2, 0.8, 1.0, 0.9) : new vec4(0.3, 0.35, 0.4, 0.5);

        if (this.textWireSightPuck) {
            this.textWireSightPuck.text = labelText;
            this.textWireSightPuck.textFill.color = textColor;
            if (this.textWireSightPuck.outlineSettings) {
                this.textWireSightPuck.outlineSettings.fill.color = outlineColor;
            }
        }
        if (this.textWireSightSpecs) {
            this.textWireSightSpecs.text = labelText;
            this.textWireSightSpecs.textFill.color = textColor;
            if (this.textWireSightSpecs.outlineSettings) {
                this.textWireSightSpecs.outlineSettings.fill.color = outlineColor;
            }
        }
    }

    public getIsWireSightOn(): boolean {
        return this.isWireSightOn;
    }

    public toggleDrill(): boolean {
        this.isDrillToolOn = !this.isDrillToolOn;
        if (this.textDrill) {
            this.textDrill.text = this.isDrillToolOn ? " 🛠️ DRILL: ON " : " ○ DRILL: OFF ";
            this.textDrill.textFill.color = this.isDrillToolOn 
                ? new vec4(0.25, 1.0, 0.45, 1.0) 
                : new vec4(0.5, 0.5, 0.55, 0.9);
            this.textDrill.outlineSettings.fill.color = this.isDrillToolOn
                ? new vec4(0.2, 1.0, 0.4, 0.9)
                : new vec4(0.3, 0.35, 0.4, 0.6);
        }
        if (this.onToggleDrill) this.onToggleDrill();
        return this.isDrillToolOn;
    }

    public toggleMarkLine(): boolean {
        this.isMarkingOn = !this.isMarkingOn;
        if (this.textMarkLine) {
            this.textMarkLine.text = this.isMarkingOn ? " ● DRAWING... " : " ✏️ DRAW WIRE ";
            this.textMarkLine.textFill.color = this.isMarkingOn 
                ? new vec4(0.2, 1.0, 0.5, 1.0) 
                : new vec4(1.0, 0.85, 0.0, 1.0);
            this.textMarkLine.outlineSettings.fill.color = this.isMarkingOn
                ? new vec4(0.2, 1.0, 0.5, 0.95)
                : new vec4(1.0, 0.75, 0.0, 0.9);
        }
        if (this.isMarkingOn) {
            // Auto-recede palette during active wire drawing so wall is 100% visible
            this.setExpanded(false);
            this.setStatusMessage("● DRAWING // Aim at wall & tap [➕ DROP NODE]", new vec4(0.2, 1.0, 0.5, 1.0));
        }
        if (this.onToggleMarkLine) this.onToggleMarkLine();
        return this.isMarkingOn;
    }

    public triggerPushBack() {
        if (this.onPushBack) this.onPushBack();
    }

    public triggerPullCloser() {
        if (this.onPullCloser) this.onPullCloser();
    }

    public triggerUndoNode() {
        if (this.onUndoNode) this.onUndoNode();
    }

    public triggerDeleteRun() {
        if (this.onDeleteRun) this.onDeleteRun();
    }

    public triggerSaveWiring() {
        if (this.onSaveWiring) this.onSaveWiring();
    }

    public triggerExportJson() {
        if (this.onExportJson) this.onExportJson();
    }

    public triggerImportJson() {
        if (this.onImportJson) this.onImportJson();
    }

    public triggerClearAll() {
        if (this.onClearAll) this.onClearAll();
    }

    public triggerAddOutlet(): boolean {
        if (this.onAddOutlet) this.onAddOutlet();
        return true;
    }

    public toggleMode(): boolean {
        if (this.onToggleMode) this.onToggleMode();
        return true;
    }

    public getIsElectricalOn(): boolean { return this.isElectricalOn; }
    public getIsPlumbingOn(): boolean { return this.isPlumbingOn; }
    public getIsDrillToolOn(): boolean { return this.isDrillToolOn; }
    public getIsMarkingOn(): boolean { return this.isMarkingOn; }
    public getIsCreateMode(): boolean { return true; }
}
