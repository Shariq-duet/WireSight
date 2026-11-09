"""
generate_house_obj.py
Creates an Expansive 8-Room Architectural Cutaway 3D Interior Model (.obj + .mtl) for Snap Spectacles.

Layout:
- Room 1: Master Bedroom (King Bed, Headboard, 2 Nightstands, Brass Lamps, Wardrobe)
- Room 2: Modern Living Room (65" TV, Media Console, 3-Seater Charcoal Sofa, Glass Coffee Table, Rug, Floor Lamp)
- Room 3: Electrical / MEP Utility Room with 200A Main Service Breaker Panel, Powerwall Battery, Disconnect, Transformer
- Room 4: Luxury Bathroom (Walk-in Glass Shower, Floating Double Vanity, Sinks, Backlit Mirror, Toilet, Chrome Fixtures)
- Room 5: Garage & High-Power Workshop (50A Level-2 EV Fast Charger, Heavy Steel Workbench, Tool Chest, Hazard Striping)
- Room 6: Modern Gourmet Kitchen (Large Island with Bar Stools, Quartz Countertops, Dual Sink, Refrigerator, Cooktop)
- Room 7: Formal Dining Room (Large Walnut Table, 6 Modern Chairs, Sideboard Credenza, Pendant Chandelier)
- Room 8: Home Office / Tech Lab (Executive Desk, Dual Monitors, Swivel Chair, Tall Modular Bookcase)
"""

import os
import json
import math

def build_house():
    obj_path = os.path.abspath("MySpecsLens.esproj/Assets/House_Interior_Cutaway.obj")
    mtl_path = os.path.abspath("MySpecsLens.esproj/Assets/House_Interior_Cutaway.mtl")
    spec_path = os.path.abspath("scripts/house_architecture_blueprint.json")
    mtl_filename = os.path.basename(mtl_path)

    # -------------------------------------------------------------
    # 1. WRITE MTL MATERIAL LIBRARY
    # -------------------------------------------------------------
    materials = {
        "Mat_Drywall": {"Kd": "0.92 0.92 0.94", "Ks": "0.05 0.05 0.05", "Ns": "10"},
        "Mat_AccentWall": {"Kd": "0.18 0.24 0.32", "Ks": "0.15 0.15 0.15", "Ns": "25"},
        "Mat_IndustrialWall": {"Kd": "0.78 0.80 0.82", "Ks": "0.10 0.10 0.10", "Ns": "15"},
        "Mat_FloorBedroom": {"Kd": "0.72 0.54 0.38", "Ks": "0.12 0.12 0.12", "Ns": "30"},
        "Mat_FloorLiving": {"Kd": "0.80 0.65 0.48", "Ks": "0.15 0.15 0.15", "Ns": "35"},
        "Mat_FloorConcrete": {"Kd": "0.45 0.46 0.48", "Ks": "0.20 0.20 0.20", "Ns": "40"},
        "Mat_HazardYellow": {"Kd": "0.95 0.78 0.12", "Ks": "0.20 0.20 0.20", "Ns": "30"},
        "Mat_WoodWalnut": {"Kd": "0.32 0.20 0.12", "Ks": "0.10 0.10 0.10", "Ns": "20"},
        "Mat_BedLinen": {"Kd": "0.95 0.95 0.96", "Ks": "0.02 0.02 0.02", "Ns": "5"},
        "Mat_DuvetNavy": {"Kd": "0.15 0.28 0.45", "Ks": "0.05 0.05 0.05", "Ns": "8"},
        "Mat_Pillow": {"Kd": "0.98 0.98 0.98", "Ks": "0.02 0.02 0.02", "Ns": "5"},
        "Mat_SofaCharcoal": {"Kd": "0.25 0.26 0.28", "Ks": "0.05 0.05 0.05", "Ns": "8"},
        "Mat_Rug": {"Kd": "0.85 0.82 0.76", "Ks": "0.02 0.02 0.02", "Ns": "4"},
        "Mat_TVBezel": {"Kd": "0.08 0.08 0.09", "Ks": "0.30 0.30 0.30", "Ns": "60"},
        "Mat_TVScreen": {"Kd": "0.02 0.02 0.03", "Ks": "0.80 0.80 0.80", "Ns": "90"},
        "Mat_BrassLamp": {"Kd": "0.85 0.68 0.28", "Ks": "0.60 0.55 0.30", "Ns": "70"},
        "Mat_LampShade": {"Kd": "0.96 0.94 0.88", "Ks": "0.05 0.05 0.05", "Ns": "10"},
        "Mat_Glass": {"Kd": "0.30 0.45 0.55", "Ks": "0.90 0.90 0.90", "Ns": "100", "d": "0.55"},

        # Electrical Panel & Breaker Materials
        "Mat_PanelCabinet": {"Kd": "0.40 0.43 0.46", "Ks": "0.30 0.30 0.32", "Ns": "40"},
        "Mat_PanelChassis": {"Kd": "0.22 0.24 0.26", "Ks": "0.25 0.25 0.25", "Ns": "30"},
        "Mat_BreakerBlack": {"Kd": "0.08 0.08 0.09", "Ks": "0.15 0.15 0.15", "Ns": "25"},
        "Mat_BreakerHandle": {"Kd": "0.92 0.92 0.92", "Ks": "0.20 0.20 0.20", "Ns": "30"},
        "Mat_MainBreakerRed": {"Kd": "0.85 0.15 0.12", "Ks": "0.30 0.30 0.30", "Ns": "45"},
        "Mat_CircuitDirectory": {"Kd": "0.94 0.92 0.86", "Ks": "0.05 0.05 0.05", "Ns": "5"},
        "Mat_CopperBus": {"Kd": "0.78 0.45 0.22", "Ks": "0.70 0.50 0.30", "Ns": "75"},
        "Mat_SafetyRed": {"Kd": "0.88 0.15 0.15", "Ks": "0.30 0.30 0.30", "Ns": "40"},
        "Mat_Powerwall": {"Kd": "0.92 0.93 0.95", "Ks": "0.50 0.50 0.50", "Ns": "80"},
        "Mat_LedGreen": {"Kd": "0.10 0.95 0.30", "Ks": "0.80 0.80 0.80", "Ns": "100"},
        "Mat_TransformerSteel": {"Kd": "0.20 0.22 0.24", "Ks": "0.35 0.35 0.35", "Ns": "45"},
        "Mat_ConduitMetallic": {"Kd": "0.75 0.78 0.82", "Ks": "0.70 0.70 0.75", "Ns": "85"},

        # New Materials for Expanded 5 Rooms
        "Mat_TileBath": {"Kd": "0.90 0.92 0.94", "Ks": "0.40 0.40 0.42", "Ns": "60"},
        "Mat_PorcelainWhite": {"Kd": "0.96 0.96 0.98", "Ks": "0.65 0.65 0.68", "Ns": "80"},
        "Mat_ChromeMetal": {"Kd": "0.85 0.88 0.92", "Ks": "0.85 0.85 0.90", "Ns": "95"},
        "Mat_CountertopQuartz": {"Kd": "0.88 0.89 0.90", "Ks": "0.45 0.45 0.45", "Ns": "50"},
        "Mat_CabinetNavy": {"Kd": "0.12 0.18 0.25", "Ks": "0.15 0.15 0.15", "Ns": "20"},
        "Mat_StainlessSteel": {"Kd": "0.75 0.76 0.78", "Ks": "0.60 0.60 0.65", "Ns": "70"},
        "Mat_StoveGlass": {"Kd": "0.05 0.05 0.06", "Ks": "0.85 0.85 0.85", "Ns": "90"},
        "Mat_FloorDining": {"Kd": "0.65 0.48 0.32", "Ks": "0.18 0.18 0.18", "Ns": "32"},
        "Mat_DiningFabric": {"Kd": "0.78 0.72 0.64", "Ks": "0.05 0.05 0.05", "Ns": "8"},
        "Mat_EVCharger": {"Kd": "0.92 0.93 0.95", "Ks": "0.40 0.40 0.40", "Ns": "50"},
        "Mat_WorkbenchSteel": {"Kd": "0.30 0.32 0.35", "Ks": "0.35 0.35 0.35", "Ns": "40"},
        "Mat_ToolboxRed": {"Kd": "0.82 0.16 0.14", "Ks": "0.40 0.40 0.40", "Ns": "45"},
        "Mat_OfficeDeskWood": {"Kd": "0.48 0.34 0.22", "Ks": "0.15 0.15 0.15", "Ns": "25"},
        "Mat_OfficeLeather": {"Kd": "0.10 0.10 0.12", "Ks": "0.15 0.15 0.15", "Ns": "20"},
        "Mat_MonitorScreen": {"Kd": "0.08 0.28 0.45", "Ks": "0.75 0.75 0.80", "Ns": "85"},
    }

    with open(mtl_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway Materials (Expansive 8-Room Estate)\n\n")
        for name, prop in materials.items():
            f.write(f"newmtl {name}\n")
            f.write("Ka 0.2 0.2 0.2\n")
            f.write(f"Kd {prop['Kd']}\n")
            f.write(f"Ks {prop['Ks']}\n")
            f.write(f"Ns {prop['Ns']}\n")
            d_val = prop.get("d", "1.0")
            f.write(f"d {d_val}\n\n")

    # -------------------------------------------------------------
    # 2. GEOMETRY GENERATOR
    # -------------------------------------------------------------
    verts = []
    normals = [
        (0.0, 1.0, 0.0),   # 1: Up (+Y)
        (0.0, -1.0, 0.0),  # 2: Down (-Y)
        (0.0, 0.0, 1.0),   # 3: Forward (+Z)
        (0.0, 0.0, -1.0),  # 4: Backward (-Z)
        (1.0, 0.0, 0.0),   # 5: Right (+X)
        (-1.0, 0.0, 0.0)   # 6: Left (-X)
    ]
    objects = []

    def add_box(min_pt, max_pt, obj_name, mat_name):
        x0, y0, z0 = min_pt
        x1, y1, z1 = max_pt
        base_v = len(verts) + 1
        b_verts = [
            (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
            (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)
        ]
        verts.extend(b_verts)
        faces = [
            (base_v + 4, base_v + 5, base_v + 6, base_v + 7, 1), # Top
            (base_v + 3, base_v + 2, base_v + 1, base_v + 0, 2), # Bottom
            (base_v + 3, base_v + 7, base_v + 6, base_v + 2, 3), # Front (+Z)
            (base_v + 1, base_v + 5, base_v + 4, base_v + 0, 4), # Back (-Z)
            (base_v + 2, base_v + 6, base_v + 5, base_v + 1, 5), # Right (+X)
            (base_v + 0, base_v + 4, base_v + 7, base_v + 3, 6)  # Left (-X)
        ]
        objects.append((obj_name, mat_name, faces))

    # =============================================================
    # 3. ARCHITECTURE LAYOUT: EXPANSIVE 8-ROOM ESTATE (17.0m W x 8.25m D x 2.4m H)
    #
    # BACK ROW (Z: -225 to +225, D: 450cm):
    # - Zone 4: Luxury Bathroom (X: -750 to -450, W: 300cm)
    # - Zone 1: Master Bedroom (X: -450 to -75, W: 375cm) [ORIGINAL PRESERVED]
    # - Zone 2: Living Room (X: -75 to +300, W: 375cm) [ORIGINAL PRESERVED]
    # - Zone 3: Electrical / MEP Room (X: +300 to +550, W: 250cm) [ORIGINAL PRESERVED]
    # - Zone 5: Garage & Workshop (X: +550 to +950, W: 400cm)
    #
    # FRONT ROW (Z: +235 to +600, D: 365cm):
    # - Zone 7: Formal Dining Room (X: -450 to -75, W: 375cm)
    # - Zone 6: Modern Gourmet Kitchen (X: -75 to +300, W: 375cm)
    # - Zone 8: Home Office / Tech Lab (X: +300 to +650, W: 350cm)
    # =============================================================

    # Floor Slabs (Y: -6 to 0)
    # Back Row Floors
    add_box((-750, -6, -225), (-450, 0, 225), "Floor_Bathroom", "Mat_TileBath")
    add_box((-450, -6, -225), (-75, 0, 225), "Floor_Bedroom", "Mat_FloorBedroom")
    add_box((-75, -6, -225), (300, 0, 225), "Floor_Living", "Mat_FloorLiving")
    add_box((300, -6, -225), (550, 0, 225), "Floor_Electrical_Room", "Mat_FloorConcrete")
    add_box((550, -6, -225), (950, 0, 225), "Floor_Garage_Workshop", "Mat_FloorConcrete")

    # Front Row Floors
    add_box((-450, -6, 235), (-75, 0, 600), "Floor_Dining_Room", "Mat_FloorDining")
    add_box((-75, -6, 235), (300, 0, 600), "Floor_Kitchen_Zone", "Mat_TileBath")
    add_box((300, -6, 235), (650, 0, 600), "Floor_Home_Office", "Mat_FloorLiving")

    # Garage EV Parking Bay Safety Striping
    add_box((620, 0, -50), (630, 1, 190), "Garage_Bay_Line_Left", "Mat_HazardYellow")
    add_box((870, 0, -50), (880, 1, 190), "Garage_Bay_Line_Right", "Mat_HazardYellow")
    add_box((620, 0, 180), (880, 1, 190), "Garage_Bay_Line_Front", "Mat_HazardYellow")

    # Electrical Room NEC 36-Inch Yellow Safety Zone
    add_box((330, 0, -225), (480, 1, -135), "SafetyZone_NEC_Clearance", "Mat_HazardYellow")

    # -------------------------------------------------------------
    # Perimeter Walls (Thickness 15cm, Height 240cm)
    # -------------------------------------------------------------
    # Full Back Wall along Z = -240 to -225 (From X = -750 to +950)
    add_box((-750, 0, -240), (-450, 240, -225), "Wall_Back_Bathroom", "Mat_Drywall")
    add_box((-450, 0, -240), (-75, 240, -225), "Wall_Back_Bedroom_Accent", "Mat_AccentWall")
    add_box((-75, 0, -240), (300, 240, -225), "Wall_Back_Living_Accent", "Mat_AccentWall")
    add_box((300, 0, -240), (550, 240, -225), "Wall_Back_Electrical_Room", "Mat_IndustrialWall")
    add_box((550, 0, -240), (950, 240, -225), "Wall_Back_Garage", "Mat_IndustrialWall")

    # Exterior Left Walls (West)
    add_box((-765, 0, -225), (-750, 240, 225), "Wall_Exterior_Left_Bathroom", "Mat_Drywall")
    add_box((-465, 0, 235), (-450, 240, 600), "Wall_Exterior_Left_Dining", "Mat_Drywall")

    # Exterior Right Walls (East)
    add_box((950, 0, -225), (965, 240, 225), "Wall_Exterior_Right_Garage", "Mat_IndustrialWall")
    add_box((650, 0, 235), (665, 240, 600), "Wall_Exterior_Right_Office", "Mat_Drywall")

    # Front Cutaway Foundation Thresholds (Height 15cm - open view into estate)
    add_box((-450, 0, 600), (650, 15, 612), "Foundation_Front_Threshold_South", "Mat_Drywall")
    add_box((-750, 0, 225), (-450, 15, 235), "Foundation_Cutaway_Bath_South", "Mat_Drywall")
    add_box((550, 0, 225), (950, 15, 235), "Foundation_Cutaway_Garage_South", "Mat_IndustrialWall")

    # -------------------------------------------------------------
    # Internal Partitions & Walkthrough Doorways
    # -------------------------------------------------------------
    # Partition A: Bathroom <-> Master Bedroom (X: -457.5 to -442.5) with Walkthrough Doorway
    add_box((-457.5, 0, -225), (-442.5, 240, -135), "Wall_Part_Bath_Bed_Back", "Mat_Drywall")
    add_box((-457.5, 210, -135), (-442.5, 240, -45), "Wall_DoorHeader_Bath_Bed", "Mat_Drywall")
    add_box((-457.5, 0, -45), (-442.5, 240, 225), "Wall_Part_Bath_Bed_Front", "Mat_Drywall")

    # Partition B: Master Bedroom <-> Living Room (X: -82.5 to -67.5) with Walkthrough Doorway [ORIGINAL]
    add_box((-82.5, 0, -225), (-67.5, 240, 20), "Wall_Partition_Bed_Living_Back", "Mat_Drywall")
    add_box((-82.5, 210, 20), (-67.5, 240, 115), "Wall_Door_Header_Bed_Living", "Mat_Drywall")
    add_box((-82.5, 0, 115), (-67.5, 240, 225), "Wall_Partition_Bed_Living_Front", "Mat_Drywall")

    # Partition C: Living Room <-> Electrical Room (X: 292.5 to 307.5) with Fire Doorway [ORIGINAL]
    add_box((292.5, 0, -225), (307.5, 240, -10), "Wall_Partition_Living_Elec_Back", "Mat_Drywall")
    add_box((292.5, 210, -10), (307.5, 240, 80), "Wall_Door_Header_Living_Elec", "Mat_Drywall")
    add_box((292.5, 0, 80), (307.5, 240, 225), "Wall_Partition_Living_Elec_Front", "Mat_Drywall")

    # Partition D: Electrical Room <-> Garage / Workshop (X: 542.5 to 557.5) with Industrial Fire Doorway
    add_box((542.5, 0, -225), (557.5, 240, -30), "Wall_Part_Elec_Garage_Back", "Mat_IndustrialWall")
    add_box((542.5, 210, -30), (557.5, 240, 70), "Wall_DoorHeader_Elec_Garage", "Mat_IndustrialWall")
    add_box((542.5, 0, 70), (557.5, 240, 225), "Wall_Part_Elec_Garage_Front", "Mat_IndustrialWall")

    # Partition E: Between Back Row & Front Row (Z: 225 to 240)
    # 1. Bedroom <-> Dining Room: Grand 180cm open archway
    add_box((-450, 0, 225), (-340, 240, 240), "Wall_Part_Bed_Dining_Left", "Mat_Drywall")
    add_box((-340, 210, 225), (-160, 240, 240), "Wall_ArchHeader_Bed_Dining", "Mat_Drywall")
    add_box((-160, 0, 225), (-75, 240, 240), "Wall_Part_Bed_Dining_Right", "Mat_Drywall")

    # 2. Living Room <-> Modern Kitchen: Open-Concept living threshold
    add_box((-75, 215, 225), (300, 240, 240), "Wall_CeilingBeam_Living_Kitchen", "Mat_Drywall")
    add_box((-75, 0, 225), (-35, 240, 240), "Wall_Col_Living_Kitchen_L", "Mat_Drywall")
    add_box((260, 0, 225), (300, 240, 240), "Wall_Col_Living_Kitchen_R", "Mat_Drywall")

    # 3. Electrical / Utility <-> Home Office: Insulated sound wall with Doorway
    add_box((300, 0, 225), (420, 240, 240), "Wall_Part_Utility_Office_L", "Mat_Drywall")
    add_box((420, 210, 225), (510, 240, 240), "Wall_DoorHeader_Utility_Office", "Mat_Drywall")
    add_box((510, 0, 225), (650, 240, 240), "Wall_Part_Utility_Office_R", "Mat_Drywall")

    # Partition F: Front Row Partitions
    # Dining <-> Kitchen (X: -82.5 to -67.5) with open archway
    add_box((-82.5, 0, 235), (-67.5, 240, 310), "Wall_Part_Dining_Kitchen_Back", "Mat_Drywall")
    add_box((-82.5, 215, 310), (-67.5, 240, 520), "Wall_ArchHeader_Dining_Kitchen", "Mat_Drywall")
    add_box((-82.5, 0, 520), (-67.5, 240, 600), "Wall_Part_Dining_Kitchen_Front", "Mat_Drywall")

    # Kitchen <-> Office (X: 292.5 to 307.5) with Office entry door
    add_box((292.5, 0, 235), (307.5, 240, 320), "Wall_Part_Kitchen_Office_Back", "Mat_Drywall")
    add_box((292.5, 210, 320), (307.5, 240, 410), "Wall_DoorHeader_Kitchen_Office", "Mat_Drywall")
    add_box((292.5, 0, 410), (307.5, 240, 600), "Wall_Part_Kitchen_Office_Front", "Mat_Drywall")

    # =============================================================
    # 4. ROOM 1: MASTER BEDROOM (LEFT BACK ROOM) [ORIGINAL PRESERVED]
    # =============================================================
    add_box((-357.5, 0, -220), (-167.5, 25, -20), "Bed_Frame", "Mat_WoodWalnut")
    add_box((-367.5, 0, -225), (-157.5, 115, -215), "Bed_Headboard", "Mat_WoodWalnut")
    add_box((-352.5, 25, -215), (-172.5, 55, -25), "Bed_Mattress", "Mat_BedLinen")
    add_box((-355.5, 25, -155), (-169.5, 58, -23), "Bed_Duvet", "Mat_DuvetNavy")
    add_box((-337.5, 55, -210), (-277.5, 68, -170), "Bed_Pillow_Left", "Mat_Pillow")
    add_box((-247.5, 55, -210), (-187.5, 68, -170), "Bed_Pillow_Right", "Mat_Pillow")

    # Nightstands & Lamps
    add_box((-427.5, 0, -220), (-377.5, 52, -175), "Nightstand_Left", "Mat_WoodWalnut")
    add_box((-407.5, 52, -202), (-397.5, 55, -192), "Lamp_Left_Base", "Mat_BrassLamp")
    add_box((-404.5, 55, -199), (-400.5, 75, -195), "Lamp_Left_Stem", "Mat_BrassLamp")
    add_box((-412.5, 75, -207), (-392.5, 92, -187), "Lamp_Left_Shade", "Mat_LampShade")

    add_box((-147.5, 0, -220), (-97.5, 52, -175), "Nightstand_Right", "Mat_WoodWalnut")
    add_box((-127.5, 52, -202), (-117.5, 55, -192), "Lamp_Right_Base", "Mat_BrassLamp")
    add_box((-124.5, 55, -199), (-120.5, 75, -195), "Lamp_Right_Stem", "Mat_BrassLamp")
    add_box((-132.5, 75, -207), (-112.5, 92, -187), "Lamp_Right_Shade", "Mat_LampShade")

    add_box((-450, 0, -10), (-390, 215, 170), "Bedroom_Wardrobe", "Mat_WoodWalnut")

    # =============================================================
    # 5. ROOM 2: LIVING ROOM (CENTER BACK ROOM) [ORIGINAL PRESERVED]
    # =============================================================
    add_box((22.5, 0, -225), (202.5, 48, -180), "TV_Media_Console", "Mat_WoodWalnut")
    add_box((37.5, 90, -225), (187.5, 175, -221), "TV_Bezel_Frame", "Mat_TVBezel")
    add_box((39.5, 92, -221), (185.5, 173, -220), "TV_Screen_Display", "Mat_TVScreen")
    add_box((-12.5, 0, -150), (237.5, 2, 90), "Living_Room_Rug", "Mat_Rug")

    add_box((2.5, 0, -10), (222.5, 42, 75), "Sofa_Seat_Base", "Mat_SofaCharcoal")
    add_box((2.5, 42, 55), (222.5, 80, 75), "Sofa_Backrest", "Mat_SofaCharcoal")
    add_box((2.5, 42, -10), (22.5, 62, 75), "Sofa_Armrest_Left", "Mat_SofaCharcoal")
    add_box((202.5, 42, -10), (222.5, 62, 75), "Sofa_Armrest_Right", "Mat_SofaCharcoal")

    add_box((57.5, 0, -115), (67.5, 38, -105), "CoffeeTable_Leg_1", "Mat_WoodWalnut")
    add_box((157.5, 0, -115), (167.5, 38, -105), "CoffeeTable_Leg_2", "Mat_WoodWalnut")
    add_box((57.5, 0, -75), (67.5, 38, -65), "CoffeeTable_Leg_3", "Mat_WoodWalnut")
    add_box((157.5, 0, -75), (167.5, 38, -65), "CoffeeTable_Leg_4", "Mat_WoodWalnut")
    add_box((52.5, 38, -120), (172.5, 42, -60), "CoffeeTable_GlassTop", "Mat_Glass")

    add_box((260, 0, -210), (280, 4, -190), "FloorLamp_Base", "Mat_BrassLamp")
    add_box((268, 4, -202), (272, 155, -198), "FloorLamp_Pole", "Mat_BrassLamp")
    add_box((255, 155, -215), (285, 185, -185), "FloorLamp_Shade", "Mat_LampShade")

    # =============================================================
    # 6. ROOM 3: ELECTRICAL / MEP UTILITY ROOM [ORIGINAL PRESERVED]
    # Centered at X = 380, Y = 140, Z = -225 on Back Wall
    # =============================================================
    # A. Panel Back Box (Enclosure Cabinet: 65cm wide, 95cm high, 15cm deep)
    add_box((347.5, 95, -225), (412.5, 190, -210), "Panel_Enclosure_Cabinet", "Mat_PanelCabinet")

    # B. Open Hinged Door
    add_box((345.5, 95, -210), (347.5, 190, -150), "Panel_Hinged_Door_Open", "Mat_PanelCabinet")
    add_box((347.6, 115, -200), (348.0, 175, -160), "Panel_Circuit_Directory_Index", "Mat_CircuitDirectory")

    # C. Interior Steel Deadfront Chassis
    add_box((352.5, 100, -210), (407.5, 185, -207), "Panel_Interior_Deadfront", "Mat_PanelChassis")

    # D. Top Main 200A Service Breaker (Double-Pole Master Disconnect)
    add_box((372.0, 170, -207), (388.0, 180, -203), "Breaker_200A_Main_Case", "Mat_BreakerBlack")
    add_box((376.0, 173, -203), (384.0, 177, -199), "Breaker_200A_Main_Handle", "Mat_MainBreakerRed")
    add_box((374.0, 178.5, -204.0), (378.0, 181.5, -200.5), "Breaker_Main_Lug_PhaseA", "Mat_CopperBus")
    add_box((382.0, 178.5, -204.0), (386.0, 181.5, -200.5), "Breaker_Main_Lug_PhaseB", "Mat_CopperBus")
    add_box((374.0, 171.0, -202.8), (386.0, 172.5, -202.2), "Breaker_Main_Hazard_Label", "Mat_SafetyRed")

    # E. Dual-Column Branch Circuit Breakers (10 Breakers, Full Schedule):
    # LEFT COLUMN (X: 356 to 376):
    # B1: Master Bedroom (20A) - Terminal (366, 157, -201)
    add_box((356.0, 153, -207), (376.0, 161, -203), "Breaker_1_Case_MasterBed", "Mat_BreakerBlack")
    add_box((370.0, 155, -203), (375.0, 159, -200), "Breaker_1_Handle_20A", "Mat_BreakerHandle")
    add_box((363.5, 159.0, -204.0), (368.5, 162.0, -200.5), "Breaker_1_Terminal_Lug", "Mat_CopperBus")
    add_box((360.0, 156.0, -202.8), (363.0, 158.0, -202.2), "Breaker_1_Trip_Flag", "Mat_LedGreen")

    # B3: Living Room Sofa & Floor Lamp (15A) - Terminal (366, 145, -201)
    add_box((356.0, 141, -207), (376.0, 149, -203), "Breaker_3_Case_SofaBranch", "Mat_BreakerBlack")
    add_box((370.0, 143, -203), (375.0, 147, -200), "Breaker_3_Handle_15A", "Mat_BreakerHandle")
    add_box((363.5, 147.0, -204.0), (368.5, 150.0, -200.5), "Breaker_3_Terminal_Lug", "Mat_CopperBus")
    add_box((360.0, 144.0, -202.8), (363.0, 146.0, -202.2), "Breaker_3_Trip_Flag", "Mat_LedGreen")

    # B5: Modern Gourmet Kitchen 20A GFCI - Terminal (366, 133, -201)
    add_box((356.0, 129, -207), (376.0, 137, -203), "Breaker_5_Case_Kitchen", "Mat_BreakerBlack")
    add_box((370.0, 131, -203), (375.0, 135, -200), "Breaker_5_Handle_20A", "Mat_BreakerHandle")
    add_box((363.5, 135.0, -204.0), (368.5, 138.0, -200.5), "Breaker_5_Terminal_Lug", "Mat_CopperBus")
    add_box((360.0, 132.0, -202.8), (363.0, 134.0, -202.2), "Breaker_5_Trip_Flag", "Mat_LedGreen")

    # B7: Luxury Bathroom 20A GFCI - Terminal (366, 121, -201)
    add_box((356.0, 117, -207), (376.0, 125, -203), "Breaker_7_Case_Bathroom", "Mat_BreakerBlack")
    add_box((370.0, 119, -203), (375.0, 123, -200), "Breaker_7_Handle_20A", "Mat_BreakerHandle")
    add_box((363.5, 123.0, -204.0), (368.5, 126.0, -200.5), "Breaker_7_Terminal_Lug", "Mat_CopperBus")
    add_box((360.0, 120.0, -202.8), (363.0, 122.0, -202.2), "Breaker_7_Trip_Flag", "Mat_LedGreen")

    # B9: Formal Dining Room Lighting (15A) - Terminal (366, 109, -201)
    add_box((356.0, 105, -207), (376.0, 113, -203), "Breaker_9_Case_Dining", "Mat_BreakerBlack")
    add_box((370.0, 107, -203), (375.0, 111, -200), "Breaker_9_Handle_15A", "Mat_BreakerHandle")
    add_box((363.5, 111.0, -204.0), (368.5, 114.0, -200.5), "Breaker_9_Terminal_Lug", "Mat_CopperBus")
    add_box((360.0, 108.0, -202.8), (363.0, 110.0, -202.2), "Breaker_9_Trip_Flag", "Mat_LedGreen")

    # RIGHT COLUMN (X: 384 to 404):
    # B2: Living Room 65" TV & Media (15A) - Terminal (394, 157, -201)
    add_box((384.0, 153, -207), (404.0, 161, -203), "Breaker_2_Case_LivingTV", "Mat_BreakerBlack")
    add_box((385.0, 155, -203), (390.0, 159, -200), "Breaker_2_Handle_15A", "Mat_BreakerHandle")
    add_box((391.5, 159.0, -204.0), (396.5, 162.0, -200.5), "Breaker_2_Terminal_Lug", "Mat_CopperBus")
    add_box((397.0, 156.0, -202.8), (400.0, 158.0, -202.2), "Breaker_2_Trip_Flag", "Mat_LedGreen")

    # B4: Utility & Battery Storage (30A) - Terminal (394, 145, -201)
    add_box((384.0, 141, -207), (404.0, 149, -203), "Breaker_4_Case_Utility", "Mat_BreakerBlack")
    add_box((385.0, 143, -203), (390.0, 147, -200), "Breaker_4_Handle_30A", "Mat_BreakerHandle")
    add_box((391.5, 147.0, -204.0), (396.5, 150.0, -200.5), "Breaker_4_Terminal_Lug", "Mat_CopperBus")
    add_box((397.0, 144.0, -202.8), (400.0, 146.0, -202.2), "Breaker_4_Trip_Flag", "Mat_LedGreen")

    # B6: Garage / Workshop 50A EV Charger - Terminal (394, 133, -201)
    add_box((384.0, 129, -207), (404.0, 137, -203), "Breaker_6_Case_GarageEV", "Mat_BreakerBlack")
    add_box((385.0, 131, -203), (390.0, 135, -200), "Breaker_6_Handle_50A", "Mat_BreakerHandle")
    add_box((391.5, 135.0, -204.0), (396.5, 138.0, -200.5), "Breaker_6_Terminal_Lug", "Mat_CopperBus")
    add_box((397.0, 132.0, -202.8), (400.0, 134.0, -202.2), "Breaker_6_Trip_Flag", "Mat_LedGreen")

    # B8: Home Office Clean Power (15A) - Terminal (394, 121, -201)
    add_box((384.0, 117, -207), (404.0, 125, -203), "Breaker_8_Case_Office", "Mat_BreakerBlack")
    add_box((385.0, 119, -203), (390.0, 123, -200), "Breaker_8_Handle_15A", "Mat_BreakerHandle")
    add_box((391.5, 123.0, -204.0), (396.5, 126.0, -200.5), "Breaker_8_Terminal_Lug", "Mat_CopperBus")
    add_box((397.0, 120.0, -202.8), (400.0, 122.0, -202.2), "Breaker_8_Trip_Flag", "Mat_LedGreen")

    # B10: HVAC Dedicated Air Handler (30A) - Terminal (394, 109, -201)
    add_box((384.0, 105, -207), (404.0, 113, -203), "Breaker_10_Case_HVAC", "Mat_BreakerBlack")
    add_box((385.0, 107, -203), (390.0, 111, -200), "Breaker_10_Handle_30A", "Mat_BreakerHandle")
    add_box((391.5, 111.0, -204.0), (396.5, 114.0, -200.5), "Breaker_10_Terminal_Lug", "Mat_CopperBus")
    add_box((397.0, 108.0, -202.8), (400.0, 110.0, -202.2), "Breaker_10_Trip_Flag", "Mat_LedGreen")

    # F. Copper Neutral & Ground Bus Bars
    add_box((350.0, 100, -209), (352.0, 170, -207), "Panel_Neutral_Bus_Bar", "Mat_CopperBus")
    add_box((408.0, 100, -209), (410.0, 170, -207), "Panel_Ground_Bus_Bar", "Mat_CopperBus")

    # G. Other Electrical Equipment
    add_box((435, 115, -225), (470, 165, -210), "Electrical_Emergency_Disconnect_Box", "Mat_PanelCabinet")
    add_box((462, 130, -210), (478, 150, -202), "Electrical_Emergency_Red_Lever", "Mat_SafetyRed")
    add_box((535, 35, -160), (550, 185, -40), "Electrical_Smart_Battery_Powerwall", "Mat_Powerwall")
    add_box((534, 165, -150), (535, 170, -50), "Electrical_Battery_Status_LED", "Mat_LedGreen")
    add_box((460, 0, 110), (535, 95, 185), "Electrical_Transformer_Unit", "Mat_TransformerSteel")
    add_box((458, 20, 125), (460, 80, 170), "Electrical_Transformer_CoolingFins", "Mat_PanelCabinet")
    add_box((330, 220, -218), (480, 226, -212), "Electrical_Conduit_Trunk_Header", "Mat_ConduitMetallic")
    add_box((375, 0, -220), (385, 95, -212), "Electrical_Feeder_Riser_Pipe", "Mat_ConduitMetallic")
    add_box((320, 85, -5), (335, 140, 10), "Safety_Fire_Extinguisher_Tank", "Mat_SafetyRed")
    add_box((324, 140, -1), (331, 150, 6), "Safety_Fire_Extinguisher_Valve", "Mat_BrassLamp")

    # =============================================================
    # 7. ROOM 4: LUXURY EN-SUITE BATHROOM (FAR-LEFT BACK ROOM)
    # Zone: X: -750 to -450, Z: -225 to 225
    # =============================================================
    # A. Walk-in Glass Shower Enclosure (X: -740 to -610, Z: -220 to -110)
    add_box((-740, 0, -220), (-610, 8, -110), "Shower_Tile_Base_Pan", "Mat_TileBath")
    add_box((-614, 8, -220), (-610, 210, -110), "Shower_Glass_Wall_East", "Mat_Glass")
    add_box((-740, 8, -114), (-670, 210, -110), "Shower_Glass_Wall_South", "Mat_Glass")
    # Shower Hardware
    add_box((-680, 180, -224), (-670, 205, -220), "Shower_Valve_Mixer", "Mat_ChromeMetal")
    add_box((-678, 205, -224), (-672, 230, -200), "Shower_Riser_Pipe", "Mat_ChromeMetal")
    add_box((-685, 228, -205), (-665, 232, -185), "Shower_Rain_Head", "Mat_ChromeMetal")

    # B. Floating Double Vanity (X: -600 to -470, Z: -220 to -170, Y: 15 to 85)
    add_box((-600, 15, -220), (-470, 80, -175), "Vanity_Cabinet_Floating", "Mat_CabinetNavy")
    add_box((-605, 80, -225), (-465, 86, -170), "Vanity_Quartz_Countertop", "Mat_CountertopQuartz")
    # Sinks (Left & Right Basin)
    add_box((-580, 84, -210), (-545, 87, -185), "Vanity_Sink_Basin_Left", "Mat_PorcelainWhite")
    add_box((-525, 84, -210), (-490, 87, -185), "Vanity_Sink_Basin_Right", "Mat_PorcelainWhite")
    # Chrome Faucets
    add_box((-564, 86, -217), (-561, 102, -207), "Vanity_Faucet_Left", "Mat_ChromeMetal")
    add_box((-509, 86, -217), (-506, 102, -207), "Vanity_Faucet_Right", "Mat_ChromeMetal")
    # Backlit Vanity Mirror
    add_box((-590, 105, -224), (-480, 185, -221), "Vanity_Backlit_Mirror", "Mat_Glass")

    # C. Porcelain Toilet (X: -730 to -675, Z: 80 to 140)
    add_box((-725, 0, 90), (-680, 42, 135), "Toilet_Bowl_Porcelain", "Mat_PorcelainWhite")
    add_box((-728, 40, 80), (-677, 82, 105), "Toilet_Tank_Porcelain", "Mat_PorcelainWhite")
    add_box((-722, 42, 92), (-683, 45, 133), "Toilet_Seat_Cover", "Mat_PorcelainWhite")

    # D. Heated Chrome Towel Rack (X: -748, Z: -40 to 20, Y: 90 to 160)
    add_box((-749, 90, -40), (-746, 160, 20), "Bathroom_Towel_Warmer", "Mat_ChromeMetal")

    # =============================================================
    # 8. ROOM 5: GARAGE & HIGH-POWER WORKSHOP (FAR-RIGHT BACK ROOM)
    # Zone: X: 550 to 950, Z: -225 to 225
    # =============================================================
    # A. Heavy-Duty Steel Industrial Workbench (X: 580 to 760, Z: -220 to -165, Y: 0 to 95)
    add_box((580, 0, -220), (760, 88, -170), "Workbench_Steel_Chassis", "Mat_WorkbenchSteel")
    add_box((575, 88, -224), (765, 96, -165), "Workbench_Hardwood_Top", "Mat_WoodWalnut")
    # Pegboard Wall Organizer above bench
    add_box((580, 105, -225), (760, 195, -223), "Workbench_Pegboard_Backer", "Mat_IndustrialWall")

    # B. Rolling Mechanic Tool Chest with Drawers (X: 790 to 880, Z: -220 to -175, Y: 0 to 130)
    add_box((790, 0, -220), (880, 125, -175), "Tool_Chest_Main_Cabinet", "Mat_ToolboxRed")
    add_box((788, 125, -222), (882, 132, -173), "Tool_Chest_Top_Lid", "Mat_ToolboxRed")
    # Chrome Drawer Pull Handles
    for dh in [25, 45, 65, 85, 105]:
        add_box((815, dh, -174), (855, dh + 4, -171), f"Toolbox_Drawer_Pull_{dh}", "Mat_ChromeMetal")

    # C. Level-2 50A 240V EV Fast Charger Wall Box (Mounted on East Wall X: 945, Z: -20 to 40)
    add_box((945, 110, -20), (955, 165, 40), "EV_Charger_Enclosure_50A", "Mat_EVCharger")
    add_box((942, 125, -5), (945, 150, 25), "EV_Charger_Faceplate_Display", "Mat_LedGreen")
    # EV Charging Cable & Holster Nozzle
    add_box((935, 105, 5), (945, 125, 15), "EV_Charger_Nozzle_Holster", "Mat_BreakerBlack")

    # D. Industrial Overhead Fluorescent Lights
    add_box((640, 230, -50), (860, 238, -35), "Garage_Overhead_Light_1", "Mat_ConduitMetallic")
    add_box((640, 230, 80), (860, 238, 95), "Garage_Overhead_Light_2", "Mat_ConduitMetallic")

    # =============================================================
    # 9. ROOM 7: FORMAL DINING ROOM (LEFT FRONT ROOM)
    # Zone: X: -450 to -75, Z: 235 to 600
    # =============================================================
    # A. Large Walnut Dining Table (X: -340 to -180, Z: 360 to 480, Y: 0 to 76)
    # 4 Tapered Legs
    add_box((-335, 0, 365), (-325, 72, 375), "DiningTable_Leg_1", "Mat_WoodWalnut")
    add_box((-195, 0, 365), (-185, 72, 375), "DiningTable_Leg_2", "Mat_WoodWalnut")
    add_box((-335, 0, 465), (-325, 72, 475), "DiningTable_Leg_3", "Mat_WoodWalnut")
    add_box((-195, 0, 465), (-185, 72, 475), "DiningTable_Leg_4", "Mat_WoodWalnut")
    # Table Top
    add_box((-345, 72, 355), (-175, 77, 485), "DiningTable_Top_Walnut", "Mat_WoodWalnut")

    # B. 6 Modern Upholstered Dining Chairs
    chair_positions = [
        # North side (facing South)
        (-300, 320, 0), (-260, 320, 0), (-220, 320, 0),
        # South side (facing North)
        (-300, 505, 180), (-260, 505, 180), (-220, 505, 180)
    ]
    for idx, (cx, cz, rot) in enumerate(chair_positions):
        # Chair Legs
        add_box((cx - 16, 0, cz - 16), (cx + 16, 44, cz + 16), f"DiningChair_{idx}_Legs", "Mat_WoodWalnut")
        # Chair Cushion Seat
        add_box((cx - 18, 44, cz - 18), (cx + 18, 49, cz + 18), f"DiningChair_{idx}_Seat", "Mat_DiningFabric")
        # Chair Backrest
        if rot == 0:
            add_box((cx - 18, 49, cz - 18), (cx + 18, 86, cz - 13), f"DiningChair_{idx}_Back", "Mat_DiningFabric")
        else:
            add_box((cx - 18, 49, cz + 13), (cx + 18, 86, cz + 18), f"DiningChair_{idx}_Back", "Mat_DiningFabric")

    # C. Dining Buffet Credenza Console (West Wall X: -445 to -395, Z: 340 to 500, Y: 0 to 86)
    add_box((-445, 0, 340), (-395, 86, 500), "Dining_Credenza_Console", "Mat_CabinetNavy")
    add_box((-448, 86, 335), (-392, 90, 505), "Dining_Credenza_Top", "Mat_CountertopQuartz")

    # D. Hanging Pendant Brass Chandelier (Above Dining Table Center: X = -260, Z = 420)
    add_box((-263, 200, 417), (-257, 240, 423), "Chandelier_Ceiling_Mount", "Mat_BrassLamp")
    add_box((-300, 190, 380), (-220, 200, 460), "Chandelier_Ring_Armature", "Mat_BrassLamp")
    add_box((-270, 182, 410), (-250, 190, 430), "Chandelier_Warm_Light", "Mat_LampShade")

    # =============================================================
    # 10. ROOM 6: MODERN GOURMET KITCHEN (CENTER FRONT ROOM)
    # Zone: X: -75 to 300, Z: 235 to 600
    # =============================================================
    # A. Large Central Kitchen Island (X: 10 to 180, Z: 340 to 440, Y: 0 to 92)
    add_box((10, 0, 340), (180, 86, 440), "Kitchen_Island_Base_Cabinets", "Mat_CabinetNavy")
    add_box((5, 86, 335), (185, 92, 455), "Kitchen_Island_Quartz_Top", "Mat_CountertopQuartz")
    # 3 Modern Bar Stools along Island overhang (Z = 475)
    for s_idx, sx in enumerate([40, 95, 150]):
        add_box((sx - 15, 0, 465), (sx + 15, 62, 495), f"Kitchen_Stool_{s_idx}_Legs", "Mat_ChromeMetal")
        add_box((sx - 16, 62, 464), (sx + 16, 68, 496), f"Kitchen_Stool_{s_idx}_Cushion", "Mat_OfficeLeather")

    # B. Main Kitchen Counter Run (East Wall X: 240 to 295, Z: 250 to 570)
    add_box((240, 0, 250), (295, 86, 500), "Kitchen_Counter_Base", "Mat_CabinetNavy")
    add_box((236, 86, 245), (298, 92, 505), "Kitchen_Counter_Quartz_Top", "Mat_CountertopQuartz")
    # Dual-Basin Undermount Stainless Sink (Z: 330 to 390)
    add_box((245, 88, 330), (285, 92, 390), "Kitchen_Dual_Sink_Basin", "Mat_StainlessSteel")
    add_box((290, 92, 355), (293, 125, 365), "Kitchen_Chrome_Gooseneck_Faucet", "Mat_ChromeMetal")

    # Glass Ceramic Cooktop & Range Oven (Z: 420 to 480)
    add_box((242, 88, 420), (292, 93, 480), "Kitchen_Ceramic_Cooktop", "Mat_StoveGlass")
    # Stainless Steel Range Hood (Y: 165 to 225)
    add_box((235, 165, 415), (295, 225, 485), "Kitchen_Range_Hood", "Mat_StainlessSteel")

    # Upper Wall Cabinets (Y: 145 to 210, Z: 250 to 410)
    add_box((255, 145, 250), (295, 210, 410), "Kitchen_Upper_Wall_Cabinets", "Mat_CabinetNavy")

    # C. Full-Height Stainless French-Door Refrigerator (X: 235 to 295, Z: 510 to 580, Y: 0 to 195)
    add_box((235, 0, 510), (295, 195, 580), "Kitchen_Refrigerator_Main", "Mat_StainlessSteel")
    # Left & Right Door Handles
    add_box((232, 70, 540), (235, 140, 544), "Fridge_Handle_Left", "Mat_ChromeMetal")
    add_box((232, 70, 546), (235, 140, 550), "Fridge_Handle_Right", "Mat_ChromeMetal")

    # =============================================================
    # 11. ROOM 8: HOME OFFICE / TECH LAB (RIGHT FRONT ROOM)
    # Zone: X: 300 to 650, Z: 235 to 600
    # =============================================================
    # A. Wide Executive Corner Desk (X: 370 to 550, Z: 430 to 510, Y: 0 to 76)
    # Desk Steel Frame / Legs
    add_box((375, 0, 435), (385, 72, 505), "OfficeDesk_Leg_Left", "Mat_WorkbenchSteel")
    add_box((535, 0, 435), (545, 72, 505), "OfficeDesk_Leg_Right", "Mat_WorkbenchSteel")
    # Solid Oak Desktop
    add_box((365, 72, 425), (555, 77, 515), "OfficeDesk_Wood_Top", "Mat_OfficeDeskWood")

    # B. Dual Ultra-Wide Curved Displays
    # Monitor 1 (Left: X: 395 to 455)
    add_box((422, 77, 440), (428, 92, 446), "Monitor_1_Stand", "Mat_ChromeMetal")
    add_box((395, 92, 430), (455, 132, 438), "Monitor_1_Bezel", "Mat_TVBezel")
    add_box((397, 94, 437), (453, 130, 439), "Monitor_1_Screen", "Mat_MonitorScreen")
    # Monitor 2 (Right: X: 465 to 525)
    add_box((492, 77, 440), (498, 92, 446), "Monitor_2_Stand", "Mat_ChromeMetal")
    add_box((465, 92, 430), (525, 132, 438), "Monitor_2_Bezel", "Mat_TVBezel")
    add_box((467, 94, 437), (523, 130, 439), "Monitor_2_Screen", "Mat_MonitorScreen")

    # High-Performance Workstation PC Tower (under desk X: 510 to 540, Z: 440 to 490, Y: 0 to 45)
    add_box((510, 0, 440), (540, 45, 490), "Office_Workstation_Tower", "Mat_BreakerBlack")

    # C. Ergonomic Leather Swivel Office Chair (Centered at X: 460, Z: 380)
    add_box((440, 0, 360), (480, 15, 400), "OfficeChair_Caster_Star_Base", "Mat_ChromeMetal")
    add_box((457, 15, 377), (463, 45, 383), "OfficeChair_Pneumatic_Cylinder", "Mat_ChromeMetal")
    add_box((435, 45, 355), (485, 54, 405), "OfficeChair_Seat_Cushion", "Mat_OfficeLeather")
    add_box((437, 54, 355), (483, 108, 363), "OfficeChair_Ergonomic_Backrest", "Mat_OfficeLeather")

    # D. Tall Modular Bookshelf / Library Storage (East Wall X: 610 to 650, Z: 280 to 490, Y: 0 to 215)
    add_box((610, 0, 280), (648, 215, 490), "Office_Bookshelf_Unit", "Mat_WoodWalnut")
    # Shelf Dividers with books
    for sy in [50, 95, 140, 180]:
        add_box((612, sy, 282), (646, sy + 4, 488), f"Bookshelf_Shelf_Tier_{sy}", "Mat_WoodWalnut")
        # Decorative books & manuals
        add_box((615, sy + 4, 300), (642, sy + 38, 360), f"Bookshelf_Books_Set_{sy}", "Mat_CabinetNavy")

    # =============================================================
    # 12. WRITE OUT OBJ FILE
    # =============================================================
    with open(obj_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway 3D Model with Expansive 8-Room Layout\n")
        f.write(f"mtllib {mtl_filename}\n\n")

        for vx, vy, vz in verts:
            f.write(f"v {vx:.2f} {vy:.2f} {vz:.2f}\n")
        f.write("\n")

        for nx, ny, nz in normals:
            f.write(f"vn {nx:.2f} {ny:.2f} {nz:.2f}\n")
        f.write("\n")

        for obj_name, mat_name, faces in objects:
            f.write(f"o {obj_name}\n")
            f.write(f"usemtl {mat_name}\n")
            f.write("s 1\n")
            for f1, f2, f3, f4, ni in faces:
                f.write(f"f {f1}//{ni} {f2}//{ni} {f3}//{ni} {f4}//{ni}\n")
            f.write("\n")

    # =============================================================
    # 13. EXPORT MEP BLUEPRINT SPECIFICATION WITH EXACT 10-CIRCUIT BREAKER HUB
    # =============================================================
    blueprint = {
        "house_dimensions_cm": {"width": 1700, "depth": 825, "height": 240},
        "rooms": [
            {"id": "bedroom", "name": "Master Bedroom", "bounds": {"min_x": -450, "max_x": -75, "min_z": -225, "max_z": 225}},
            {"id": "living", "name": "Living Room", "bounds": {"min_x": -75, "max_x": 300, "min_z": -225, "max_z": 225}},
            {"id": "utility", "name": "Electrical MEP Room", "bounds": {"min_x": 300, "max_x": 550, "min_z": -225, "max_z": 225}},
            {"id": "bathroom", "name": "Luxury Bathroom", "bounds": {"min_x": -750, "max_x": -450, "min_z": -225, "max_z": 225}},
            {"id": "garage", "name": "Garage & Workshop", "bounds": {"min_x": 550, "max_x": 950, "min_z": -225, "max_z": 225}},
            {"id": "dining", "name": "Formal Dining Room", "bounds": {"min_x": -450, "max_x": -75, "min_z": 235, "max_z": 600}},
            {"id": "kitchen", "name": "Modern Gourmet Kitchen", "bounds": {"min_x": -75, "max_x": 300, "min_z": 235, "max_z": 600}},
            {"id": "office", "name": "Home Office / Tech Lab", "bounds": {"min_x": 300, "max_x": 650, "min_z": 235, "max_z": 600}}
        ],
        "breaker_panel": {
            "center": {"x": 380, "y": 140, "z": -208},
            "main_breaker_200a": {"x": 380, "y": 175, "z": -201, "amperage": 200, "service": "Whole House Main Disconnect"},
            "branch_breakers": [
                {
                    "num": 1,
                    "slot": "Left Row 1",
                    "terminal": {"x": 366, "y": 157, "z": -201},
                    "amperage": 20,
                    "circuit": "Master Bedroom Outlets & Lights",
                    "room": "bedroom",
                    "scenario": 1
                },
                {
                    "num": 2,
                    "slot": "Right Row 1",
                    "terminal": {"x": 394, "y": 157, "z": -201},
                    "amperage": 15,
                    "circuit": "Living Room 65in TV & Media Console",
                    "room": "living",
                    "scenario": 2
                },
                {
                    "num": 3,
                    "slot": "Left Row 2",
                    "terminal": {"x": 366, "y": 145, "z": -201},
                    "amperage": 15,
                    "circuit": "Living Room Sofa & Corner Lamp Tap-In",
                    "room": "sofa",
                    "scenario": 3
                },
                {
                    "num": 4,
                    "slot": "Right Row 2",
                    "terminal": {"x": 394, "y": 145, "z": -201},
                    "amperage": 30,
                    "circuit": "Utility & Energy Storage Battery System",
                    "room": "utility",
                    "scenario": 4
                },
                {
                    "num": 5,
                    "slot": "Left Row 3",
                    "terminal": {"x": 366, "y": 133, "z": -201},
                    "amperage": 20,
                    "circuit": "Kitchen Small Appliances & Island GFCI",
                    "room": "kitchen",
                    "scenario": 5
                },
                {
                    "num": 6,
                    "slot": "Right Row 3",
                    "terminal": {"x": 394, "y": 133, "z": -201},
                    "amperage": 50,
                    "circuit": "Garage 50A 240V Level-2 EV Fast Charger",
                    "room": "garage",
                    "scenario": 6
                },
                {
                    "num": 7,
                    "slot": "Left Row 4",
                    "terminal": {"x": 366, "y": 121, "z": -201},
                    "amperage": 20,
                    "circuit": "Bathroom Vanity GFCI & Exhaust Fan",
                    "room": "bathroom",
                    "scenario": 7
                },
                {
                    "num": 8,
                    "slot": "Right Row 4",
                    "terminal": {"x": 394, "y": 121, "z": -201},
                    "amperage": 15,
                    "circuit": "Home Office Tech Workstation Clean Power",
                    "room": "office",
                    "scenario": 8
                },
                {
                    "num": 9,
                    "slot": "Left Row 5",
                    "terminal": {"x": 366, "y": 109, "z": -201},
                    "amperage": 15,
                    "circuit": "Formal Dining Room Chandelier & Sconces",
                    "room": "dining",
                    "scenario": 9
                },
                {
                    "num": 10,
                    "slot": "Right Row 5",
                    "terminal": {"x": 394, "y": 109, "z": -201},
                    "amperage": 30,
                    "circuit": "Central HVAC Dedicated Air Handler",
                    "room": "utility",
                    "scenario": 10
                }
            ]
        }
    }

    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(blueprint, f, indent=2)

    print("==============================================================")
    print(f" SUCCESS! Generated Expansive 8-Room 3D Estate Cutaway Model:")
    print(f" -> OBJ: {obj_path} ({len(verts)} vertices, {len(objects)} objects)")
    print(f" -> MTL: {mtl_path} ({len(materials)} materials)")
    print(f" -> Blueprint Spec: {spec_path}")
    print("==============================================================")

if __name__ == "__main__":
    build_house()
