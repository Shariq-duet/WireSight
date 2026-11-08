import { ConduitXRMain } from "../ConduitXRMain";
import { LayerToggleScenario } from "./LayerToggleScenario";
import { InspectRunDetailsScenario } from "./InspectRunDetailsScenario";
import { DrillSafetyProximityScenario } from "./DrillSafetyProximityScenario";
import { TapInOutletPlacementScenario } from "./TapInOutletPlacementScenario";
import { ModeSwitchScenario } from "./ModeSwitchScenario";

export interface LeafTestResult {
    scenario: string;
    criterion: string;
    passed: boolean;
    error?: string;
}

@component
export class LeafIndex extends BaseScriptComponent {
    @input
    conduitXRMain!: ConduitXRMain;

    onAwake() {
        // Run tests on start
        this.createEvent("OnStartEvent").bind(() => {
            this.runAllScenarios();
        });
    }

    public async runAllScenarios(): Promise<LeafTestResult[]> {
        print("==========================================================");
        print("  LEAF AUTOMATED TEST RUNNER: ConduitXR Test Suite");
        print("==========================================================");

        const results: LeafTestResult[] = [];

        // Scenario 1: Layer Toggling
        try {
            await LayerToggleScenario.run(this.conduitXRMain);
            results.push({
                scenario: "LayerToggleScenario",
                criterion: "Criterion 1: Layer Toggling (Electrical & Plumbing)",
                passed: true
            });
        } catch (e: any) {
            results.push({
                scenario: "LayerToggleScenario",
                criterion: "Criterion 1: Layer Toggling (Electrical & Plumbing)",
                passed: false,
                error: e.message
            });
        }

        // Scenario 2: Inspect Run Details
        try {
            await InspectRunDetailsScenario.run(this.conduitXRMain);
            results.push({
                scenario: "InspectRunDetailsScenario",
                criterion: "Criterion 2: Inspect Run Details (Circuit Specs & Installer)",
                passed: true
            });
        } catch (e: any) {
            results.push({
                scenario: "InspectRunDetailsScenario",
                criterion: "Criterion 2: Inspect Run Details (Circuit Specs & Installer)",
                passed: false,
                error: e.message
            });
        }

        // Scenario 3: Drill Safety Proximity Alert
        try {
            await DrillSafetyProximityScenario.run(this.conduitXRMain);
            results.push({
                scenario: "DrillSafetyProximityScenario",
                criterion: "Criterion 3: Active Drill Safety Proximity Alert",
                passed: true
            });
        } catch (e: any) {
            results.push({
                scenario: "DrillSafetyProximityScenario",
                criterion: "Criterion 3: Active Drill Safety Proximity Alert",
                passed: false,
                error: e.message
            });
        }

        // Scenario 4: Tap-In Outlet Placement
        try {
            await TapInOutletPlacementScenario.run(this.conduitXRMain);
            results.push({
                scenario: "TapInOutletPlacementScenario",
                criterion: "Criterion 4: Tap-In / Outlet Placement & Splice",
                passed: true
            });
        } catch (e: any) {
            results.push({
                scenario: "TapInOutletPlacementScenario",
                criterion: "Criterion 4: Tap-In / Outlet Placement & Splice",
                passed: false,
                error: e.message
            });
        }

        // Scenario 5: Mode Switch (Create vs View)
        try {
            await ModeSwitchScenario.run(this.conduitXRMain);
            results.push({
                scenario: "ModeSwitchScenario",
                criterion: "Criterion 5: Mode Switch (Create vs. View Locks)",
                passed: true
            });
        } catch (e: any) {
            results.push({
                scenario: "ModeSwitchScenario",
                criterion: "Criterion 5: Mode Switch (Create vs. View Locks)",
                passed: false,
                error: e.message
            });
        }

        print("----------------------------------------------------------");
        print(`  LEAF TEST SUMMARY: ${results.filter(r => r.passed).length}/${results.length} PASSED`);
        print("----------------------------------------------------------");
        for (const res of results) {
            print(`  [${res.passed ? "PASS" : "FAIL"}] ${res.criterion}`);
            if (res.error) print(`         Error: ${res.error}`);
        }
        print("==========================================================");

        return results;
    }
}

