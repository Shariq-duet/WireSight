import { ConduitRun } from "./ConduitTypes";

@component
export class RunInspectionCard extends BaseScriptComponent {
    private rootObject: SceneObject | null = null;
    private titleText: Text | null = null;
    private detailsText: Text | null = null;
    private installerText: Text | null = null;
    private statusText: Text | null = null;
    private isVisible: boolean = false;
    private activeRunId: string | null = null;

    onAwake() {
        this.buildCardUI();
        this.hide();
    }

    private buildCardUI() {
        this.rootObject = this.getSceneObject();

        // 0. Frosted Glassmorphism Visor Card Backing
        const backingObj = global.scene.createSceneObject("CardBacking");
        backingObj.setParent(this.rootObject);
        backingObj.getTransform().setLocalPosition(new vec3(0, 1.5, 0));
        const backingText = backingObj.createComponent("Component.Text") as Text;
        backingText.text = 
            "                                                \n" +
            "                                                \n" +
            "                                                \n" +
            "                                                \n" +
            "                                                ";
        backingText.size = 38;
        backingText.backgroundSettings.enabled = true;
        backingText.backgroundSettings.fill.color = new vec4(0.02, 0.06, 0.14, 0.96);
        backingText.backgroundSettings.cornerRadius = 0.42;
        backingText.outlineSettings.enabled = true;
        backingText.outlineSettings.fill.color = new vec4(0.25, 0.75, 1.0, 0.9);
        backingText.outlineSettings.size = 0.12;

        // 1. Card Header Bar
        const titleObj = global.scene.createSceneObject("CardTitle");
        titleObj.setParent(this.rootObject);
        titleObj.getTransform().setLocalPosition(new vec3(0, 10.5, 1));
        this.titleText = titleObj.createComponent("Component.Text") as Text;
        this.titleText.text = "CIRCUIT INSPECTION";
        this.titleText.size = 32;
        this.titleText.textFill.color = new vec4(1.0, 0.92, 0.4, 1.0);

        // 2. Technical Details (Voltage, Gauge, Pressure)
        const detailsObj = global.scene.createSceneObject("CardDetails");
        detailsObj.setParent(this.rootObject);
        detailsObj.getTransform().setLocalPosition(new vec3(0, 4.5, 1));
        this.detailsText = detailsObj.createComponent("Component.Text") as Text;
        this.detailsText.text = "Spec: 230V AC - 16A";
        this.detailsText.size = 26;
        this.detailsText.textFill.color = new vec4(0.9, 0.95, 1.0, 1.0);

        // 3. Certified Installer & Date
        const installerObj = global.scene.createSceneObject("CardInstaller");
        installerObj.setParent(this.rootObject);
        installerObj.getTransform().setLocalPosition(new vec3(0, -1.5, 1));
        this.installerText = installerObj.createComponent("Component.Text") as Text;
        this.installerText.text = "Installer: Verified";
        this.installerText.size = 22;
        this.installerText.textFill.color = new vec4(0.75, 0.85, 1.0, 0.9);

        // 4. Status Badge Pill
        const statusObj = global.scene.createSceneObject("CardStatus");
        statusObj.setParent(this.rootObject);
        statusObj.getTransform().setLocalPosition(new vec3(0, -7.5, 1));
        this.statusText = statusObj.createComponent("Component.Text") as Text;
        this.statusText.text = " [ACTIVE / CERTIFIED] ";
        this.statusText.size = 24;
        this.statusText.textFill.color = new vec4(0.2, 1.0, 0.4, 1.0);
        this.statusText.backgroundSettings.enabled = true;
        this.statusText.backgroundSettings.fill.color = new vec4(0.04, 0.16, 0.08, 0.9);
        this.statusText.backgroundSettings.cornerRadius = 0.5;
        this.statusText.outlineSettings.enabled = true;
        this.statusText.outlineSettings.fill.color = new vec4(0.2, 1.0, 0.4, 0.95);
        this.statusText.outlineSettings.size = 0.1;
    }

    private findCamera(): SceneObject | null {
        const rootCount = global.scene.getRootObjectsCount();
        for (let i = 0; i < rootCount; i++) {
            const obj = global.scene.getRootObject(i);
            if (obj.name.toLowerCase().includes("camera")) return obj;
            for (let j = 0; j < obj.getChildrenCount(); j++) {
                const child = obj.getChild(j);
                if (child.name.toLowerCase().includes("camera")) return child;
            }
        }
        return null;
    }

    public inspectRun(run: ConduitRun, worldPosition?: vec3) {
        const pos = worldPosition || run.startPoint.add(run.endPoint).uniformScale(0.5);
        this.show(run, pos);
    }

    public show(run: ConduitRun, worldPosition: vec3) {
        if (!this.rootObject) return;

        // Position directly at eye level above the inspected node
        const cardPos = new vec3(worldPosition.x, worldPosition.y + 22, worldPosition.z + 10);
        this.rootObject.getTransform().setWorldPosition(cardPos);

        const camObj = this.findCamera();
        if (camObj) {
            this.rootObject.getTransform().setWorldRotation(camObj.getTransform().getWorldRotation());
        }

        if (this.titleText) this.titleText.text = `📋 ${run.name}`;
        if (this.detailsText) this.detailsText.text = `⚡ Spec: ${run.voltageOrType}`;
        if (this.installerText) this.installerText.text = `👤 Verified: ${run.installer} (${run.installDate})`;
        
        if (this.statusText) {
            if (run.isConflict) {
                this.statusText.text = ` ⚠️ ${run.conflictWarning || "CLEARANCE HAZARD"} `;
                this.statusText.textFill.color = new vec4(1.0, 0.2, 0.2, 1.0);
                this.statusText.backgroundSettings.fill.color = new vec4(0.3, 0.04, 0.04, 0.92);
                this.statusText.outlineSettings.fill.color = new vec4(1.0, 0.2, 0.2, 0.95);
            } else {
                this.statusText.text = ` ✅ ${run.status} `;
                this.statusText.textFill.color = new vec4(0.2, 1.0, 0.4, 1.0);
                this.statusText.backgroundSettings.fill.color = new vec4(0.04, 0.16, 0.08, 0.9);
                this.statusText.outlineSettings.fill.color = new vec4(0.2, 1.0, 0.4, 0.95);
            }
        }

        this.rootObject.enabled = true;
        this.isVisible = true;
        this.activeRunId = run.id;
    }

    public hide() {
        if (this.rootObject) {
            this.rootObject.enabled = false;
        }
        this.isVisible = false;
        this.activeRunId = null;
    }

    public getIsVisible(): boolean {
        return this.isVisible;
    }

    public getActiveRunId(): string | null {
        return this.activeRunId;
    }
}
