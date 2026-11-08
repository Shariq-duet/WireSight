import { ConduitRun } from "./ConduitTypes";
import { ReferenceWall } from "./ReferenceWall";

/**
 * LineMarkerTool — Continuous Polyline Wiring
 *
 * HOW IT WORKS NOW:
 *   • Tap [✏️ DRAW WIRE] to enter marking mode.
 *   • Each tap drops a new node.  The first tap anchors the starting
 *     junction box; every subsequent tap extends the wire by one segment.
 *   • The wire preview line (last anchored point → current gaze) is drawn
 *     live each frame so the user can see exactly where the next segment
 *     will land before tapping.
 *   • Double-tap (two taps within DOUBLE_TAP_MS ms) on the LAST node
 *     finishes the run.  Alternatively, tapping [✏️ DRAW WIRE] again also
 *     finishes.
 *   • Each finished segment becomes its own ConduitRun so the existing
 *     handle-pinch and push/pull system keeps working unchanged.
 *   • Snapping: if a new tap lands within SNAP_RADIUS_CM of an existing
 *     run endpoint it snaps to that exact point (corner-to-corner joins).
 */
@component
export class LineMarkerTool extends BaseScriptComponent {
    private toolRoot: SceneObject | null = null;
    private camera: Camera | null = null;
    private viewerCamera: Camera | null = null;
    private toolPalette: any = null;
    private deviceTracking: DeviceTracking | null = null;
    private referenceWall: ReferenceWall | null = null;
    private referenceWalls: ReferenceWall[] = [];

    public setReferenceWall(wall: ReferenceWall) {
        this.referenceWall = wall;
        if (wall) {
            this.referenceWalls = [wall];
        }
    }

    public setReferenceWalls(walls: ReferenceWall[]) {
        this.referenceWalls = walls;
        if (walls.length > 0) {
            this.referenceWall = walls[0];
        } else {
            this.referenceWall = null;
        }
    }

    // ── UI ────────────────────────────────────────────────────────────────
    private startPointMarker: SceneObject | null = null;
    private startMarkerText: Text | null = null;
    private liveTapeMeasureObj: SceneObject | null = null;
    private liveTapeMeasureText: Text | null = null;

    /** Live node-dot markers placed along the polyline */
    private nodeMarkerObjs: SceneObject[] = [];

    // ── State ─────────────────────────────────────────────────────────────
    private isMarkingActive: boolean = false;
    private isOrthoSnapEnabled: boolean = true; // Auto-Ortho 90° Wall Snapping enabled by default

    /** All anchored nodes in the current in-progress polyline */
    private polylineNodes: vec3[] = [];
    private lastNodeWall: ReferenceWall | null = null;
    private lastNodeIsCeiling: boolean = false;

    private selectedLayer: "electrical" | "plumbing" = "electrical";
    private markedRuns: ConduitRun[] = [];
    private currentDepth: number = 200.0;

    // ── Double-tap detection ───────────────────────────────────────────────
    private static readonly DOUBLE_TAP_MS  = 350;
    private lastTapTime: number = 0;

    // ── Snap-to-node radius (cm in world units) ───────────────────────────
    private static readonly SNAP_RADIUS_CM = 18.0;

    // ── Live preview ──────────────────────────────────────────────────────
    /** World-space position of the user's current gaze center (updated each frame) */
    private gazeWorldPos: vec3 | null = null;

    // ── Callbacks ─────────────────────────────────────────────────────────
    public onConduitMarked: ((run: ConduitRun) => void) | null = null;

    // ─────────────────────────────────────────────────────────────────────
    onAwake() {
        this.toolRoot = this.getSceneObject();
        this.buildMarkerUI();
        this.registerInputEvents();
        this.registerUpdateEvent();
    }

    public setCamera(cam: Camera)              { this.camera = cam; if (!this.viewerCamera) this.viewerCamera = cam; }
    public setViewerCamera(cam: Camera)        { this.viewerCamera = cam; }
    public setToolPalette(p: any)              { this.toolPalette = p; }
    public setDeviceTracking(dt: DeviceTracking) { this.deviceTracking = dt; }
    public getDepth(): number                  { return this.currentDepth; }
    public getIsMarkingActive(): boolean       { return this.isMarkingActive; }
    public getMarkedRuns(): ConduitRun[]       { return this.markedRuns; }

    public dropNodeAtGaze(): boolean {
        if (!this.isMarkingActive) {
            this.toggleMarkingMode();
        }
        const centerScreen = new vec2(0.5, 0.5);
        const hit = this.getSurfaceHit(centerScreen);
        this.handleNodeTap(hit.point, !!hit.isOnWall, hit.hitWall || null, !!hit.isCeiling);
        return true;
    }

    public adjustDepth(deltaCm: number): number {
        this.currentDepth = Math.max(60.0, Math.min(650.0, this.currentDepth + deltaCm));
        if (this.isMarkingActive) {
            this.updateStatusBanner();
        }
        return this.currentDepth;
    }

    // ── Multi-Wall Raycast Intersection across all active walls ───────────
    public raycastAllWalls(rayOrigin: vec3, rayDir: vec3): { point: vec3; normal: vec3; isHit: boolean; wall: ReferenceWall } | null {
        const wallsToTest = (this.referenceWalls && this.referenceWalls.length > 0)
            ? this.referenceWalls
            : (this.referenceWall ? [this.referenceWall] : []);

        let closestHit: { point: vec3; normal: vec3; isHit: boolean; wall: ReferenceWall; dist: number } | null = null;

        for (const wall of wallsToTest) {
            const wallHit = wall.raycastWall(rayOrigin, rayDir);
            if (wallHit && wallHit.isHit) {
                const dist = wallHit.point.sub(rayOrigin).length;
                if (!closestHit || dist < closestHit.dist) {
                    closestHit = {
                        point: wallHit.point,
                        normal: wallHit.normal,
                        isHit: true,
                        wall: wall,
                        dist: dist
                    };
                }
            }
        }
        return closestHit ? { point: closestHit.point, normal: closestHit.normal, isHit: true, wall: closestHit.wall } : null;
    }

    // ── Surface Hit Detection (Multi-Wall, Ceiling & 3D Spatial Support) ────
    public getSurfaceHit(screenPos: vec2): { point: vec3; normal: vec3; isHit: boolean; isOnWall?: boolean; hitWall?: ReferenceWall | null; isCeiling?: boolean } {
        const cam = this.camera;
        if (!cam) {
            return {
                point: new vec3(0, 0, -this.currentDepth),
                normal: new vec3(0, 0, 1),
                isHit: false,
                isOnWall: false,
                hitWall: null
            };
        }

        const rayOrigin = cam.screenSpaceToWorldSpace(screenPos, 1.0);
        const rayFar = cam.screenSpaceToWorldSpace(screenPos, 500.0);
        const rayDir = rayFar.sub(rayOrigin).normalize();

        // 1. Priority: Check all active Reference Walls (Wall 1, Wall 2 / TV Wall, corner partitions)
        const wallHit = this.raycastAllWalls(rayOrigin, rayDir);
        if (wallHit && wallHit.isHit) {
            return {
                point: wallHit.point,
                normal: wallHit.normal,
                isHit: true,
                isOnWall: true,
                hitWall: wallHit.wall,
                isCeiling: false
            };
        }

        // 2. Ceiling Raycasting: Standard residential ceiling plane at y = +120.0 cm
        // Enables wires to jump from walls up to the ceiling and travel between rooms/walls!
        const ceilingY = 120.0;
        if (rayDir.y > 0.005) {
            const tCeil = (ceilingY - rayOrigin.y) / rayDir.y;
            if (tCeil > 5.0 && tCeil < 1200.0) {
                const hitPt = rayOrigin.add(rayDir.uniformScale(tCeil));
                return {
                    point: hitPt,
                    normal: new vec3(0, -1, 0),
                    isHit: true,
                    isOnWall: false,
                    hitWall: null,
                    isCeiling: true
                };
            }
        }

        // 3. Native Spectacles World Mesh Hit Test (on physical glasses device)
        if (this.deviceTracking && typeof this.deviceTracking.hitTestWorldMesh === "function") {
            try {
                const hits = this.deviceTracking.hitTestWorldMesh(screenPos);
                if (hits && hits.length > 0) {
                    return {
                        point: hits[0].position,
                        normal: hits[0].normal,
                        isHit: true,
                        isOnWall: false,
                        hitWall: null
                    };
                }
            } catch (e) {
                // Fallback to geometric planar raycast
            }
        }

        // 4. Default Room Wall Plane at currentDepth (-200cm in front of camera)
        const camTrans = cam.getSceneObject().getTransform();
        const camPos = camTrans.getWorldPosition();
        const camFwd = camTrans.getWorldRotation().multiplyVec3(new vec3(0, 0, -1));
        const wallPlaneTarget = camPos.add(camFwd.uniformScale(this.currentDepth));
        const wallNormal = camFwd.uniformScale(-1);

        const denom = rayDir.dot(wallNormal);
        if (Math.abs(denom) > 0.001) {
            const t = wallPlaneTarget.sub(rayOrigin).dot(wallNormal) / denom;
            if (t > 0) {
                return {
                    point: rayOrigin.add(rayDir.uniformScale(t)),
                    normal: wallNormal,
                    isHit: true,
                    isOnWall: false,
                    hitWall: null
                };
            }
        }

        // 5. Fallback unprojection at comfortable room depth
        const pt = cam.screenSpaceToWorldSpace(screenPos, this.currentDepth);
        return {
            point: pt,
            normal: new vec3(0, 0, 1),
            isHit: false,
            isOnWall: false,
            hitWall: null
        };
    }

    // ── Build UI ──────────────────────────────────────────────────────────
    private buildMarkerUI() {
        if (!this.toolRoot) return;

        // Note: Duplicate status banner removed to prevent overlapping the top HUD toolbar!
        // All status updates now flow cleanly through ToolPaletteUI.setStatusMessage().

        // Start pin (anchored at first node)
        this.startPointMarker = global.scene.createSceneObject("WorldStartPin");
        this.startPointMarker.setParent(this.toolRoot);
        this.startMarkerText = this.startPointMarker.createComponent("Component.Text") as Text;
        this.startMarkerText.text = " 📍 START ";
        this.startMarkerText.size = 42;
        this.startMarkerText.textFill.color = new vec4(1.0, 0.88, 0.1, 1.0);
        this.startMarkerText.backgroundSettings.enabled = true;
        this.startMarkerText.backgroundSettings.fill.color = new vec4(0.04, 0.08, 0.18, 0.94);
        this.startMarkerText.backgroundSettings.cornerRadius = 0.5;
        this.startMarkerText.outlineSettings.enabled = true;
        this.startMarkerText.outlineSettings.fill.color = new vec4(1.0, 0.85, 0.1, 0.95);
        this.startMarkerText.outlineSettings.size = 0.12;
        this.startPointMarker.enabled = false;

        // Live Floating Tape Measure Dimension Label
        this.liveTapeMeasureObj = global.scene.createSceneObject("LiveTapeMeasure");
        this.liveTapeMeasureObj.setParent(this.toolRoot);
        this.liveTapeMeasureText = this.liveTapeMeasureObj.createComponent("Component.Text") as Text;
        this.liveTapeMeasureText.text = "";
        this.liveTapeMeasureText.size = 40;
        this.liveTapeMeasureText.textFill.color = new vec4(1.0, 1.0, 1.0, 1.0);
        this.liveTapeMeasureText.backgroundSettings.enabled = true;
        this.liveTapeMeasureText.backgroundSettings.fill.color = new vec4(0.02, 0.06, 0.15, 0.88);
        this.liveTapeMeasureText.backgroundSettings.cornerRadius = 0.5;
        this.liveTapeMeasureText.outlineSettings.enabled = true;
        this.liveTapeMeasureText.outlineSettings.fill.color = new vec4(1.0, 0.85, 0.15, 0.95);
        this.liveTapeMeasureText.outlineSettings.size = 0.14;
        this.liveTapeMeasureObj.enabled = false;
    }

    // ── Update loop — live gaze surface tracking & real-time tape measure ─
    private registerUpdateEvent() {
        this.createEvent("UpdateEvent").bind(() => {
            const glassesCam = this.camera;
            if (!glassesCam) return;

            const glassesCamPos = glassesCam.getSceneObject().getTransform().getWorldPosition();
            const activeViewer = this.viewerCamera || glassesCam;
            const viewerRot = activeViewer.getSceneObject().getTransform().getWorldRotation();

            // Always raycast from glasses camera center
            const centerScreen = new vec2(0.5, 0.5);
            const hit = this.getSurfaceHit(centerScreen);

            // ── Real-Time 3D Raycast Laser & Target Visualizer (Guides pinch & aiming) ──
            if (global.debugRenderSystem) {
                // 1. Spectacles Glasses 3D Proxy (visible when viewed from Camera 2 or Scene View)
                const isViewerOutside = (this.viewerCamera && this.viewerCamera !== glassesCam);
                if (isViewerOutside) {
                    global.debugRenderSystem.drawSolidSphere(glassesCamPos, 3.2, new vec4(0.0, 0.85, 1.0, 0.95));
                    global.debugRenderSystem.drawCircle(glassesCamPos, 6.0, new vec4(0.2, 0.9, 1.0, 0.85));
                    const fwd = hit.point.sub(glassesCamPos).normalize();
                    global.debugRenderSystem.drawLine(glassesCamPos, glassesCamPos.add(fwd.uniformScale(22.0)), new vec4(1.0, 1.0, 1.0, 0.9));
                }

                // 2. High-Visibility Raycast Laser Trajectory Beam (from glasses to wall/ceiling)
                const laserCol = hit.isHit
                    ? (hit.isCeiling ? new vec4(0.2, 0.9, 1.0, 0.9) : new vec4(0.0, 1.0, 0.75, 0.85))
                    : new vec4(1.0, 0.85, 0.1, 0.85);
                global.debugRenderSystem.drawLine(glassesCamPos, hit.point, laserCol);

                // 3. Wall/Ceiling Surface Contact Disc & Reticle (Precision Pinch Target)
                const reticleCol = hit.isHit
                    ? (hit.isCeiling ? new vec4(0.3, 0.95, 1.0, 0.95) : new vec4(0.2, 1.0, 0.5, 0.95))
                    : new vec4(0.0, 0.9, 1.0, 0.85);
                global.debugRenderSystem.drawCircle(hit.point, 4.5, reticleCol);
                global.debugRenderSystem.drawSolidSphere(hit.point, 1.8, reticleCol);
            }

            // Keep all placed node markers facing the active viewer camera
            for (const m of this.nodeMarkerObjs) {
                if (m) m.getTransform().setWorldRotation(viewerRot);
            }
            if (this.startPointMarker && this.startPointMarker.enabled) {
                this.startPointMarker.getTransform().setWorldRotation(viewerRot);
            }

            // ── Live Wire Preview & Tape Measure (when in active marking mode) ──
            if (this.isMarkingActive && this.polylineNodes.length > 0) {
                const last = this.polylineNodes[this.polylineNodes.length - 1];
                let lockedGaze = hit.point;

                // 1. Auto-Ortho Snapping across Wall, Ceiling & Cross-Wall Transitions
                if (this.isOrthoSnapEnabled) {
                    if (hit.isOnWall && hit.hitWall && this.lastNodeWall && this.lastNodeWall === hit.hitWall) {
                        lockedGaze = hit.hitWall.applyLocalOrthoSnap(last, lockedGaze);
                    } else if (hit.isCeiling && this.lastNodeIsCeiling) {
                        const dx = Math.abs(lockedGaze.x - last.x);
                        const dz = Math.abs(lockedGaze.z - last.z);
                        if (dx >= dz * 1.25) {
                            lockedGaze = new vec3(lockedGaze.x, 120.0, last.z);
                        } else if (dz >= dx * 1.25) {
                            lockedGaze = new vec3(last.x, 120.0, lockedGaze.z);
                        } else {
                            lockedGaze = new vec3(lockedGaze.x, 120.0, lockedGaze.z);
                        }
                    } else if (hit.isOnWall && hit.hitWall) {
                        lockedGaze = hit.hitWall.projectPointToWall(lockedGaze);
                    } else if (hit.isCeiling) {
                        lockedGaze = new vec3(lockedGaze.x, 120.0, lockedGaze.z);
                    } else {
                        lockedGaze = this.applyOrthoSnap(last, lockedGaze);
                    }
                }

                // 2. Snap to existing endpoints if close
                lockedGaze = this.snapToNearbyEndpoint(lockedGaze);
                this.gazeWorldPos = lockedGaze;

                const distCm = last.distance(lockedGaze);
                const distFt = (distCm / 30.48).toFixed(1);

                // Update Live Tape Measure Billboard
                if (this.liveTapeMeasureObj && this.liveTapeMeasureText) {
                    const mid = last.add(lockedGaze).uniformScale(0.5);
                    this.liveTapeMeasureObj.getTransform().setWorldPosition(new vec3(mid.x, mid.y + 4.5, mid.z));
                    const orthoIcon = hit.isCeiling ? "☁️ CEILING " : (this.isOrthoSnapEnabled ? "📐 " : "📏 ");
                    this.liveTapeMeasureText.text = ` ${orthoIcon}${distCm.toFixed(0)}cm (${distFt}ft) `;
                    this.liveTapeMeasureObj.enabled = true;
                    this.liveTapeMeasureObj.getTransform().setWorldRotation(viewerRot);
                }

                // Draw live wire preview line flush on wall surface
                if (global.debugRenderSystem) {
                    const previewColor = new vec4(1.0, 0.88, 0.15, 0.85); // glowing safety yellow
                    global.debugRenderSystem.drawLine(last, lockedGaze, previewColor);
                    global.debugRenderSystem.drawSolidSphere(lockedGaze, 2.5, new vec4(1.0, 1.0, 0.3, 0.9));

                    // Tape measure tick at midpoint
                    const tickPos = last.add(lockedGaze).uniformScale(0.5);
                    global.debugRenderSystem.drawSolidSphere(tickPos, 1.2, new vec4(1.0, 1.0, 1.0, 0.9));
                }
            } else {
                this.gazeWorldPos = hit.point;
                if (this.liveTapeMeasureObj) this.liveTapeMeasureObj.enabled = false;
            }
        });
    }

    // ── Input registration ────────────────────────────────────────────────
    private registerInputEvents() {
        this.createEvent("TouchStartEvent").bind((event: TouchStartEvent) => {
            if (!this.isMarkingActive) return;

            const tapPos = event.getTouchPosition();

            // Block clicks on toolbar buttons from dropping wire nodes
            if (this.toolPalette && typeof this.toolPalette.isClickOnToolbar === "function") {
                if (this.toolPalette.isClickOnToolbar(tapPos)) return;
            }

            const hit = this.getSurfaceHit(tapPos);
            this.handleNodeTap(hit.point, !!hit.isOnWall, hit.hitWall || null, !!hit.isCeiling);
        });
    }

    // ── Core: drop a node or finish (Multi-Wall, Ceiling & Corner Routing) ────
    private handleNodeTap(rawWorldPt: vec3, isOnWall: boolean = false, hitWall: ReferenceWall | null = null, isCeiling: boolean = false) {
        let targetPt = rawWorldPt;

        // Project onto the SPECIFIC wall that was hit (e.g. Wall 2 / TV Wall, Kitchen, etc.)
        if (isOnWall && hitWall) {
            targetPt = hitWall.projectPointToWall(targetPt);
        } else if (isCeiling) {
            targetPt = new vec3(targetPt.x, 120.0, targetPt.z);
        }

        if (this.polylineNodes.length > 0) {
            const anchor = this.polylineNodes[this.polylineNodes.length - 1];

            // Auto-Ortho 90° Snapping across Wall, Ceiling & Cross-Wall Transitions
            if (this.isOrthoSnapEnabled) {
                if (isOnWall && hitWall && this.lastNodeWall && this.lastNodeWall === hitWall) {
                    // Both anchor and target are on the SAME wall: use local wall ortho snap!
                    targetPt = hitWall.applyLocalOrthoSnap(anchor, targetPt);
                } else if (isCeiling && this.lastNodeIsCeiling) {
                    // Both anchor and target are on the ceiling: snap in ceiling XZ grid!
                    const dx = Math.abs(targetPt.x - anchor.x);
                    const dz = Math.abs(targetPt.z - anchor.z);
                    if (dx >= dz * 1.25) {
                        targetPt = new vec3(targetPt.x, 120.0, anchor.z);
                    } else if (dz >= dx * 1.25) {
                        targetPt = new vec3(anchor.x, 120.0, targetPt.z);
                    } else {
                        targetPt = new vec3(targetPt.x, 120.0, targetPt.z);
                    }
                } else if (isOnWall && hitWall) {
                    // Cross-surface jump to new wall (e.g. Wall 1 -> Wall 2 / TV Wall)
                    targetPt = hitWall.projectPointToWall(targetPt);
                } else if (isCeiling) {
                    // Cross-surface jump up to ceiling
                    targetPt = new vec3(targetPt.x, 120.0, targetPt.z);
                } else {
                    targetPt = this.applyOrthoSnap(anchor, targetPt);
                }
            }
        }

        // Snap to nearest existing run endpoint if within radius (welds connection into joint)
        const worldPt = this.snapToNearbyEndpoint(targetPt);

        // ── Add node ──────────────────────────────────────────────────────
        this.polylineNodes.push(worldPt);
        this.lastNodeWall = isOnWall ? (hitWall || null) : null;
        this.lastNodeIsCeiling = isCeiling;
        this.placeNodeMarker(worldPt, this.polylineNodes.length);

        if (this.polylineNodes.length === 1) {
            // First node — show the start pin
            if (this.startPointMarker) {
                this.startPointMarker.getTransform().setWorldPosition(worldPt);
                this.startPointMarker.enabled = true;
            }
            if (this.toolPalette) {
                const surfaceName = isOnWall ? (hitWall ? hitWall.wallId : "Wall") : (isCeiling ? "Ceiling" : "Space");
                this.toolPalette.setStatusMessage(
                    `📍 START ANCHORED on [${surfaceName}] • Aim at any wall or ceiling & tap next turn!`,
                    new vec4(0.3, 1.0, 0.6, 1.0)
                );
            }
            print(`[WireSight] Polyline start: (${worldPt.x.toFixed(0)}, ${worldPt.y.toFixed(0)}, ${worldPt.z.toFixed(0)}) on ${isOnWall ? "Wall" : (isCeiling ? "Ceiling" : "Space")}`);
        } else {
            // Subsequent nodes: immediately emit the segment [n-1 → n]
            const startPt = this.polylineNodes[this.polylineNodes.length - 2];
            const endPt   = this.polylineNodes[this.polylineNodes.length - 1];
            this.emitSegment(startPt, endPt, false /* not last */);
            const distCm = startPt.distance(endPt);
            const segCount = this.polylineNodes.length - 1;
            if (this.toolPalette) {
                const targetName = isOnWall ? (hitWall ? hitWall.wallId : "Wall") : (isCeiling ? "Ceiling" : "Space");
                this.toolPalette.setStatusMessage(
                    `✓ SEGMENT #${segCount} ROUTED to [${targetName}] (${distCm.toFixed(0)}cm) • Tap next turn or [✏️ DRAW] to finish`,
                    new vec4(0.2, 1.0, 0.5, 1.0)
                );
            }
            print(`[WireSight] Polyline node #${this.polylineNodes.length} added on ${isOnWall ? "Wall" : (isCeiling ? "Ceiling" : "Space")}. Segment #${segCount} (${distCm.toFixed(1)}cm)`);
        }
    }

    public applyOrthoSnap(anchor: vec3, target: vec3): vec3 {
        const dx = Math.abs(target.x - anchor.x);
        const dy = Math.abs(target.y - anchor.y);
        const dz = Math.abs(target.z - anchor.z);

        // Dominant X (horizontal run along North/South wall)
        if (dx >= dy * 1.3 && dx >= dz * 1.3) {
            return new vec3(target.x, anchor.y, anchor.z);
        }
        // Dominant Y (vertical drop or riser)
        if (dy >= dx * 1.3 && dy >= dz * 1.3) {
            return new vec3(anchor.x, target.y, anchor.z);
        }
        // Dominant Z (depth / perpendicular side wall / ceiling corridor run)
        if (dz >= dx * 1.3 && dz >= dy * 1.3) {
            return new vec3(anchor.x, anchor.y, target.z);
        }
        return target;
    }

    public toggleOrthoSnap(): boolean {
        this.isOrthoSnapEnabled = !this.isOrthoSnapEnabled;
        if (this.toolPalette) {
            const state = this.isOrthoSnapEnabled ? "ON (90° Straight Lines)" : "OFF (Freeform)";
            this.toolPalette.setStatusMessage(`📐 Auto-Ortho: ${state}`, new vec4(0.3, 0.95, 1.0, 1.0));
        }
        return this.isOrthoSnapEnabled;
    }

    public getIsOrthoSnap(): boolean {
        return this.isOrthoSnapEnabled;
    }

    // ── Finish the polyline ───────────────────────────────────────────────
    private finishPolyline() {
        if (this.polylineNodes.length < 2) {
            // Not enough nodes — just cancel
            this.cancelPolyline();
            return;
        }

        // The last emitted segment was already created; clean up markers and state
        this.clearNodeMarkers();
        this.lastNodeWall = null;
        this.lastNodeIsCeiling = false;
        if (this.startPointMarker) this.startPointMarker.enabled = false;
        if (this.liveTapeMeasureObj) this.liveTapeMeasureObj.enabled = false;

        const segCount = this.polylineNodes.length - 1;
        this.polylineNodes = [];

        if (this.toolPalette) {
            this.toolPalette.setStatusMessage(
                `✓ WIRE RUN COMPLETE: ${segCount} segment${segCount > 1 ? "s" : ""} placed. Tap [✏️ DRAW] for new run.`,
                new vec4(0.2, 1.0, 0.5, 1.0)
            );
        }
        print(`[WireSight] Polyline finished — ${segCount} segment(s) placed.`);
    }

    private cancelPolyline() {
        this.polylineNodes = [];
        this.lastNodeWall = null;
        this.lastNodeIsCeiling = false;
        this.clearNodeMarkers();
        if (this.startPointMarker) this.startPointMarker.enabled = false;
        if (this.liveTapeMeasureObj) this.liveTapeMeasureObj.enabled = false;
        if (this.toolPalette) {
            this.toolPalette.setStatusMessage("✏️ Marking cancelled.", new vec4(0.8, 0.8, 0.8, 0.8));
        }
        print("[WireSight] Polyline cancelled (< 2 nodes).");
    }

    // ── Emit one segment as a ConduitRun ──────────────────────────────────
    private emitSegment(startPt: vec3, endPt: vec3, isLast: boolean) {
        const isElec   = this.selectedLayer === "electrical";
        const runIdx   = this.markedRuns.length + 1;

        const currentGauge = (this.toolPalette && typeof this.toolPalette.getCurrentGauge === "function")
            ? this.toolPalette.getCurrentGauge()
            : { label: "12 AWG (20A)", name: "12 AWG (20A Outlets)", thickness: 5.5, voltage: "230V AC - 20A" };

        const isWireLive = (this.toolPalette && typeof this.toolPalette.getIsWireLive === "function")
            ? this.toolPalette.getIsWireLive()
            : true;

        const currentRoom = (this.toolPalette && typeof this.toolPalette.getCurrentRoomZone === "function")
            ? this.toolPalette.getCurrentRoomZone()
            : "Kitchen";

        const lenCm = startPt.distance(endPt);

        const newRun: ConduitRun = {
            id: `run-${runIdx}-${Date.now()}`,
            name: isElec
                ? `[${currentRoom}] Circuit #${runIdx}: ${currentGauge.label}`
                : `[${currentRoom}] Pipe #${runIdx}: Water Riser`,
            layer: this.selectedLayer,
            voltageOrType: isElec
                ? `${isWireLive ? "Live 230V" : "De-Energized"} (${currentGauge.label})`
                : `1/2" PEX Line (${lenCm.toFixed(0)} cm)`,
            installer: "Electrician (Live Mapping)",
            installDate: new Date().toLocaleDateString(),
            status: isWireLive ? "LIVE 230V AC (ENERGIZED)" : "DE-ENERGIZED (SAFE / COLD)",
            color: isElec
                ? (isWireLive ? new vec4(1.0, 0.85, 0.1, 1.0) : new vec4(0.4, 0.65, 0.85, 0.9))
                : new vec4(0.2, 0.7, 1.0, 1.0),
            startPoint: startPt,
            endPoint: endPt,
            isWorldCoords: true,
            roomZone: currentRoom,
            gauge: currentGauge.label,
            isLive: isWireLive,
            thickness: currentGauge.thickness || 5.5
        };

        this.markedRuns.push(newRun);

        if (this.onConduitMarked) {
            this.onConduitMarked(newRun);
        }
    }

    // ── Snap to nearby endpoints ──────────────────────────────────────────
    private snapToNearbyEndpoint(pt: vec3): vec3 {
        const candidateRuns: ConduitRun[] = [];

        // Check active runs in parent controller
        const getActiveRuns: (() => ConduitRun[]) | undefined =
            (this.toolPalette as any)?.__parentGetActiveRuns;
        if (getActiveRuns) {
            try {
                const pRuns = getActiveRuns();
                if (pRuns && pRuns.length > 0) candidateRuns.push(...pRuns);
            } catch (e) {}
        }
        // Also check runs locally tracked in markedRuns
        if (this.markedRuns && this.markedRuns.length > 0) {
            for (const r of this.markedRuns) {
                if (!candidateRuns.some(c => c.id === r.id)) {
                    candidateRuns.push(r);
                }
            }
        }

        let bestDist = LineMarkerTool.SNAP_RADIUS_CM;
        let snapped: vec3 = pt;

        for (const run of candidateRuns) {
            const dA = pt.distance(run.startPoint);
            const dB = pt.distance(run.endPoint);
            if (dA < bestDist) {
                bestDist = dA;
                snapped = new vec3(run.startPoint.x, run.startPoint.y, run.startPoint.z);
            }
            if (dB < bestDist) {
                bestDist = dB;
                snapped = new vec3(run.endPoint.x, run.endPoint.y, run.endPoint.z);
            }
        }

        // Also snap to nodes in the current polyline
        for (const node of this.polylineNodes) {
            const d = pt.distance(node);
            if (d < bestDist) {
                bestDist = d;
                snapped = new vec3(node.x, node.y, node.z);
            }
        }

        return snapped;
    }

    // ── Node markers (small floating dot labels per tap) ──────────────────
    private placeNodeMarker(worldPt: vec3, idx: number) {
        if (!this.toolRoot) return;
        const obj = global.scene.createSceneObject(`NodeMark_${idx}`);
        obj.setParent(this.toolRoot);
        obj.getTransform().setWorldPosition(worldPt);

        const activeCam = this.viewerCamera || this.camera;
        if (activeCam) {
            obj.getTransform().setWorldRotation(activeCam.getSceneObject().getTransform().getWorldRotation());
        }

        const t = obj.createComponent("Component.Text") as Text;
        t.text = idx === 1 ? " ◉ START " : ` • #${idx} `;
        t.size = idx === 1 ? 46 : 38;
        t.textFill.color = new vec4(1.0, 0.9, 0.2, 1.0);
        t.backgroundSettings.enabled = true;
        t.backgroundSettings.fill.color = new vec4(0.02, 0.06, 0.16, 0.90);
        t.backgroundSettings.cornerRadius = 0.5;
        t.outlineSettings.enabled = true;
        t.outlineSettings.fill.color = new vec4(1.0, 0.75, 0.0, 0.95);
        t.outlineSettings.size = 0.14;
        this.nodeMarkerObjs.push(obj);
    }

    private clearNodeMarkers() {
        for (const obj of this.nodeMarkerObjs) {
            if (obj) obj.destroy();
        }
        this.nodeMarkerObjs = [];
    }

    // ── Status banner text (routed to unified top safe zone HUD) ──────────
    private updateStatusBanner() {
        if (!this.toolPalette) return;
        const n = this.polylineNodes.length;
        if (n === 0) {
            this.toolPalette.setStatusMessage("✏️ AIM AT WALL • Reticle hugs surface • Tap Point A", new vec4(1.0, 0.88, 0.2, 1.0));
        } else if (n === 1) {
            this.toolPalette.setStatusMessage("📍 Point A anchored • Move across wall & tap next turn", new vec4(0.3, 1.0, 0.6, 1.0));
        } else {
            this.toolPalette.setStatusMessage(`✏️ ${n} nodes placed • Double-tap to finish circuit`, new vec4(0.2, 1.0, 0.5, 1.0));
        }
    }

    // ── Toggle marking mode ───────────────────────────────────────────────
    public toggleMarkingMode(): boolean {
        this.isMarkingActive = !this.isMarkingActive;

        if (!this.isMarkingActive) {
            // Finishing by button press: commit whatever we have
            if (this.polylineNodes.length >= 2) {
                this.finishPolyline();
            } else {
                this.cancelPolyline();
            }
        } else {
            this.polylineNodes = [];
            this.clearNodeMarkers();
            this.updateStatusBanner();
        }

        print(`[WireSight] Polyline Marking: ${this.isMarkingActive ? "ON" : "OFF"}`);
        return this.isMarkingActive;
    }

    // ── Undo last node ────────────────────────────────────────────────────
    public undoLastNode(): boolean {
        if (this.polylineNodes.length === 0) return false;

        // Remove the last emitted segment's run
        if (this.polylineNodes.length >= 2) {
            const lastRun = this.markedRuns.pop();
            if (lastRun && this.toolPalette) {
                // Signal main to also remove visual
                (this.toolPalette as any).__onUndoSegment && (this.toolPalette as any).__onUndoSegment(lastRun.id);
            }
        }

        // Remove last node marker
        const lastMarker = this.nodeMarkerObjs.pop();
        if (lastMarker) lastMarker.destroy();

        this.polylineNodes.pop();
        this.updateStatusBanner();

        if (this.polylineNodes.length === 0 && this.startPointMarker) {
            this.startPointMarker.enabled = false;
        }

        print(`[WireSight] Undo: removed last node. Remaining: ${this.polylineNodes.length}`);
        return true;
    }

    // ── Legacy handlePointClick (kept for test compat) ────────────────────
    public handlePointClick(worldPt: vec3) {
        this.handleNodeTap(worldPt);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private screenToWorldWallPosition(screenPos: vec2): vec3 {
        if (this.camera) {
            return this.camera.screenSpaceToWorldSpace(screenPos, this.currentDepth);
        }
        const basePos = this.toolRoot!.getTransform().getWorldPosition();
        const offsetX = (screenPos.x - 0.5) * 140.0;
        const offsetY = (0.5 - screenPos.y) * 95.0;
        return new vec3(basePos.x + offsetX, basePos.y + offsetY, basePos.z - this.currentDepth);
    }

    public setLayerType(layer: "electrical" | "plumbing") {
        this.selectedLayer = layer;
    }

    public deleteLastRun(): ConduitRun | null {
        if (this.markedRuns.length === 0) return null;
        return this.markedRuns.pop() || null;
    }

    public clearAll() {
        this.markedRuns = [];
        this.polylineNodes = [];
        this.clearNodeMarkers();
        this.lastTapTime = 0;
        if (this.startPointMarker) this.startPointMarker.enabled = false;
        if (this.liveTapeMeasureObj) this.liveTapeMeasureObj.enabled = false;
    }
}
