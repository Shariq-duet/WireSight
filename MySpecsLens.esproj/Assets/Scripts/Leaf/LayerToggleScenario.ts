import { ConduitXRMain } from "../ConduitXRMain";
import { ConduitXRLeafInteractor } from "./ConduitXRLeafInteractor";

export class LayerToggleScenario {
    public static async run(main: ConduitXRMain): Promise<boolean> {
        print("[LEAF Scenario 1] Starting LayerToggleScenario...");
        const interactor = new ConduitXRLeafInteractor();

        // 1. Initial State: Both Layers ON
        const palette = main.getToolPalette()!;
        if (!palette.getIsElectricalOn() || !palette.getIsPlumbingOn()) {
            throw new Error("FAIL: Initial layers must default to ON");
        }

        // 2. Toggle Electrical Layer OFF
        interactor.toggleElectrical(main);
        if (palette.getIsElectricalOn() !== false) {
            throw new Error("FAIL: Electrical layer failed to toggle OFF");
        }

        // 3. Toggle Electrical Layer ON
        interactor.toggleElectrical(main);
        if (palette.getIsElectricalOn() !== true) {
            throw new Error("FAIL: Electrical layer failed to toggle ON");
        }

        // 4. Toggle Plumbing Layer OFF
        interactor.togglePlumbing(main);
        if (palette.getIsPlumbingOn() !== false) {
            throw new Error("FAIL: Plumbing layer failed to toggle OFF");
        }

        // Restore Plumbing to ON
        interactor.togglePlumbing(main);
        print("[LEAF Scenario 1] LayerToggleScenario PASSED (Criterion 1 Verified) ✓");
        return true;
    }
}

