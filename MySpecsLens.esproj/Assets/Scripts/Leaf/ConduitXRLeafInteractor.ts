import { ConduitXRMain } from "../ConduitXRMain";

export class ConduitXRLeafInteractor {
    public toggleElectrical(main: ConduitXRMain): boolean {
        const palette = main.toolPalette;
        if (!palette) throw new Error("ToolPaletteUI not found on ConduitXRMain");
        return palette.toggleElectrical();
    }

    public togglePlumbing(main: ConduitXRMain): boolean {
        const palette = main.toolPalette;
        if (!palette) throw new Error("ToolPaletteUI not found on ConduitXRMain");
        return palette.togglePlumbing();
    }

    public toggleDrill(main: ConduitXRMain): boolean {
        const palette = main.toolPalette;
        if (!palette) throw new Error("ToolPaletteUI not found on ConduitXRMain");
        return palette.toggleDrill();
    }

    public toggleMode(main: ConduitXRMain): boolean {
        const palette = main.toolPalette;
        if (!palette) throw new Error("ToolPaletteUI not found on ConduitXRMain");
        return palette.toggleMode();
    }

    public addOutlet(main: ConduitXRMain): boolean {
        const palette = main.toolPalette;
        if (!palette) throw new Error("ToolPaletteUI not found on ConduitXRMain");
        return palette.triggerAddOutlet();
    }

    public inspectRun(main: ConduitXRMain, runId: string) {
        main.inspectRunById(runId);
    }

    public closeInspection(main: ConduitXRMain) {
        main.closeInspection();
    }

    public moveDrill(main: ConduitXRMain, x: number, y: number) {
        main.setDrillPosition(x, y);
    }
}

