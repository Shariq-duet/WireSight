import { ConduitXRMain } from "../ConduitXRMain";
import { ConduitXRLeafInteractor } from "./ConduitXRLeafInteractor";

export class ModeSwitchScenario {
    public static async run(main: ConduitXRMain): Promise<boolean> {
        print("[LEAF Scenario 5] Starting ModeSwitchScenario...");
        const interactor = new ConduitXRLeafInteractor();
        const palette = main.toolPalette!;

        // 1. Initial State: Mode should be View Mode (isCreateMode = false)
        if (palette.getIsCreateMode() !== false) {
            // Reset to View mode
            interactor.toggleMode(main);
        }

        // 2. Toggle to Create Mode
        const mode1 = interactor.toggleMode(main);
        if (mode1 !== true || !palette.getIsCreateMode()) {
            throw new Error("FAIL: Failed to toggle into CREATE mode");
        }

        // 3. Toggle back to View Mode (Read-only lock)
        const mode2 = interactor.toggleMode(main);
        if (mode2 !== false || palette.getIsCreateMode()) {
            throw new Error("FAIL: Failed to toggle into VIEW mode");
        }

        print("[LEAF Scenario 5] ModeSwitchScenario PASSED (Criterion 5 Verified) ✓");
        return true;
    }
}

