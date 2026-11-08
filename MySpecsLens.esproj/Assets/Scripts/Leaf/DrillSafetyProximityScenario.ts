import { ConduitXRMain } from "../ConduitXRMain";
import { ConduitXRLeafInteractor } from "./ConduitXRLeafInteractor";

export class DrillSafetyProximityScenario {
    public static async run(main: ConduitXRMain): Promise<boolean> {
        print("[LEAF Scenario 3] Starting DrillSafetyProximityScenario...");
        const interactor = new ConduitXRLeafInteractor();
        const drill = main.getDrillSafetyTool()!;

        // 1. Move Drill to Clear Area (x: 0, y: -20) -> far from all runs
        interactor.moveDrill(main, 0, -20);
        if (drill.getIsDanger()) {
            throw new Error(`FAIL: Position (0, -20) should be SAFE, got danger`);
        }
        if (drill.getClosestDistance() < 10.0) {
            throw new Error(`FAIL: Clearance should be > 10cm, got ${drill.getClosestDistance()}`);
        }

        // 2. Move Drill directly into Proximity Hazard (x: 0, y: 48)
        // Live overhead line runs horizontally at y = 50. Distance is 2 cm (< 10 cm!)
        interactor.moveDrill(main, 0, 48);
        if (!drill.getIsDanger()) {
            throw new Error("FAIL: Proximity alert did not trigger when 2cm from live conduit");
        }
        if (drill.getClosestDistance() > 10.0) {
            throw new Error(`FAIL: Expected clearance <= 10cm, got ${drill.getClosestDistance()}`);
        }

        // 3. Move back to safe spot (x: 0, y: 0)
        interactor.moveDrill(main, 0, 0);
        if (drill.getIsDanger()) {
            throw new Error("FAIL: Drill safety did not reset to SAFE state");
        }

        print("[LEAF Scenario 3] DrillSafetyProximityScenario PASSED (Criterion 3 Verified) ✓");
        return true;
    }
}

