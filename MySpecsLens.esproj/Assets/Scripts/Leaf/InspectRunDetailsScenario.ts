import { ConduitXRMain } from "../ConduitXRMain";
import { ConduitXRLeafInteractor } from "./ConduitXRLeafInteractor";

export class InspectRunDetailsScenario {
    public static async run(main: ConduitXRMain): Promise<boolean> {
        print("[LEAF Scenario 2] Starting InspectRunDetailsScenario...");
        const interactor = new ConduitXRLeafInteractor();
        const card = main.getInspectionCard()!;

        // 1. Initially hidden
        if (card.getIsVisible()) {
            throw new Error("FAIL: Inspection card must be hidden initially");
        }

        // 2. Inspect Live Overhead Line (Circuit 4B)
        interactor.inspectRun(main, "elec-overhead-1");
        if (!card.getIsVisible()) {
            throw new Error("FAIL: Inspection card did not open upon selection");
        }
        if (card.getActiveRunId() !== "elec-overhead-1") {
            throw new Error("FAIL: Active run mismatch on inspection card");
        }

        // 3. Inspect Plumbing Line
        interactor.inspectRun(main, "plumb-cold-main");
        if (card.getActiveRunId() !== "plumb-cold-main") {
            throw new Error("FAIL: Failed to switch inspected run to plumbing");
        }

        // 4. Close inspection card
        interactor.closeInspection(main);
        if (card.getIsVisible()) {
            throw new Error("FAIL: Inspection card failed to close");
        }

        print("[LEAF Scenario 2] InspectRunDetailsScenario PASSED (Criterion 2 Verified) ✓");
        return true;
    }
}

