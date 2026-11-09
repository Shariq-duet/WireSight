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

export interface BreakerInfo {
    isBreaker: boolean;
    num: number;
    label: string;
    room: string;
    amperage: number;
    isOn: boolean;
    terminalPos: vec3;
    isLeftCol: boolean;
    isMain: boolean;
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
    private orbitTarget: vec3 = new vec3(0, 0, -200);

    // Cinematic estate camera pan across all 8 rooms
    private isCinematicPanning: boolean = false;
    private cinematicPanProgress: number = 0.0;
    private cinematicPanDirection: number = 1.0;

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
        // Clean up any stray HouseWall_ objects from previous test runs so no phantom walls follow the camera
        const rootCount = global.scene.getRootObjectsCount();
        for (let i = rootCount - 1; i >= 0; i--) {
            const rootObj = global.scene.getRootObject(i);
            if (rootObj && rootObj.name.startsWith("HouseWall_") && (rootObj.name.includes("bedroom") || rootObj.name.includes("living") || rootObj.name.includes("utility"))) {
                rootObj.destroy();
            }
        }

        // Keep reference walls enabled and visible so users have wall framing in every room
        for (const wall of this.activeWalls) {
            if (wall.getSceneObject()) {
                wall.getSceneObject().enabled = true;
            }
        }
        this.runVisualObjects.forEach((runObj, runId) => {
            if (runId.startsWith("run-") && !runId.includes("outlet") && !runId.includes("tapin")) {
                runObj.enabled = false;
            } else {
                runObj.enabled = true;
            }
        });
        this.saveStateToStorage();
        // Automatically spawn in Master Bedroom facing the wall & wiring on launch
        this.teleportToRoom(4);
    }

    private findCamera(): SceneObject | null {
        if (this.activeCameraMode === "inspector" && this.inspectorCameraObj) {
            return this.inspectorCameraObj;
        }
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
                camComp.far = 5000.0;
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
        if (!this.inspectorCameraObj) {
            this.inspectorCameraObj = global.scene.createSceneObject("InspectorCamera");
            this.inspectorCamera = this.inspectorCameraObj.createComponent("Component.Camera") as Camera;
        }

        if (this.glassesCamera && this.inspectorCamera) {
            this.inspectorCamera.renderTarget = this.glassesCamera.renderTarget;
            this.inspectorCamera.near = 1.0;
            this.inspectorCamera.far = 5000.0;
            // Lens Studio camera FOV is in radians (0, PI)
            this.inspectorCamera.fov = this.glassesCamera.fov || ((65.0 * Math.PI) / 180.0);
            try {
                if (this.glassesCamera.renderOrder !== undefined) {
                    this.inspectorCamera.renderOrder = this.glassesCamera.renderOrder;
                }
                if (this.glassesCamera.renderLayer) {
                    this.inspectorCamera.renderLayer = this.glassesCamera.renderLayer;
                }
            } catch (e) {
                // Ignore layer/order copy error if unsupported
            }
        }

        if (this.inspectorCamera) {
            this.inspectorCamera.enabled = false;
        }
        this.applyInspectorPreset("iso");
        print("[WireSight] Camera 2 (InspectorCamera) created! Can move in Scene panel or orbit in Preview.");
    }

    public switchCameraView(): string {
        if (!this.glassesCamera || !this.inspectorCamera) return this.activeCameraMode;

        this.activeCameraMode = (this.activeCameraMode === "glasses") ? "inspector" : "glasses";
        const isGlasses = (this.activeCameraMode === "glasses");

        this.glassesCamera.enabled = isGlasses;
        this.inspectorCamera.enabled = !isGlasses;

        if (this.glassesCameraObj) {
            const dt = this.glassesCameraObj.getComponent("Component.DeviceTracking");
            if (dt) dt.enabled = isGlasses;
        }

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
            this.toolPalette.summonInWorld();
        }

        print(`[WireSight] Active Camera switched to: ${this.activeCameraMode.toUpperCase()}`);
        return this.activeCameraMode;
    }

    public cycleInspectorPreset(): string {
        const PRESETS: ("iso" | "side" | "top" | "orbit" | "pan")[] = ["iso", "side", "top", "orbit", "pan"];
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
        const LABELS = ["45° ISO", "SIDE", "TOP-DOWN", "ORBIT", "🎬 ESTATE PAN"];
        return LABELS[this.inspectorPresetIndex] || "45° ISO";
    }

    private applyInspectorPreset(preset: "iso" | "side" | "top" | "orbit" | "pan") {
        if (!this.inspectorCameraObj) return;

        let pos = new vec3(100, 850, 950);
        let target = new vec3(100, 60, 180);

        if (preset === "side") {
            // Perpendicular to line of sight — directly reveals depth from glasses to wall!
            this.isCinematicPanning = false;
            pos = new vec3(-190, 15, -100);
            target = new vec3(0, 15, -100);
            this.orbitYaw = -Math.PI / 2;
            this.orbitPitch = 0.05;
        } else if (preset === "top") {
            // Straight down from ceiling — blueprint layout over entire estate
            this.isCinematicPanning = false;
            pos = new vec3(100, 750, 180);
            target = new vec3(100, 0, 180);
            this.orbitYaw = 0;
            this.orbitPitch = 1.25;
        } else if (preset === "orbit") {
            this.isCinematicPanning = false;
            pos = new vec3(115, 85, -70);
            target = new vec3(0, 0, -200);
            this.orbitYaw = 0.55;
            this.orbitPitch = 0.32;
        } else if (preset === "pan") {
            // Smooth horizontal cinematic glide across all 8 wired rooms!
            this.isCinematicPanning = true;
            this.cinematicPanProgress = 0.0;
            this.cinematicPanDirection = 1.0;
            pos = new vec3(-650, 520, 780);
            target = new vec3(-650, 60, 120);
            this.orbitYaw = 0.0;
            this.orbitPitch = 0.55;
        } else {
            // iso (default 45-degree elevated view framing all 8 rooms)
            this.isCinematicPanning = false;
            pos = new vec3(100, 850, 950);
            target = new vec3(100, 60, 180);
            this.orbitYaw = -0.55;
            this.orbitPitch = 0.32;
        }

        this.orbitTarget = target;
        this.orbitDist = pos.distance(target);
        this.inspectorCameraObj.getTransform().setWorldPosition(pos);
        const forward = target.sub(pos).normalize();
        const up = (preset === "top") ? new vec3(0, 0, -1) : new vec3(0, 1, 0);
        this.inspectorCameraObj.getTransform().setWorldRotation(quat.lookAt(forward, up));
    }

    public updateCinematicCameraPan(): void {
        if (!this.isCinematicPanning || !this.inspectorCameraObj) return;

        // Smoothly glide camera horizontally across the entire 8-room estate:
        // From West (Bathroom X = -650) to East (Garage X = 750)
        const dt = 0.016;
        this.cinematicPanProgress += dt * 0.06 * this.cinematicPanDirection;
        if (this.cinematicPanProgress >= 1.0) {
            this.cinematicPanProgress = 1.0;
            this.cinematicPanDirection = -1.0;
        } else if (this.cinematicPanProgress <= 0.0) {
            this.cinematicPanProgress = 0.0;
            this.cinematicPanDirection = 1.0;
        }

        // Sinusoidal easing
        const t = (1.0 - Math.cos(this.cinematicPanProgress * Math.PI)) * 0.5;
        const currentTargetX = -650.0 + t * 1400.0; // from -650 to +750
        const currentTargetZ = 120.0 + Math.sin(t * Math.PI) * 70.0;

        const panTarget = new vec3(currentTargetX, 60.0, currentTargetZ);
        const panCamPos = new vec3(currentTargetX, 520.0, currentTargetZ + 680.0);

        this.inspectorCameraObj.getTransform().setWorldPosition(panCamPos);
        const forward = panTarget.sub(panCamPos).normalize();
        this.inspectorCameraObj.getTransform().setWorldRotation(quat.lookAt(forward, new vec3(0, 1, 0)));
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
        { num: 0, label: "MAIN 200A SERVICE DISCONNECT", room: "all", x: 0, y: 35, amperage: 200, isOn: true },
        { num: 1, label: "B1: 20A Master Bed Outlets", room: "bedroom", x: -14, y: 17, amperage: 20, isOn: true },
        { num: 2, label: "B2: 15A Living Room TV", room: "living", x: 14, y: 17, amperage: 15, isOn: true },
        { num: 3, label: "B3: 15A Living Room Sofa", room: "sofa", x: -14, y: 5, amperage: 15, isOn: true },
        { num: 4, label: "B4: 30A Utility & Battery Hub", room: "utility", x: 14, y: 5, amperage: 30, isOn: true }
    ];

    private buildBreakerPanel() {
        if (!this.breakerPanelRoot) {
            this.breakerPanelRoot = global.scene.createSceneObject("MainBreakerPanel");

            // Panel Enclosure Header
            const headerObj = global.scene.createSceneObject("PanelHeader");
            headerObj.setParent(this.breakerPanelRoot);
            headerObj.getTransform().setLocalPosition(new vec3(0, 46, 0));
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
        if (bestWall) return bestWall;

        // Fall back to matching wall for point's room coordinates
        let targetId = "wall-bedroom";
        if (p.x >= 300.0) targetId = "wall-utility";
        else if (p.x >= -75.0) targetId = "wall-living";

        const roomWall = this.activeWalls.find(w => w.wallId === targetId);
        return roomWall || (this.activeWalls.length > 0 ? this.activeWalls[0] : null);
    }

    // Computes world coordinates for a given breaker on the load center panel
    public getBreakerWorldPosition(num: number): vec3 {
        const rootPos = this.breakerPanelRoot
            ? this.breakerPanelRoot.getTransform().getWorldPosition()
            : new vec3(380.0, 140.0, -200.0);
        const rootRot = this.breakerPanelRoot
            ? this.breakerPanelRoot.getTransform().getWorldRotation()
            : quat.fromEulerAngles(0, 0, 0);

        const b = this.breakerBranches.find(item => item.num === num);
        if (!b) return rootPos;
        return rootPos.add(rootRot.multiplyVec3(new vec3(b.x, b.y, -1.0)));
    }

    // Resolves whether a 3D point is on an active Circuit Breaker switch terminal
    public getBreakerForPoint(p: vec3, run?: ConduitRun): BreakerInfo | null {
        for (const b of this.breakerBranches) {
            const worldPos = this.getBreakerWorldPosition(b.num);
            if (worldPos.distance(p) <= 8.5) {
                return {
                    isBreaker: true,
                    num: b.num,
                    label: b.label,
                    room: b.room,
                    amperage: b.amperage,
                    isOn: b.isOn,
                    terminalPos: worldPos,
                    isLeftCol: b.x < 0,
                    isMain: b.num === 0
                };
            }
        }

        // Contextual fallback: check if run name / id points directly to a breaker terminal
        if (run) {
            const nameLower = (run.name + " " + run.id).toLowerCase();
            let matchedNum = -1;
            if (nameLower.includes("breaker b1") || nameLower.includes("-b1")) matchedNum = 1;
            else if (nameLower.includes("breaker b2") || nameLower.includes("-b2")) matchedNum = 2;
            else if (nameLower.includes("breaker b3") || nameLower.includes("-b3")) matchedNum = 3;
            else if (nameLower.includes("breaker b4") || nameLower.includes("-b4")) matchedNum = 4;
            else if (nameLower.includes("main 200a") || nameLower.includes("main-disconnect")) matchedNum = 0;

            if (matchedNum >= 0) {
                const b = this.breakerBranches.find(item => item.num === matchedNum);
                if (b) {
                    const worldPos = this.getBreakerWorldPosition(b.num);
                    return {
                        isBreaker: true,
                        num: b.num,
                        label: b.label,
                        room: b.room,
                        amperage: b.amperage,
                        isOn: b.isOn,
                        terminalPos: worldPos,
                        isLeftCol: b.x < 0,
                        isMain: b.num === 0
                    };
                }
            }
        }

        return null;
    }

    public getBreakerByNum(num: number): BreakerInfo | null {
        const b = this.breakerBranches.find(item => item.num === num);
        if (!b) return null;
        return {
            isBreaker: true,
            num: b.num,
            label: b.label,
            room: b.room,
            amperage: b.amperage,
            isOn: b.isOn,
            terminalPos: this.getBreakerWorldPosition(b.num),
            isLeftCol: b.x < 0,
            isMain: b.num === 0
        };
    }

    // Formats 3D node badges: Distinct Duplex Outlet faceplate, Circuit Breaker, Ceiling Luminaire, J-Box, or Grip Handle
    private applyNodeVisualText(textComp: Text, pt: vec3, run: ConduitRun, isJunc: boolean, isStart: boolean) {
        const breakerInfo = this.getBreakerForPoint(pt, run);
        if (breakerInfo) {
            const statusLabel = breakerInfo.isOn ? "[■ ON]" : "[○ OFF TRIPPED]";
            const circuitDesc = breakerInfo.num === 0 ? "MAIN 200A DISCONNECT" : `B${breakerInfo.num} (${breakerInfo.amperage}A)`;
            textComp.text = breakerInfo.isOn
                ? ` ⚡ ${statusLabel} ${circuitDesc} `
                : ` ❄️ ${statusLabel} ${circuitDesc} (0V SAFE) `;
            textComp.size = breakerInfo.isMain ? 52 : 46;
            textComp.textFill.color = breakerInfo.isOn
                ? (breakerInfo.isMain ? new vec4(1.0, 0.45, 0.45, 1.0) : new vec4(0.3, 1.0, 0.6, 1.0))
                : new vec4(1.0, 0.35, 0.3, 1.0);
            textComp.backgroundSettings.enabled = true;
            textComp.backgroundSettings.fill.color = breakerInfo.isOn
                ? new vec4(0.02, 0.12, 0.06, 0.92)
                : new vec4(0.25, 0.04, 0.04, 0.92);
            textComp.backgroundSettings.cornerRadius = 0.45;
            textComp.outlineSettings.enabled = true;
            textComp.outlineSettings.fill.color = breakerInfo.isOn
                ? (breakerInfo.isMain ? new vec4(0.9, 0.2, 0.2, 0.85) : new vec4(0.25, 0.85, 0.5, 0.85))
                : new vec4(0.9, 0.2, 0.2, 0.9);
            textComp.outlineSettings.size = 0.16;
            textComp.enabled = true;
            return;
        }

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

        // 7c7. Breaker Trip & Room Teleport Callbacks from ToolPalette UI
        this.toolPalette.onCycleBreakerTrip = () => {
            this.cycleBreakerTripDemo();
        };

        this.toolPalette.onTeleportRoom = (roomIdx: number) => {
            this.teleportToRoom(roomIdx);
        };

        // 7d. Keyboard Shortcuts in Preview:
        // Space / M = Summon / Hide Palette
        // B = Cycle Breaker Trip Demo (B1 Bed -> B2 TV -> B3 Sofa -> B0 Main)
        // H = Toggle WireSight X-Ray Mode
        // U = Toggle Original Custom Wires
        // 7 = Teleport to Master Bedroom
        // 6 = Teleport to Electrical Room & Breaker Panel
        // 5 = Teleport to Living Room
        // 8 = Teleport to 45° Bird's Eye Overview
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
                const kVal: any = event.key;
                const kStr = kVal !== undefined ? String(kVal).toLowerCase() : "";

                const isKey = (keyName: string, char: string, ascii?: number): boolean => {
                    // 1. Lens Studio Keys enum match
                    if (typeof Keys !== "undefined") {
                        const val = (Keys as any)[keyName];
                        if (val !== undefined && kVal === val) return true;
                        const valPref = (Keys as any)[`Key_${keyName}`];
                        if (valPref !== undefined && kVal === valPref) return true;
                    }
                    // 2. String representation match
                    if (kStr === char.toLowerCase() || kStr === keyName.toLowerCase()) return true;
                    if (kVal === char || kVal === char.toUpperCase() || kVal === char.toLowerCase()) return true;
                    // 3. Numeric / ASCII code match
                    if (typeof kVal === "number") {
                        if (ascii !== undefined && kVal === ascii) return true;
                        if (char.length === 1 && (kVal === char.charCodeAt(0) || kVal === char.toUpperCase().charCodeAt(0))) return true;
                    }
                    return false;
                };

                if (isKey("Space", " ") || isKey("Spacebar", " ") || isKey("M", "m", 77)) {
                    if (this.toolPalette) {
                        if (this.toolPalette.getIsExpanded()) {
                            this.toolPalette.hidePalette();
                        } else {
                            this.toolPalette.summonInWorld();
                        }
                    }
                } else if (isKey("B", "b", 66)) {
                    this.cycleBreakerTripDemo();
                } else if (isKey("H", "h", 72)) {
                    this.toggleWireSightMode();
                } else if (isKey("U", "u", 85)) {
                    this.toggleUserRunsVisibility();
                } else if (isKey("Seven", "7", 55) || isKey("Digit7", "7") || isKey("Key_7", "7")) {
                    this.teleportToRoom(4); // Master Bedroom
                } else if (isKey("Six", "6", 54) || isKey("Digit6", "6") || isKey("Key_6", "6")) {
                    this.teleportToRoom(3); // Utility Room & Breaker Panel
                } else if (isKey("Five", "5", 53) || isKey("Digit5", "5") || isKey("Key_5", "5")) {
                    this.teleportToRoom(2); // Living Room
                } else if (isKey("Four", "4", 52) || isKey("Digit4", "4") || isKey("Key_4", "4")) {
                    this.teleportToRoom(1); // Kitchen
                } else if (isKey("Eight", "8", 56) || isKey("Digit8", "8") || isKey("Key_8", "8")) {
                    this.teleportToRoom(5); // 45° Bird's Eye Overview
                } else if (isKey("Nine", "9", 57) || isKey("Digit9", "9") || isKey("Key_9", "9")) {
                    this.teleportToRoom(0); // Central Hallway
                } else if (isKey("Zero", "0", 48) || isKey("Digit0", "0") || isKey("Key_0", "0")) {
                    this.teleportToRoom(10); // 🎬 Cinematic Estate Pan (Glides across all 8 wired rooms)
                } else if (isKey("One", "1", 49) || isKey("Digit1", "1")) {
                    if (this.toolPalette) this.toolPalette.switchTab("wire");
                } else if (isKey("Two", "2", 50) || isKey("Digit2", "2")) {
                    if (this.toolPalette) this.toolPalette.switchTab("wall");
                } else if (isKey("Three", "3", 51) || isKey("Digit3", "3")) {
                    if (this.toolPalette) this.toolPalette.switchTab("specs");
                } else if (isKey("O", "o", 79)) {
                    this.addOutletTapIn();
                } else if (isKey("W", "w", 87)) {
                    if (this.wallCreatorTool) {
                        if (this.wallCreatorTool.getIsActive()) {
                            this.wallCreatorTool.cancelWallCreation();
                        } else {
                            this.wallCreatorTool.startWallCreation();
                        }
                    }
                } else if (isKey("S", "s", 83)) {
                    this.cycleActiveWallSize();
                } else if (isKey("Up", "arrowup", 38) || isKey("KeyUp", "up")) {
                    this.pushActiveWallDepth(20.0);
                } else if (isKey("Down", "arrowdown", 40) || isKey("KeyDown", "down")) {
                    this.pushActiveWallDepth(-20.0);
                } else if (isKey("R", "r", 82)) {
                    this.rotateActiveWall(5.0);
                } else if (kStr === "]" || kStr === "." || isKey("E", "e", 69)) {
                    this.rotateActiveWall(1.0);
                } else if (kStr === "[" || kStr === "," || isKey("Q", "q", 81)) {
                    this.rotateActiveWall(-1.0);
                } else if (kStr === "}" || kStr === ">") {
                    this.rotateActiveWall(5.0);
                } else if (kStr === "{" || kStr === "<") {
                    this.rotateActiveWall(-5.0);
                } else if (isKey("N", "n", 78)) {
                    this.addNewWall();
                } else if (isKey("Tab", "tab", 9)) {
                    this.cycleActiveWall();
                } else if (isKey("X", "x", 88)) {
                    this.deleteActiveWall();
                } else if (isKey("Delete", "delete", 46) || isKey("Backspace", "backspace", 8)) {
                    this.deleteLastRun();
                } else if (isKey("V", "v", 86)) {
                    this.saveAndExportWiring();
                } else if (isKey("I", "i", 73)) {
                    this.importWiringJson();
                } else if (isKey("C", "c", 67)) {
                    this.switchCameraView();
                } else if (isKey("P", "p", 80)) {
                    this.cycleInspectorPreset();
                } else if (isKey("D", "d", 68)) {
                    const wall = this.getActiveWall();
                    if (wall && this.toolPalette) {
                        const activeCam = this.getActiveCamera();
                        const camPos = activeCam
                            ? activeCam.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 1.0)
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
            this.updateCinematicCameraPan();
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
                for (const b of this.breakerBranches) {
                    const bWorld = this.getBreakerWorldPosition(b.num);
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
                this.isCinematicPanning = false;
                if (this.lastDragPos) {
                    const dx = touchPos.x - this.lastDragPos.x;
                    const dy = touchPos.y - this.lastDragPos.y;
                    this.orbitYaw += dx * 3.2;
                    this.orbitPitch = Math.max(-0.25, Math.min(1.3, this.orbitPitch + dy * 2.5));

                    const target = this.orbitTarget;
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
                            const zPos = Array.isArray(sw.pos) ? sw.pos[2] : (sw.pos && sw.pos.z !== undefined ? sw.pos.z : 0);
                            // Purge legacy prebuilt room walls at Z > 50
                            if (zPos > 50.0 && sw.wallId !== "wall-bedroom" && sw.wallId !== "wall-corner") {
                                continue;
                            }
                            if (sw.wallId === "wall-bedroom") {
                                sw.pos = [-262.5, 120.0, -225.0];
                                sw.yawDeg = 0.0;
                                sw.widthCm = 375.0;
                                sw.heightCm = 240.0;
                            } else if (sw.wallId === "wall-corner") {
                                sw.pos = [-450.0, 120.0, 0.0];
                                sw.yawDeg = 90.0;
                                sw.widthCm = 450.0;
                                sw.heightCm = 240.0;
                            } else if (sw.wallId === "wall-living") {
                                sw.pos = [112.5, 120.0, -225.0];
                                sw.yawDeg = 0.0;
                                sw.widthCm = 375.0;
                                sw.heightCm = 240.0;
                            } else if (sw.wallId === "wall-utility") {
                                sw.pos = [425.0, 120.0, -225.0];
                                sw.yawDeg = 0.0;
                                sw.widthCm = 250.0;
                                sw.heightCm = 240.0;
                            } else if (zPos > 50.0) {
                                continue;
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
                            // Purge legacy runs in prebuilt space (Z > 50) and old ghost outlets
                            const startZ = Array.isArray(s.startPoint) ? s.startPoint[2] : (s.startPoint && s.startPoint.z !== undefined ? s.startPoint.z : 0);
                            const endZ = Array.isArray(s.endPoint) ? s.endPoint[2] : (s.endPoint && s.endPoint.z !== undefined ? s.endPoint.z : 0);
                            if (startZ > 50.0 || endZ > 50.0) {
                                continue;
                            }
                            if (s.id && (s.id.includes("outlet-1794059634526") || s.id.includes("outlet-1794058870118") || s.id.includes("outlet-1794059432207"))) {
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
        const runsToKeep: ConduitRun[] = [];
        let purgedCount = 0;
        for (const run of this.activeRuns) {
            // Purge procedural house runs or legacy prebuilt runs (Z > 50)
            const isProcedural = run.id.startsWith("elec-") || run.id.startsWith("plumb-");
            const isPrebuiltLegacy = (run.startPoint.z > 50.0 || run.endPoint.z > 50.0) && !run.id.startsWith("scen");
            if (isProcedural || isPrebuiltLegacy) {
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

        // Purge any legacy prebuilt walls (Z > 50)
        const wallsToKeep: ReferenceWall[] = [];
        for (const wall of this.activeWalls) {
            const wPos = wall.getSceneObject().getTransform().getWorldPosition();
            if (wPos.z > 50.0 && wall.wallId !== "wall-bedroom" && wall.wallId !== "wall-corner") {
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
            print(`[WireSight] Purged ${purgedCount} legacy runs. Preserved ${this.activeRuns.length} architectural runs.`);
        }
    }

    // Restores the user's master bedroom corner walls (Wall 1 behind bed, Wall 2 along TV & wardrobe)
    public setupDefaultCornerWalls(): void {
        print("[WireSight] Ensuring Architectural Room Reference Walls (Bedroom, Corner, Living, Utility)...");

        // Wall 1: Master Bedroom Back Wall (behind bed & nightstands)
        // Position: (-262.5, 120.0, -225.0), Yaw: 0°, Width: 375cm, Height: 240cm
        let wall1 = this.activeWalls.find(w => w.wallId === "wall-bedroom");
        if (!wall1) {
            const wall1Obj = global.scene.createSceneObject("HolographicReferenceWall_1");
            wall1 = wall1Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
            wall1.wallIndex = 1;
            wall1.wallId = "wall-bedroom";
            this.activeWalls.unshift(wall1);
        }
        wall1.widthCm = 375.0;
        wall1.heightCm = 240.0;
        wall1.initialPosition = new vec3(-262.5, 120.0, -225.0);
        wall1.initialRotation = quat.fromEulerAngles(0, 0, 0);
        wall1.getSceneObject().getTransform().setWorldPosition(wall1.initialPosition);
        wall1.getSceneObject().getTransform().setWorldRotation(wall1.initialRotation);
        wall1.rebuildWall(wall1.initialPosition, wall1.initialRotation, 375.0, 240.0);
        wall1.setWallYaw(0.0);
        wall1.getSceneObject().enabled = true;

        // Wall 2: Master Bedroom Perpendicular Side Wall (along Wardrobe & Doorway)
        // Position: (-450.0, 120.0, 0.0), Yaw: 90°, Width: 450cm, Height: 240cm
        let wall2 = this.activeWalls.find(w => w.wallId === "wall-corner");
        if (!wall2) {
            const wall2Obj = global.scene.createSceneObject("HolographicReferenceWall_2");
            wall2 = wall2Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
            wall2.wallIndex = 2;
            wall2.wallId = "wall-corner";
            this.activeWalls.push(wall2);
        }
        wall2.widthCm = 450.0;
        wall2.heightCm = 240.0;
        wall2.initialPosition = new vec3(-450.0, 120.0, 0.0);
        wall2.initialRotation = quat.fromEulerAngles(0, (90.0 * Math.PI) / 180.0, 0);
        wall2.getSceneObject().getTransform().setWorldPosition(wall2.initialPosition);
        wall2.getSceneObject().getTransform().setWorldRotation(wall2.initialRotation);
        wall2.rebuildWall(wall2.initialPosition, wall2.initialRotation, 450.0, 240.0);
        wall2.setWallYaw(90.0);
        wall2.getSceneObject().enabled = true;

        // Wall 3: Living Room Media & TV Wall
        // Position: (112.5, 120.0, -225.0), Yaw: 0°, Width: 375cm, Height: 240cm
        let wall3 = this.activeWalls.find(w => w.wallId === "wall-living");
        if (!wall3) {
            const wall3Obj = global.scene.createSceneObject("HolographicReferenceWall_3");
            wall3 = wall3Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
            wall3.wallIndex = 3;
            wall3.wallId = "wall-living";
            this.activeWalls.push(wall3);
        }
        wall3.widthCm = 375.0;
        wall3.heightCm = 240.0;
        wall3.initialPosition = new vec3(112.5, 120.0, -225.0);
        wall3.initialRotation = quat.fromEulerAngles(0, 0, 0);
        wall3.getSceneObject().getTransform().setWorldPosition(wall3.initialPosition);
        wall3.getSceneObject().getTransform().setWorldRotation(wall3.initialRotation);
        wall3.rebuildWall(wall3.initialPosition, wall3.initialRotation, 375.0, 240.0);
        wall3.setWallYaw(0.0);
        wall3.getSceneObject().enabled = true;

        // Wall 4: Utility Room Breaker Panel Wall
        // Position: (425.0, 120.0, -225.0), Yaw: 0°, Width: 250cm, Height: 240cm
        let wall4 = this.activeWalls.find(w => w.wallId === "wall-utility");
        if (!wall4) {
            const wall4Obj = global.scene.createSceneObject("HolographicReferenceWall_4");
            wall4 = wall4Obj.createComponent(ReferenceWall.getTypeName()) as ReferenceWall;
            wall4.wallIndex = 4;
            wall4.wallId = "wall-utility";
            this.activeWalls.push(wall4);
        }
        wall4.widthCm = 250.0;
        wall4.heightCm = 240.0;
        wall4.initialPosition = new vec3(425.0, 120.0, -225.0);
        wall4.initialRotation = quat.fromEulerAngles(0, 0, 0);
        wall4.getSceneObject().getTransform().setWorldPosition(wall4.initialPosition);
        wall4.getSceneObject().getTransform().setWorldRotation(wall4.initialRotation);
        wall4.rebuildWall(wall4.initialPosition, wall4.initialRotation, 250.0, 240.0);
        wall4.setWallYaw(0.0);
        wall4.getSceneObject().enabled = true;

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
        print(`[WireSight] Restored ${this.activeWalls.length} architectural room walls successfully.`);
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
        const activeCam = this.getActiveCamera();
        const camTrans = activeCam ? activeCam.getSceneObject().getTransform() : null;
        const camPos = camTrans ? camTrans.getWorldPosition() : new vec3(-262.5, 120.0, 100.0);
        const centerScreen = new vec2(0.5, 0.5);

        // 1. Identify which room the user is currently in based on camera coordinates:
        let currentRoomId = "bedroom";
        let roomLabel = "Master Bedroom";
        let targetWallId = "wall-bedroom";
        let minRoomX = -430.0;
        let maxRoomX = -95.0;
        let defaultOutletX = -177.5; // Beside the master bed / nightstand

        if (camPos.x >= 300.0) {
            currentRoomId = "utility";
            roomLabel = "Electrical Room";
            targetWallId = "wall-utility";
            minRoomX = 320.0;
            maxRoomX = 530.0;
            defaultOutletX = 425.0;
        } else if (camPos.x >= -75.0) {
            currentRoomId = "living";
            roomLabel = "Living Room";
            targetWallId = "wall-living";
            minRoomX = -55.0;
            maxRoomX = 280.0;
            defaultOutletX = 45.0;
        }

        // 2. Automatically select this room's wall as the active reference wall
        let targetWall = this.activeWalls.find(w => w.wallId === targetWallId);
        if (!targetWall) {
            targetWall = this.getActiveWall();
        }
        if (targetWall) {
            const wallIdx = this.activeWalls.indexOf(targetWall);
            if (wallIdx >= 0) {
                this.activeWallIndex = wallIdx;
                for (let i = 0; i < this.activeWalls.length; i++) {
                    this.activeWalls[i].setIsActiveWall(i === wallIdx);
                }
                this.referenceWall = targetWall;
                this.updateMultiWallUI();
            }
        }

        // 3. Compute outlet world position flush on the room wall surface (Z = -221.0cm)
        let outletWorldPos: vec3;
        let placedFromRay = false;

        if (activeCam && targetWall) {
            const rayOrigin = activeCam.screenSpaceToWorldSpace(centerScreen, 1.0);
            const rayFar = activeCam.screenSpaceToWorldSpace(centerScreen, 600.0);
            const rayDir = rayFar.sub(rayOrigin).normalize();

            const wallHit = targetWall.raycastWall(rayOrigin, rayDir);
            if (wallHit && wallHit.isHit) {
                const clampedX = Math.max(minRoomX, Math.min(maxRoomX, wallHit.point.x));
                const clampedY = (wallHit.point.y >= 15.0 && wallHit.point.y <= 120.0) ? wallHit.point.y : 40.0;
                outletWorldPos = new vec3(clampedX, clampedY, -221.0);
                placedFromRay = true;
            } else if (Math.abs(rayDir.z) > 0.05) {
                const t = (-225.0 - rayOrigin.z) / rayDir.z;
                if (t > 10.0 && t < 900.0) {
                    const hitX = rayOrigin.x + t * rayDir.x;
                    const hitY = rayOrigin.y + t * rayDir.y;
                    const clampedX = Math.max(minRoomX, Math.min(maxRoomX, hitX));
                    const clampedY = (hitY >= 15.0 && hitY <= 120.0) ? hitY : 40.0;
                    outletWorldPos = new vec3(clampedX, clampedY, -221.0);
                    placedFromRay = true;
                }
            }
        }

        if (!placedFromRay) {
            outletWorldPos = new vec3(defaultOutletX, 40.0, -221.0);
        }

        // 4. Project onto the nearest existing in-wall branch wire in THIS room
        let dropTop = new vec3(outletWorldPos.x, 110.0, -223.0);
        let bestDist = 999.0;
        for (const run of this.activeRuns) {
            if (run.layer !== "electrical") continue;
            // Only search in-wall runs for THIS room
            const midZ = (run.startPoint.z + run.endPoint.z) * 0.5;
            if (Math.abs(midZ - (-223.0)) > 20.0) continue;
            const minX = Math.min(run.startPoint.x, run.endPoint.x);
            const maxX = Math.max(run.startPoint.x, run.endPoint.x);
            if (maxX < minRoomX - 30.0 || minX > maxRoomX + 30.0) continue;

            const a = run.startPoint;
            const b = run.endPoint;
            const ab = b.sub(a);
            const abLenSq = ab.dot(ab);
            let t = 0.5;
            if (abLenSq > 0.001) {
                t = Math.max(0.0, Math.min(1.0, outletWorldPos.sub(a).dot(ab) / abLenSq));
            }
            const ptOnSeg = a.add(ab.uniformScale(t));
            const horizDist = Math.abs(ptOnSeg.x - outletWorldPos.x);
            if (horizDist < bestDist && horizDist < 260.0) {
                bestDist = horizDist;
                const tapY = Math.max(ptOnSeg.y, outletWorldPos.y + 35.0);
                dropTop = new vec3(outletWorldPos.x, tapY, -223.0);
            }
        }

        const outletIdx = this.activeRuns.filter(r => r.name.includes("Outlet") || r.id.includes("outlet")).length + 1;
        const newRun: ConduitRun = {
            id: `outlet-tapin-${Date.now()}`,
            name: `[${roomLabel}] 120V 20A Duplex Outlet #${outletIdx}`,
            layer: "electrical",
            voltageOrType: "120V AC 20A (In-Wall Tap)",
            installer: "AR Optical Tap-In (Zero Wall Damage)",
            installDate: "Nov 09, 2026",
            status: "TAP-IN READY: 1-GANG CUTOUT 5.7×9.5cm",
            color: new vec4(1.0, 0.88, 0.15, 1.0),
            startPoint: dropTop,
            endPoint: outletWorldPos,
            isWorldCoords: true,
            roomZone: currentRoomId,
            gauge: "12 AWG (20A)",
            isLive: true,
            thickness: 5.5
        };

        this.activeRuns.push(newRun);
        this.selectedRunId = newRun.id;
        this.createRunVisual(newRun, true);
        this.newOutletObject = this.runVisualObjects.get(newRun.id) || null;
        if (this.newOutletObject) {
            this.newOutletObject.enabled = true;
        }
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
        print(`[WireSight] Mounted 120V Duplex Outlet #${outletIdx} on ${targetWallId} at (${outletWorldPos.x.toFixed(1)}, ${outletWorldPos.y.toFixed(1)}, ${outletWorldPos.z.toFixed(1)})cm`);
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

            // 5. Holographic Drywall Jab-Saw Cutout Stencil (1-Gang Remodel Box: 5.7cm x 9.5cm)
            const cutW = 2.85; // half width (5.7cm total)
            const cutH = 4.75; // half height (9.5cm total)
            const sTL = pt.add(wallRot.multiplyVec3(new vec3(-cutW, cutH, faceOffsetZ + 0.1)));
            const sTR = pt.add(wallRot.multiplyVec3(new vec3(cutW, cutH, faceOffsetZ + 0.1)));
            const sBR = pt.add(wallRot.multiplyVec3(new vec3(cutW, -cutH, faceOffsetZ + 0.1)));
            const sBL = pt.add(wallRot.multiplyVec3(new vec3(-cutW, -cutH, faceOffsetZ + 0.1)));
            const stencilCol = new vec4(0.2, 1.0, 0.45, 0.95); // High-viz laser neon green
            global.debugRenderSystem.drawLine(sTL, sTR, stencilCol);
            global.debugRenderSystem.drawLine(sTR, sBR, stencilCol);
            global.debugRenderSystem.drawLine(sBR, sBL, stencilCol);
            global.debugRenderSystem.drawLine(sBL, sTL, stencilCol);

            // Stencil corner tick marks (for carpenter's pencil alignment)
            const tickLen = 0.8;
            global.debugRenderSystem.drawLine(sTL, sTL.add(wallRot.multiplyVec3(new vec3(0, tickLen, 0))), stencilCol);
            global.debugRenderSystem.drawLine(sTR, sTR.add(wallRot.multiplyVec3(new vec3(0, tickLen, 0))), stencilCol);
            global.debugRenderSystem.drawLine(sBL, sBL.add(wallRot.multiplyVec3(new vec3(0, -tickLen, 0))), stencilCol);
            global.debugRenderSystem.drawLine(sBR, sBR.add(wallRot.multiplyVec3(new vec3(0, -tickLen, 0))), stencilCol);
            return;
        }

        const breakerInfo = this.getBreakerForPoint(pt, run);
        if (breakerInfo) {
            // ⚡ REALISTIC 3D LOAD CENTER CIRCUIT BREAKER HARDWARE VISUAL
            this.renderBreakerVisual(pt, breakerInfo, isSelected);
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

    // Renders realistic 3D Circuit Breaker hardware: molded-case body, mechanical ON/OFF toggle switch,
    // metallic screw terminal lug, copper bus bar clip, and live energization / red warning trip flag indicator
    private renderBreakerVisual(pt: vec3, breaker: BreakerInfo, isSelected: boolean) {
        if (!global.debugRenderSystem) return;

        const wall = this.getWallForPoint(pt);
        const wallRot = wall ? wall.getSceneObject().getTransform().getWorldRotation() : quat.fromEulerAngles(0, 0, 0);

        const halfW = breaker.isMain ? 11.0 : 8.5;
        const halfH = breaker.isMain ? 5.2 : 4.2;
        const faceOffsetZ = 1.0;

        // 1. Molded-Case Outer Bevel Enclosure Frame
        const cTL = pt.add(wallRot.multiplyVec3(new vec3(-halfW, halfH, faceOffsetZ)));
        const cTR = pt.add(wallRot.multiplyVec3(new vec3(halfW, halfH, faceOffsetZ)));
        const cBR = pt.add(wallRot.multiplyVec3(new vec3(halfW, -halfH, faceOffsetZ)));
        const cBL = pt.add(wallRot.multiplyVec3(new vec3(-halfW, -halfH, faceOffsetZ)));

        const frameCol = isSelected
            ? new vec4(1.0, 0.95, 0.35, 1.0)
            : (!breaker.isOn
                ? new vec4(1.0, 0.40, 0.25, 0.95)
                : (breaker.isMain ? new vec4(0.85, 0.22, 0.22, 0.95) : new vec4(0.42, 0.46, 0.52, 0.95)));

        global.debugRenderSystem.drawLine(cTL, cTR, frameCol);
        global.debugRenderSystem.drawLine(cTR, cBR, frameCol);
        global.debugRenderSystem.drawLine(cBR, cBL, frameCol);
        global.debugRenderSystem.drawLine(cBL, cTL, frameCol);

        // 2. Inner Chamfer / Molded-Case Recess Frame
        const inW = halfW - 0.9;
        const inH = halfH - 0.7;
        const iTL = pt.add(wallRot.multiplyVec3(new vec3(-inW, inH, faceOffsetZ)));
        const iTR = pt.add(wallRot.multiplyVec3(new vec3(inW, inH, faceOffsetZ)));
        const iBR = pt.add(wallRot.multiplyVec3(new vec3(inW, -inH, faceOffsetZ)));
        const iBL = pt.add(wallRot.multiplyVec3(new vec3(-inW, -inH, faceOffsetZ)));

        const innerCol = new vec4(0.12, 0.14, 0.18, 0.95);
        global.debugRenderSystem.drawLine(iTL, iTR, innerCol);
        global.debugRenderSystem.drawLine(iTR, iBR, innerCol);
        global.debugRenderSystem.drawLine(iBR, iBL, innerCol);
        global.debugRenderSystem.drawLine(iBL, iTL, innerCol);

        // 3. Metallic Screw Terminal Clamp Lug (Where Conduit / Feeder Enters Breaker)
        const collarCol = new vec4(0.85, 0.72, 0.28, 0.95); // Brass clamp ring
        const lugBarrelCol = new vec4(0.70, 0.72, 0.78, 0.95); // Zinc-plated steel clamp lug
        global.debugRenderSystem.drawCircle(pt, 2.6, collarCol);
        global.debugRenderSystem.drawSolidSphere(pt, 1.6, lugBarrelCol);

        // Slotted screw drive on terminal lug
        const slotL = pt.add(wallRot.multiplyVec3(new vec3(-1.1, 0, 0.2)));
        const slotR = pt.add(wallRot.multiplyVec3(new vec3(1.1, 0, 0.2)));
        global.debugRenderSystem.drawLine(slotL, slotR, new vec4(0.12, 0.12, 0.15, 1.0));

        // Conduit clamping bracket linking lug to case edge
        const bracketTop = pt.add(wallRot.multiplyVec3(new vec3(0, halfH, 0)));
        global.debugRenderSystem.drawLine(pt, bracketTop, new vec4(0.55, 0.60, 0.65, 0.85));

        // 4. Mechanical Toggle Switch Lever
        if (breaker.isMain) {
            // Main 200A Service Disconnect: Dual-pole coupled toggle switch
            const switchPosL = pt.add(wallRot.multiplyVec3(new vec3(-3.5, 0, faceOffsetZ + 0.3)));
            const switchPosR = pt.add(wallRot.multiplyVec3(new vec3(3.5, 0, faceOffsetZ + 0.3)));
            global.debugRenderSystem.drawCircle(switchPosL, 1.8, innerCol);
            global.debugRenderSystem.drawCircle(switchPosR, 1.8, innerCol);

            const leverY = breaker.isOn ? 2.0 : -2.0;
            const leverCol = breaker.isOn ? new vec4(0.95, 0.20, 0.20, 1.0) : new vec4(1.0, 0.40, 0.25, 1.0);
            const tipL = pt.add(wallRot.multiplyVec3(new vec3(-3.5, leverY, faceOffsetZ + 1.2)));
            const tipR = pt.add(wallRot.multiplyVec3(new vec3(3.5, leverY, faceOffsetZ + 1.2)));

            global.debugRenderSystem.drawLine(switchPosL, tipL, leverCol);
            global.debugRenderSystem.drawLine(switchPosR, tipR, leverCol);
            global.debugRenderSystem.drawLine(tipL, tipR, leverCol); // Dual-pole tie-bar!
            global.debugRenderSystem.drawSolidSphere(tipL, 1.5, leverCol);
            global.debugRenderSystem.drawSolidSphere(tipR, 1.5, leverCol);

            // Dual utility feeder service lugs at top of main breaker
            const lugA = pt.add(wallRot.multiplyVec3(new vec3(-4.5, halfH, 0)));
            const lugB = pt.add(wallRot.multiplyVec3(new vec3(4.5, halfH, 0)));
            global.debugRenderSystem.drawCircle(lugA, 2.8, collarCol);
            global.debugRenderSystem.drawSolidSphere(lugA, 1.7, lugBarrelCol);
            global.debugRenderSystem.drawCircle(lugB, 2.8, collarCol);
            global.debugRenderSystem.drawSolidSphere(lugB, 1.7, lugBarrelCol);

            if (!breaker.isOn) {
                // Whole house blackout warning aura
                global.debugRenderSystem.drawCircle(pt, 8.0, new vec4(1.0, 0.2, 0.2, 0.85));
            }
        } else {
            // Branch Circuit Breaker (B1, B2, B3, B4)
            const switchOffsetX = breaker.isLeftCol ? 3.6 : -3.6;
            const switchCenter = pt.add(wallRot.multiplyVec3(new vec3(switchOffsetX, 0, faceOffsetZ + 0.3)));
            global.debugRenderSystem.drawCircle(switchCenter, 2.1, innerCol);

            if (breaker.isOn) {
                // [ | ON ] Lever thrown towards center bus bar
                const leverVec = breaker.isLeftCol ? new vec3(1.8, 0.7, 0.9) : new vec3(-1.8, 0.7, 0.9);
                const leverTip = switchCenter.add(wallRot.multiplyVec3(leverVec));
                const leverCol = new vec4(0.25, 0.95, 0.55, 1.0); // Vibrant emerald green
                global.debugRenderSystem.drawLine(switchCenter, leverTip, leverCol);
                global.debugRenderSystem.drawSolidSphere(leverTip, 1.4, leverCol);

                // Active Energized Green LED Indicator Dot
                const ledPos = switchCenter.add(wallRot.multiplyVec3(new vec3(breaker.isLeftCol ? -2.2 : 2.2, 0, 0.1)));
                global.debugRenderSystem.drawCircle(ledPos, 1.3, new vec4(0.2, 1.0, 0.5, 0.95));
                global.debugRenderSystem.drawSolidSphere(ledPos, 0.8, new vec4(0.35, 1.0, 0.65, 1.0));
            } else {
                // [ ○ OFF ] Lever dropped to center/down (TRIPPED)
                const leverVec = new vec3(0, -1.8, 0.7);
                const leverTip = switchCenter.add(wallRot.multiplyVec3(leverVec));
                const leverCol = new vec4(1.0, 0.35, 0.25, 1.0); // Warning trip red
                global.debugRenderSystem.drawLine(switchCenter, leverTip, leverCol);
                global.debugRenderSystem.drawSolidSphere(leverTip, 1.4, leverCol);

                // High-visibility TRIP FLAG / Warning Red Indicator
                const ledPos = switchCenter.add(wallRot.multiplyVec3(new vec3(breaker.isLeftCol ? -2.2 : 2.2, 0, 0.1)));
                global.debugRenderSystem.drawCircle(ledPos, 2.0, new vec4(1.0, 0.2, 0.15, 0.95));
                global.debugRenderSystem.drawSolidSphere(ledPos, 1.1, new vec4(1.0, 0.15, 0.10, 1.0));
                // Warning trip aura ring around the breaker
                global.debugRenderSystem.drawCircle(pt, 5.5, new vec4(1.0, 0.3, 0.2, 0.65));
            }

            // 5. Copper Bus Bar Contact Clip
            const busClipX = breaker.isLeftCol ? 7.2 : -7.2;
            const busClipPos = pt.add(wallRot.multiplyVec3(new vec3(busClipX, 0, 0)));
            global.debugRenderSystem.drawCircle(busClipPos, 1.4, new vec4(0.85, 0.52, 0.25, 0.95));
            global.debugRenderSystem.drawLine(switchCenter, busClipPos, new vec4(0.85, 0.52, 0.25, 0.85));

            // 6. Amperage Rating Stencil Badge
            const badgeX = breaker.isLeftCol ? -4.0 : 4.0;
            const badgePos = pt.add(wallRot.multiplyVec3(new vec3(badgeX, 0, faceOffsetZ + 0.2)));
            const badgeRingCol = breaker.isOn ? new vec4(0.9, 0.9, 0.95, 0.9) : new vec4(1.0, 0.45, 0.35, 0.9);
            const badgeCoreCol = breaker.isOn ? new vec4(0.12, 0.15, 0.20, 1.0) : new vec4(0.35, 0.08, 0.08, 1.0);
            global.debugRenderSystem.drawCircle(badgePos, 1.7, badgeRingCol);
            global.debugRenderSystem.drawSolidSphere(badgePos, 0.9, badgeCoreCol);
        }
    }

    // Renders all load center circuit breakers across the electrical panel
    private renderAllBreakersDebug(alreadyRendered?: vec3[]) {
        if (!global.debugRenderSystem) return;
        const hasHouse = this.activeRuns.some(r => r.id.startsWith("scen") || r.isWorldCoords);
        if (!hasHouse) return;

        for (const b of this.breakerBranches) {
            const worldPos = this.getBreakerWorldPosition(b.num);
            if (alreadyRendered && alreadyRendered.some(p => p.distance(worldPos) <= 5.0)) {
                continue;
            }
            const info = this.getBreakerByNum(b.num);
            if (info) {
                this.renderBreakerVisual(worldPos, info, false);
                if (alreadyRendered) alreadyRendered.push(worldPos);
            }
        }
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
            this.renderAllBreakersDebug();
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

        // 6. Real-time 3D Load Center Circuit Breaker System
        this.renderAllBreakersDebug(renderedJunctions);
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

        // 1. Ensure Inspector Camera exists
        if (!this.inspectorCamera || !this.inspectorCameraObj) {
            this.setupInspectorCamera();
        }

        // 2. Switch active camera to Inspector Camera (No DeviceTracking overrides!)
        this.activeCameraMode = "inspector";
        if (this.glassesCamera) this.glassesCamera.enabled = false;
        if (this.inspectorCamera) this.inspectorCamera.enabled = true;

        // 3. Disable DeviceTracking on glasses camera to prevent tracking snapback
        if (this.glassesCameraObj) {
            const dt = this.glassesCameraObj.getComponent("Component.DeviceTracking");
            if (dt) dt.enabled = false;
            this.glassesCameraObj.getTransform().setWorldPosition(room.cameraPos);
            this.glassesCameraObj.getTransform().setWorldRotation(room.cameraRot);
        }

        // 4. Place Inspector Camera permanently at the designated room position & angle
        if (this.inspectorCameraObj) {
            this.inspectorCameraObj.getTransform().setWorldPosition(room.cameraPos);
            this.inspectorCameraObj.getTransform().setWorldRotation(room.cameraRot);
        }

        // 5. Setup Orbit center and angles matching this room
        this.orbitTarget = room.center;
        const offset = room.cameraPos.sub(room.center);
        const dist = Math.max(10.0, offset.length);
        this.orbitDist = dist;
        this.orbitPitch = Math.asin(Math.max(-0.99, Math.min(0.99, offset.y / dist)));
        this.orbitYaw = Math.atan2(offset.x, offset.z);

        if (room.id === "panoramic") {
            this.isCinematicPanning = true;
            this.cinematicPanProgress = 0.0;
            this.cinematicPanDirection = 1.0;
        } else {
            this.isCinematicPanning = false;
        }

        // 6. Update all tools with the active camera
        const activeCam = this.inspectorCamera || this.glassesCamera;
        if (activeCam) {
            if (this.lineMarkerTool) {
                this.lineMarkerTool.setViewerCamera(activeCam);
            }
            if (this.wallCreatorTool) {
                this.wallCreatorTool.setCamera(activeCam);
            }
            if (this.toolPalette) {
                this.toolPalette.setCamera(activeCam);
                this.toolPalette.updateCameraBtnText("🎥 3RD POV");
                this.toolPalette.updateCameraPresetText(room.name, true);
                this.toolPalette.summonInWorld();
            }
        }

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(`📍 Teleported to ${room.icon} ${room.name}`, new vec4(0.3, 0.95, 1.0, 1.0));
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
            const activeCam = this.getActiveCamera();
            const camPos = activeCam
                ? activeCam.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 180.0)
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
