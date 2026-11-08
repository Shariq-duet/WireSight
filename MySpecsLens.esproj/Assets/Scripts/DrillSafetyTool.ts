import { ConduitRun } from "./ConduitTypes";

@component
export class DrillSafetyTool extends BaseScriptComponent {
    private toolObject: SceneObject | null = null;
    private statusLabel: Text | null = null;
    private distanceLabel: Text | null = null;
    private visualRing: Text | null = null;
    
    private isDanger: boolean = false;
    private closestDistance: number = 999;
    private closestRunName: string = "";
    private isAudioTriggered: boolean = false;

    onAwake() {
        this.buildToolUI();
    }

    private buildToolUI() {
        this.toolObject = this.getSceneObject();

        // 1. Center Target Crosshair / Reticle
        const ringObj = global.scene.createSceneObject("DrillRing");
        ringObj.setParent(this.toolObject);
        ringObj.getTransform().setLocalPosition(new vec3(0, 0, 1));
        this.visualRing = ringObj.createComponent("Component.Text") as Text;
        this.visualRing.text = "〔 ⊕ 〕"; // Bold Crosshair Reticle
        this.visualRing.size = 56;
        this.visualRing.textFill.color = new vec4(0.2, 0.95, 0.3, 1.0);

        // 2. Status Banner (SAFE vs DANGER)
        const statusObj = global.scene.createSceneObject("DrillStatus");
        statusObj.setParent(this.toolObject);
        statusObj.getTransform().setLocalPosition(new vec3(0, 9.5, 1));
        this.statusLabel = statusObj.createComponent("Component.Text") as Text;
        this.statusLabel.text = " 🛡️ SAFE DRILL ZONE ";
        this.statusLabel.size = 26;
        this.statusLabel.textFill.color = new vec4(0.2, 0.95, 0.3, 1.0);
        this.statusLabel.backgroundSettings.enabled = true;
        this.statusLabel.backgroundSettings.fill.color = new vec4(0.02, 0.14, 0.06, 0.92);
        this.statusLabel.backgroundSettings.cornerRadius = 0.45;
        this.statusLabel.outlineSettings.enabled = true;
        this.statusLabel.outlineSettings.fill.color = new vec4(0.2, 0.95, 0.3, 0.9);
        this.statusLabel.outlineSettings.size = 0.12;

        // 3. Live Distance Readout
        const distObj = global.scene.createSceneObject("DrillDistance");
        distObj.setParent(this.toolObject);
        distObj.getTransform().setLocalPosition(new vec3(0, -8.5, 1));
        this.distanceLabel = distObj.createComponent("Component.Text") as Text;
        this.distanceLabel.text = " Clearance: > 25 cm (Clear) ";
        this.distanceLabel.size = 22;
        this.distanceLabel.textFill.color = new vec4(0.9, 0.95, 1.0, 1.0);
        this.distanceLabel.backgroundSettings.enabled = true;
        this.distanceLabel.backgroundSettings.fill.color = new vec4(0.03, 0.08, 0.16, 0.88);
        this.distanceLabel.backgroundSettings.cornerRadius = 0.45;
        this.distanceLabel.outlineSettings.enabled = true;
        this.distanceLabel.outlineSettings.fill.color = new vec4(0.3, 0.6, 0.9, 0.7);
        this.distanceLabel.outlineSettings.size = 0.10;
    }

    public setPosition(pos: vec3) {
        if (this.toolObject) {
            this.toolObject.getTransform().setWorldPosition(pos);
        }
    }

    public checkProximity(activeConduits: ConduitRun[], currentPos: vec3) {
        let minDistance = 999;
        let nearestItem = "";
        let nearestRun: ConduitRun | null = null;

        for (const run of activeConduits) {
            const dist = this.distToSegment2D(currentPos, run.startPoint, run.endPoint);
            if (dist < minDistance) {
                minDistance = dist;
                nearestItem = run.name;
                nearestRun = run;
            }
        }

        this.closestDistance = minDistance;
        this.closestRunName = nearestItem;

        // Danger threshold: 10 cm
        if (minDistance <= 10.0) {
            const isCold = nearestRun && nearestRun.isLive === false;
            this.isDanger = !isCold;

            if (isCold) {
                if (this.visualRing) {
                    this.visualRing.text = "〔 ℹ️ 〕";
                    this.visualRing.textFill.color = new vec4(0.3, 0.85, 1.0, 1.0);
                }
                if (this.statusLabel) {
                    this.statusLabel.text = ` ℹ️ DE-ENERGIZED WIRE WITHIN ${minDistance.toFixed(1)}cm (COLD) `;
                    this.statusLabel.textFill.color = new vec4(0.3, 0.85, 1.0, 1.0);
                    this.statusLabel.backgroundSettings.fill.color = new vec4(0.04, 0.12, 0.22, 0.94);
                    this.statusLabel.outlineSettings.fill.color = new vec4(0.3, 0.8, 1.0, 0.95);
                }
                if (this.distanceLabel) {
                    this.distanceLabel.text = ` Clearance: ${minDistance.toFixed(1)} cm (${nearestItem} • Safe/Cold) `;
                    this.distanceLabel.textFill.color = new vec4(0.7, 0.9, 1.0, 1.0);
                    this.distanceLabel.backgroundSettings.fill.color = new vec4(0.03, 0.08, 0.18, 0.9);
                    this.distanceLabel.outlineSettings.fill.color = new vec4(0.3, 0.7, 1.0, 0.8);
                }
            } else {
                if (this.visualRing) {
                    this.visualRing.text = "〔 ⚠️ 〕";
                    this.visualRing.textFill.color = new vec4(1.0, 0.15, 0.15, 1.0);
                }
                if (this.statusLabel) {
                    this.statusLabel.text = ` ⚠️ HAZARD! LIVE CONDUIT COLLISION RISK `;
                    this.statusLabel.textFill.color = new vec4(1.0, 0.2, 0.2, 1.0);
                    this.statusLabel.backgroundSettings.fill.color = new vec4(0.35, 0.04, 0.04, 0.95);
                    this.statusLabel.outlineSettings.fill.color = new vec4(1.0, 0.15, 0.15, 1.0);
                }
                if (this.distanceLabel) {
                    this.distanceLabel.text = ` Clearance: ${minDistance.toFixed(1)} cm (${nearestItem}) `;
                    this.distanceLabel.textFill.color = new vec4(1.0, 0.6, 0.6, 1.0);
                    this.distanceLabel.backgroundSettings.fill.color = new vec4(0.25, 0.05, 0.05, 0.92);
                    this.distanceLabel.outlineSettings.fill.color = new vec4(1.0, 0.3, 0.3, 0.9);
                }
                if (!this.isAudioTriggered) {
                    print(`[WireSight] AUDIO ALERT: Collision warning triggered near ${nearestItem}!`);
                    this.isAudioTriggered = true;
                }
            }
        } else {
            this.isDanger = false;
            this.isAudioTriggered = false;
            if (this.visualRing) {
                this.visualRing.text = "〔 ⊕ 〕";
                this.visualRing.textFill.color = new vec4(0.2, 0.95, 0.3, 1.0);
            }
            if (this.statusLabel) {
                this.statusLabel.text = ` 🛡️ SAFE DRILL ZONE `;
                this.statusLabel.textFill.color = new vec4(0.2, 0.95, 0.3, 1.0);
                this.statusLabel.backgroundSettings.fill.color = new vec4(0.02, 0.14, 0.06, 0.92);
                this.statusLabel.outlineSettings.fill.color = new vec4(0.2, 0.95, 0.3, 0.9);
            }
            if (this.distanceLabel) {
                this.distanceLabel.text = ` Clearance: ${minDistance.toFixed(1)} cm (${nearestItem || "Safe"}) `;
                this.distanceLabel.textFill.color = new vec4(0.9, 0.95, 1.0, 1.0);
                this.distanceLabel.backgroundSettings.fill.color = new vec4(0.03, 0.08, 0.16, 0.88);
                this.distanceLabel.outlineSettings.fill.color = new vec4(0.3, 0.6, 0.9, 0.7);
            }
        }
    }

    private distToSegment2D(p: vec3, a: vec3, b: vec3): number {
        const abX = b.x - a.x;
        const abY = b.y - a.y;
        const lenSq = abX * abX + abY * abY;
        if (lenSq === 0) {
            const dx = p.x - a.x;
            const dy = p.y - a.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        let t = ((p.x - a.x) * abX + (p.y - a.y) * abY) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = a.x + t * abX;
        const projY = a.y + t * abY;

        const dx = p.x - projX;
        const dy = p.y - projY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    public getIsDanger(): boolean { return this.isDanger; }
    public getClosestDistance(): number { return this.closestDistance; }
    public getClosestRunName(): string { return this.closestRunName; }
}
