import { ConduitXRMain } from "../ConduitXRMain";
import { ConduitXRLeafInteractor } from "./ConduitXRLeafInteractor";

export class TapInOutletPlacementScenario {
    public static async run(main: ConduitXRMain): Promise<boolean> {
        print("[LEAF Scenario 4] Starting TapInOutletPlacementScenario...");
        const interactor = new ConduitXRLeafInteractor();
        const palette = main.getToolPalette()!;

        // 1. In VIEW mode, trying to place an outlet must be rejected/safely blocked
        if (palette.getIsCreateMode()) {
            interactor.toggleMode(main); // Ensure View mode
        }
        const viewAttempt = interactor.addOutlet(main);
        if (viewAttempt !== false) {
            throw new Error("FAIL: Adding outlet must be blocked in VIEW mode");
        }

        // 2. Switch to CREATE mode
        interactor.toggleMode(main);
        if (!palette.getIsCreateMode()) {
            throw new Error("FAIL: Failed to enter CREATE mode");
        }

        // 3. Place Outlet & Splice to Overhead Line
        const createAttempt = interactor.addOutlet(main);
        if (createAttempt !== true) {
            throw new Error("FAIL: Adding outlet failed in CREATE mode");
        }

        const outletObj = main.getNewOutletObject();
        if (!outletObj || !outletObj.enabled) {
            throw new Error("FAIL: New outlet visual object is not enabled");
        }

        // 4. Verify new run is added to active runs
        const runs = main.getActiveRuns();
        const tapInRun = runs.find(r => r.id === "elec-new-outlet-tap");
        if (!tapInRun) {
            throw new Error("FAIL: Splice tap-in conduit was not added to active network");
        }

        print("[LEAF Scenario 4] TapInOutletPlacementScenario PASSED (Criterion 4 Verified) ✓");
        return true;
    }
}

