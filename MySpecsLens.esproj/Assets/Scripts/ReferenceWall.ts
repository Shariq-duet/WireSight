@component
export class ReferenceWall extends BaseScriptComponent {
    private wallRoot: SceneObject | null = null;
    private collider: ColliderComponent | null = null;
    private headerLabelObj: SceneObject | null = null;
    private headerTextComp: Text | null = null;

    // Multi-Wall & Rotation Properties
    public wallId: string = "wall-1";
    public wallIndex: number = 1;
    public isActiveWall: boolean = true;
    public wallYawDegrees: number = 0;

    // Dimensions in centimeters (Standard 8ft x 9ft room back wall default)
    public widthCm: number = 280.0;
    public heightCm: number = 240.0;
    public depthCm: number = 10.0;

    // 16-inch on-center standard stud positions across width
    public studLocalXs: number[] = [-140.0, -100.0, -60.0, -20.0, 20.0, 60.0, 100.0, 140.0];

    // Floor and ceiling elevations relative to wall center
    public floorY: number = -120.0;
    public ceilingY: number = 120.0;

    // Standard electrical outlet elevation: 18 inches (~45 cm) from floor
    public outletLocalY: number = -75.0;

    // Pinch Resize & Move Handles: All 4 Corners + Center Move
    private handleResizeTLObj: SceneObject | null = null;
    private handleResizeTRObj: SceneObject | null = null;
    private handleResizeBLObj: SceneObject | null = null;
    private handleResizeBRObj: SceneObject | null = null;
    private handleMoveCenterObj: SceneObject | null = null;
    private handleRotateTopObj: SceneObject | null = null;
    private editHandlesVisible: boolean = false;

    // Default wall transform: 1.8 meters in front of user
    public initialPosition: vec3 = new vec3(0, 0, -180.0);
    public initialRotation: quat = quat.fromEulerAngles(0, 0, 0);

    onAwake() {
        this.wallRoot = this.getSceneObject();
        this.wallRoot.getTransform().setWorldPosition(this.initialPosition);
        this.wallRoot.getTransform().setWorldRotation(this.initialRotation);

        this.setupWallCollider();
        this.setupVisualPlateLabels();
        this.setupPinchHandles();

        this.createEvent("UpdateEvent").bind(() => this.renderWallFraming());
    }

    private setupWallCollider() {
        if (!this.wallRoot) return;

        // Add 3D box collider matching wall plane (240cm x 240cm x 6cm)
        this.collider = this.wallRoot.createComponent("Physics.ColliderComponent") as ColliderComponent;
        const box = Shape.createBoxShape();
        box.size = new vec3(this.widthCm, this.heightCm, 6.0);
        this.collider.shape = box;
    }

    private setupVisualPlateLabels() {
        if (!this.wallRoot) return;

        // Top Header Banner
        this.headerLabelObj = global.scene.createSceneObject("WallHeaderLabel");
        this.headerLabelObj.setParent(this.wallRoot);
        this.headerLabelObj.getTransform().setLocalPosition(new vec3(0, this.ceilingY + 12.0, 2.0));
        this.headerTextComp = this.headerLabelObj.createComponent("Component.Text") as Text;
        this.headerTextComp.size = 20;
        this.headerTextComp.horizontalAlignment = HorizontalAlignment.Center;
        this.headerTextComp.verticalAlignment = VerticalAlignment.Center;
        this.headerTextComp.backgroundSettings.enabled = true;
        this.headerTextComp.backgroundSettings.fill.color = new vec4(0.01, 0.04, 0.12, 0.75);
        this.headerTextComp.backgroundSettings.cornerRadius = 0.45;
        this.headerTextComp.outlineSettings.enabled = true;
        this.headerTextComp.outlineSettings.size = 0.15;
        this.updateHeaderLabel();
    }

    public updateHeaderLabel() {
        if (!this.headerTextComp || !this.headerLabelObj) return;

        this.headerLabelObj.getTransform().setLocalPosition(new vec3(0, this.ceilingY + 12.0, 2.0));
        const star = this.isActiveWall ? "★ " : "";
        const activeTag = this.isActiveWall ? " [ACTIVE]" : "";
        this.headerTextComp.text = `📐 ${star}WALL #${this.wallIndex}${activeTag} // ${this.widthCm.toFixed(0)}x${this.heightCm.toFixed(0)}cm (${this.wallYawDegrees}°)`;

        if (this.isActiveWall) {
            this.headerTextComp.textFill.color = new vec4(0.3, 0.95, 1.0, 0.95);
            this.headerTextComp.outlineSettings.fill.color = new vec4(0.2, 0.8, 1.0, 0.85);
        } else {
            this.headerTextComp.textFill.color = new vec4(0.65, 0.75, 0.85, 0.70);
            this.headerTextComp.outlineSettings.fill.color = new vec4(0.3, 0.45, 0.6, 0.50);
        }
    }

    public setIsActiveWall(active: boolean) {
        this.isActiveWall = active;
        this.updateHeaderLabel();
    }

    private setupPinchHandles() {
        if (!this.wallRoot) return;

        // 1. Top-Left Corner Resize Handle
        this.handleResizeTLObj = global.scene.createSceneObject("HandleResizeTL");
        this.handleResizeTLObj.setParent(this.wallRoot);
        const textTL = this.handleResizeTLObj.createComponent("Component.Text") as Text;
        textTL.text = " ⤢ TL ";
        textTL.size = 14;
        textTL.horizontalAlignment = HorizontalAlignment.Center;
        textTL.verticalAlignment = VerticalAlignment.Center;
        textTL.textFill.color = new vec4(0.2, 1.0, 0.85, 1.0);
        textTL.backgroundSettings.enabled = true;
        textTL.backgroundSettings.fill.color = new vec4(0.01, 0.08, 0.16, 0.85);
        textTL.backgroundSettings.cornerRadius = 0.4;
        textTL.outlineSettings.enabled = true;
        textTL.outlineSettings.fill.color = new vec4(0.2, 0.95, 1.0, 0.95);
        textTL.outlineSettings.size = 0.14;

        // 2. Top-Right Corner Resize Handle
        this.handleResizeTRObj = global.scene.createSceneObject("HandleResizeTR");
        this.handleResizeTRObj.setParent(this.wallRoot);
        const textTR = this.handleResizeTRObj.createComponent("Component.Text") as Text;
        textTR.text = " ⤢ TR ";
        textTR.size = 14;
        textTR.horizontalAlignment = HorizontalAlignment.Center;
        textTR.verticalAlignment = VerticalAlignment.Center;
        textTR.textFill.color = new vec4(0.2, 1.0, 0.85, 1.0);
        textTR.backgroundSettings.enabled = true;
        textTR.backgroundSettings.fill.color = new vec4(0.01, 0.08, 0.16, 0.85);
        textTR.backgroundSettings.cornerRadius = 0.4;
        textTR.outlineSettings.enabled = true;
        textTR.outlineSettings.fill.color = new vec4(0.2, 0.95, 1.0, 0.95);
        textTR.outlineSettings.size = 0.14;

        // 3. Bottom-Left Corner Resize Handle
        this.handleResizeBLObj = global.scene.createSceneObject("HandleResizeBL");
        this.handleResizeBLObj.setParent(this.wallRoot);
        const textBL = this.handleResizeBLObj.createComponent("Component.Text") as Text;
        textBL.text = " ⤢ BL ";
        textBL.size = 14;
        textBL.horizontalAlignment = HorizontalAlignment.Center;
        textBL.verticalAlignment = VerticalAlignment.Center;
        textBL.textFill.color = new vec4(0.2, 1.0, 0.85, 1.0);
        textBL.backgroundSettings.enabled = true;
        textBL.backgroundSettings.fill.color = new vec4(0.01, 0.08, 0.16, 0.85);
        textBL.backgroundSettings.cornerRadius = 0.4;
        textBL.outlineSettings.enabled = true;
        textBL.outlineSettings.fill.color = new vec4(0.2, 0.95, 1.0, 0.95);
        textBL.outlineSettings.size = 0.14;

        // 4. Bottom-Right Corner Resize Handle
        this.handleResizeBRObj = global.scene.createSceneObject("HandleResizeBR");
        this.handleResizeBRObj.setParent(this.wallRoot);
        const textBR = this.handleResizeBRObj.createComponent("Component.Text") as Text;
        textBR.text = " ⤢ BR ";
        textBR.size = 14;
        textBR.horizontalAlignment = HorizontalAlignment.Center;
        textBR.verticalAlignment = VerticalAlignment.Center;
        textBR.textFill.color = new vec4(0.2, 1.0, 0.85, 1.0);
        textBR.backgroundSettings.enabled = true;
        textBR.backgroundSettings.fill.color = new vec4(0.01, 0.08, 0.16, 0.85);
        textBR.backgroundSettings.cornerRadius = 0.4;
        textBR.outlineSettings.enabled = true;
        textBR.outlineSettings.fill.color = new vec4(0.2, 0.95, 1.0, 0.95);
        textBR.outlineSettings.size = 0.14;

        // 5. Center Move Handle
        this.handleMoveCenterObj = global.scene.createSceneObject("HandleMoveCenter");
        this.handleMoveCenterObj.setParent(this.wallRoot);
        const textC = this.handleMoveCenterObj.createComponent("Component.Text") as Text;
        textC.text = " ✥ MOVE WALL ";
        textC.size = 15;
        textC.horizontalAlignment = HorizontalAlignment.Center;
        textC.verticalAlignment = VerticalAlignment.Center;
        textC.textFill.color = new vec4(0.3, 1.0, 0.6, 1.0);
        textC.backgroundSettings.enabled = true;
        textC.backgroundSettings.fill.color = new vec4(0.01, 0.12, 0.06, 0.85);
        textC.backgroundSettings.cornerRadius = 0.4;
        textC.outlineSettings.enabled = true;
        textC.outlineSettings.fill.color = new vec4(0.2, 1.0, 0.5, 0.95);
        textC.outlineSettings.size = 0.14;

        // 6. Top Center Quick-Rotate Handle (Pinch & drag or hold to rapidly steer wall)
        this.handleRotateTopObj = global.scene.createSceneObject("HandleRotateTop");
        this.handleRotateTopObj.setParent(this.wallRoot);
        const textR = this.handleRotateTopObj.createComponent("Component.Text") as Text;
        textR.text = " ⟳ PINCH ROTATE ";
        textR.size = 15;
        textR.horizontalAlignment = HorizontalAlignment.Center;
        textR.verticalAlignment = VerticalAlignment.Center;
        textR.textFill.color = new vec4(0.3, 0.95, 1.0, 1.0);
        textR.backgroundSettings.enabled = true;
        textR.backgroundSettings.fill.color = new vec4(0.01, 0.08, 0.18, 0.90);
        textR.backgroundSettings.cornerRadius = 0.4;
        textR.outlineSettings.enabled = true;
        textR.outlineSettings.fill.color = new vec4(0.2, 0.85, 1.0, 0.95);
        textR.outlineSettings.size = 0.14;

        this.updatePinchHandlePositions();
        this.setEditHandlesVisible(false);
    }

    public updatePinchHandlePositions() {
        const halfW = this.widthCm * 0.5;
        if (this.handleResizeTLObj) {
            this.handleResizeTLObj.getTransform().setLocalPosition(new vec3(-halfW, this.ceilingY, 4.0));
        }
        if (this.handleResizeTRObj) {
            this.handleResizeTRObj.getTransform().setLocalPosition(new vec3(halfW, this.ceilingY, 4.0));
        }
        if (this.handleResizeBLObj) {
            this.handleResizeBLObj.getTransform().setLocalPosition(new vec3(-halfW, this.floorY, 4.0));
        }
        if (this.handleResizeBRObj) {
            this.handleResizeBRObj.getTransform().setLocalPosition(new vec3(halfW, this.floorY, 4.0));
        }
        if (this.handleMoveCenterObj) {
            this.handleMoveCenterObj.getTransform().setLocalPosition(new vec3(0, 0, 4.0));
        }
        if (this.handleRotateTopObj) {
            this.handleRotateTopObj.getTransform().setLocalPosition(new vec3(0, this.ceilingY + 16.0, 4.0));
        }
    }

    public setEditHandlesVisible(visible: boolean) {
        this.editHandlesVisible = visible;
        if (this.handleResizeTLObj) this.handleResizeTLObj.enabled = visible;
        if (this.handleResizeTRObj) this.handleResizeTRObj.enabled = visible;
        if (this.handleResizeBLObj) this.handleResizeBLObj.enabled = visible;
        if (this.handleResizeBRObj) this.handleResizeBRObj.enabled = visible;
        if (this.handleMoveCenterObj) this.handleMoveCenterObj.enabled = visible;
        if (this.handleRotateTopObj) this.handleRotateTopObj.enabled = visible;
    }

    public isEditHandlesVisible(): boolean {
        return this.editHandlesVisible;
    }

    public getEditHandleWorldPositions(): {
        resizeTL: vec3;
        resizeTR: vec3;
        resizeBL: vec3;
        resizeBR: vec3;
        center: vec3;
        rotateTop: vec3;
    } {
        const halfW = this.widthCm * 0.5;
        const trans = this.wallRoot ? this.wallRoot.getTransform() : null;
        const pos = trans ? trans.getWorldPosition() : new vec3(0, 0, -180.0);
        const rot = trans ? trans.getWorldRotation() : quat.fromEulerAngles(0, 0, 0);

        const tlWorld = pos.add(rot.multiplyVec3(new vec3(-halfW, this.ceilingY, 4.0)));
        const trWorld = pos.add(rot.multiplyVec3(new vec3(halfW, this.ceilingY, 4.0)));
        const blWorld = pos.add(rot.multiplyVec3(new vec3(-halfW, this.floorY, 4.0)));
        const brWorld = pos.add(rot.multiplyVec3(new vec3(halfW, this.floorY, 4.0)));
        const cWorld = pos.add(rot.multiplyVec3(new vec3(0, 0, 4.0)));
        const rotWorld = pos.add(rot.multiplyVec3(new vec3(0, this.ceilingY + 16.0, 4.0)));

        return { resizeTL: tlWorld, resizeTR: trWorld, resizeBL: blWorld, resizeBR: brWorld, center: cWorld, rotateTop: rotWorld };
    }

    // Pushes wall deeper into room (+deltaCm) or pulls it closer (-deltaCm)
    public pushWallDepth(deltaCm: number): number {
        if (!this.wallRoot) return 0;
        const trans = this.wallRoot.getTransform();
        const pos = trans.getWorldPosition();
        const rot = trans.getWorldRotation();
        const forward = rot.multiplyVec3(new vec3(0, 0, 1.0));
        const newPos = pos.sub(forward.uniformScale(deltaCm));
        trans.setWorldPosition(newPos);
        return newPos.z;
    }

    // Moves wall in 3D world space
    public moveWall(deltaWorld: vec3): vec3 {
        if (!this.wallRoot) return new vec3(0, 0, 0);
        const trans = this.wallRoot.getTransform();
        const pos = trans.getWorldPosition().add(deltaWorld);
        trans.setWorldPosition(pos);
        return pos;
    }

    // Dynamic Wall Rebuild & Sizing from User Pinch Measurements
    public rebuildWall(center: vec3, rotation: quat, newWidthCm: number, newHeightCm: number) {
        if (!this.wallRoot) {
            try {
                this.wallRoot = this.getSceneObject();
            } catch (e) {
                return;
            }
        }
        if (!this.wallRoot) return;

        this.widthCm = Math.max(60.0, newWidthCm);
        this.heightCm = Math.max(60.0, newHeightCm);
        this.floorY = -this.heightCm * 0.5;
        this.ceilingY = this.heightCm * 0.5;
        this.outletLocalY = this.floorY + 45.0; // 45 cm / 18 inches above floor

        // Recompute 16-inch (40.64 cm) on-center studs across new width
        const studSpacing = 40.64;
        const halfW = this.widthCm * 0.5;
        this.studLocalXs = [-halfW];

        let curX = -halfW + studSpacing;
        while (curX < halfW - 10.0) {
            this.studLocalXs.push(curX);
            curX += studSpacing;
        }
        this.studLocalXs.push(halfW);

        // Update Transform
        this.wallRoot.getTransform().setWorldPosition(center);
        this.wallRoot.getTransform().setWorldRotation(rotation);

        // Derive yaw degrees from rotation
        try {
            const fwd = rotation.multiplyVec3(new vec3(0, 0, 1.0));
            const yawRad = Math.atan2(fwd.x, fwd.z);
            let deg = Math.round((yawRad * 180.0) / Math.PI);
            if (deg < 0) deg += 360;
            this.wallYawDegrees = deg;
        } catch (e) {
            // Keep existing yaw if math fails
        }

        // Update Box Collider
        if (this.collider) {
            const box = Shape.createBoxShape();
            box.size = new vec3(this.widthCm, this.heightCm, 6.0);
            this.collider.shape = box;
        }

        // Update Visual Header and Pinch Handles
        this.updateHeaderLabel();
        this.updatePinchHandlePositions();

        print(`[ReferenceWall] Rebuilt wall #${this.wallIndex} at (${center.x.toFixed(0)}, ${center.y.toFixed(0)}, ${center.z.toFixed(0)}) with size ${this.widthCm.toFixed(0)}x${this.heightCm.toFixed(0)}cm (${this.studLocalXs.length} studs, ${this.wallYawDegrees}°)`);
    }

    // Rotates the wall around the vertical Y-axis (upright plumb rotation)
    // Supports ANY arbitrary degree increment (e.g. +1°, +5°, +23°, -1°, -23.5°)
    public rotateWall(deltaDegrees: number = 5.0): number {
        this.wallYawDegrees = (this.wallYawDegrees + deltaDegrees) % 360;
        if (this.wallYawDegrees < 0) this.wallYawDegrees += 360;
        this.wallYawDegrees = Math.round(this.wallYawDegrees * 10) / 10;
        this.applyYawRotation();
        return this.wallYawDegrees;
    }

    public setWallYaw(degrees: number): number {
        this.wallYawDegrees = ((degrees % 360) + 360) % 360;
        this.wallYawDegrees = Math.round(this.wallYawDegrees * 10) / 10;
        this.applyYawRotation();
        return this.wallYawDegrees;
    }

    public getWallYaw(): number {
        return this.wallYawDegrees;
    }

    private applyYawRotation() {
        if (!this.wallRoot) {
            try {
                this.wallRoot = this.getSceneObject();
            } catch (e) {
                return;
            }
        }
        if (!this.wallRoot) return;
        const rad = (this.wallYawDegrees * Math.PI) / 180.0;
        const rot = quat.fromEulerAngles(0, rad, 0);
        this.wallRoot.getTransform().setWorldRotation(rot);
        this.updateHeaderLabel();
        print(`[ReferenceWall] Wall #${this.wallIndex} yaw set to ${this.wallYawDegrees}°`);
    }

    public destroyWall() {
        if (this.wallRoot) {
            this.wallRoot.destroy();
            this.wallRoot = null;
        }
    }

    public static readonly WALL_PRESETS = [
        { name: "2.8×2.4m (Room Wall)", w: 280.0, h: 240.0 },
        { name: "3.2×2.4m (Wide Wall)", w: 320.0, h: 240.0 },
        { name: "2.0×2.4m (Partition)", w: 200.0, h: 240.0 },
        { name: "1.2×2.4m (Sheet)", w: 120.0, h: 240.0 },
        { name: "1.6×2.0m (Bay)", w: 160.0, h: 200.0 }
    ];
    private wallPresetIndex: number = 0;

    // Cycles wall size with a single click (effortless mouse resizing)
    public cycleWallPresetSize(): { name: string; w: number; h: number } {
        this.wallPresetIndex = (this.wallPresetIndex + 1) % ReferenceWall.WALL_PRESETS.length;
        const p = ReferenceWall.WALL_PRESETS[this.wallPresetIndex];
        if (this.wallRoot) {
            const center = this.wallRoot.getTransform().getWorldPosition();
            const rot = this.wallRoot.getTransform().getWorldRotation();
            this.rebuildWall(center, rot, p.w, p.h);
        }
        return p;
    }

    public getWallPresetName(): string {
        return ReferenceWall.WALL_PRESETS[this.wallPresetIndex].name;
    }

    private static readonly WALL_DISTANCES = [260.0, 200.0, 150.0, 300.0];
    private wallDistanceIndex: number = 0;

    // Cycles wall distance (closer / farther) with a single click
    public cycleWallDistance(camPos?: vec3): number {
        this.wallDistanceIndex = (this.wallDistanceIndex + 1) % ReferenceWall.WALL_DISTANCES.length;
        const dist = ReferenceWall.WALL_DISTANCES[this.wallDistanceIndex];
        if (this.wallRoot) {
            const rot = this.wallRoot.getTransform().getWorldRotation();
            const fwd = rot.multiplyVec3(new vec3(0, 0, -1.0));
            const basePos = camPos || new vec3(0, 0, 0);
            const newCenter = basePos.add(fwd.uniformScale(dist));
            newCenter.y = 0;
            this.wallRoot.getTransform().setWorldPosition(newCenter);
        }
        return dist;
    }

    public getWallDistance(): number {
        return ReferenceWall.WALL_DISTANCES[this.wallDistanceIndex];
    }

    // Mathematical Raycast directly against wall plane (supports both front and back faces)
    public raycastWall(rayOrigin: vec3, rayDir: vec3): { point: vec3; normal: vec3; isHit: boolean } | null {
        if (!this.wallRoot) return null;

        const trans = this.wallRoot.getTransform();
        const wallPos = trans.getWorldPosition();
        const wallRot = trans.getWorldRotation();

        // Normal pointing outward toward room (local +Z)
        const wallNormal = wallRot.multiplyVec3(new vec3(0, 0, 1.0));

        // Two-sided raycast: reject only rays parallel to the wall surface
        const denom = rayDir.dot(wallNormal);
        if (Math.abs(denom) < 0.001) {
            return null;
        }

        // Ray-Plane Intersection distance t
        const diff = wallPos.sub(rayOrigin);
        const t = diff.dot(wallNormal) / denom;
        if (t < 5.0 || t > 900.0) return null;

        const worldHitPoint = rayOrigin.add(rayDir.uniformScale(t));

        // Convert to local coordinates to check bounds
        const invRot = wallRot.invert();
        const localHit = invRot.multiplyVec3(worldHitPoint.sub(wallPos));

        const halfW = this.widthCm * 0.5;
        const halfH = this.heightCm * 0.5;

        // Check if within wall boundary (lateral margin for easy targeting, tight ceiling edge at halfH + 2cm so looking up smoothly transitions to ceiling raycasting!)
        if (Math.abs(localHit.x) > halfW + 25.0 || localHit.y > halfH + 2.0 || localHit.y < -halfH - 25.0) {
            return null;
        }

        const isFrontFacing = denom < 0;
        const hitNormal = isFrontFacing ? wallNormal : wallNormal.uniformScale(-1);
        const surfaceOffsetZ = isFrontFacing ? 4.0 : -4.0;

        // Clamp tightly to physical drywall edges
        const clampedX = Math.max(-halfW, Math.min(halfW, localHit.x));
        const clampedY = Math.max(-halfH, Math.min(halfH, localHit.y));
        const clampedLocal = new vec3(clampedX, clampedY, surfaceOffsetZ); 

        const finalWorldPt = wallPos.add(wallRot.multiplyVec3(clampedLocal));

        return {
            point: finalWorldPt,
            normal: hitNormal,
            isHit: true
        };
    }

    // Projects any 3D world position onto the exact face of the reference wall
    public projectPointToWall(worldPt: vec3): vec3 {
        if (!this.wallRoot) return worldPt;

        const trans = this.wallRoot.getTransform();
        const wallPos = trans.getWorldPosition();
        const wallRot = trans.getWorldRotation();
        const invRot = wallRot.invert();

        const localPt = invRot.multiplyVec3(worldPt.sub(wallPos));

        const halfW = this.widthCm * 0.5;
        const halfH = this.heightCm * 0.5;

        const clampedX = Math.max(-halfW, Math.min(halfW, localPt.x));
        const clampedY = Math.max(-halfH, Math.min(halfH, localPt.y));
        const offsetZ = localPt.z >= 0 ? 4.0 : -4.0;
        const projectedLocal = new vec3(clampedX, clampedY, offsetZ);

        return wallPos.add(wallRot.multiplyVec3(projectedLocal));
    }

    // Applies 2D auto-ortho snapping directly in the wall's local coordinate system
    public applyLocalOrthoSnap(anchorWorldPt: vec3, targetWorldPt: vec3): vec3 {
        if (!this.wallRoot) return targetWorldPt;

        const trans = this.wallRoot.getTransform();
        const wallPos = trans.getWorldPosition();
        const wallRot = trans.getWorldRotation();
        const invRot = wallRot.invert();

        const aLocal = invRot.multiplyVec3(anchorWorldPt.sub(wallPos));
        const tLocal = invRot.multiplyVec3(targetWorldPt.sub(wallPos));

        const halfW = this.widthCm * 0.5;
        const halfH = this.heightCm * 0.5;

        const dx = Math.abs(tLocal.x - aLocal.x);
        const dy = Math.abs(tLocal.y - aLocal.y);

        let snappedX = tLocal.x;
        let snappedY = tLocal.y;

        if (dx >= dy * 1.25) {
            // Horizontal run: lock height to anchor
            snappedY = aLocal.y;
        } else if (dy >= dx * 1.25) {
            // Vertical riser/drop: lock horizontal position to anchor
            snappedX = aLocal.x;
        }

        const clampedX = Math.max(-halfW, Math.min(halfW, snappedX));
        const clampedY = Math.max(-halfH, Math.min(halfH, snappedY));
        const offsetZ = tLocal.z >= 0 ? 4.0 : -4.0;

        return wallPos.add(wallRot.multiplyVec3(new vec3(clampedX, clampedY, offsetZ)));
    }

    // Snaps an X-coordinate to the nearest 16-inch on-center stud centerline
    public snapToNearestStud(worldPt: vec3, snapThresholdCm: number = 8.0): vec3 {
        if (!this.wallRoot) return worldPt;

        const trans = this.wallRoot.getTransform();
        const wallPos = trans.getWorldPosition();
        const wallRot = trans.getWorldRotation();
        const invRot = wallRot.invert();

        const localPt = invRot.multiplyVec3(worldPt.sub(wallPos));

        let closestStudX = localPt.x;
        let minDelta = snapThresholdCm;

        for (const studX of this.studLocalXs) {
            const delta = Math.abs(localPt.x - studX);
            if (delta < minDelta) {
                minDelta = delta;
                closestStudX = studX;
            }
        }

        const snappedLocal = new vec3(closestStudX, localPt.y, 1.5);
        return wallPos.add(wallRot.multiplyVec3(snappedLocal));
    }

    // Returns blueprint station dock position on the front upper-left face of the Reference Wall
    public getWallDockPosition(): { pos: vec3; rot: quat } {
        if (!this.wallRoot) {
            return { pos: new vec3(-110, 35, -256), rot: quat.fromEulerAngles(0, 0, 0) };
        }

        const trans = this.wallRoot.getTransform();
        const wallPos = trans.getWorldPosition();
        const wallRot = trans.getWorldRotation();

        // Mount directly inside the left stud bay, visible above left nightstand
        const localDockPos = new vec3(-(this.widthCm * 0.5 - 35.0), 35.0, 4.0);
        const dockWorldPos = wallPos.add(wallRot.multiplyVec3(localDockPos));

        return { pos: dockWorldPos, rot: wallRot };
    }

    public isFramingVisible: boolean = true;

    public setFramingVisible(visible: boolean) {
        this.isFramingVisible = visible;
        if (this.headerTextComp && this.headerTextComp.getSceneObject()) {
            this.headerTextComp.getSceneObject().enabled = visible;
        }
    }

    // Real-Time Procedural Architectural Stud Framing Renderer
    private renderWallFraming() {
        if (!global.debugRenderSystem || !this.wallRoot || !this.isFramingVisible) return;

        const trans = this.wallRoot.getTransform();
        const wallPos = trans.getWorldPosition();
        const wallRot = trans.getWorldRotation();

        // Active Wall is brightly highlighted; inactive walls are muted
        const studCol = this.isActiveWall
            ? new vec4(0.2, 0.75, 1.0, 0.75) // Luminous Blueprint Cyan
            : new vec4(0.3, 0.50, 0.7, 0.40); // Subtle Muted Slate
        const plateCol = this.isActiveWall
            ? new vec4(0.1, 0.9, 0.6, 0.85)  // Emerald Plates
            : new vec4(0.2, 0.6, 0.45, 0.45);
        const outlineCol = this.isActiveWall
            ? new vec4(0.3, 0.65, 0.9, 0.45)
            : new vec4(0.25, 0.45, 0.65, 0.30);

        const halfW = this.widthCm * 0.5;
        const halfH = this.heightCm * 0.5;

        // 1. Top Double-Plate (Ceiling runner)
        const topA = wallPos.add(wallRot.multiplyVec3(new vec3(-halfW, this.ceilingY, 0)));
        const topB = wallPos.add(wallRot.multiplyVec3(new vec3(halfW, this.ceilingY, 0)));
        global.debugRenderSystem.drawLine(topA, topB, plateCol);

        // 2. Bottom Sole-Plate (Floor runner)
        const botA = wallPos.add(wallRot.multiplyVec3(new vec3(-halfW, this.floorY, 0)));
        const botB = wallPos.add(wallRot.multiplyVec3(new vec3(halfW, this.floorY, 0)));
        global.debugRenderSystem.drawLine(botA, botB, plateCol);

        // 3. Vertical 16" On-Center Wood Studs
        for (let i = 0; i < this.studLocalXs.length; i++) {
            const sx = this.studLocalXs[i];
            const pTop = wallPos.add(wallRot.multiplyVec3(new vec3(sx, this.ceilingY, 0)));
            const pBot = wallPos.add(wallRot.multiplyVec3(new vec3(sx, this.floorY, 0)));

            const isKingStud = (i === 0 || i === this.studLocalXs.length - 1);
            const col = isKingStud ? plateCol : studCol;
            global.debugRenderSystem.drawLine(pTop, pBot, col);

            // Stud bay centerline indicator tick
            const pMid = wallPos.add(wallRot.multiplyVec3(new vec3(sx, 0, 1.5)));
            global.debugRenderSystem.drawCircle(pMid, 1.8, new vec4(0.0, 0.95, 1.0, 0.5));
        }

        // 4. Perimeter Framing Box
        const pTL = wallPos.add(wallRot.multiplyVec3(new vec3(-halfW, halfH, 0)));
        const pTR = wallPos.add(wallRot.multiplyVec3(new vec3(halfW, halfH, 0)));
        const pBR = wallPos.add(wallRot.multiplyVec3(new vec3(halfW, -halfH, 0)));
        const pBL = wallPos.add(wallRot.multiplyVec3(new vec3(-halfW, -halfH, 0)));

        global.debugRenderSystem.drawLine(pTL, pTR, outlineCol);
        global.debugRenderSystem.drawLine(pTR, pBR, outlineCol);
        global.debugRenderSystem.drawLine(pBR, pBL, outlineCol);
        global.debugRenderSystem.drawLine(pBL, pTL, outlineCol);
    }
}

