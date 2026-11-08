import { ConduitRun, INITIAL_CONDUIT_RUNS, RoomPreset, ROOM_PRESETS } from "./ConduitTypes";
import { RunInspectionCard } from "./RunInspectionCard";
import { DrillSafetyTool } from "./DrillSafetyTool";
import { ToolPaletteUI, WireGaugeDef } from "./ToolPaletteUI";
import { LineMarkerTool } from "./LineMarkerTool";
import { ReferenceWall } from "./ReferenceWall";
import { WallCreatorTool } from "./WallCreatorTool";
import { HouseEnvironment, HOUSE_ROOMS } from "./HouseEnvironment";

interface ActivePinchData {
    runId: string;
    target: "HANDLE_A" | "HANDLE_B" | "BODY";
    depth: number;
    startA?: vec3;
    startB?: vec3;
    startMid?: vec3;
}

interface ActiveWallPinchData {
    target: "RESIZE_TL" | "RESIZE_TR" | "RESIZE_BL" | "RESIZE_BR" | "MOVE" | "ROTATE";
    wall: ReferenceWall;
    startW: number;
    startH: number;
    startPos: vec3;
    startRot: quat;
    depth: number;
    touchStart: vec2;
    startLocalTouch?: vec2;
    startYaw?: number;
}

@component
export class ConduitXRMain extends BaseScriptComponent {
    // Sub-components
    private inspectionCard: RunInspectionCard | null = null;
    private drillSafetyTool: DrillSafetyTool | null = null;
    public toolPalette: ToolPaletteUI | null = null;
    private lineMarkerTool: LineMarkerTool | null = null;
    private referenceWall: ReferenceWall | null = null;
    private activeWalls: ReferenceWall[] = [];
    private activeWallIndex: number = 0;
    private wallCreatorTool: WallCreatorTool | null = null;
    private houseEnvironment: HouseEnvironment | null = null;

    // Visual SceneObjects
    private wallRoot: SceneObject | null = null;
    private worldRunsRoot: SceneObject | null = null;
    private electricalGroup: SceneObject | null = null;
    private plumbingGroup: SceneObject | null = null;
    private newOutletObject: SceneObject | null = null;

    // Dual-Camera System: Glasses POV (Camera 1) vs 3rd-Person Inspector (Camera 2)
    private glassesCameraObj: SceneObject | null = null;
    private glassesCamera: Camera | null = null;
    private inspectorCameraObj: SceneObject | null = null;
    private inspectorCamera: Camera | null = null;
    private activeCameraMode: "glasses" | "inspector" = "glasses";
    private inspectorPresetIndex: number = 0;
    private lastDragPos: vec2 | null = null;
    private orbitYaw: number = -0.55;
    private orbitPitch: number = 0.32;
    private orbitDist: number = 220.0;

    // Run registry
    private activeRuns: ConduitRun[] = [...INITIAL_CONDUIT_RUNS];
    private runVisualObjects: Map<string, SceneObject> = new Map();
    public isUserRunsVisible: boolean = false; // Disabled by default, preserved in storage
    private selectedRunId: string | null = null;
    private selectedRunIds: Set<string> = new Set();
    private activeRoomFilter: string = "all";

    // Active Pinch Dragging State (for expanding/retracting/moving wires)
    private activePinch: ActivePinchData | null = null;
    private isWallEditMode: boolean = false;
    private activeWallPinch: ActiveWallPinchData | null = null;

    // Soft Copy Inspector Slot
    @input
    public importJsonString: string = "";

    onAwake() {
        print("[WireSight] Initializing Spatial MEP & WireSight System...");
        this.buildExperience();
        this.wireEvents();
        this.registerSpatialPinchGestures();
        this.loadStateFromStorage();
        this.purgePrewiredHouseRuns();
        // Guaranteed Self-Healing: Foundation bedroom walls & 10 circuit runs are permanently maintained
        this.setupDefaultCornerWalls();
        this.setupDefaultBedroomCircuit();
        // Disable original reference walls & user runs by default so new 3D model & scenarios are cleanly shown
        for (const wall of this.activeWalls) {
            if (wall.getSceneObject()) {
                wall.getSceneObject().enabled = false;
            }
        }
        this.runVisualObjects.forEach((runObj, runId) => {
            if (runId.startsWith("run-")) {
                runObj.enabled = false;
            }
        });
        this.saveStateToStorage();
    }

    private findCamera(): SceneObject | null {
        if (this.glassesCameraObj) return this.glassesCameraObj;
        const rootCount = global.scene.getRootObjectsCount();
        for (let i = 0; i < rootCount; i++) {
            const obj = global.scene.getRootObject(i);
            if (obj.name.toLowerCase().includes("camera") && !obj.name.toLowerCase().includes("inspector")) {
                return obj;
            }
            for (let j = 0; j < obj.getChildrenCount(); j++) {
                const child = obj.getChild(j);
                if (child.name.toLowerCase().includes("camera") && !child.name.toLowerCase().includes("inspector")) {
                    return child;
                }
            }
        }
        return null;
    }

    private buildExperience() {
        // 1. Container for custom user-drawn conduits across ANY room
        this.worldRunsRoot = global.scene.createSceneObject("WorldRunsRoot");
        this.worldRunsRoot.getTransform().setWorldPosition(new vec3(0, 0, 0));

        this.electricalGroup = global.scene.createSceneObject("ElectricalLayer");
        this.electricalGroup.setParent(this.worldRunsRoot);

        this.plumbingGroup = global.scene.createSceneObject("PlumbingLayer");
        this.plumbingGroup.setParent(this.worldRunsRoot);

        // 2. Multi-Wall Architecture begins clean (no hardcoded default wall or demo runs)
        this.activeWalls = [];
        this.activeWallIndex = 0;
        this.referenceWall = null;
        this.wallRoot = null;
        this.activeRuns = [];

        // 3. Build Sub-Systems
        const cardObj = global.scene.createSceneObject("InspectionCardAnchor");
        this.inspectionCard = cardObj.createComponent(RunInspectionCard.getTypeName()) as RunInspectionCard;

        const drillObj = global.scene.createSceneObject("DrillToolAnchor");
        this.drillSafetyTool = drillObj.createComponent(DrillSafetyTool.getTypeName()) as DrillSafetyTool;
        drillObj.enabled = false; // Disabled by default to remove intrusive warning

        const paletteObj = global.scene.createSceneObject("ToolPaletteAnchor");
        this.toolPalette = paletteObj.createComponent(ToolPaletteUI.getTypeName()) as ToolPaletteUI;

        const markerObj = global.scene.createSceneObject("LineMarkerAnchor");
        this.lineMarkerTool = markerObj.createComponent(LineMarkerTool.getTypeName()) as LineMarkerTool;

        const creatorObj = global.scene.createSceneObject("WallCreatorAnchor");
        this.wallCreatorTool = creatorObj.createComponent(WallCreatorTool.getTypeName()) as WallCreatorTool;

        // Find Camera & Bind
        const camObj = this.findCamera();
        if (camObj) {
            this.glassesCameraObj = camObj;
            let dt = camObj.getComponent("Component.DeviceTracking") as DeviceTracking;
            if (!dt) {
                try {
                    dt = camObj.createComponent("Component.DeviceTracking") as DeviceTracking;
                    print("[WireSight] Created Component.DeviceTracking on Camera Object!");
                } catch (e) {
                    print("[WireSight] Note: DeviceTracking create: " + e);
                }
            }
            if (dt && typeof dt.requestDeviceTrackingMode === "function") {
                dt.requestDeviceTrackingMode(DeviceTrackingMode.World);
                print("[WireSight] DeviceTracking set to World mode!");
            }

            const camComp = camObj.getComponent("Component.Camera") as Camera;
            if (camComp) {
                this.glassesCamera = camComp;
                if (this.toolPalette) {
                    this.toolPalette.setCamera(camComp);
                }
                if (this.lineMarkerTool) {
                    this.lineMarkerTool.setCamera(camComp);
                    if (dt) {
                        this.lineMarkerTool.setDeviceTracking(dt);
                    }
                    if (this.toolPalette) {
                        (this.toolPalette as any).__parentGetActiveRuns = () => this.activeRuns;
                        (this.toolPalette as any).__onUndoSegment = (runId: string) => this.deleteRunById(runId);
                        this.lineMarkerTool.setToolPalette(this.toolPalette);
                    }
                }
                if (this.wallCreatorTool) {
                    this.wallCreatorTool.setCamera(camComp);
                    if (this.toolPalette) {
                        this.wallCreatorTool.setToolPalette(this.toolPalette);
                    }
                }
            }

            // Create Camera 2: 3rd-Person Inspector Camera (Moveable in Scene View or Orbit in Preview)
            this.setupInspectorCamera();
        }

        // 3b. Initialize HouseEnvironment for architectural boundary grid and floor badges
        const houseObj = global.scene.createSceneObject("HouseEnvironmentRoot");
        this.houseEnvironment = houseObj.createComponent(HouseEnvironment.getTypeName()) as HouseEnvironment;

        // 4. Build Foundation Master Bedroom Corner Walls (Wall #1 Headboard & Wall #2 TV Corner)
        this.setupDefaultCornerWalls();

        // 5. Build Breaker Panel Hub (anchored flush to Wall #1)
        this.buildBreakerPanel();

        // 6. Summon Tool Palette floating comfortably in world space in front of the user
        if (this.toolPalette) {
            this.toolPalette.summonInWorld();
        }
    }

    private setupInspectorCamera() {
        this.inspectorCameraObj = global.scene.createSceneObject("InspectorCamera");
        this.inspectorCamera = this.inspectorCameraObj.createComponent("Component.Camera") as Camera;

        if (this.glassesCamera) {
            this.inspectorCamera.renderTarget = this.glassesCamera.renderTarget;
            this.inspectorCamera.near = this.glassesCamera.near || 1.0;
            this.inspectorCamera.far = this.glassesCamera.far || 2500.0;
            // Lens Studio camera FOV is in radians (0, PI)
            this.inspectorCamera.fov = this.glassesCamera.fov || ((65.0 * Math.PI) / 180.0);
        }

        this.inspectorCamera.enabled = false;
        this.applyInspectorPreset("iso");
        print("[WireSight] Camera 2 (InspectorCamera) created! Can move in Scene panel or orbit in Preview.");
    }

    public switchCameraView(): string {
        if (!this.glassesCamera || !this.inspectorCamera) return this.activeCameraMode;

        this.activeCameraMode = (this.activeCameraMode === "glasses") ? "inspector" : "glasses";
        const isGlasses = (this.activeCameraMode === "glasses");

        this.glassesCamera.enabled = isGlasses;
        this.inspectorCamera.enabled = !isGlasses;

        const activeCamComp = isGlasses ? this.glassesCamera : this.inspectorCamera;
        const activeCamObj = isGlasses ? this.glassesCameraObj! : this.inspectorCameraObj!;

        if (this.lineMarkerTool) {
            this.lineMarkerTool.setViewerCamera(activeCamComp);
        }
        if (this.wallCreatorTool) {
            this.wallCreatorTool.setCamera(activeCamComp);
        }
        if (this.toolPalette) {
            this.toolPalette.setCamera(activeCamComp);
            this.toolPalette.updateCameraBtnText(isGlasses ? "🎥 GLASSES" : "🎥 3RD POV");
            this.toolPalette.updateCameraPresetText(this.getPresetLabel(), !isGlasses);

            const msg = isGlasses
                ? "🎥 Glasses POV (First Person)"
                : `🎥 3rd-Person Inspector [${this.getPresetLabel()}]`;
            this.toolPalette.setStatusMessage(msg, new vec4(0.3, 0.95, 1.0, 1.0));
        }

        print(`[WireSight] Active Camera switched to: ${this.activeCameraMode.toUpperCase()}`);
        return this.activeCameraMode;
    }

    public cycleInspectorPreset(): string {
        const PRESETS: ("iso" | "side" | "top" | "orbit")[] = ["iso", "side", "top", "orbit"];
        this.inspectorPresetIndex = (this.inspectorPresetIndex + 1) % PRESETS.length;
        const p = PRESETS[this.inspectorPresetIndex];
        this.applyInspectorPreset(p);

        if (this.toolPalette) {
            this.toolPalette.updateCameraPresetText(this.getPresetLabel(), true);
            this.toolPalette.setStatusMessage(`📐 Inspector Camera: ${this.getPresetLabel()}`, new vec4(0.3, 0.95, 1.0, 1.0));
        }
        return p;
    }

    private getPresetLabel(): string {
        const LABELS = ["45° ISO", "SIDE", "TOP-DOWN", "ORBIT"];
        return LABELS[this.inspectorPresetIndex] || "45° ISO";
    }

    private applyInspectorPreset(preset: "iso" | "side" | "top" | "orbit") {
        if (!this.inspectorCameraObj) return;

        let pos = new vec3(-115, 85, -70);
        let target = new vec3(0, 0, -200);

        if (preset === "side") {
            // Perpendicular to line of sight — directly reveals depth from glasses to wall!
            pos = new vec3(-190, 15, -100);
            target = new vec3(0, 15, -100);
            this.orbitYaw = -Math.PI / 2;
            this.orbitPitch = 0.05;
        } else if (preset === "top") {
            // Straight down from ceiling — blueprint layout
            pos = new vec3(0, 220, -100);
            target = new vec3(0, 0, -100);
            this.orbitYaw = 0;
            this.orbitPitch = 1.25;
        } else if (preset === "orbit") {
            pos = new vec3(115, 85, -70);
            target = new vec3(0, 0, -200);
            this.orbitYaw = 0.55;
            this.orbitPitch = 0.32;
        } else {
            // iso (default 45-degree elevated view)
            pos = new vec3(-115, 85, -70);
            target = new vec3(0, 0, -200);
            this.orbitYaw = -0.55;
            this.orbitPitch = 0.32;
        }

        this.orbitDist = pos.distance(target);
        this.inspectorCameraObj.getTransform().setWorldPosition(pos);
        const forward = target.sub(pos).normalize();
        const up = (preset === "top") ? new vec3(0, 0, -1) : new vec3(0, 1, 0);
        this.inspectorCameraObj.getTransform().setWorldRotation(quat.lookAt(forward, up));
    }

    public getActiveCamera(): Camera | null {
        return (this.activeCameraMode === "inspector" && this.inspectorCamera)
            ? this.inspectorCamera
            : this.glassesCamera;
    }

    public getGlassesCamera(): Camera | null { return this.glassesCamera; }
    public getInspectorCamera(): Camera | null { return this.inspectorCamera; }
    public getActiveCameraMode(): string { return this.activeCameraMode; }

    // ── Main Service Breaker Panel Hub ──────────────────────────────────
    private breakerPanelRoot: SceneObject | null = null;
    private breakerBranches: {
        num: number;
        label: string;
        room: string;
        x: number;
        y: number;
        amperage: number;
        isOn: boolean;
        textComp?: Text;
    }[] = [
        { num: 0, label: "MAIN 200A SERVICE DISCONNECT", room: "all", x: 0, y: 15, amperage: 200, isOn: true },
        { num: 1, label: "B1: 20A Master Bed Outlets", room: "bedroom", x: -14, y: 5, amperage: 20, isOn: true },
        { num: 2, label: "B2: 15A Living Room TV", room: "living", x: 14, y: 5, amperage: 15, isOn: true },
        { num: 3, label: "B3: 15A Living Room Sofa", room: "sofa", x: -14, y: -5, amperage: 15, isOn: true },
        { num: 4, label: "B4: 30A Utility & Battery Hub", room: "utility", x: 14, y: -5, amperage: 30, isOn: true }
    ];

    private buildBreakerPanel() {
        if (!this.breakerPanelRoot) {
            this.breakerPanelRoot = global.scene.createSceneObject("MainBreakerPanel");

            // Panel Enclosure Header
            const headerObj = global.scene.createSceneObject("PanelHeader");
            headerObj.setParent(this.breakerPanelRoot);
            headerObj.getTransform().setLocalPosition(new vec3(0, 24, 0));
            const headText = headerObj.createComponent("Component.Text") as Text;
            headText.text = " ⚡ LOAD CENTER: 200A MAIN SERVICE PANEL ";
            headText.size = 32;
            headText.textFill.color = new vec4(0.3, 0.95, 1.0, 1.0);
            headText.backgroundSettings.enabled = true;
            headText.backgroundSettings.fill.color = new vec4(0.02, 0.05, 0.12, 0.50);
            headText.backgroundSettings.cornerRadius = 0.4;
            headText.outlineSettings.enabled = true;
            headText.outlineSettings.fill.color = new vec4(0.2, 0.75, 1.0, 0.9);
            headText.outlineSettings.size = 0.14;

            for (const b of this.breakerBranches) {
                const bObj = global.scene.createSceneObject(`Breaker_${b.num}`);
                bObj.setParent(this.breakerPanelRoot);
                bObj.getTransform().setLocalPosition(new vec3(b.x, b.y, 0));
                const bText = bObj.createComponent("Component.Text") as Text;
                bText.text = ` [■ ON] ${b.label} `;
                bText.size = b.num === 0 ? 24 : 20;
                bText.textFill.color = b.num === 0 ? new vec4(1.0, 0.4, 0.4, 0.95) : new vec4(0.3, 1.0, 0.6, 0.95);
                bText.backgroundSettings.enabled = true;
                bText.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.10, 0.45);
                bText.backgroundSettings.cornerRadius = 0.35;
                bText.outlineSettings.enabled = true;
                bText.outlineSettings.fill.color = b.num === 0 ? new vec4(0.9, 0.2, 0.2, 0.85) : new vec4(0.25, 0.85, 0.5, 0.85);
                bText.outlineSettings.size = 0.12;

                b.textComp = bText;

                const collider = bObj.createComponent("Physics.ColliderComponent") as ColliderComponent;
                const box = Shape.createBoxShape();
                box.size = new vec3(26, 4.5, 4);
                collider.shape = box;
            }
        }
        this.alignBreakerPanelToActiveWall();
    }

    public alignBreakerPanelToActiveWall() {
        if (!this.breakerPanelRoot) return;
        // Check if scenario house runs are active -> Anchor directly to 200A panel inside Electrical Room
        const hasHouseModel = this.activeRuns.some(r => r.id.startsWith("scen1-") || r.id.startsWith("scen2-") || r.id.startsWith("scen3-"));
        if (hasHouseModel) {
            this.breakerPanelRoot.getTransform().setWorldPosition(new vec3(380.0, 140.0, -200.0));
            this.breakerPanelRoot.getTransform().setWorldRotation(quat.fromEulerAngles(0, 0, 0));
            return;
        }

        // When whole house environment is wired (multiple walls exist), breaker panel stays anchored to utility wall
        const utilityWall = this.activeWalls.find(w => w.wallId === "wall-utility");
        const wall = (this.activeWalls.length > 1 && utilityWall) ? utilityWall : this.getActiveWall();
        if (!wall) return;
        const wPos = wall.getSceneObject().getTransform().getWorldPosition();
        const halfW = wall.widthCm * 0.5;
        const rad = (wall.getWallYaw() * Math.PI) / 180.0;
        const right = new vec3(Math.cos(rad), 0, -Math.sin(rad));
        const fwd = new vec3(Math.sin(rad), 0, Math.cos(rad));
        // Flush on wall, mounted near upper-left boundary (+4cm drywall offset)
        const panelPos = wPos.add(right.uniformScale(-halfW + 35)).add(new vec3(0, 15, 0)).add(fwd.uniformScale(4.0));
        this.breakerPanelRoot.getTransform().setWorldPosition(panelPos);
        this.breakerPanelRoot.getTransform().setWorldRotation(quat.fromEulerAngles(0, rad, 0));
    }

    public toggleBreaker(num: number): boolean {
        const b = this.breakerBranches.find(item => item.num === num);
        if (!b) return false;

        b.isOn = !b.isOn;

        if (b.textComp) {
            b.textComp.text = b.isOn ? ` [■ ON] ${b.label} ` : ` [○ OFF] ${b.label} (TRIPPED) `;
            b.textComp.textFill.color = b.isOn
                ? (b.num === 0 ? new vec4(1.0, 0.4, 0.4, 0.95) : new vec4(0.3, 1.0, 0.6, 0.95))
                : new vec4(1.0, 0.35, 0.3, 0.95);
            if (b.textComp.outlineSettings) {
                b.textComp.outlineSettings.fill.color = b.isOn
                    ? (b.num === 0 ? new vec4(0.9, 0.2, 0.2, 0.85) : new vec4(0.25, 0.85, 0.5, 0.85))
                    : new vec4(0.9, 0.2, 0.2, 0.9);
            }
        }

        // Check if Main 200A Breaker (B0) is ON
        const mainBreaker = this.breakerBranches.find(item => item.num === 0);
        const isMainOn = mainBreaker ? mainBreaker.isOn : true;

        // Apply state to all runs belonging to this room zone
        let affectedCount = 0;
        for (const run of this.activeRuns) {
            const isTargetRoom = (b.num === 0) || (run.roomZone && run.roomZone.toLowerCase().includes(b.room.toLowerCase()));
            if (isTargetRoom) {
                const branchBreaker = this.breakerBranches.find(br => br.room !== "all" && run.roomZone && run.roomZone.toLowerCase().includes(br.room.toLowerCase()));
                const isBranchOn = branchBreaker ? branchBreaker.isOn : true;
                const shouldBeLive = isMainOn && isBranchOn;

                run.isLive = shouldBeLive;
                run.status = shouldBeLive ? "LIVE 120V AC (ENERGIZED)" : "DE-ENERGIZED (SAFE / COLD)";
                run.color = shouldBeLive ? new vec4(1.0, 0.85, 0.1, 1.0) : new vec4(0.4, 0.65, 0.85, 0.9);
                const gaugeLabel = run.gauge || "12 AWG";
                run.voltageOrType = shouldBeLive ? `Live 120V (${gaugeLabel})` : `De-Energized (${gaugeLabel})`;
                this.updateRunVisualPositions(run);
                affectedCount++;
            }
        }

        if (this.toolPalette) {
            const stateText = b.isOn ? "RESET: Circuits LIVE 120V ⚡" : "TRIPPED: Circuits DE-ENERGIZED (0V / SAFE) ❄️";
            const col = b.isOn ? new vec4(0.3, 1.0, 0.6, 1.0) : new vec4(1.0, 0.4, 0.3, 1.0);
            this.toolPalette.setStatusMessage(`⚡ ${b.label} ${stateText} [${affectedCount} circuit(s)]`, col);
        }
        this.updateSafetyCheck();
        return b.isOn;
    }

    private lastDemoBreakerIndex: number = 0;

    // Cycles through tripping and resetting individual room breakers: B1 (Bed) -> B2 (TV) -> B3 (Sofa) -> B0 (Main)
    public cycleBreakerTripDemo(): void {
        const order = [1, 2, 3, 0];
        const targetNum = order[this.lastDemoBreakerIndex % order.length];
        this.lastDemoBreakerIndex++;
        this.toggleBreaker(targetNum);
    }

    // Toggles visibility of the user's original 32 wires (preserved in memory & storage, hidden by default)
    public toggleUserRunsVisibility(): boolean {
        this.isUserRunsVisible = !this.isUserRunsVisible;
        const count = this.activeRuns.filter(r => r.id.startsWith("run-")).length;
        this.runVisualObjects.forEach((runObj, runId) => {
            if (runId.startsWith("run-")) {
                runObj.enabled = this.isUserRunsVisible;
            }
        });
        if (this.toolPalette) {
            const msg = this.isUserRunsVisible
                ? `👁️ Original Wires: VISIBLE (${count} runs preserved & shown)`
                : `👁️ Original Wires: DISABLED (${count} runs safely preserved, hidden from view)`;
            const col = this.isUserRunsVisible ? new vec4(0.3, 1.0, 0.6, 1.0) : new vec4(1.0, 0.75, 0.2, 1.0);
            this.toolPalette.setStatusMessage(msg, col);
        }
        return this.isUserRunsVisible;
    }

    public isWireSightActive: boolean = true;

    // Toggles between Real-World Room View (wires & studs hidden) and WireSight X-Ray (conduits & framing revealed)
    public toggleWireSightMode(): boolean {
        this.isWireSightActive = !this.isWireSightActive;
        // Keep worldRunsRoot enabled so physical wall outlets remain visible in real-world view
        if (this.worldRunsRoot) {
            this.worldRunsRoot.enabled = true;
        }
        if (this.runVisualObjects) {
            this.runVisualObjects.forEach((runObj, runId) => {
                if (runObj) {
                    const run = this.activeRuns.find(r => r.id === runId);
                    const isOutletRun = run && (run.id.indexOf("outlet") !== -1 || run.name.indexOf("Outlet") !== -1);
                    // Physical outlet fixtures stay visible on drywall even in Real-World View; internal wiring toggles
                    runObj.enabled = this.isWireSightActive || !!isOutletRun;
                    if (isOutletRun) {
                        const jboxA = this.findChildByName(runObj, "JBoxA");
                        const spec = this.findChildByName(runObj, "ConduitSpecLabel");
                        if (jboxA) jboxA.enabled = this.isWireSightActive;
                        if (spec) spec.enabled = this.isWireSightActive;
                        const jboxB = this.findChildByName(runObj, "JBoxB");
                        if (jboxB) jboxB.enabled = true; // Physical outlet faceplate stays mounted
                    }
                }
            });
        }
        for (const wall of this.activeWalls) {
            wall.setFramingVisible(this.isWireSightActive);
        }
        if (this.houseEnvironment) {
            this.houseEnvironment.setXRayMode(this.isWireSightActive);
        }
        if (this.inspectionCard && !this.isWireSightActive) {
            this.inspectionCard.hide();
        }
        if (this.toolPalette) {
            this.toolPalette.setWireSightState(this.isWireSightActive);
            this.toolPalette.setStatusMessage(
                this.isWireSightActive
                    ? "✨ WireSight X-Ray ON: Concealed Conduit & Framing Revealed!"
                    : "🏠 Real-World Room View: Concealed Wiring Hidden (Outlets Physical)",
                this.isWireSightActive ? new vec4(0.2, 0.95, 1.0, 1.0) : new vec4(0.85, 0.85, 0.9, 1.0)
            );
        }
        return this.isWireSightActive;
    }

    // Checks if an endpoint connects with another wire (degree >= 2 = Junction Box)
    public isJunctionPoint(pt: vec3, currentRunId: string): boolean {
        for (const run of this.activeRuns) {
            if (run.id === currentRunId) continue;
            if (run.startPoint.distance(pt) <= 14.0 || run.endPoint.distance(pt) <= 14.0) {
                return true;
            }
        }
        return false;
    }

    private hasExistingJBoxVisualAt(pt: vec3, excludeRunId: string): boolean {
        for (const run of this.activeRuns) {
            if (run.id === excludeRunId) continue;
            if (run.startPoint.distance(pt) <= 12.0 || run.endPoint.distance(pt) <= 12.0) {
                return true;
            }
        }
        return false;
    }

    // Determines if a 3D point is an electrical outlet receptacle or a ceiling luminaire fixture
    public isOutletPoint(p: vec3): { isOutlet: boolean; run: ConduitRun | null; isCeilingFixture: boolean } {
        for (const run of this.activeRuns) {
            if (run.endPoint.distance(p) <= 8.0) {
                if (run.id.includes("ceiling-fixture") || run.name.toLowerCase().includes("luminaire")) {
                    return { isOutlet: false, run, isCeilingFixture: true };
                }
                // Only mark as an outlet if explicitly created via Add Outlet Tap-In
                if (run.id.indexOf("outlet") !== -1 || run.name.indexOf("Outlet") !== -1) {
                    return { isOutlet: true, run, isCeilingFixture: false };
                }
            }
        }
        return { isOutlet: false, run: null, isCeilingFixture: false };
    }

    // Finds closest reference wall for surface-normal orientation of outlet faceplates
    public getWallForPoint(p: vec3): ReferenceWall | null {
        let bestWall: ReferenceWall | null = null;
        let bestDist = 999.0;
        for (const wall of this.activeWalls) {
            const proj = wall.projectPointToWall(p);
            const dist = proj.distance(p);
            if (dist < bestDist && dist < 50.0) {
                bestDist = dist;
                bestWall = wall;
            }
        }
        return bestWall || (this.activeWalls.length > 0 ? this.activeWalls[0] : null);
    }

    // Formats 3D node badges: Distinct Duplex Outlet faceplate, Ceiling Luminaire, J-Box, or Grip Handle
    private applyNodeVisualText(textComp: Text, pt: vec3, run: ConduitRun, isJunc: boolean, isStart: boolean) {
        const outletInfo = this.isOutletPoint(pt);

        if (outletInfo.isCeilingFixture) {
            textComp.text = " 💡 CEILING FIXTURE ";
            textComp.size = 50;
            textComp.textFill.color = new vec4(1.0, 0.95, 0.35, 1.0);
            textComp.backgroundSettings.enabled = true;
            textComp.backgroundSettings.fill.color = new vec4(0.08, 0.08, 0.18, 0.88);
            textComp.backgroundSettings.cornerRadius = 0.45;
            textComp.outlineSettings.enabled = true;
            textComp.outlineSettings.fill.color = new vec4(1.0, 0.85, 0.20, 1.0);
            textComp.outlineSettings.size = 0.18;
            textComp.enabled = true;
            return;
        }

        if (outletInfo.isOutlet) {
            textComp.text = " 🔌 120V OUTLET [⚇] ";
            textComp.size = 52;
            textComp.textFill.color = new vec4(0.08, 0.10, 0.16, 1.0); // High-contrast dark plug slots
            textComp.backgroundSettings.enabled = true;
            textComp.backgroundSettings.fill.color = new vec4(0.96, 0.95, 0.90, 0.96); // Ivory faceplate
            textComp.backgroundSettings.cornerRadius = 0.45;
            textComp.outlineSettings.enabled = true;
            textComp.outlineSettings.fill.color = new vec4(1.0, 0.85, 0.20, 1.0); // Gold electrical trim
            textComp.outlineSettings.size = 0.20;
            textComp.enabled = true;
            return;
        }

        if (isJunc) {
            textComp.text = " ⬢ J-BOX ";
            textComp.size = 48;
            textComp.textFill.color = new vec4(1.0, 0.75, 0.2, 1.0);
            textComp.backgroundSettings.enabled = true;
            textComp.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.10, 0.25);
            textComp.backgroundSettings.cornerRadius = 0.5;
            textComp.outlineSettings.enabled = true;
            textComp.outlineSettings.fill.color = new vec4(1.0, 0.65, 0.1, 0.95);
            textComp.outlineSettings.size = 0.14;
            return;
        }

        textComp.text = isStart ? " ◉ GRIP A " : " ◉ GRIP B ";
        textComp.size = 54;
        textComp.textFill.color = run.color;
        textComp.backgroundSettings.enabled = true;
        textComp.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.10, 0.25);
        textComp.backgroundSettings.cornerRadius = 0.5;
        textComp.outlineSettings.enabled = true;
        textComp.outlineSettings.fill.color = run.color;
        textComp.outlineSettings.size = 0.14;
        textComp.enabled = true;
    }

    // Creates 3D conduits with interactive grip handles on both ends
    private createRunVisual(run: ConduitRun, isWorldCoords: boolean = true) {
        const parentGroup = isWorldCoords ? this.worldRunsRoot : this.electricalGroup;
        if (!parentGroup) return;

        const runObj = global.scene.createSceneObject(`Run_${run.id}`);
        runObj.setParent(parentGroup);
        if (run.id.startsWith("run-") && !this.isUserRunsVisible) {
            runObj.enabled = false;
        }

        const mid = run.startPoint.add(run.endPoint).uniformScale(0.5);
        if (isWorldCoords) {
            runObj.getTransform().setWorldPosition(mid);
        } else {
            runObj.getTransform().setLocalPosition(mid);
        }

        // 1. Grip Handle A (at start point)
        const jboxA = global.scene.createSceneObject("JBoxA");
        jboxA.setParent(runObj);
        if (isWorldCoords) {
            jboxA.getTransform().setWorldPosition(run.startPoint);
        } else {
            jboxA.getTransform().setLocalPosition(run.startPoint.sub(mid));
        }
        const isJuncA = this.isJunctionPoint(run.startPoint, run.id);
        const textA = jboxA.createComponent("Component.Text") as Text;
        this.applyNodeVisualText(textA, run.startPoint, run, isJuncA, true);
        if (isJuncA && this.hasExistingJBoxVisualAt(run.startPoint, run.id)) {
            textA.enabled = false;
        }

        // 2. Grip Handle B (at end point)
        const jboxB = global.scene.createSceneObject("JBoxB");
        jboxB.setParent(runObj);
        if (isWorldCoords) {
            jboxB.getTransform().setWorldPosition(run.endPoint);
        } else {
            jboxB.getTransform().setLocalPosition(run.endPoint.sub(mid));
        }
        const isJuncB = this.isJunctionPoint(run.endPoint, run.id);
        const textB = jboxB.createComponent("Component.Text") as Text;
        this.applyNodeVisualText(textB, run.endPoint, run, isJuncB, false);
        if (isJuncB && this.hasExistingJBoxVisualAt(run.endPoint, run.id)) {
            textB.enabled = false;
        }

        // 3. Floating Spec Label centered on conduit
        const labelObj = global.scene.createSceneObject("ConduitSpecLabel");
        labelObj.setParent(runObj);
        labelObj.getTransform().setLocalPosition(new vec3(0, 10, 0));
        const labelText = labelObj.createComponent("Component.Text") as Text;
        const lenCm = run.startPoint.distance(run.endPoint);
        const statusIcon = run.isLive !== false ? "⚡" : "○";
        const gaugeLabel = run.gauge || "12 AWG";
        const liveLabel = run.isLive !== false ? "LIVE" : "COLD";
        const roomTag = run.roomZone ? `[${run.roomZone}] ` : "";
        labelText.text = ` ${statusIcon} ${roomTag}${run.name} • ${gaugeLabel} • ${liveLabel} (${lenCm.toFixed(0)}cm) `;
        labelText.size = 46;
        labelText.textFill.color = new vec4(1.0, 1.0, 1.0, 0.98);
        labelText.backgroundSettings.enabled = true;
        labelText.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.10, 0.25);
        labelText.backgroundSettings.cornerRadius = 0.45;
        labelText.outlineSettings.enabled = true;
        labelText.outlineSettings.fill.color = new vec4(0.3, 0.85, 1.0, 0.85);
        labelText.outlineSettings.size = 0.12;

        // 4. Box Collider for selection & inspection
        const collider = runObj.createComponent("Physics.ColliderComponent") as ColliderComponent;
        const box = Shape.createBoxShape();
        box.size = new vec3(
            Math.max(25, Math.abs(run.endPoint.x - run.startPoint.x) + 16),
            Math.max(20, Math.abs(run.endPoint.y - run.startPoint.y) + 16),
            16
        );
        collider.shape = box;

        this.runVisualObjects.set(run.id, runObj);
    }

    private updateRunVisualPositions(run: ConduitRun) {
        const runObj = this.runVisualObjects.get(run.id);
        if (!runObj) return;

        const mid = run.startPoint.add(run.endPoint).uniformScale(0.5);
        runObj.getTransform().setWorldPosition(mid);

        const isJuncA = this.isJunctionPoint(run.startPoint, run.id);
        const jboxA = this.findChildByName(runObj, "JBoxA");
        if (jboxA) {
            jboxA.getTransform().setWorldPosition(run.startPoint);
            const textA = jboxA.getComponent("Component.Text") as Text;
            if (textA) {
                this.applyNodeVisualText(textA, run.startPoint, run, isJuncA, true);
            }
        }

        const isJuncB = this.isJunctionPoint(run.endPoint, run.id);
        const jboxB = this.findChildByName(runObj, "JBoxB");
        if (jboxB) {
            jboxB.getTransform().setWorldPosition(run.endPoint);
            const textB = jboxB.getComponent("Component.Text") as Text;
            if (textB) {
                this.applyNodeVisualText(textB, run.endPoint, run, isJuncB, false);
            }
        }

        const specLabel = this.findChildByName(runObj, "ConduitSpecLabel");
        if (specLabel) {
            const labelText = specLabel.getComponent("Component.Text") as Text;
            const lenCm = run.startPoint.distance(run.endPoint);
            const statusIcon = run.isLive !== false ? "⚡" : "○";
            const gaugeLabel = run.gauge || "12 AWG";
            const liveLabel = run.isLive !== false ? "LIVE" : "COLD";
            const roomTag = run.roomZone ? `[${run.roomZone}] ` : "";
            if (labelText) {
                labelText.text = ` ${statusIcon} ${roomTag}${run.name} • ${gaugeLabel} • ${liveLabel} (${lenCm.toFixed(0)}cm) `;
            }
        }
    }

    private findChildByName(parent: SceneObject, name: string): SceneObject | null {
        for (let i = 0; i < parent.getChildrenCount(); i++) {
            const c = parent.getChild(i);
            if (c.name === name) return c;
        }
        return null;
    }

    public refreshAllJunctions() {
        const seenLocations: vec3[] = [];
        for (const run of this.activeRuns) {
            const visualObj = this.runVisualObjects.get(run.id);
            if (!visualObj) continue;

            const jboxA = this.findChildByName(visualObj, "JBoxA");
            const jboxB = this.findChildByName(visualObj, "JBoxB");

            const isJuncA = this.isJunctionPoint(run.startPoint, run.id);
            const isJuncB = this.isJunctionPoint(run.endPoint, run.id);

            if (jboxA) {
                const textA = jboxA.getComponent("Component.Text") as Text;
                if (textA) {
                    const alreadyShown = seenLocations.some(p => p.distance(run.startPoint) <= 12.0);
                    this.applyNodeVisualText(textA, run.startPoint, run, isJuncA, true);
                    if (isJuncA && alreadyShown) {
                        textA.enabled = false;
                    } else if (isJuncA) {
                        seenLocations.push(run.startPoint);
                    }
                }
            }

            if (jboxB) {
                const textB = jboxB.getComponent("Component.Text") as Text;
                if (textB) {
                    const alreadyShown = seenLocations.some(p => p.distance(run.endPoint) <= 12.0);
                    this.applyNodeVisualText(textB, run.endPoint, run, isJuncB, false);
                    if (isJuncB && alreadyShown) {
                        textB.enabled = false;
                    } else if (isJuncB) {
                        seenLocations.push(run.endPoint);
                    }
                }
            }
        }
    }

    private wireEvents() {
        if (!this.toolPalette) return;

        // 1. Layer Cycling (Electrical -> Plumbing -> All)
        this.toolPalette.onCycleLayer = (mode: "electrical" | "plumbing" | "all") => {
            if (mode === "electrical") {
                if (this.electricalGroup) this.electricalGroup.enabled = true;
                if (this.plumbingGroup) this.plumbingGroup.enabled = false;
            } else if (mode === "plumbing") {
                if (this.electricalGroup) this.electricalGroup.enabled = false;
                if (this.plumbingGroup) this.plumbingGroup.enabled = true;
            } else {
                if (this.electricalGroup) this.electricalGroup.enabled = true;
                if (this.plumbingGroup) this.plumbingGroup.enabled = true;
            }
            this.updateSafetyCheck();
        };

        // 2. Wire Gauge Cycling (12 AWG -> 14 AWG -> 10 AWG -> 1/2" PEX)
        this.toolPalette.onCycleGauge = (gauge: WireGaugeDef) => {
            this.applyGaugeToActiveRun(gauge);
        };

        // 2b. Room Isolation Filter (ALL -> KITCHEN -> LIVING -> BEDROOM -> BATHROOM -> GARAGE -> PANEL)
        this.toolPalette.onCycleRoomFilter = (room: RoomPreset) => {
            this.activeRoomFilter = room.id;
            this.applyRoomFilter();
            this.updateSafetyCheck();
        };

        // 2c. Room Assignment to selected / connected wires & camera teleportation
        this.toolPalette.onAssignRoom = (room: RoomPreset) => {
            this.assignRoomToSelection(room);
            const roomMap: { [key: string]: number } = {
                "kitchen": 1,
                "living": 2,
                "utility": 3,
                "panel": 3,
                "garage": 3,
                "bedroom": 4,
                "bathroom": 3
            };
            const targetRoomIdx = roomMap[room.id.toLowerCase()];
            if (targetRoomIdx !== undefined) {
                this.teleportToRoom(targetRoomIdx);
            }
        };

        // 2d. Wire Entire House (1-Click Whole-House MEP Architectural Population)
        this.toolPalette.onWireEntireHouse = () => {
            this.wireEntireHouse(true);
        };

        // 3. Live / De-Energized State Switcher
        this.toolPalette.onToggleWireLiveState = (isLive: boolean) => {
            this.applyLiveStateToActiveRun(isLive);
        };

        // Legacy individual toggles
        this.toolPalette.onToggleElectrical = () => {
            const on = this.toolPalette!.getIsElectricalOn();
            if (this.electricalGroup) this.electricalGroup.enabled = on;
            this.updateSafetyCheck();
        };

        this.toolPalette.onTogglePlumbing = () => {
            const on = this.toolPalette!.getIsPlumbingOn();
            if (this.plumbingGroup) this.plumbingGroup.enabled = on;
            this.updateSafetyCheck();
        };

        // WireSight Toggle (Click on-screen pill or press 'h')
        this.toolPalette.onToggleWireSight = () => {
            this.toggleWireSightMode();
        };

        // 2. Drill Tool Toggle
        this.toolPalette.onToggleDrill = () => {
            const on = this.toolPalette!.getIsDrillToolOn();
            if (this.drillSafetyTool) {
                this.drillSafetyTool.getSceneObject().enabled = on;
            }
        };

        // 3. Mark Line Tool Toggle
        this.toolPalette.onToggleMarkLine = () => {
            if (this.lineMarkerTool) {
                const isActive = this.lineMarkerTool.toggleMarkingMode();
                if (isActive) {
                    const depthM = (this.lineMarkerTool.getDepth() / 100).toFixed(1);
                    this.toolPalette!.setStatusMessage(`✏️ MARKING (${depthM}m) • Tap Point A on wall`, new vec4(1.0, 0.85, 0.1, 1.0));
                } else {
                    this.toolPalette!.setStatusMessage("READY • Pinch wire handles to stretch/retract", new vec4(0.8, 0.9, 0.95, 0.9));
                }
            }
        };

        // When a new conduit is marked by user clicks in world space
        if (this.lineMarkerTool) {
            this.lineMarkerTool.onConduitMarked = (newRun: ConduitRun) => {
                this.activeRuns.push(newRun);
                this.selectedRunId = newRun.id;
                this.createRunVisual(newRun, true);
                this.refreshAllJunctions();
                this.inspectRun(newRun);
                this.updateSafetyCheck();
                this.saveStateToStorage();
                this.toolPalette!.setStatusMessage(`✓ MARKED: ${newRun.name}! Pinch handles to stretch, or tap [⬆️ PUSH]`, new vec4(0.2, 1.0, 0.5, 1.0));
            };
        }

        // 3b. Save & Export Wiring
        this.toolPalette.onSaveWiring = () => {
            this.saveAndExportWiring();
        };

        // 3c. Soft Copy JSON Export & Import + Toggle User Wires
        this.toolPalette.onExportJson = () => {
            this.exportWiringJson();
        };

        this.toolPalette.onImportJson = () => {
            this.importWiringJson();
        };

        this.toolPalette.onToggleUserWires = () => {
            this.toggleUserRunsVisibility();
        };

        // 4. Remote Sofa Push Back (+30 cm)
        this.toolPalette.onPushBack = () => {
            this.pushActiveConduit(30.0);
        };

        // 5. Remote Sofa Pull Closer (-30 cm)
        this.toolPalette.onPullCloser = () => {
            this.pushActiveConduit(-30.0);
        };

        // 6. Delete Run (Delete selected or last marked conduit)
        this.toolPalette.onDeleteRun = () => {
            this.deleteLastRun();
        };

        // 6b. Undo Node (Undo in-progress polyline node or remove last segment)
        this.toolPalette.onUndoNode = () => {
            if (this.lineMarkerTool && this.lineMarkerTool.getIsMarkingActive()) {
                const undid = this.lineMarkerTool.undoLastNode();
                if (!undid) {
                    this.deleteLastRun();
                }
            } else {
                this.deleteLastRun();
            }
        };

        // 7. Clear All Runs (Clean blank canvas)
        this.toolPalette.onClearAll = () => {
            this.clearAllRuns();
        };

        // 7b. Dock Tool Palette to Wall
        this.toolPalette.onDockToWall = () => {
            const wall = this.getActiveWall();
            if (wall && this.toolPalette) {
                const dock = wall.getWallDockPosition();
                this.toolPalette.dockToWall(dock.pos, dock.rot);
            }
        };

        // 7c. Instant 1-Click Wall Resizer (Single-Mouse Friendly)
        this.toolPalette.onCycleWallSize = () => {
            this.cycleActiveWallSize();
        };

        // 7c2. Wall Rotation (Any Degree Increment: 1°, 5°, 23°, etc.)
        this.toolPalette.onRotateWall = (delta: number) => {
            this.rotateActiveWall(delta !== undefined ? delta : 5.0);
        };

        // 7c3. Multi-Wall Cycle Selection (Wall 1 <-> Wall 2)
        this.toolPalette.onCycleActiveWall = () => {
            this.cycleActiveWall();
        };

        // 7c4. Add New Wall (Corner / Multi-Wall)
        this.toolPalette.onAddWall = () => {
            this.addNewWall();
        };

        // 7c5. Delete Active Wall
        this.toolPalette.onDeleteWall = () => {
            this.deleteActiveWall();
        };

        // 7c6. Custom Wall Creator Tool
        this.toolPalette.onStartCreateWall = () => {
            if (this.wallCreatorTool) {
                this.wallCreatorTool.startWallCreation();
            }
        };

        if (this.wallCreatorTool) {
            this.wallCreatorTool.onWallCreated = (w: number, h: number, center: vec3) => {
                this.alignBreakerPanelToActiveWall();
                this.updateMultiWallUI();
                if (this.toolPalette) {
                    const studCount = Math.floor(w / 40.64) + 1;
                    this.toolPalette.setStatusMessage(
                        `✓ Wall Created: ${w.toFixed(0)}x${h.toFixed(0)}cm (${studCount} Studs)`,
                        new vec4(0.2, 1.0, 0.5, 1.0)
                    );
                }
            };
        }

        // 7d. Keyboard Shortcuts in Preview:
        // Space / M = Summon / Hide Palette
        // W = Start / Cancel 2-Pinch Wall Creator
        // S = Cycle Wall Size Preset (Instant 1-Click Resize)
        // R = Rotate Active Wall 45°
        // N = Add New Wall (Corner / Partition)
        // Tab = Cycle Active Wall
        // X = Delete Active Wall
        // Delete = Delete Wire Run
        // D = Cycle Wall Distance (Push Closer / Farther)
        try {
            this.createEvent("KeyPressEvent").bind((event: KeyPressEvent) => {
                const keyStr = event.key !== undefined ? String(event.key) : "";
                const k = keyStr.toLowerCase();
                const isShift = (event as any).shiftKey === true || keyStr === "W";
                if (k === "space" || k === " " || k === "m" || (typeof Keys !== "undefined" && (event.key as any) === (Keys as any).Space)) {
                    if (this.toolPalette) {
                        if (this.toolPalette.getIsExpanded()) {
                            this.toolPalette.hidePalette();
                        } else {
                            this.toolPalette.summonInWorld();
                        }
                    }
                } else if (k === "o") {
                    this.addOutletTapIn();
                } else if (k === "w") {
                    if (this.wallCreatorTool) {
                        if (this.wallCreatorTool.getIsActive()) {
                            this.wallCreatorTool.cancelWallCreation();
                        } else {
                            this.wallCreatorTool.startWallCreation();
                        }
                    }
                } else if (k === "s") {
                    this.cycleActiveWallSize();
                } else if (k === "arrowup" || k === "up") {
                    this.pushActiveWallDepth(20.0); // Push wall deeper into room
                } else if (k === "arrowdown" || k === "down") {
                    this.pushActiveWallDepth(-20.0); // Pull wall closer
                } else if (k === "r") {
                    // Quick 5° step rotation (or -5° with Shift)
                    this.rotateActiveWall(5.0);
                } else if (k === "]" || k === "." || k === "e") {
                    // Fine +1° nudge (dial in exact angles like 23°)
                    this.rotateActiveWall(1.0);
                } else if (k === "[" || k === "," || k === "q") {
                    // Fine -1° nudge
                    this.rotateActiveWall(-1.0);
                } else if (k === "}" || k === ">") {
                    // +5° step
                    this.rotateActiveWall(5.0);
                } else if (k === "{" || k === "<") {
                    // -5° step
                    this.rotateActiveWall(-5.0);
                } else if (k === "n") {
                    this.addNewWall();
                } else if (k === "1") {
                    if (this.toolPalette) this.toolPalette.switchTab("wire");
                } else if (k === "2") {
                    if (this.toolPalette) this.toolPalette.switchTab("wall");
                } else if (k === "3") {
                    if (this.toolPalette) this.toolPalette.switchTab("specs");
                } else if (k === "4") {
                    this.teleportToRoom(1); // Kitchen
                } else if (k === "5") {
                    this.teleportToRoom(2); // Living Room
                } else if (k === "6") {
                    this.teleportToRoom(3); // Utility Room & Breaker Panel
                } else if (k === "7") {
                    this.teleportToRoom(4); // Master Bedroom
                } else if (k === "8") {
                    this.teleportToRoom(5); // 45° Bird's Eye Overview
                } else if (k === "9" || k === "0") {
                    this.teleportToRoom(0); // Central Hallway
                } else if (k === "h") {
                    this.toggleWireSightMode();
                } else if (k === "tab") {
                    this.cycleActiveWall();
                } else if (k === "x") {
                    this.deleteActiveWall();
                } else if (k === "delete") {
                    this.deleteLastRun();
                } else if (k === "v") {
                    this.saveAndExportWiring();
                } else if (k === "e") {
                    this.exportWiringJson();
                } else if (k === "i") {
                    this.importWiringJson();
                } else if (k === "u") {
                    this.toggleUserRunsVisibility();
                } else if (k === "b") {
                    this.cycleBreakerTripDemo();
                } else if (k === "d") {
                    const wall = this.getActiveWall();
                    if (wall && this.toolPalette) {
                        const camPos = this.glassesCamera
                            ? this.glassesCamera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 1.0)
                            : new vec3(0, 0, 0);
                        const dist = wall.cycleWallDistance(camPos);
                        this.alignBreakerPanelToActiveWall();
                        this.toolPalette.setStatusMessage(`⇕ Wall Distance: ${(dist / 100).toFixed(1)}m`, new vec4(0.2, 0.95, 1.0, 1.0));
                    }
                }
            });
        } catch (e) {
            // KeyPressEvent may be preview-only
        }

        // 8. Add Outlet (Tap-In Splice)
        this.toolPalette.onAddOutlet = () => {
            this.addOutletTapIn();
        };

        // 9. Camera View Toggle (Glasses POV <-> 3rd-Person Inspector)
        this.toolPalette.onToggleCameraView = () => {
            this.switchCameraView();
        };

        // 10. Camera Preset Cycle (ISO -> SIDE -> TOP -> ORBIT)
        this.toolPalette.onCycleCameraPreset = () => {
            this.cycleInspectorPreset();
        };

        // 11. Drop Node at Center Gaze Reticle
        this.toolPalette.onDropNode = () => {
            if (this.lineMarkerTool) {
                this.lineMarkerTool.dropNodeAtGaze();
            }
        };

        // 12. Toggle Wall Edit View (Pinch Handles for Resize & Move)
        this.toolPalette.onToggleWallEditMode = () => {
            this.isWallEditMode = !this.isWallEditMode;
            const wall = this.getActiveWall();
            if (wall) {
                wall.setEditHandlesVisible(this.isWallEditMode);
            }
            if (this.isWallEditMode && this.toolPalette) {
                this.toolPalette.setStatusMessage("⤢ WALL EDIT VIEW: Pinch corners to resize, center to move, or tap [PUSH]/[PULL]", new vec4(0.2, 1.0, 0.6, 1.0));
            } else if (this.toolPalette) {
                this.toolPalette.setStatusMessage("✓ Wall Edit View Closed", new vec4(0.4, 0.8, 1.0, 0.9));
            }
        };

        // 13. Push / Pull Wall Depth in Room
        this.toolPalette.onPushWall = (deltaCm: number) => {
            this.pushActiveWallDepth(deltaCm);
        };

        // Initialize HUD with Wall 1 metadata
        this.updateMultiWallUI();

        // Render loop for 3D world line rendering and real-time drill proximity
        this.createEvent("UpdateEvent").bind(() => {
            this.renderConduitLinesDebug();
            this.updateSafetyCheck();
            this.billboardLabelsToCamera();
        });
    }

    // Pushes active wall deeper into room (+deltaCm) or pulls closer (-deltaCm) independently without affecting conduits
    public pushActiveWallDepth(deltaCm: number): number {
        const wall = this.getActiveWall();
        if (!wall) return 0;

        const newZ = wall.pushWallDepth(deltaCm);

        this.alignBreakerPanelToActiveWall();

        if (this.toolPalette) {
            const tag = deltaCm > 0 ? "PUSHED DEEPER" : "PULLED CLOSER";
            const pos = wall.getSceneObject().getTransform().getWorldPosition();
            this.toolPalette.setStatusMessage(`🧱 WALL #${wall.wallIndex} ${tag}: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})cm`, new vec4(0.2, 1.0, 0.7, 1.0));
        }

        this.saveStateToStorage();
        return newZ;
    }

    private billboardLabelsToCamera() {
        const camObj = this.getActiveCamera();
        if (!camObj) return;
        const camRot = camObj.getSceneObject().getTransform().getWorldRotation();

        for (const run of this.activeRuns) {
            const runObj = this.runVisualObjects.get(run.id);
            if (runObj && runObj.enabled) {
                const jboxB = this.findChildByName(runObj, "JBoxB");
                if (jboxB && jboxB.enabled) jboxB.getTransform().setWorldRotation(camRot);
                if (this.isWireSightActive) {
                    const jboxA = this.findChildByName(runObj, "JBoxA");
                    const spec = this.findChildByName(runObj, "ConduitSpecLabel");
                    if (jboxA) jboxA.getTransform().setWorldRotation(camRot);
                    if (spec) spec.getTransform().setWorldRotation(camRot);
                }
            }
        }
    }

    // Spectacles Pinch & Drag Gestures: expand, retract, or move wire handles in real-time
    private registerSpatialPinchGestures() {
        // 1. PINCH START
        this.createEvent("TouchStartEvent").bind((event: TouchStartEvent) => {
            const pos = event.getTouchPosition();
            this.lastDragPos = pos;

            // If click hits the bottom toolbar, the toolbar handles it
            if (this.toolPalette && this.toolPalette.isClickOnToolbar(pos)) {
                return;
            }

            // If in line marking mode, LineMarkerTool handles point drops
            if (this.lineMarkerTool && this.lineMarkerTool.getIsMarkingActive()) {
                return;
            }

            const camObj = this.findCamera();
            if (!camObj) return;
            const camComp = camObj.getComponent("Component.Camera") as Camera;
            if (!camComp) return;
            const camPos = camObj.getTransform().getWorldPosition();

            // Check if user tapped a Breaker on the Main Service Breaker Panel
            if (this.breakerPanelRoot) {
                const panelPos = this.breakerPanelRoot.getTransform().getWorldPosition();
                for (const b of this.breakerBranches) {
                    const bWorld = new vec3(panelPos.x, panelPos.y + b.y, panelPos.z);
                    const screenPt = camComp.worldSpaceToScreenSpace(bWorld);
                    const dist = Math.sqrt((pos.x - screenPt.x) ** 2 + (pos.y - screenPt.y) ** 2);
                    if (dist <= 0.08) {
                        this.toggleBreaker(b.num);
                        return;
                    }
                }
            }

            // Check if user pinched a Wall Edit Handle (Any of 4 Corners or Center Move)
            const activeWall = this.getActiveWall();
            if (activeWall && activeWall.isEditHandlesVisible()) {
                const handles = activeWall.getEditHandleWorldPositions();
                const screenTL = camComp.worldSpaceToScreenSpace(handles.resizeTL);
                const screenTR = camComp.worldSpaceToScreenSpace(handles.resizeTR);
                const screenBL = camComp.worldSpaceToScreenSpace(handles.resizeBL);
                const screenBR = camComp.worldSpaceToScreenSpace(handles.resizeBR);
                const screenC = camComp.worldSpaceToScreenSpace(handles.center);
                const screenRot = camComp.worldSpaceToScreenSpace(handles.rotateTop);

                const distTL = Math.sqrt((pos.x - screenTL.x) ** 2 + (pos.y - screenTL.y) ** 2);
                const distTR = Math.sqrt((pos.x - screenTR.x) ** 2 + (pos.y - screenTR.y) ** 2);
                const distBL = Math.sqrt((pos.x - screenBL.x) ** 2 + (pos.y - screenBL.y) ** 2);
                const distBR = Math.sqrt((pos.x - screenBR.x) ** 2 + (pos.y - screenBR.y) ** 2);
                const distC = Math.sqrt((pos.x - screenC.x) ** 2 + (pos.y - screenC.y) ** 2);
                const distRot = Math.sqrt((pos.x - screenRot.x) ** 2 + (pos.y - screenRot.y) ** 2);

                const wTrans = activeWall.getSceneObject().getTransform();
                const startPos = wTrans.getWorldPosition();
                const startRot = wTrans.getWorldRotation();

                // Compute initial ray intersection point in local wall plane coordinates
                let startLocalTouch = new vec2(0, 0);
                const rayOrigin = camComp.screenSpaceToWorldSpace(pos, 1.0);
                const rayFar = camComp.screenSpaceToWorldSpace(pos, 100.0);
                const rayDir = rayFar.sub(rayOrigin).normalize();
                const wallNormal = startRot.multiplyVec3(new vec3(0, 0, 1.0));
                const denom = rayDir.dot(wallNormal);
                if (Math.abs(denom) > 0.0001) {
                    const diff = startPos.sub(rayOrigin);
                    const t = diff.dot(wallNormal) / denom;
                    const worldHit = rayOrigin.add(rayDir.uniformScale(t));
                    const invRot = startRot.invert();
                    const localHit = invRot.multiplyVec3(worldHit.sub(startPos));
                    startLocalTouch = new vec2(localHit.x, localHit.y);
                }

                const PINCH_THRESH = 0.12;

                if (distTL <= PINCH_THRESH) {
                    this.activeWallPinch = {
                        target: "RESIZE_TL",
                        wall: activeWall,
                        startW: activeWall.widthCm,
                        startH: activeWall.heightCm,
                        startPos: startPos,
                        startRot: startRot,
                        depth: handles.resizeTL.distance(camPos),
                        touchStart: pos,
                        startLocalTouch: startLocalTouch
                    };
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`⤢ PINCHED TOP-LEFT: Drag to resize! (Bottom-Right fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                    return;
                }

                if (distTR <= PINCH_THRESH) {
                    this.activeWallPinch = {
                        target: "RESIZE_TR",
                        wall: activeWall,
                        startW: activeWall.widthCm,
                        startH: activeWall.heightCm,
                        startPos: startPos,
                        startRot: startRot,
                        depth: handles.resizeTR.distance(camPos),
                        touchStart: pos,
                        startLocalTouch: startLocalTouch
                    };
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`⤢ PINCHED TOP-RIGHT: Drag to resize! (Bottom-Left fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                    return;
                }

                if (distBL <= PINCH_THRESH) {
                    this.activeWallPinch = {
                        target: "RESIZE_BL",
                        wall: activeWall,
                        startW: activeWall.widthCm,
                        startH: activeWall.heightCm,
                        startPos: startPos,
                        startRot: startRot,
                        depth: handles.resizeBL.distance(camPos),
                        touchStart: pos,
                        startLocalTouch: startLocalTouch
                    };
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`⤢ PINCHED BOTTOM-LEFT: Drag to resize! (Top-Right fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                    return;
                }

                if (distBR <= PINCH_THRESH) {
                    this.activeWallPinch = {
                        target: "RESIZE_BR",
                        wall: activeWall,
                        startW: activeWall.widthCm,
                        startH: activeWall.heightCm,
                        startPos: startPos,
                        startRot: startRot,
                        depth: handles.resizeBR.distance(camPos),
                        touchStart: pos,
                        startLocalTouch: startLocalTouch
                    };
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`⤢ PINCHED BOTTOM-RIGHT: Drag to resize! (Top-Left fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                    return;
                }

                if (distC <= PINCH_THRESH) {
                    this.activeWallPinch = {
                        target: "MOVE",
                        wall: activeWall,
                        startW: activeWall.widthCm,
                        startH: activeWall.heightCm,
                        startPos: startPos,
                        startRot: startRot,
                        depth: handles.center.distance(camPos),
                        touchStart: pos,
                        startLocalTouch: startLocalTouch
                    };
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`✥ PINCHED [MOVE WALL]: Drag to reposition wall in room!`, new vec4(0.3, 1.0, 0.6, 1.0));
                    }
                    return;
                }

                if (distRot <= PINCH_THRESH) {
                    this.activeWallPinch = {
                        target: "ROTATE",
                        wall: activeWall,
                        startW: activeWall.widthCm,
                        startH: activeWall.heightCm,
                        startPos: startPos,
                        startRot: startRot,
                        depth: handles.rotateTop.distance(camPos),
                        touchStart: pos,
                        startLocalTouch: startLocalTouch,
                        startYaw: activeWall.getWallYaw()
                    };
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`⟳ PINCHED [ROTATE WALL]: Drag left/right to steer wall rapidly!`, new vec4(0.3, 0.95, 1.0, 1.0));
                    }
                    return;
                }
            }

            // Check if user pinched near Handle A, Handle B, or Wire Body
            for (const run of this.activeRuns) {
                const screenA = camComp.worldSpaceToScreenSpace(run.startPoint);
                const screenB = camComp.worldSpaceToScreenSpace(run.endPoint);
                const mid = run.startPoint.add(run.endPoint).uniformScale(0.5);
                const screenMid = camComp.worldSpaceToScreenSpace(mid);

                const distA = Math.sqrt((pos.x - screenA.x) ** 2 + (pos.y - screenA.y) ** 2);
                const distB = Math.sqrt((pos.x - screenB.x) ** 2 + (pos.y - screenB.y) ** 2);
                const distMid = Math.sqrt((pos.x - screenMid.x) ** 2 + (pos.y - screenMid.y) ** 2);

                if (distA <= 0.09) {
                    this.activePinch = {
                        runId: run.id,
                        target: "HANDLE_A",
                        depth: run.startPoint.distance(camPos)
                    };
                    this.selectedRunId = run.id;
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`🤏 PINCHED [GRIP A]: Drag to expand, retract, or angle wire!`, new vec4(1.0, 0.9, 0.2, 1.0));
                    }
                    this.inspectRun(run);
                    return;
                }

                if (distB <= 0.09) {
                    this.activePinch = {
                        runId: run.id,
                        target: "HANDLE_B",
                        depth: run.endPoint.distance(camPos)
                    };
                    this.selectedRunId = run.id;
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`🤏 PINCHED [GRIP B]: Drag to expand, retract, or angle wire!`, new vec4(1.0, 0.9, 0.2, 1.0));
                    }
                    this.inspectRun(run);
                    return;
                }

                if (distMid <= 0.09) {
                    this.activePinch = {
                        runId: run.id,
                        target: "BODY",
                        depth: mid.distance(camPos),
                        startA: run.startPoint,
                        startB: run.endPoint,
                        startMid: mid
                    };
                    this.selectedRunId = run.id;
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`🤏 PINCHED WIRE: Drag to slide conduit across room!`, new vec4(0.2, 1.0, 0.8, 1.0));
                    }
                    this.inspectRun(run);
                    return;
                }
            }
        });

        // 2. PINCH MOVE (DRAG)
        this.createEvent("TouchMoveEvent").bind((event: TouchMoveEvent) => {
            const touchPos = event.getTouchPosition();

            // A. If in Inspector camera mode and not pinching, drag orbits the camera around room
            if (this.activeCameraMode === "inspector" && !this.activePinch && !this.activeWallPinch && this.inspectorCameraObj) {
                if (this.lastDragPos) {
                    const dx = touchPos.x - this.lastDragPos.x;
                    const dy = touchPos.y - this.lastDragPos.y;
                    this.orbitYaw += dx * 3.2;
                    this.orbitPitch = Math.max(-0.25, Math.min(1.3, this.orbitPitch + dy * 2.5));

                    const target = new vec3(0, 0, -200);
                    const cx = target.x + Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist;
                    const cy = target.y + Math.sin(this.orbitPitch) * this.orbitDist;
                    const cz = target.z + Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist;
                    const newPos = new vec3(cx, cy, cz);
                    this.inspectorCameraObj.getTransform().setWorldPosition(newPos);
                    const fwd = target.sub(newPos).normalize();
                    this.inspectorCameraObj.getTransform().setWorldRotation(quat.lookAt(fwd, new vec3(0, 1, 0)));
                }
                this.lastDragPos = touchPos;
                return;
            }

            // B. Active Wall Pinch (Opposite-Anchor Resize or Reposition)
            if (this.activeWallPinch) {
                const pinch = this.activeWallPinch;
                const wall = pinch.wall;
                const startPos = pinch.startPos;
                const startRot = pinch.startRot;
                const startW = pinch.startW;
                const startH = pinch.startH;

                const camObj = this.findCamera();
                const camComp = camObj ? camObj.getComponent("Component.Camera") as Camera : this.glassesCamera;

                // Raycast from camera through current touch position onto wall reference plane
                let xDrag = 0;
                let yDrag = 0;
                let hasHit = false;

                if (camComp) {
                    const rayOrigin = camComp.screenSpaceToWorldSpace(touchPos, 1.0);
                    const rayFar = camComp.screenSpaceToWorldSpace(touchPos, 100.0);
                    const rayDir = rayFar.sub(rayOrigin).normalize();
                    const wallNormal = startRot.multiplyVec3(new vec3(0, 0, 1.0));
                    const denom = rayDir.dot(wallNormal);

                    if (Math.abs(denom) > 0.0001) {
                        const diff = startPos.sub(rayOrigin);
                        const t = diff.dot(wallNormal) / denom;
                        const worldHit = rayOrigin.add(rayDir.uniformScale(t));
                        const invRot = startRot.invert();
                        const localHit = invRot.multiplyVec3(worldHit.sub(startPos));
                        xDrag = localHit.x;
                        yDrag = localHit.y;
                        hasHit = true;
                    }
                }

                if (!hasHit) {
                    const dx = (touchPos.x - pinch.touchStart.x) * 350.0;
                    const dy = -(touchPos.y - pinch.touchStart.y) * 350.0;
                    if (pinch.target === "RESIZE_BR") {
                        xDrag = startW * 0.5 + dx;
                        yDrag = -startH * 0.5 + dy;
                    } else if (pinch.target === "RESIZE_TR") {
                        xDrag = startW * 0.5 + dx;
                        yDrag = startH * 0.5 + dy;
                    } else if (pinch.target === "RESIZE_TL") {
                        xDrag = -startW * 0.5 + dx;
                        yDrag = startH * 0.5 + dy;
                    } else if (pinch.target === "RESIZE_BL") {
                        xDrag = -startW * 0.5 + dx;
                        yDrag = -startH * 0.5 + dy;
                    } else {
                        xDrag = dx;
                        yDrag = dy;
                    }
                }

                if (pinch.target === "RESIZE_BR") {
                    // Fixed Anchor: Top-Left (-startW/2, +startH/2)
                    const fixedX = -startW * 0.5;
                    const fixedY = startH * 0.5;
                    const clampedX = Math.max(fixedX + 60.0, Math.min(fixedX + 800.0, xDrag));
                    const clampedY = Math.min(fixedY - 60.0, Math.max(fixedY - 600.0, yDrag));

                    const newW = clampedX - fixedX;
                    const newH = fixedY - clampedY;
                    const localCenter = new vec3((fixedX + clampedX) * 0.5, (fixedY + clampedY) * 0.5, 0);
                    const newPos = startPos.add(startRot.multiplyVec3(localCenter));

                    wall.rebuildWall(newPos, startRot, newW, newH);
                    this.alignBreakerPanelToActiveWall();
                    if (this.toolPalette) {
                        this.toolPalette.updateWallInfo(this.activeWallIndex + 1, this.activeWalls.length, wall.wallYawDegrees, `${(newW / 100).toFixed(1)}m`);
                        this.toolPalette.setStatusMessage(`⤢ BR RESIZE: ${newW.toFixed(0)}cm W × ${newH.toFixed(0)}cm H (Top-Left fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                } else if (pinch.target === "RESIZE_TR") {
                    // Fixed Anchor: Bottom-Left (-startW/2, -startH/2)
                    const fixedX = -startW * 0.5;
                    const fixedY = -startH * 0.5;
                    const clampedX = Math.max(fixedX + 60.0, Math.min(fixedX + 800.0, xDrag));
                    const clampedY = Math.max(fixedY + 60.0, Math.min(fixedY + 600.0, yDrag));

                    const newW = clampedX - fixedX;
                    const newH = clampedY - fixedY;
                    const localCenter = new vec3((fixedX + clampedX) * 0.5, (fixedY + clampedY) * 0.5, 0);
                    const newPos = startPos.add(startRot.multiplyVec3(localCenter));

                    wall.rebuildWall(newPos, startRot, newW, newH);
                    this.alignBreakerPanelToActiveWall();
                    if (this.toolPalette) {
                        this.toolPalette.updateWallInfo(this.activeWallIndex + 1, this.activeWalls.length, wall.wallYawDegrees, `${(newW / 100).toFixed(1)}m`);
                        this.toolPalette.setStatusMessage(`⤢ TR RESIZE: ${newW.toFixed(0)}cm W × ${newH.toFixed(0)}cm H (Bottom-Left fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                } else if (pinch.target === "RESIZE_TL") {
                    // Fixed Anchor: Bottom-Right (+startW/2, -startH/2)
                    const fixedX = startW * 0.5;
                    const fixedY = -startH * 0.5;
                    const clampedX = Math.min(fixedX - 60.0, Math.max(fixedX - 800.0, xDrag));
                    const clampedY = Math.max(fixedY + 60.0, Math.min(fixedY + 600.0, yDrag));

                    const newW = fixedX - clampedX;
                    const newH = clampedY - fixedY;
                    const localCenter = new vec3((clampedX + fixedX) * 0.5, (clampedY + fixedY) * 0.5, 0);
                    const newPos = startPos.add(startRot.multiplyVec3(localCenter));

                    wall.rebuildWall(newPos, startRot, newW, newH);
                    this.alignBreakerPanelToActiveWall();
                    if (this.toolPalette) {
                        this.toolPalette.updateWallInfo(this.activeWallIndex + 1, this.activeWalls.length, wall.wallYawDegrees, `${(newW / 100).toFixed(1)}m`);
                        this.toolPalette.setStatusMessage(`⤢ TL RESIZE: ${newW.toFixed(0)}cm W × ${newH.toFixed(0)}cm H (Bottom-Right fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                } else if (pinch.target === "RESIZE_BL") {
                    // Fixed Anchor: Top-Right (+startW/2, +startH/2)
                    const fixedX = startW * 0.5;
                    const fixedY = startH * 0.5;
                    const clampedX = Math.min(fixedX - 60.0, Math.max(fixedX - 800.0, xDrag));
                    const clampedY = Math.min(fixedY - 60.0, Math.max(fixedY - 600.0, yDrag));

                    const newW = fixedX - clampedX;
                    const newH = fixedY - clampedY;
                    const localCenter = new vec3((clampedX + fixedX) * 0.5, (fixedY + clampedY) * 0.5, 0);
                    const newPos = startPos.add(startRot.multiplyVec3(localCenter));

                    wall.rebuildWall(newPos, startRot, newW, newH);
                    this.alignBreakerPanelToActiveWall();
                    if (this.toolPalette) {
                        this.toolPalette.updateWallInfo(this.activeWallIndex + 1, this.activeWalls.length, wall.wallYawDegrees, `${(newW / 100).toFixed(1)}m`);
                        this.toolPalette.setStatusMessage(`⤢ BL RESIZE: ${newW.toFixed(0)}cm W × ${newH.toFixed(0)}cm H (Top-Right fixed)`, new vec4(0.2, 1.0, 0.7, 1.0));
                    }
                } else if (pinch.target === "MOVE") {
                    const startLocal = pinch.startLocalTouch || new vec2(0, 0);
                    const deltaLocal = new vec3(xDrag - startLocal.x, yDrag - startLocal.y, 0);
                    const newPos = startPos.add(startRot.multiplyVec3(deltaLocal));

                    wall.rebuildWall(newPos, startRot, startW, startH);
                    this.alignBreakerPanelToActiveWall();
                    if (this.toolPalette) {
                        this.toolPalette.setStatusMessage(`✥ REPOSITIONING WALL: (${newPos.x.toFixed(0)}, ${newPos.y.toFixed(0)}, ${newPos.z.toFixed(0)})cm`, new vec4(0.3, 1.0, 0.6, 1.0));
                    }
                } else if (pinch.target === "ROTATE") {
                    const dx = (touchPos.x - pinch.touchStart.x);
                    const deltaYaw = dx * 360.0;
                    const startYaw = pinch.startYaw !== undefined ? pinch.startYaw : 0;
                    const newYaw = ((startYaw + deltaYaw) % 360 + 360) % 360;
                    wall.setWallYaw(newYaw);
                    this.alignBreakerPanelToActiveWall();
                    if (this.toolPalette) {
                        this.toolPalette.updateWallInfo(this.activeWallIndex + 1, this.activeWalls.length, newYaw, `${(wall.widthCm / 100).toFixed(1)}m`);
                        this.toolPalette.setStatusMessage(`⟳ PINCH ROTATING: ${newYaw.toFixed(0)}° (Release to lock)`, new vec4(0.3, 0.95, 1.0, 1.0));
                    }
                }
                return;
            }

            if (!this.activePinch) return;

            const run = this.activeRuns.find(r => r.id === this.activePinch!.runId);
            if (!run) return;

            const camObj = this.findCamera();
            if (!camObj) return;
            const camComp = camObj.getComponent("Component.Camera") as Camera;
            if (!camComp) return;

            const newWorldPt = camComp.screenSpaceToWorldSpace(touchPos, this.activePinch.depth);

            if (this.activePinch.target === "HANDLE_A") {
                run.startPoint = newWorldPt;
            } else if (this.activePinch.target === "HANDLE_B") {
                run.endPoint = newWorldPt;
            } else if (this.activePinch.target === "BODY" && this.activePinch.startMid && this.activePinch.startA && this.activePinch.startB) {
                const delta = newWorldPt.sub(this.activePinch.startMid);
                run.startPoint = this.activePinch.startA.add(delta);
                run.endPoint = this.activePinch.startB.add(delta);
            }

            const lenCm = run.startPoint.distance(run.endPoint);
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(`↔️ EXPANDING WIRE: ${lenCm.toFixed(0)} cm (${run.name})`, new vec4(0.2, 1.0, 0.5, 1.0));
            }

            this.updateRunVisualPositions(run);
        });

        // 3. PINCH END (RELEASE)
        this.createEvent("TouchEndEvent").bind(() => {
            this.lastDragPos = null;

            if (this.activeWallPinch) {
                const wall = this.activeWallPinch.wall;
                if (this.toolPalette) {
                    if (this.activeWallPinch.target.startsWith("RESIZE")) {
                        this.toolPalette.setStatusMessage(`✓ WALL RESIZED: ${wall.widthCm.toFixed(0)}×${wall.heightCm.toFixed(0)}cm locked!`, new vec4(0.2, 1.0, 0.5, 1.0));
                    } else if (this.activeWallPinch.target === "ROTATE") {
                        this.toolPalette.setStatusMessage(`✓ WALL ROTATED: ${wall.getWallYaw().toFixed(0)}° locked!`, new vec4(0.2, 1.0, 0.5, 1.0));
                    } else {
                        const p = wall.getSceneObject().getTransform().getWorldPosition();
                        this.toolPalette.setStatusMessage(`✓ WALL POSITIONED at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)})cm`, new vec4(0.2, 1.0, 0.5, 1.0));
                    }
                }
                this.activeWallPinch = null;
            }

            if (this.activePinch) {
                const run = this.activeRuns.find(r => r.id === this.activePinch!.runId);
                if (run && this.toolPalette) {
                    const lenCm = run.startPoint.distance(run.endPoint);
                    this.toolPalette.setStatusMessage(`✓ ANCHORED: Length ${lenCm.toFixed(0)} cm. Tap [⬆️ PUSH] to push to wall`, new vec4(0.2, 1.0, 0.5, 1.0));
                    this.inspectRun(run);
                }
                this.activePinch = null;
                this.updateSafetyCheck();
            }
            this.saveStateToStorage();
        });
    }

    // Remote Sofa Depth Adjustment: pushes active conduit along camera gaze ray toward the wall
    public pushActiveConduit(deltaDepth: number) {
        if (this.lineMarkerTool) {
            this.lineMarkerTool.adjustDepth(deltaDepth);
        }

        if (this.activeRuns.length === 0) {
            if (this.toolPalette && this.lineMarkerTool) {
                const depthM = (this.lineMarkerTool.getDepth() / 100).toFixed(1);
                this.toolPalette.setStatusMessage(`Default Depth: ${depthM}m. Tap [✏️ MARK] to draw from sofa`, new vec4(0.3, 0.85, 1.0, 1.0));
            }
            return;
        }

        const run = this.selectedRunId 
            ? this.activeRuns.find(r => r.id === this.selectedRunId) || this.activeRuns[this.activeRuns.length - 1]
            : this.activeRuns[this.activeRuns.length - 1];

        const camObj = this.findCamera();
        if (!camObj) return;
        const camPos = camObj.getTransform().getWorldPosition();

        // Push startPoint along line of sight from camera
        const dirA = run.startPoint.sub(camPos).normalize();
        run.startPoint = run.startPoint.add(dirA.uniformScale(deltaDepth));

        // Push endPoint along line of sight from camera
        const dirB = run.endPoint.sub(camPos).normalize();
        run.endPoint = run.endPoint.add(dirB.uniformScale(deltaDepth));

        this.updateRunVisualPositions(run);

        const currentDist = run.startPoint.distance(camPos);
        const actionWord = deltaDepth > 0 ? "⬆️ PUSHED TO WALL" : "⬇️ PULLED CLOSER";
        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(`${actionWord}: ${run.name} (~${(currentDist / 100).toFixed(1)}m from you)`, new vec4(0.2, 0.9, 1.0, 1.0));
        }

        this.updateSafetyCheck();
        if (this.inspectionCard && this.inspectionCard.getIsVisible()) {
            this.inspectRun(run);
        }
    }

    // Changes the wire gauge / size of active or last drawn run in real-time
    public applyGaugeToActiveRun(gauge: WireGaugeDef) {
        if (this.activeRuns.length === 0) {
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(`Default Gauge: ${gauge.name}. Tap [✏️ DRAW] to place`, new vec4(0.2, 0.95, 1.0, 1.0));
            }
            return;
        }

        const run = this.selectedRunId 
            ? this.activeRuns.find(r => r.id === this.selectedRunId) || this.activeRuns[this.activeRuns.length - 1]
            : this.activeRuns[this.activeRuns.length - 1];

        run.gauge = gauge.label;
        run.thickness = gauge.thickness;
        const isLive = run.isLive !== false;
        run.voltageOrType = isLive ? `Live 230V (${gauge.label})` : `De-Energized (${gauge.label})`;

        if (gauge.label.includes("PEX")) {
            run.layer = "plumbing";
            run.color = new vec4(0.2, 0.75, 1.0, 1.0);
        } else {
            run.layer = "electrical";
            run.color = isLive ? new vec4(1.0, 0.85, 0.1, 1.0) : new vec4(0.4, 0.65, 0.85, 0.9);
        }

        this.updateRunVisualPositions(run);
        if (this.inspectionCard && this.inspectionCard.getIsVisible()) {
            this.inspectRun(run);
        }
        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(`📐 Updated ${run.name} to ${gauge.name}`, new vec4(0.2, 0.95, 1.0, 1.0));
        }
        this.updateSafetyCheck();
    }

    // Toggles whether active wire is LIVE 230V or DE-ENERGIZED (Safe / Cold)
    public applyLiveStateToActiveRun(isLive: boolean) {
        if (this.activeRuns.length === 0) {
            return;
        }

        const run = this.selectedRunId 
            ? this.activeRuns.find(r => r.id === this.selectedRunId) || this.activeRuns[this.activeRuns.length - 1]
            : this.activeRuns[this.activeRuns.length - 1];

        run.isLive = isLive;
        run.status = isLive ? "LIVE 230V AC (ENERGIZED)" : "DE-ENERGIZED (SAFE / COLD)";
        run.color = isLive ? new vec4(1.0, 0.85, 0.1, 1.0) : new vec4(0.4, 0.65, 0.85, 0.9);
        const gaugeLabel = run.gauge || "12 AWG";
        run.voltageOrType = isLive ? `Live 230V (${gaugeLabel})` : `De-Energized (${gaugeLabel})`;

        this.updateRunVisualPositions(run);
        if (this.inspectionCard && this.inspectionCard.getIsVisible()) {
            this.inspectRun(run);
        }
        if (this.toolPalette) {
            const statusText = isLive ? "⚡ LIVE 230V" : "○ DE-ENERGIZED (COLD)";
            this.toolPalette.setStatusMessage(`Wire ${run.name} is now ${statusText}`, isLive ? new vec4(1.0, 0.85, 0.1, 1.0) : new vec4(0.4, 0.8, 1.0, 1.0));
        }
        this.updateSafetyCheck();
    }

    public deleteRunById(id: string): boolean {
        const visualObj = this.runVisualObjects.get(id);
        if (visualObj) {
            visualObj.destroy();
            this.runVisualObjects.delete(id);
        }
        this.activeRuns = this.activeRuns.filter(r => r.id !== id);
        this.refreshAllJunctions();
        if (this.selectedRunId === id) {
            this.selectedRunId = null;
            if (this.inspectionCard) this.inspectionCard.hide();
        }
        this.updateSafetyCheck();
        return true;
    }

    // Deletes selected or last conduit
    public deleteLastRun(): boolean {
        if (this.activeRuns.length === 0) {
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage("Canvas is already empty! Tap [✏️ MARK] to draw", new vec4(0.8, 0.85, 0.9, 1.0));
            }
            return false;
        }

        const runToDelete = this.selectedRunId 
            ? this.activeRuns.find(r => r.id === this.selectedRunId) || this.activeRuns[this.activeRuns.length - 1]
            : this.activeRuns[this.activeRuns.length - 1];

        const visualObj = this.runVisualObjects.get(runToDelete.id);
        if (visualObj) {
            visualObj.destroy();
            this.runVisualObjects.delete(runToDelete.id);
        }

        this.activeRuns = this.activeRuns.filter(r => r.id !== runToDelete.id);
        if (this.selectedRunId === runToDelete.id) {
            this.selectedRunId = null;
            if (this.inspectionCard) this.inspectionCard.hide();
        }

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(`🗑️ REMOVED: ${runToDelete.name} (${this.activeRuns.length} remaining)`, new vec4(1.0, 0.5, 0.3, 1.0));
        }

        this.updateSafetyCheck();
        this.saveStateToStorage();
        return true;
    }

    // Clears drafting markers & scratch conduits, while keeping the 10 Foundation Bedroom Circuit runs permanently intact!
    public clearAllRuns() {
        if (this.lineMarkerTool) this.lineMarkerTool.clearAll();
        if (this.inspectionCard) this.inspectionCard.hide();
        this.selectedRunId = null;
        this.activePinch = null;

        const permanentIds = new Set(INITIAL_CONDUIT_RUNS.map(r => r.id));

        for (const run of [...this.activeRuns]) {
            if (!permanentIds.has(run.id)) {
                const visualObj = this.runVisualObjects.get(run.id);
                if (visualObj) {
                    visualObj.destroy();
                    this.runVisualObjects.delete(run.id);
                }
            }
        }
        this.activeRuns = this.activeRuns.filter(r => permanentIds.has(r.id));

        // Self-heal: ensure all 10 permanent bedroom runs are 100% present and rendered
        this.setupDefaultBedroomCircuit();

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage("🧹 Markers cleared • Permanent Bedroom Circuit Restored!", new vec4(0.2, 1.0, 0.5, 1.0));
        }

        this.refreshAllJunctions();
        this.updateSafetyCheck();
        this.saveStateToStorage();
    }

    // ── Persistent Storage: Saves User Wiring & Walls Across Reloads & Previews ──
    public saveStateToStorage(): void {
        try {
            const pss = (global as any).persistentStorageSystem;
            if (pss && pss.store && typeof pss.store.putString === "function") {
                const serializedRuns = this.activeRuns.map(r => ({
                    id: r.id,
                    name: r.name,
                    layer: r.layer,
                    voltageOrType: r.voltageOrType,
                    installer: r.installer,
                    installDate: r.installDate,
                    status: r.status,
                    color: [r.color.x, r.color.y, r.color.z, r.color.w],
                    startPoint: [r.startPoint.x, r.startPoint.y, r.startPoint.z],
                    endPoint: [r.endPoint.x, r.endPoint.y, r.endPoint.z],
                    isConflict: r.isConflict,
                    conflictWarning: r.conflictWarning,
                    isWorldCoords: r.isWorldCoords,
                    roomZone: r.roomZone,
                    gauge: r.gauge,
                    isLive: r.isLive,
                    thickness: r.thickness
                }));
                pss.store.putString("wiresight_saved_runs", JSON.stringify(serializedRuns));
                pss.store.putString("conduitxr_saved_runs", JSON.stringify(serializedRuns));

                const serializedWalls = this.activeWalls.map(w => {
                    const pos = w.getSceneObject().getTransform().getWorldPosition();
                    return {
                        wallIndex: w.wallIndex,
                        wallId: w.wallId,
                        widthCm: w.widthCm,
                        heightCm: w.heightCm,
                        pos: [pos.x, pos.y, pos.z],
                        yawDeg: w.getWallYaw()
                    };
                });
                pss.store.putString("wiresight_saved_walls", JSON.stringify(serializedWalls));
                pss.store.putString("conduitxr_saved_walls", JSON.stringify(serializedWalls));
                print(`[WireSight] Auto-saved ${this.activeRuns.length} wiring runs to Persistent Storage.`);
            }
        } catch (e) {
            print(`[WireSight] Persistent save note: ${e}`);
        }
    }

    public loadStateFromStorage(): boolean {
        try {
            const pss = (global as any).persistentStorageSystem;
            if (!pss || !pss.store || typeof pss.store.getString !== "function" || typeof pss.store.has !== "function") {
                return false;
            }

            // 1. Restore Saved Walls first
            const hasSavedWalls = pss.store.has("wiresight_saved_walls") || pss.store.has("conduitxr_saved_walls");
            if (hasSavedWalls) {
                const rawWalls = pss.store.has("wiresight_saved_walls")
                    ? pss.store.getString("wiresight_saved_walls")
                    : pss.store.getString("conduitxr_saved_walls");
                if (rawWalls && rawWalls.length > 5) {
                    const parsedWalls = JSON.parse(rawWalls);
                    if (Array.isArray(parsedWalls) && parsedWalls.length > 0) {
                        for (const sw of parsedWalls) {
                            // Anchor Foundation Walls to true architectural bedroom coordinates
                            if (sw.wallId === "wall-bedroom") {
                                sw.pos = [-279.0, 0, 215.0];
                                sw.yawDeg = 45.0;
                                sw.widthCm = 290.0;
                                sw.heightCm = 240.0;
                            } else if (sw.wallId === "wall-corner") {
                                sw.pos = [-697.0, -17.0, 195.0];
                                sw.yawDeg = 135.0;
                                sw.widthCm = 560.0;
                                sw.heightCm = 240.0;
                            }

                            let wall = this.activeWalls.find(w => w.wallId === sw.wallId);
                            if (!wall) {
                                const wallObj = global.scene.createSceneObject(`SavedWall_${sw.wallId}`);
                                wall = wallObj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
                                wall.wallIndex = sw.wallIndex || (this.activeWalls.length + 1);
                                wall.wallId = sw.wallId;
                                this.activeWalls.push(wall);
                            }
                            wall.widthCm = sw.widthCm;
                            wall.heightCm = sw.heightCm;
                            wall.initialPosition = new vec3(sw.pos[0], sw.pos[1], sw.pos[2]);
                            const rad = (sw.yawDeg * Math.PI) / 180.0;
                            wall.initialRotation = quat.fromEulerAngles(0, rad, 0);
                            const t = wall.getSceneObject().getTransform();
                            t.setWorldPosition(wall.initialPosition);
                            t.setWorldRotation(wall.initialRotation);
                            wall.rebuildWall(wall.initialPosition, wall.initialRotation, sw.widthCm, sw.heightCm);
                            wall.setWallYaw(sw.yawDeg);
                        }
                        if (this.activeWalls.length > 0) {
                            this.referenceWall = this.activeWalls[0];
                            this.activeWallIndex = 0;
                            this.referenceWall.setIsActiveWall(true);
                            if (this.lineMarkerTool) this.lineMarkerTool.setReferenceWalls(this.activeWalls);
                            if (this.wallCreatorTool) this.wallCreatorTool.setReferenceWall(this.referenceWall);
                            this.updateMultiWallUI();
                        }
                    }
                }
            }

            // 2. Restore Saved Conduit Runs
            const hasSavedRuns = pss.store.has("wiresight_saved_runs") || pss.store.has("conduitxr_saved_runs");
            if (hasSavedRuns) {
                const rawRuns = pss.store.has("wiresight_saved_runs")
                    ? pss.store.getString("wiresight_saved_runs")
                    : pss.store.getString("conduitxr_saved_runs");
                if (rawRuns && rawRuns.length > 5) {
                    const parsedRuns = JSON.parse(rawRuns);
                    if (Array.isArray(parsedRuns) && parsedRuns.length > 0) {
                        for (const s of parsedRuns) {
                            // Filter out demo prewired house runs — preserve only user-created wires!
                            if (s.id && (
                                s.id.startsWith("elec-kitchen") ||
                                s.id.startsWith("elec-living") ||
                                s.id.startsWith("elec-corridor") ||
                                s.id.startsWith("elec-main") ||
                                s.id.startsWith("elec-bedroom-overhead") ||
                                s.id.startsWith("elec-bedroom-switch") ||
                                s.id.startsWith("plumb-")
                            )) {
                                continue;
                            }

                            const existing = this.activeRuns.find(r => r.id === s.id);
                            if (existing) {
                                existing.startPoint = new vec3(s.startPoint[0], s.startPoint[1], s.startPoint[2]);
                                existing.endPoint = new vec3(s.endPoint[0], s.endPoint[1], s.endPoint[2]);
                                this.updateRunVisualPositions(existing);
                            } else {
                                const run: ConduitRun = {
                                    id: s.id,
                                    name: s.name,
                                    layer: s.layer,
                                    voltageOrType: s.voltageOrType,
                                    installer: s.installer,
                                    installDate: s.installDate,
                                    status: s.status,
                                    color: new vec4(s.color[0], s.color[1], s.color[2], s.color[3]),
                                    startPoint: new vec3(s.startPoint[0], s.startPoint[1], s.startPoint[2]),
                                    endPoint: new vec3(s.endPoint[0], s.endPoint[1], s.endPoint[2]),
                                    isConflict: s.isConflict,
                                    conflictWarning: s.conflictWarning,
                                    isWorldCoords: s.isWorldCoords !== false,
                                    roomZone: s.roomZone,
                                    gauge: s.gauge,
                                    isLive: s.isLive !== false,
                                    thickness: s.thickness || 5.0
                                };
                                this.activeRuns.push(run);
                                this.createRunVisual(run, true);
                            }
                        }
                        print(`[WireSight] Restored ${this.activeRuns.length} user conduit runs from Persistent Storage.`);
                        if (this.toolPalette) {
                            this.toolPalette.setStatusMessage(
                                `💾 Restored ${this.activeRuns.length} User Wires from Storage!`,
                                new vec4(0.2, 1.0, 0.5, 1.0)
                            );
                        }
                        this.updateSafetyCheck();
                        return true;
                    }
                }
            }
        } catch (e) {
            print(`[WireSight] Persistent load note: ${e}`);
        }
        return false;
    }

    // Purges prewired demo house runs, keeping ONLY user-created wires and user walls
    public purgePrewiredHouseRuns(): void {
        const isPrewired = (id: string) => {
            return id.startsWith("elec-") || id.startsWith("plumb-") || !id.startsWith("run-");
        };

        const runsToKeep: ConduitRun[] = [];
        let purgedCount = 0;
        for (const run of this.activeRuns) {
            if (isPrewired(run.id)) {
                const vis = this.runVisualObjects.get(run.id);
                if (vis) {
                    try {
                        vis.destroy();
                    } catch (e) {}
                    this.runVisualObjects.delete(run.id);
                }
                purgedCount++;
            } else {
                runsToKeep.push(run);
            }
        }

        this.activeRuns = runsToKeep;

        // Clean up any extra demo walls (keep only the user's bedroom & corner walls)
        const wallsToKeep: ReferenceWall[] = [];
        for (const wall of this.activeWalls) {
            if (wall.wallId.includes("kitchen") || wall.wallId.includes("living") || wall.wallId.includes("utility")) {
                try {
                    wall.getSceneObject().destroy();
                } catch (e) {}
            } else {
                wallsToKeep.push(wall);
            }
        }
        this.activeWalls = wallsToKeep;
        for (let i = 0; i < this.activeWalls.length; i++) {
            this.activeWalls[i].wallIndex = i + 1;
        }

        this.saveStateToStorage();
        this.refreshAllJunctions();
        this.updateSafetyCheck();
        this.updateMultiWallUI();

        if (purgedCount > 0) {
            print(`[WireSight] Purged ${purgedCount} generated house runs. Preserved ${this.activeRuns.length} user-created wires.`);
        }
    }

    // Restores the user's master bedroom corner walls (Wall 1 behind bed, Wall 2 along TV & wardrobe)
    public setupDefaultCornerWalls(): void {
        print("[WireSight] Ensuring Master Bedroom Corner Walls from Architectural Blueprint...");

        // Wall 1: Master Bedroom Back Wall (behind bed & nightstands)
        // Position: (0, 0, -180.0), Yaw: 0°, Width: 240cm, Height: 240cm
        let wall1 = this.activeWalls.find(w => w.wallId === "wall-bedroom");
        if (!wall1) {
            const wall1Obj = global.scene.createSceneObject("HolographicReferenceWall_1");
            wall1 = wall1Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
            wall1.wallIndex = 1;
            wall1.wallId = "wall-bedroom";
            this.activeWalls.unshift(wall1);
        }
        wall1.widthCm = 290.0;
        wall1.heightCm = 240.0;
        wall1.initialPosition = new vec3(-279.0, 0, 215.0);
        wall1.initialRotation = quat.fromEulerAngles(0, (45.0 * Math.PI) / 180.0, 0);
        wall1.getSceneObject().getTransform().setWorldPosition(wall1.initialPosition);
        wall1.getSceneObject().getTransform().setWorldRotation(wall1.initialRotation);
        wall1.rebuildWall(wall1.initialPosition, wall1.initialRotation, 290.0, 240.0);
        wall1.setWallYaw(45.0);
        wall1.getSceneObject().enabled = false; // Disable original preview wall

        // Wall 2: Master Bedroom Perpendicular Side Wall (along TV, Dresser & Wardrobe)
        // Position: (-697.0, -17.0, 195.0), Yaw: 135°, Width: 560cm, Height: 240cm
        let wall2 = this.activeWalls.find(w => w.wallId === "wall-corner");
        if (!wall2) {
            const wall2Obj = global.scene.createSceneObject("HolographicReferenceWall_2");
            wall2 = wall2Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
            wall2.wallIndex = 2;
            wall2.wallId = "wall-corner";
            if (this.activeWalls.length <= 1) {
                this.activeWalls.push(wall2);
            } else {
                this.activeWalls.splice(1, 0, wall2);
            }
        }
        wall2.widthCm = 560.0;
        wall2.heightCm = 240.0;
        wall2.initialPosition = new vec3(-697.0, -17.0, 195.0);
        wall2.initialRotation = quat.fromEulerAngles(0, (135.0 * Math.PI) / 180.0, 0);
        wall2.getSceneObject().getTransform().setWorldPosition(wall2.initialPosition);
        wall2.getSceneObject().getTransform().setWorldRotation(wall2.initialRotation);
        wall2.rebuildWall(wall2.initialPosition, wall2.initialRotation, 560.0, 240.0);
        wall2.setWallYaw(135.0);
        wall2.getSceneObject().enabled = false; // Disable original preview wall

        // Renumber all active walls
        for (let i = 0; i < this.activeWalls.length; i++) {
            this.activeWalls[i].wallIndex = i + 1;
        }

        if (!this.referenceWall || !this.activeWalls.includes(this.referenceWall)) {
            this.referenceWall = wall1;
            this.activeWallIndex = 0;
        }
        for (let i = 0; i < this.activeWalls.length; i++) {
            this.activeWalls[i].setIsActiveWall(i === this.activeWallIndex);
        }

        // Link with line marker and wall creator tools
        if (this.lineMarkerTool) {
            this.lineMarkerTool.setReferenceWalls(this.activeWalls);
        }
        if (this.wallCreatorTool) {
            this.wallCreatorTool.setReferenceWall(this.referenceWall);
        }
        this.alignBreakerPanelToActiveWall();
        this.updateMultiWallUI();
        this.saveStateToStorage();
        print(`[WireSight] Restored ${this.activeWalls.length} bedroom corner walls successfully.`);
    }

    // Restores the complete Master Bedroom & residential wiring circuits from Architectural Blueprint
    public setupDefaultBedroomCircuit(): void {
        print(`[WireSight] Ensuring ${INITIAL_CONDUIT_RUNS.length} architectural wiring runs from spatial blueprint...`);

        for (const run of INITIAL_CONDUIT_RUNS) {
            const existing = this.activeRuns.find(r => r.id === run.id);
            if (!existing) {
                this.activeRuns.push(run);
                this.createRunVisual(run, true);
            } else {
                existing.startPoint = new vec3(run.startPoint.x, run.startPoint.y, run.startPoint.z);
                existing.endPoint = new vec3(run.endPoint.x, run.endPoint.y, run.endPoint.z);
                this.updateRunVisualPositions(existing);
                if (!this.runVisualObjects.has(run.id)) {
                    this.createRunVisual(existing, true);
                }
            }
        }

        this.refreshAllJunctions();
        this.updateSafetyCheck();
        this.saveStateToStorage();

        if (INITIAL_CONDUIT_RUNS.length > 0) {
            this.inspectRun(INITIAL_CONDUIT_RUNS[0]);
        }

        print(`[WireSight] Restored ${this.activeRuns.length} bedroom circuit runs from spatial blueprint.`);
    }

    // Interactive Add Outlet / Tap-In tool: mounts a 120V 20A duplex outlet right where user aims on the wall!
    public addOutletTapIn(): ConduitRun {
        let outletWorldPos: vec3;
        let targetWall = this.getActiveWall();
        const centerScreen = new vec2(0.5, 0.5);
        const hit = this.lineMarkerTool ? this.lineMarkerTool.getSurfaceHit(centerScreen) : null;

        if (hit && hit.isHit && hit.isOnWall && hit.hitWall) {
            targetWall = hit.hitWall;
            outletWorldPos = hit.point;
        } else if (targetWall) {
            const wPos = targetWall.getSceneObject().getTransform().getWorldPosition();
            const wRot = targetWall.getSceneObject().getTransform().getWorldRotation();
            // Standard receptacle height (-40cm from center, +4cm drywall surface)
            outletWorldPos = wPos.add(wRot.multiplyVec3(new vec3(0, -40.0, 4.0)));
        } else {
            outletWorldPos = new vec3(0, -40.0, -180.0);
        }

        if (targetWall) {
            outletWorldPos = targetWall.projectPointToWall(outletWorldPos);
        }

        // Look for an existing conduit overhead to connect down from
        let dropTop = new vec3(outletWorldPos.x, outletWorldPos.y + 65.0, outletWorldPos.z);
        let bestDist = 999.0;
        for (const run of this.activeRuns) {
            if (run.layer !== "electrical") continue;
            const mid = run.startPoint.add(run.endPoint).uniformScale(0.5);
            if (mid.y > outletWorldPos.y) {
                const horizDist = Math.sqrt((mid.x - outletWorldPos.x) ** 2 + (mid.z - outletWorldPos.z) ** 2);
                if (horizDist < bestDist && horizDist < 140.0) {
                    bestDist = horizDist;
                    dropTop = new vec3(outletWorldPos.x, Math.min(mid.y, 110.0), outletWorldPos.z);
                    if (targetWall) dropTop = targetWall.projectPointToWall(dropTop);
                }
            }
        }

        const outletIdx = this.activeRuns.filter(r => r.name.includes("Outlet") || r.id.includes("outlet")).length + 1;
        const newRun: ConduitRun = {
            id: `run-outlet-${Date.now()}`,
            name: `[${targetWall ? targetWall.wallId : "Bedroom"}] 120V 20A Duplex Outlet #${outletIdx}`,
            layer: "electrical",
            voltageOrType: "120V AC - 20A Duplex Receptacle",
            installer: "User (AR Spectacles Session)",
            installDate: "Nov 07, 2026",
            status: "INSTALLED & ENERGIZED",
            color: new vec4(1.0, 0.88, 0.15, 1.0),
            startPoint: dropTop,
            endPoint: outletWorldPos,
            isWorldCoords: true,
            roomZone: targetWall ? targetWall.wallId : "Master Bedroom",
            gauge: "12 AWG (20A)",
            isLive: true,
            thickness: 5.5
        };

        this.activeRuns.push(newRun);
        this.selectedRunId = newRun.id;
        this.createRunVisual(newRun, true);
        this.inspectRun(newRun);
        this.refreshAllJunctions();
        this.updateSafetyCheck();
        this.saveStateToStorage();

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `🔌 OUTLET #${outletIdx} ADDED: 120V 20A Receptacle mounted at (${outletWorldPos.x.toFixed(0)}, ${outletWorldPos.y.toFixed(0)})cm!`,
                new vec4(0.2, 1.0, 0.55, 1.0)
            );
        }

        return newRun;
    }

    // Exports all current user-drawn conduit runs as copy-pasteable TypeScript code
    public saveAndExportWiring(): string {
        this.saveStateToStorage();

        const runsCode = this.activeRuns.map(r => {
            return `    {
        id: "${r.id}",
        name: "${r.name}",
        layer: "${r.layer}",
        voltageOrType: "${r.voltageOrType}",
        installer: "${r.installer}",
        installDate: "${r.installDate}",
        status: "${r.status}",
        color: new vec4(${r.color.x.toFixed(2)}, ${r.color.y.toFixed(2)}, ${r.color.z.toFixed(2)}, ${r.color.w.toFixed(2)}),
        startPoint: new vec3(${r.startPoint.x.toFixed(1)}, ${r.startPoint.y.toFixed(1)}, ${r.startPoint.z.toFixed(1)}),
        endPoint: new vec3(${r.endPoint.x.toFixed(1)}, ${r.endPoint.y.toFixed(1)}, ${r.endPoint.z.toFixed(1)}),
        isWorldCoords: true,
        roomZone: "${r.roomZone || "Master Bedroom"}",
        gauge: "${r.gauge || "12 AWG (20A)"}",
        isLive: ${r.isLive !== false},
        thickness: ${r.thickness || 5.5}
    }`;
        }).join(",\n");

        const fullExport = `// =========================================================================\n// CONDUITXR SAVED WIRING RUNS (${this.activeRuns.length} Runs)\n// Paste this into INITIAL_CONDUIT_RUNS in ConduitTypes.ts to make it permanent:\n// =========================================================================\nexport const INITIAL_CONDUIT_RUNS: ConduitRun[] = [\n${runsCode}\n];\n`;

        print(fullExport);

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `💾 Saved ${this.activeRuns.length} Wires! Auto-persisted & printed to Logger (Press V)`,
                new vec4(0.2, 1.0, 0.55, 1.0)
            );
        }

        return fullExport;
    }

    // Exports all current conduit runs as a portable soft copy (JSON format)
    public exportWiringJson(): string {
        this.saveStateToStorage();

        const jsonRuns = this.activeRuns.map(r => ({
            id: r.id,
            name: r.name,
            layer: r.layer,
            voltageOrType: r.voltageOrType,
            installer: r.installer,
            installDate: r.installDate,
            status: r.status,
            color: {
                x: Number(r.color.x.toFixed(2)),
                y: Number(r.color.y.toFixed(2)),
                z: Number(r.color.z.toFixed(2)),
                w: Number(r.color.w.toFixed(2))
            },
            startPoint: {
                x: Number(r.startPoint.x.toFixed(1)),
                y: Number(r.startPoint.y.toFixed(1)),
                z: Number(r.startPoint.z.toFixed(1))
            },
            endPoint: {
                x: Number(r.endPoint.x.toFixed(1)),
                y: Number(r.endPoint.y.toFixed(1)),
                z: Number(r.endPoint.z.toFixed(1))
            },
            isWorldCoords: true,
            roomZone: r.roomZone || "General",
            gauge: r.gauge || "12 AWG (20A)",
            isLive: r.isLive !== false,
            thickness: r.thickness || 5.5,
            isConflict: !!r.isConflict,
            conflictWarning: r.conflictWarning || ""
        }));

        const jsonString = JSON.stringify(jsonRuns, null, 2);

        if (global.persistentStorageSystem) {
            try {
                global.persistentStorageSystem.store.putString("wiresight_exported_softcopy", jsonString);
            } catch (e) {
                // Storage fallback
            }
        }

        print("\n================== [WIRESIGHT_JSON_EXPORT_START] ==================");
        print(jsonString);
        print("================== [WIRESIGHT_JSON_EXPORT_END] ====================\n");

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `📤 Exported ${this.activeRuns.length} Wires to JSON Soft Copy! Saved in Logger & Storage (Press E)`,
                new vec4(0.2, 0.95, 1.0, 1.0)
            );
        }

        return jsonString;
    }

    // Imports conduit runs from a portable soft copy (JSON format) and instantiates them in 3D
    public importWiringJson(customJson?: string): number {
        let raw = customJson;
        if ((!raw || raw.trim().length === 0) && this.importJsonString && this.importJsonString.trim().length > 0) {
            raw = this.importJsonString.trim();
        }
        if ((!raw || raw.trim().length === 0) && global.persistentStorageSystem) {
            try {
                raw = global.persistentStorageSystem.store.getString("wiresight_exported_softcopy");
            } catch (e) {
                raw = "";
            }
        }

        if (!raw || raw.trim().length === 0) {
            print("[WireSight] Import Soft Copy: No JSON string found. Paste JSON into Inspector or press E to Export first.");
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(
                    "⚠️ No JSON soft copy found! Paste JSON into Inspector or press E to Export.",
                    new vec4(1.0, 0.4, 0.3, 1.0)
                );
            }
            return 0;
        }

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                throw new Error("JSON soft copy must be an array of ConduitRun objects.");
            }

            // Remove previous visuals
            for (const [id, obj] of this.runVisualObjects.entries()) {
                if (obj) {
                    try {
                        obj.destroy();
                    } catch (e) {
                        // Already destroyed
                    }
                }
            }
            this.runVisualObjects.clear();
            this.activeRuns = [];

            for (const item of parsed) {
                if (!item.id || !item.startPoint || !item.endPoint) continue;
                const col = item.color
                    ? new vec4(item.color.x, item.color.y, item.color.z, item.color.w !== undefined ? item.color.w : 1.0)
                    : new vec4(1.0, 0.88, 0.2, 1.0);
                const sPt = new vec3(item.startPoint.x, item.startPoint.y, item.startPoint.z);
                const ePt = new vec3(item.endPoint.x, item.endPoint.y, item.endPoint.z);

                const run: ConduitRun = {
                    id: item.id,
                    name: item.name || `Conduit ${item.id}`,
                    layer: item.layer || "electrical",
                    voltageOrType: item.voltageOrType || "120V AC",
                    installer: item.installer || "WireSight Specialist",
                    installDate: item.installDate || "2026-11-08",
                    status: item.status || "ACTIVE",
                    color: col,
                    startPoint: sPt,
                    endPoint: ePt,
                    isWorldCoords: true,
                    roomZone: item.roomZone || "General",
                    gauge: item.gauge || "12 AWG (20A)",
                    isLive: item.isLive !== false,
                    thickness: item.thickness || 5.5,
                    isConflict: !!item.isConflict,
                    conflictWarning: item.conflictWarning || ""
                };

                this.activeRuns.push(run);
                this.createRunVisual(run, true);
            }

            this.refreshAllJunctions();
            this.updateSafetyCheck();
            this.saveStateToStorage();

            if (this.activeRuns.length > 0) {
                this.inspectRun(this.activeRuns[0]);
            }

            print(`[WireSight] Successfully imported ${this.activeRuns.length} wiring runs from soft copy!`);
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(
                    `📥 Successfully Imported ${this.activeRuns.length} Wires from Soft Copy! Active in 3D (Press I)`,
                    new vec4(0.2, 1.0, 0.5, 1.0)
                );
            }

            return this.activeRuns.length;
        } catch (err) {
            print(`[WireSight] Failed to parse JSON soft copy: ${err}`);
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(
                    "⚠️ Invalid JSON soft copy format!",
                    new vec4(1.0, 0.35, 0.35, 1.0)
                );
            }
            return 0;
        }
    }

    // Renders the 3D visual for a node point: Duplex Outlet Faceplate, Ceiling Fixture, Junction Box, or Grip Node
    private renderPointVisual(pt: vec3, run: ConduitRun, isJunc: boolean, isSelected: boolean) {
        if (!global.debugRenderSystem) return;

        const outletInfo = this.isOutletPoint(pt);
        const sphereRadius = Math.max(2.6, (run.thickness || 5.0) * 0.55);
        const wireColor = isSelected ? new vec4(1.0, 0.95, 0.35, 1.0) : run.color;
        const ringColor = isSelected ? new vec4(1.0, 0.85, 0.2, 0.95) : new vec4(1.0, 1.0, 1.0, 0.85);

        if (outletInfo.isCeilingFixture) {
            // 💡 CEILING LUMINAIRE FIXTURE (Canopy Rosette + Glowing Center)
            const canopyRim = new vec4(1.0, 0.95, 0.5, 0.95);
            const canopyInner = new vec4(1.0, 0.85, 0.2, 0.95);
            global.debugRenderSystem.drawCircle(pt, 6.0, canopyRim);
            global.debugRenderSystem.drawCircle(pt, 3.8, canopyInner);
            global.debugRenderSystem.drawSolidSphere(pt, 2.2, new vec4(1.0, 1.0, 0.85, 1.0));
            return;
        }

        if (outletInfo.isOutlet) {
            // 🔌 REALISTIC ARCHITECTURAL DUPLEX ELECTRICAL WALL OUTLET RECEPTACLE
            const wall = this.getWallForPoint(pt);
            const wallRot = wall ? wall.getSceneObject().getTransform().getWorldRotation() : quat.fromEulerAngles(0, 0, 0);

            // Single-Gang Duplex Wall Plate: 7.2cm x 11.6cm
            const halfW = 3.6;
            const halfH = 5.8;
            const faceOffsetZ = 1.8;

            const cTL = pt.add(wallRot.multiplyVec3(new vec3(-halfW, halfH, faceOffsetZ)));
            const cTR = pt.add(wallRot.multiplyVec3(new vec3(halfW, halfH, faceOffsetZ)));
            const cBR = pt.add(wallRot.multiplyVec3(new vec3(halfW, -halfH, faceOffsetZ)));
            const cBL = pt.add(wallRot.multiplyVec3(new vec3(-halfW, -halfH, faceOffsetZ)));

            const plateBorder = new vec4(1.0, 0.95, 0.82, 0.95); // Ivory faceplate frame
            const plateGlow = isSelected ? new vec4(1.0, 0.95, 0.4, 1.0) : new vec4(1.0, 0.85, 0.20, 0.95); // Energized gold

            // 1. Outer Faceplate Bevel
            global.debugRenderSystem.drawLine(cTL, cTR, plateBorder);
            global.debugRenderSystem.drawLine(cTR, cBR, plateBorder);
            global.debugRenderSystem.drawLine(cBR, cBL, plateBorder);
            global.debugRenderSystem.drawLine(cBL, cTL, plateBorder);

            // 2. Inner Metallic Receptacle Box Outline
            const inW = 2.8;
            const inH = 4.8;
            const bTL = pt.add(wallRot.multiplyVec3(new vec3(-inW, inH, faceOffsetZ)));
            const bTR = pt.add(wallRot.multiplyVec3(new vec3(inW, inH, faceOffsetZ)));
            const bBR = pt.add(wallRot.multiplyVec3(new vec3(inW, -inH, faceOffsetZ)));
            const bBL = pt.add(wallRot.multiplyVec3(new vec3(-inW, -inH, faceOffsetZ)));

            global.debugRenderSystem.drawLine(bTL, bTR, plateGlow);
            global.debugRenderSystem.drawLine(bTR, bBR, plateGlow);
            global.debugRenderSystem.drawLine(bBR, bBL, plateGlow);
            global.debugRenderSystem.drawLine(bBL, bTL, plateGlow);

            // 3. Top Duplex Receptacle Socket (with 3-prong slots)
            const topSockCenter = pt.add(wallRot.multiplyVec3(new vec3(0, 2.5, faceOffsetZ + 0.2)));
            global.debugRenderSystem.drawCircle(topSockCenter, 2.1, plateGlow);
            global.debugRenderSystem.drawSolidSphere(topSockCenter, 1.2, new vec4(0.12, 0.12, 0.16, 0.95));

            const slotCol = new vec4(0.92, 0.92, 0.98, 0.95);
            // Left (Neutral) Slot (taller)
            const tNL1 = topSockCenter.add(wallRot.multiplyVec3(new vec3(-0.75, 0.7, 0.2)));
            const tNL2 = topSockCenter.add(wallRot.multiplyVec3(new vec3(-0.75, -0.7, 0.2)));
            global.debugRenderSystem.drawLine(tNL1, tNL2, slotCol);
            // Right (Hot) Slot (shorter)
            const tHL1 = topSockCenter.add(wallRot.multiplyVec3(new vec3(0.75, 0.55, 0.2)));
            const tHL2 = topSockCenter.add(wallRot.multiplyVec3(new vec3(0.75, -0.55, 0.2)));
            global.debugRenderSystem.drawLine(tHL1, tHL2, slotCol);
            // Ground pin hole
            const tGround = topSockCenter.add(wallRot.multiplyVec3(new vec3(0, -1.1, 0.2)));
            global.debugRenderSystem.drawSolidSphere(tGround, 0.45, slotCol);

            // 4. Bottom Duplex Receptacle Socket (with 3-prong slots)
            const botSockCenter = pt.add(wallRot.multiplyVec3(new vec3(0, -2.5, faceOffsetZ + 0.2)));
            global.debugRenderSystem.drawCircle(botSockCenter, 2.1, plateGlow);
            global.debugRenderSystem.drawSolidSphere(botSockCenter, 1.2, new vec4(0.12, 0.12, 0.16, 0.95));

            // Left (Neutral) Slot
            const bNL1 = botSockCenter.add(wallRot.multiplyVec3(new vec3(-0.75, 0.7, 0.2)));
            const bNL2 = botSockCenter.add(wallRot.multiplyVec3(new vec3(-0.75, -0.7, 0.2)));
            global.debugRenderSystem.drawLine(bNL1, bNL2, slotCol);
            // Right (Hot) Slot
            const bHL1 = botSockCenter.add(wallRot.multiplyVec3(new vec3(0.75, 0.55, 0.2)));
            const bHL2 = botSockCenter.add(wallRot.multiplyVec3(new vec3(0.75, -0.55, 0.2)));
            global.debugRenderSystem.drawLine(bHL1, bHL2, slotCol);
            // Ground pin hole
            const bGround = botSockCenter.add(wallRot.multiplyVec3(new vec3(0, -1.1, 0.2)));
            global.debugRenderSystem.drawSolidSphere(bGround, 0.45, slotCol);

            // Center mounting screw
            global.debugRenderSystem.drawSolidSphere(pt.add(wallRot.multiplyVec3(new vec3(0, 0, faceOffsetZ + 0.2))), 0.4, new vec4(0.85, 0.85, 0.90, 0.95));
            return;
        }

        if (isJunc) {
            // ⬢ UNIFIED CIRCUIT JUNCTION BOX
            const jBoxCol = new vec4(1.0, 0.85, 0.20, 1.0);
            global.debugRenderSystem.drawSolidSphere(pt, sphereRadius + 1.2, jBoxCol);
            global.debugRenderSystem.drawCircle(pt, sphereRadius + 2.8, new vec4(1.0, 0.75, 0.1, 0.95));
            return;
        }

        // ◉ STANDARD WIRE GRIP NODE
        global.debugRenderSystem.drawSolidSphere(pt, sphereRadius, wireColor);
        global.debugRenderSystem.drawCircle(pt, sphereRadius + 2.2, ringColor);
    }

    // Renders glowing 3D world-locked lines, grip spheres, and midpoint handles
    private renderConduitLinesDebug() {
        if (!global.debugRenderSystem) return;

        // When WireSight is OFF, concealed conduits & framing are hidden,
        // BUT physical electrical wall outlets mounted on the drywall REMAIN VISIBLE!
        if (!this.isWireSightActive) {
            for (const run of this.activeRuns) {
                if (run.id.startsWith("run-") && !this.isUserRunsVisible) continue;
                const outletInfo = this.isOutletPoint(run.endPoint);
                if (outletInfo.isOutlet) {
                    this.renderPointVisual(run.endPoint, run, false, run.id === this.selectedRunId);
                }
            }
            return;
        }

        const isElec = this.toolPalette ? this.toolPalette.getIsElectricalOn() : true;
        const isPlumb = this.toolPalette ? this.toolPalette.getIsPlumbingOn() : true;

        const camObj = this.findCamera();
        const camPos = camObj ? camObj.getTransform().getWorldPosition() : new vec3(0, 0, 0);

        const renderedJunctions: vec3[] = [];
        const isPointRendered = (p: vec3) => {
            return renderedJunctions.some(existing => existing.distance(p) <= 10.0);
        };

        for (const run of this.activeRuns) {
            if (run.id.startsWith("run-") && !this.isUserRunsVisible) continue;
            if (run.layer === "electrical" && !isElec) continue;
            if (run.layer === "plumbing" && !isPlumb) continue;

            const pA = run.startPoint;
            const pB = run.endPoint;
            const pMid = pA.add(pB).uniformScale(0.5);

            // Check Room Isolation Filter
            const isRoomMatch = this.activeRoomFilter === "all" ||
                (run.roomZone && run.roomZone.toLowerCase().includes(this.activeRoomFilter.toLowerCase()));

            if (!isRoomMatch) {
                // Dim ghost line for runs outside active room filter (keeps spatial context, removes clutter)
                const ghostColor = new vec4(run.color.x * 0.4, run.color.y * 0.4, run.color.z * 0.4, 0.18);
                global.debugRenderSystem.drawLine(pA, pB, ghostColor);
                continue;
            }

            const isSelected = this.selectedRunIds.has(run.id) || this.selectedRunId === run.id;
            const wireColor = isSelected ? new vec4(1.0, 0.95, 0.35, 1.0) : run.color;

            // 1. Draw thin glowing conduit wire line (keeps outlets & wall texture visible)
            global.debugRenderSystem.drawLine(pA, pB, wireColor);

            // 2. Interactive pinch grip / unified junction box / duplex outlet fittings
            const isJuncA = this.isJunctionPoint(pA, run.id);
            if (!isPointRendered(pA)) {
                renderedJunctions.push(pA);
                this.renderPointVisual(pA, run, isJuncA, isSelected);
            }

            const isJuncB = this.isJunctionPoint(pB, run.id);
            if (!isPointRendered(pB)) {
                renderedJunctions.push(pB);
                this.renderPointVisual(pB, run, isJuncB, isSelected);
            }

            // 4. Center grip slider handle
            global.debugRenderSystem.drawSolidSphere(pMid, 2.0, new vec4(1.0, 1.0, 1.0, 0.95));

            // 5. Live Circuit Current Flow Tracer (Animated pulse flowing along live wires)
            if (typeof getTime === "function") {
                const pulseT = (getTime() * 1.5) % 1.0;
                const pulsePt = pA.add(pB.sub(pA).uniformScale(pulseT));
                const pulseCol = run.layer === "electrical"
                    ? (run.isLive !== false ? new vec4(1.0, 1.0, 0.45, 0.95) : new vec4(0.4, 0.75, 1.0, 0.85))
                    : new vec4(0.2, 0.9, 1.0, 0.95);
                global.debugRenderSystem.drawSolidSphere(pulsePt, 2.6, pulseCol);
            }
        }
    }

    // Applies room isolation filter to 3D labels and grip handles
    public applyRoomFilter() {
        for (const run of this.activeRuns) {
            const visualObj = this.runVisualObjects.get(run.id);
            if (!visualObj) continue;

            const isMatch = Boolean(this.activeRoomFilter === "all" ||
                (run.roomZone && run.roomZone.toLowerCase().includes(this.activeRoomFilter.toLowerCase())));

            const jboxA = this.findChildByName(visualObj, "JBoxA");
            const jboxB = this.findChildByName(visualObj, "JBoxB");
            const label = this.findChildByName(visualObj, "ConduitSpecLabel");

            if (jboxA) jboxA.enabled = isMatch;
            if (jboxB) jboxB.enabled = isMatch;
            if (label) label.enabled = isMatch;
        }
    }

    // Assigns room zone to selected runs or all connected runs
    public assignRoomToSelection(room: RoomPreset) {
        if (this.activeRuns.length === 0) return;

        // Target selected runs, or all runs connected to current selection, or last run
        let targetRunIds: string[] = [];
        if (this.selectedRunIds.size > 0) {
            targetRunIds = Array.from(this.selectedRunIds);
        } else if (this.selectedRunId) {
            targetRunIds = this.getConnectedRunIds(this.selectedRunId);
        } else {
            targetRunIds = [this.activeRuns[this.activeRuns.length - 1].id];
        }

        let count = 0;
        for (const run of this.activeRuns) {
            if (targetRunIds.indexOf(run.id) !== -1) {
                run.roomZone = room.name;
                // Add room prefix to name if not present
                run.name = run.name.replace(/^\[.*?\]\s*/, "");
                run.name = `[${room.name}] ${run.name}`;
                this.updateRunVisualPositions(run);
                count++;
            }
        }

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(`🏷️ Assigned ${count} circuit(s) to ${room.name}!`, new vec4(1.0, 0.75, 0.2, 1.0));
        }
        this.applyRoomFilter();
    }

    // Finds all runs connected to a given run by shared endpoints (corner nodes)
    public getConnectedRunIds(rootId: string): string[] {
        const connected = new Set<string>([rootId]);
        let addedNew = true;
        const SNAP_TOLERANCE_CM = 15.0;

        while (addedNew) {
            addedNew = false;
            for (const run of this.activeRuns) {
                if (connected.has(run.id)) continue;

                for (const connId of Array.from(connected)) {
                    const connRun = this.activeRuns.find(r => r.id === connId);
                    if (!connRun) continue;

                    const dAA = run.startPoint.distance(connRun.startPoint);
                    const dAB = run.startPoint.distance(connRun.endPoint);
                    const dBA = run.endPoint.distance(connRun.startPoint);
                    const dBB = run.endPoint.distance(connRun.endPoint);

                    if (dAA <= SNAP_TOLERANCE_CM || dAB <= SNAP_TOLERANCE_CM ||
                        dBA <= SNAP_TOLERANCE_CM || dBB <= SNAP_TOLERANCE_CM) {
                        connected.add(run.id);
                        addedNew = true;
                        break;
                    }
                }
            }
        }
        return Array.from(connected);
    }

    private updateSafetyCheck() {
        if (!this.drillSafetyTool || !this.toolPalette || !this.toolPalette.getIsDrillToolOn()) return;

        const camObj = this.findCamera();
        if (!camObj) return;

        const camComp = camObj.getComponent("Component.Camera") as Camera;
        if (!camComp) return;

        // Drill reticle is projected 140cm directly ahead in center of gaze
        const reticleWorldPos = camComp.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 140.0);
        this.drillSafetyTool.setPosition(reticleWorldPos);

        const filteredRuns = this.activeRuns.filter(r => {
            if (r.layer === "electrical" && !this.toolPalette!.getIsElectricalOn()) return false;
            if (r.layer === "plumbing" && !this.toolPalette!.getIsPlumbingOn()) return false;
            return true;
        });

        this.drillSafetyTool.checkProximity(filteredRuns, reticleWorldPos);
    }

    public inspectRun(run: ConduitRun) {
        if (this.inspectionCard) {
            const mid = run.startPoint.add(run.endPoint).uniformScale(0.5);
            this.inspectionCard.show(run, mid);
        }
    }

    public inspectRunById(id: string) {
        const run = this.activeRuns.find(r => r.id === id);
        if (run) {
            this.selectedRunId = run.id;
            this.inspectRun(run);
        }
    }

    public closeInspection() {
        if (this.inspectionCard) {
            this.inspectionCard.hide();
        }
    }

    public teleportToRoom(roomIndex: number): string {
        if (roomIndex < 0 || roomIndex >= HOUSE_ROOMS.length) return "";
        const room = HOUSE_ROOMS[roomIndex];
        const camObj = this.findCamera();
        if (camObj) {
            camObj.getTransform().setWorldPosition(room.cameraPos);
            camObj.getTransform().setWorldRotation(room.cameraRot);
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(`📍 Teleported to ${room.icon} ${room.name}`, new vec4(0.3, 0.95, 1.0, 1.0));
            }
        }

        // Set matching wall as active wall if one exists
        const wallIdMatch = `wall-${room.id}`;
        const matchIdx = this.activeWalls.findIndex(w => w.wallId === wallIdMatch || (room.id === "bedroom" && (w.wallIndex === 1 || w.wallId === "wall-bedroom")));
        if (matchIdx >= 0) {
            this.activeWallIndex = matchIdx;
            for (let i = 0; i < this.activeWalls.length; i++) {
                this.activeWalls[i].setIsActiveWall(i === matchIdx);
            }
            this.alignBreakerPanelToActiveWall();
            this.updateMultiWallUI();
        }

        return room.id;
    }

    public wireEntireHouse(preserveExistingRuns: boolean = true): number {
        print("[WireSight] Wiring entire residential house (Kitchen, Living, Utility, Bedroom, Corridor)...");

        // 1. Ensure HouseEnvironment instance exists
        if (!this.houseEnvironment) {
            const houseObj = global.scene.createSceneObject("HouseEnvironmentRoot");
            this.houseEnvironment = houseObj.createComponent(HouseEnvironment.getTypeName()) as HouseEnvironment;
        }

        // 2. Setup architectural room walls (scaled 3X spacious estate)
        const targetWalls = [
            { id: "wall-kitchen", name: "HouseWall_North_Kitchen", pos: new vec3(-500, 0, -800), yaw: 0, w: 720, h: 360 },
            { id: "wall-living", name: "HouseWall_North_Living", pos: new vec3(500, 0, -800), yaw: 0, w: 720, h: 360 },
            { id: "wall-utility", name: "HouseWall_Utility", pos: new vec3(-500, 0, 400), yaw: 180, w: 720, h: 360 }
        ];

        // If no walls exist at all, also add bedroom wall
        if (this.activeWalls.length === 0) {
            targetWalls.push({ id: "wall-bedroom", name: "HouseWall_Bedroom", pos: new vec3(500, 0, 400), yaw: 180, w: 720, h: 360 });
        } else if (this.activeWalls.length > 0) {
            // Label user's existing wall as bedroom wall if it's the primary one
            const primaryWall = this.activeWalls[0];
            if (primaryWall && !primaryWall.wallId.includes("kitchen") && !primaryWall.wallId.includes("living") && !primaryWall.wallId.includes("utility")) {
                primaryWall.wallId = "wall-bedroom";
            }
        }

        for (const tw of targetWalls) {
            const alreadyExists = this.activeWalls.some(w => w.wallId === tw.id);
            if (!alreadyExists) {
                const wallIdx = this.activeWalls.length + 1;
                const wallObj = global.scene.createSceneObject(tw.name);
                const wallComp = wallObj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
                wallComp.wallIndex = wallIdx;
                wallComp.wallId = tw.id;
                wallComp.widthCm = tw.w;
                wallComp.heightCm = tw.h;
                wallComp.initialPosition = tw.pos;
                wallComp.initialRotation = quat.fromEulerAngles(0, (tw.yaw * Math.PI) / 180.0, 0);
                wallComp.setIsActiveWall(false);
                this.activeWalls.push(wallComp);
            }
        }

        // Re-index all active walls
        for (let i = 0; i < this.activeWalls.length; i++) {
            this.activeWalls[i].wallIndex = i + 1;
        }

        // Update tools with all active walls
        if (this.lineMarkerTool) {
            this.lineMarkerTool.setReferenceWalls(this.activeWalls);
        }

        // 3. Anchor Main Breaker Panel to the Utility Room wall
        this.alignBreakerPanelToActiveWall();

        // 4. Retrieve whole-house MEP runs from HouseEnvironment
        const prewiredRuns = this.houseEnvironment.getPrewiredHouseConduits();
        let addedCount = 0;

        for (const r of prewiredRuns) {
            const exists = this.activeRuns.some(existing => existing.id === r.id);
            if (!exists) {
                this.activeRuns.push(r);
                this.createRunVisual(r, true);
                addedCount++;
            }
        }

        // 5. Update UI & Status
        this.updateMultiWallUI();
        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `⚡ ENTIRE HOUSE WIRED! ${this.activeRuns.length} Circuits active across 4 Rooms. Tap [ROOM ⟳] to tour!`,
                new vec4(0.2, 1.0, 0.5, 1.0)
            );
            this.toolPalette.updateWallCycleText(this.activeWallIndex + 1, this.activeWalls.length);
        }

        print(`[WireSight] Wire Entire House complete: ${addedCount} runs added, total runs: ${this.activeRuns.length}, total walls: ${this.activeWalls.length}`);
        return this.activeRuns.length;
    }

    public setDrillPosition(x: number, y: number) {
        if (this.drillSafetyTool) {
            this.drillSafetyTool.setPosition(new vec3(x, y, 1));
            this.updateSafetyCheck();
        }
    }

    public getActiveWall(): ReferenceWall | null {
        if (this.activeWalls.length === 0) return null;
        if (this.activeWallIndex < 0 || this.activeWallIndex >= this.activeWalls.length) {
            this.activeWallIndex = 0;
        }
        return this.activeWalls[this.activeWallIndex];
    }

    public getActiveWalls(): ReferenceWall[] {
        return this.activeWalls;
    }

    public rotateActiveWall(deltaDegrees: number = 5.0): number {
        const wall = this.getActiveWall();
        if (!wall) return 0;

        const newYaw = wall.rotateWall(deltaDegrees);
        this.alignBreakerPanelToActiveWall();
        this.updateMultiWallUI();

        if (this.toolPalette) {
            const sign = deltaDegrees > 0 ? "+" : "";
            this.toolPalette.setStatusMessage(
                `🔄 Wall #${wall.wallIndex} Yaw: ${newYaw}° (${sign}${deltaDegrees}°)`,
                new vec4(0.2, 0.95, 1.0, 1.0)
            );
        }
        this.saveStateToStorage();
        return newYaw;
    }

    public setWallRotationDegrees(degrees: number): number {
        const wall = this.getActiveWall();
        if (!wall) return 0;

        wall.setWallYaw(degrees);
        this.alignBreakerPanelToActiveWall();
        this.updateMultiWallUI();

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `🔄 Wall #${wall.wallIndex} Exact Yaw: ${wall.getWallYaw()}°`,
                new vec4(0.2, 0.95, 1.0, 1.0)
            );
        }
        return wall.getWallYaw();
    }

    public cycleActiveWall(): ReferenceWall | null {
        if (this.activeWalls.length <= 1) {
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage("Only 1 wall in scene. Tap [➕ WALL] or press N to add more!", new vec4(1.0, 0.85, 0.2, 1.0));
            }
            return this.getActiveWall();
        }

        this.activeWallIndex = (this.activeWallIndex + 1) % this.activeWalls.length;
        for (let i = 0; i < this.activeWalls.length; i++) {
            this.activeWalls[i].setIsActiveWall(i === this.activeWallIndex);
        }

        const active = this.getActiveWall();
        if (active) {
            this.referenceWall = active;
            if (this.wallCreatorTool) {
                this.wallCreatorTool.setReferenceWall(active);
            }
            this.alignBreakerPanelToActiveWall();
            this.updateMultiWallUI();
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(
                    `★ Selected Wall #${active.wallIndex} (${active.widthCm}x${active.heightCm}cm, ${active.getWallYaw()}°)`,
                    new vec4(0.3, 0.95, 1.0, 1.0)
                );
            }
        }
        return active;
    }

    public addNewWall(customPos?: vec3, customYawDeg?: number): ReferenceWall {
        const wallIdx = this.activeWalls.length + 1;
        const newWallObj = global.scene.createSceneObject(`HolographicReferenceWall_${wallIdx}`);
        const newWall = newWallObj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
        newWall.wallIndex = wallIdx;
        newWall.wallId = `wall-${wallIdx}`;

        // Smart architectural placement
        let pos: vec3;
        let yawDeg: number;

        if (customPos) {
            pos = customPos;
            yawDeg = customYawDeg !== undefined ? customYawDeg : 0;
        } else if (this.activeWalls.length === 1) {
            // Standard Architectural L-Corner: Wall 2 forms 90° left perpendicular wall
            const w1 = this.activeWalls[0];
            const w1Pos = w1.getSceneObject().getTransform().getWorldPosition();
            const halfW = w1.widthCm * 0.5;
            pos = new vec3(w1Pos.x - halfW, w1Pos.y, w1Pos.z + halfW);
            yawDeg = 90.0;
        } else if (this.activeWalls.length === 2) {
            // Wall 3 forms opposite 270° right perpendicular wall
            const w1 = this.activeWalls[0];
            const w1Pos = w1.getSceneObject().getTransform().getWorldPosition();
            const halfW = w1.widthCm * 0.5;
            pos = new vec3(w1Pos.x + halfW, w1Pos.y, w1Pos.z + halfW);
            yawDeg = 270.0;
        } else {
            // Default 1.8m in front of camera
            const camPos = this.glassesCamera
                ? this.glassesCamera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 180.0)
                : new vec3(0, 0, -180.0);
            pos = new vec3(camPos.x, 0, camPos.z);
            yawDeg = 0;
        }

        newWall.getSceneObject().getTransform().setWorldPosition(pos);
        newWall.setWallYaw(yawDeg);

        // Update active selection to newly spawned wall
        for (const w of this.activeWalls) {
            w.setIsActiveWall(false);
        }
        newWall.setIsActiveWall(true);

        this.activeWalls.push(newWall);
        this.activeWallIndex = this.activeWalls.length - 1;
        this.referenceWall = newWall;

        // Update tools
        if (this.lineMarkerTool) {
            this.lineMarkerTool.setReferenceWalls(this.activeWalls);
        }
        if (this.wallCreatorTool) {
            this.wallCreatorTool.setReferenceWall(newWall);
        }

        this.alignBreakerPanelToActiveWall();
        this.updateMultiWallUI();

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `➕ Wall #${wallIdx} added! (${newWall.widthCm}x${newWall.heightCm}cm at ${yawDeg}°)`,
                new vec4(0.2, 1.0, 0.5, 1.0)
            );
        }
        print(`[WireSight] Added Wall #${wallIdx} at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}) yaw ${yawDeg}°`);
        this.saveStateToStorage();
        return newWall;
    }

    public deleteActiveWall(): boolean {
        if (this.activeWalls.length === 0) {
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage("No walls to delete.", new vec4(1.0, 0.7, 0.3, 1.0));
            }
            return false;
        }

        const target = this.getActiveWall();
        if (!target) return false;

        // Foundation Walls #1 & #2 (Master Bedroom back wall & TV corner) are protected foundation assets!
        if (target.wallId === "wall-bedroom" || target.wallId === "wall-corner" || this.activeWalls.length <= 2) {
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(
                    "🔒 Foundation Walls #1 & #2 are protected and cannot be deleted.",
                    new vec4(1.0, 0.85, 0.2, 1.0)
                );
            }
            print(`[WireSight] Prevented deletion of protected foundation wall: ${target.wallId}`);
            return false;
        }

        const deletedIdx = target.wallIndex;
        target.destroyWall();

        this.activeWalls.splice(this.activeWallIndex, 1);

        if (this.activeWalls.length > 0) {
            if (this.activeWallIndex >= this.activeWalls.length) {
                this.activeWallIndex = this.activeWalls.length - 1;
            }
            // Renumber remaining walls
            for (let i = 0; i < this.activeWalls.length; i++) {
                this.activeWalls[i].wallIndex = i + 1;
                this.activeWalls[i].setIsActiveWall(i === this.activeWallIndex);
            }
            const newActive = this.getActiveWall()!;
            this.referenceWall = newActive;
            if (this.wallCreatorTool) {
                this.wallCreatorTool.setReferenceWall(newActive);
            }
            if (this.lineMarkerTool) {
                this.lineMarkerTool.setReferenceWalls(this.activeWalls);
            }
            this.alignBreakerPanelToActiveWall();
            this.updateMultiWallUI();
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage(
                    `🗑️ Wall #${deletedIdx} deleted. Switched to Wall #${newActive.wallIndex}`,
                    new vec4(1.0, 0.7, 0.3, 1.0)
                );
            }
        } else {
            this.referenceWall = null;
            this.activeWallIndex = 0;
            if (this.wallCreatorTool) {
                this.wallCreatorTool.setReferenceWall(null as any);
            }
            if (this.lineMarkerTool) {
                this.lineMarkerTool.setReferenceWalls([]);
            }
            this.updateMultiWallUI();
            if (this.toolPalette) {
                this.toolPalette.setStatusMessage("🗑️ Wall deleted. 0 walls left. Press N or tap [➕ WALL] to spawn!", new vec4(1.0, 0.5, 0.3, 1.0));
            }
        }
        this.saveStateToStorage();
        return true;
    }

    public cycleActiveWallSize(): void {
        const wall = this.getActiveWall();
        if (!wall) return;

        const preset = wall.cycleWallPresetSize();
        this.alignBreakerPanelToActiveWall();
        this.updateMultiWallUI();
        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `📐 Wall #${wall.wallIndex} Resized: ${preset.name} (${Math.floor(preset.w / 40.64) + 1} Studs)`,
                new vec4(0.2, 0.95, 1.0, 1.0)
            );
        }
        this.saveStateToStorage();
    }

    public updateMultiWallUI(): void {
        if (!this.toolPalette) return;
        const active = this.getActiveWall();
        const count = this.activeWalls.length;
        const currentIdx = active ? active.wallIndex : 0;
        const yaw = active ? active.getWallYaw() : 0;
        const sizePreset = active ? active.getWallPresetName() : "None";

        this.toolPalette.updateWallInfo(currentIdx, count, yaw, sizePreset);
    }

    public getNewOutletObject(): SceneObject | null { return this.newOutletObject; }
    public getToolPalette(): ToolPaletteUI | null { return this.toolPalette; }
    public getInspectionCard(): RunInspectionCard | null { return this.inspectionCard; }
    public getDrillSafetyTool(): DrillSafetyTool | null { return this.drillSafetyTool; }
    public getLineMarkerTool(): LineMarkerTool | null { return this.lineMarkerTool; }
    public getActiveRuns(): ConduitRun[] { return this.activeRuns; }
    public getSelectedRunId(): string | null { return this.selectedRunId; }
}
