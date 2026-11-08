import { ReferenceWall } from "./ReferenceWall";

@component
export class WallCreatorTool extends BaseScriptComponent {
    private camera: Camera | null = null;
    private referenceWall: ReferenceWall | null = null;
    private toolPalette: any = null;

    // Creation State Machine
    private isActive: boolean = false;
    private isWaitingForPointB: boolean = false;
    private pointA: vec3 | null = null;
    private candidatePointB: vec3 | null = null;
    private currentMousePos: vec2 = new vec2(0.5, 0.5);
    private lastPinchTime: number = 0;

    // Default depth in front of camera if not specified
    private defaultWallDepth: number = 180.0;

    // Event Callbacks
    public onWallCreated: ((widthCm: number, heightCm: number, center: vec3) => void) | null = null;
    public onWallCancelled: (() => void) | null = null;

    onAwake() {
        this.registerTouchClicks();
        this.createEvent("UpdateEvent").bind(() => this.onFrameUpdate());
    }

    public setCamera(cam: Camera) {
        this.camera = cam;
    }

    public setReferenceWall(wall: ReferenceWall) {
        this.referenceWall = wall;
    }

    public setToolPalette(palette: any) {
        this.toolPalette = palette;
    }

    public getIsActive(): boolean {
        return this.isActive;
    }

    public startWallCreation() {
        this.isActive = true;
        this.isWaitingForPointB = false;
        this.pointA = null;
        this.candidatePointB = null;

        if (this.toolPalette && typeof this.toolPalette.setStatusMessage === "function") {
            this.toolPalette.setStatusMessage("📐 AIM AT FLOOR & PINCH POINT A (Relax hands at waist)", new vec4(0.2, 0.95, 1.0, 1.0));
        }
        print("[WallCreatorTool] Started wall creation. Waiting for Point A pinch...");
    }

    public cancelWallCreation() {
        this.isActive = false;
        this.isWaitingForPointB = false;
        this.pointA = null;
        this.candidatePointB = null;

        if (this.toolPalette && typeof this.toolPalette.setStatusMessage === "function") {
            this.toolPalette.setStatusMessage("○ Wall creation cancelled", new vec4(0.8, 0.8, 0.9, 0.9));
        }
        if (this.onWallCancelled) this.onWallCancelled();
    }

    private registerTouchClicks() {
        this.createEvent("TouchStartEvent").bind((event: TouchStartEvent) => {
            if (!this.isActive) return;

            const tapPos = event.getTouchPosition();
            this.currentMousePos = tapPos;

            // Ignore taps on UI buttons
            if (this.toolPalette && typeof this.toolPalette.isClickOnToolbar === "function") {
                if (this.toolPalette.isClickOnToolbar(tapPos)) return;
            }

            this.handlePinch(tapPos);
        });

        this.createEvent("TouchMoveEvent").bind((event: TouchMoveEvent) => {
            if (!this.isActive) return;
            this.currentMousePos = event.getTouchPosition();
        });
    }

    // Mathematical Ray-Plane Intersection on Plumb Depth Plane
    private computePlaneHit(screenPos: vec2, planeAnchor: vec3, planeNormal: vec3): vec3 | null {
        if (!this.camera) return null;

        const rayOrigin = this.camera.screenSpaceToWorldSpace(screenPos, 1.0);
        const rayFar = this.camera.screenSpaceToWorldSpace(screenPos, 500.0);
        const rayDir = rayFar.sub(rayOrigin).normalize();

        const denom = rayDir.dot(planeNormal);
        if (Math.abs(denom) < 0.001) return null;

        const t = planeAnchor.sub(rayOrigin).dot(planeNormal) / denom;
        if (t <= 0) return null;

        return rayOrigin.add(rayDir.uniformScale(t));
    }

    public handlePinch(screenPos: vec2) {
        if (!this.isActive || !this.camera) return;

        const now = (typeof getTime === "function") ? getTime() : Date.now() / 1000;

        if (!this.isWaitingForPointB) {
            // =========================================================================
            // ACTION 1: PINCH POINT A (Origin / Bottom-Left Corner)
            // =========================================================================
            const camTrans = this.camera.getSceneObject().getTransform();
            const camPos = camTrans.getWorldPosition();
            const camFwd = camTrans.getWorldRotation().multiplyVec3(new vec3(0, 0, -1));

            // Default plane facing camera at 1.8m
            const defaultPlaneAnchor = camPos.add(camFwd.uniformScale(this.defaultWallDepth));
            const defaultPlaneNormal = camFwd.uniformScale(-1);

            const hitA = this.computePlaneHit(screenPos, defaultPlaneAnchor, defaultPlaneNormal);
            this.pointA = hitA || defaultPlaneAnchor;
            this.isWaitingForPointB = true;
            this.lastPinchTime = now;

            if (this.toolPalette && typeof this.toolPalette.setStatusMessage === "function") {
                this.toolPalette.setStatusMessage(
                    `📍 POINT A ANCHORED at (${this.pointA.x.toFixed(0)}, ${this.pointA.y.toFixed(0)}) • Aim at top corner & pinch Point B`,
                    new vec4(0.3, 1.0, 0.6, 1.0)
                );
            }
            print(`[WallCreatorTool] Point A anchored at: ${this.pointA.x.toFixed(1)}, ${this.pointA.y.toFixed(1)}, ${this.pointA.z.toFixed(1)}`);
        } else {
            // =========================================================================
            // ACTION 2: PINCH POINT B (Commit / Top-Right Corner)
            // =========================================================================
            // Debounce check: ignore consecutive pinches within 200ms
            if (now - this.lastPinchTime < 0.20) return;

            if (!this.pointA) return;

            const camTrans = this.camera.getSceneObject().getTransform();
            const camPos = camTrans.getWorldPosition();
            const camFwd = camTrans.getWorldRotation().multiplyVec3(new vec3(0, 0, -1));
            const planeNormal = camFwd.uniformScale(-1);

            // Point B is strictly projected onto Point A's depth plane (Depth Inheritance)
            const rawHitB = this.computePlaneHit(screenPos, this.pointA, planeNormal) || this.candidatePointB;
            if (!rawHitB) return;

            this.commitWall(this.pointA, rawHitB);
        }
    }

    public commitWall(pA: vec3, pB: vec3) {
        // Compute raw width and height in camera view space so it works at ANY camera angle
        let rawW = Math.abs(pB.x - pA.x);
        let rawH = Math.abs(pB.y - pA.y);

        if (this.camera) {
            const camRot = this.camera.getSceneObject().getTransform().getWorldRotation();
            const invRot = camRot.invert();
            const localDelta = invRot.multiplyVec3(pB.sub(pA));
            rawW = Math.abs(localDelta.x);
            rawH = Math.abs(localDelta.y);
        }

        // Edge Case 1: Minimum size threshold & Sub-scale auto-expand
        let finalW = rawW;
        let finalH = rawH;

        if (rawW < 40.0 && rawH < 40.0) {
            // Accidental double-pinch: auto-expand to standard 120cm x 240cm (4ft x 8ft sheet)
            finalW = 120.0;
            finalH = 240.0;
        } else {
            finalW = Math.max(80.0, rawW);  // Minimum 80cm (at least 2 stud bays)
            finalH = Math.max(100.0, rawH); // Minimum 100cm height
        }

        // 3D Center Calculation
        const wallCenter = pA.add(pB).uniformScale(0.5);

        // Rotation: Strictly Plumb (World-Up alignment) with front face (+Z) facing the user
        let wallRot = quat.fromEulerAngles(0, 0, 0);
        if (this.camera) {
            const camPos = this.camera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 1.0);
            const toCam = camPos.sub(wallCenter);
            toCam.y = 0; // Lock roll and pitch to 0 (gravity-aligned plumb wall)
            if (toCam.length > 0.01) {
                const yaw = Math.atan2(toCam.x, toCam.z);
                wallRot = quat.fromEulerAngles(0, yaw, 0);
            }
        }

        // Rebuild reference wall with dynamic dimensions
        if (this.referenceWall) {
            this.referenceWall.rebuildWall(wallCenter, wallRot, finalW, finalH);
        }

        const studCount = Math.floor(finalW / 40.64) + 1;

        if (this.toolPalette && typeof this.toolPalette.setStatusMessage === "function") {
            this.toolPalette.setStatusMessage(
                `✓ WALL CREATED: ${finalW.toFixed(0)}cm wide × ${finalH.toFixed(0)}cm tall (${studCount} Studs)`,
                new vec4(0.2, 1.0, 0.5, 1.0)
            );
        }

        this.isActive = false;
        this.isWaitingForPointB = false;
        this.pointA = null;
        this.candidatePointB = null;

        if (this.onWallCreated) {
            this.onWallCreated(finalW, finalH, wallCenter);
        }

        print(`[WallCreatorTool] Successfully committed wall: ${finalW.toFixed(0)}x${finalH.toFixed(0)}cm at (${wallCenter.x.toFixed(0)}, ${wallCenter.y.toFixed(0)}, ${wallCenter.z.toFixed(0)})`);
    }

    private onFrameUpdate() {
        if (!this.isActive || !this.isWaitingForPointB || !this.pointA || !this.camera) return;

        // Cast ray from current mouse position through Point A's depth plane
        const rayOrigin = this.camera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 1.0);
        const rayFar = this.camera.screenSpaceToWorldSpace(new vec2(0.5, 0.5), 100.0);
        const camFwd = rayFar.sub(rayOrigin).normalize();
        const planeNormal = camFwd.uniformScale(-1);

        this.candidatePointB = this.computePlaneHit(this.currentMousePos, this.pointA, planeNormal);

        if (!this.candidatePointB) return;

        // Real-Time Elastic Framing Visualizer
        if (global.debugRenderSystem) {
            const pA = this.pointA;
            const pB = this.candidatePointB;

            const minX = Math.min(pA.x, pB.x);
            const maxX = Math.max(pA.x, pB.x);
            const minY = Math.min(pA.y, pB.y);
            const maxY = Math.max(pA.y, pB.y);
            const z = pA.z;

            const cTL = new vec3(minX, maxY, z);
            const cTR = new vec3(maxX, maxY, z);
            const cBR = new vec3(maxX, minY, z);
            const cBL = new vec3(minX, minY, z);

            const frameColor = new vec4(1.0, 0.88, 0.15, 0.9); // Glowing yellow drafting frame
            global.debugRenderSystem.drawLine(cTL, cTR, frameColor);
            global.debugRenderSystem.drawLine(cTR, cBR, frameColor);
            global.debugRenderSystem.drawLine(cBR, cBL, frameColor);
            global.debugRenderSystem.drawLine(cBL, cTL, frameColor);

            // Draw glowing corner pinches
            global.debugRenderSystem.drawSolidSphere(pA, 2.5, new vec4(0.2, 1.0, 0.5, 0.95)); // Point A Green
            global.debugRenderSystem.drawSolidSphere(pB, 2.5, new vec4(1.0, 0.85, 0.2, 0.95)); // Point B Yellow

            // Draw live preview studs inside bounding box
            const width = maxX - minX;
            const studSpacing = 40.64;
            const numBays = Math.floor(width / studSpacing);
            for (let i = 1; i <= numBays; i++) {
                const sx = minX + i * studSpacing;
                if (sx < maxX - 5.0) {
                    const topS = new vec3(sx, maxY, z);
                    const botS = new vec3(sx, minY, z);
                    global.debugRenderSystem.drawLine(topS, botS, new vec4(0.2, 0.8, 1.0, 0.6));
                }
            }
        }
    }
}

