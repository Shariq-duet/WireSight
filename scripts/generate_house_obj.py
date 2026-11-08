"""
generate_house_obj.py
Creates an Architectural Cutaway 3D Interior Model (.obj + .mtl) for Snap Spectacles.

Layout:
- Left Room: Master Bedroom (King Bed, Headboard, 2 Nightstands, Lamps, Wardrobe)
- Center Room: Modern Living Room (65" TV, Media Console, 3-Seater Sofa, Coffee Table, Rug, Floor Lamp)
- Right Room: Electrical / MEP Utility Room with a FULL REALISTIC RESIDENTIAL BREAKER PANEL:
  * Open Hinged Cabinet Door with Inside Circuit Directory Index Schedule
  * Interior Galvanized Steel Deadfront Chassis
  * Top 200A Double-Pole Main Service Disconnect Switch
  * Dual-Column Branch Breakers:
    - B1 (Left Top): 20A Master Bedroom Outlets & Lights
    - B2 (Right Top): 15A Living Room 65" TV & Media Console
    - B3 (Left Middle): 15A Living Room Sofa & Floor Lamp Tap-In
    - B4 (Right Middle): 30A Utility & Battery Storage
    - B5-B8: Spare Breakers
  * Copper Bus Bars & Neutral Bars
  * Emergency Red Disconnect Switch, Smart Battery Powerwall, Transformer, and NEC Safety Floor Zone
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
        "Mat_Glass": {"Kd": "0.30 0.45 0.55", "Ks": "0.90 0.90 0.90", "Ns": "100", "d": "0.6"},
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
    }

    with open(mtl_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway Materials (With Detailed Breaker System)\n\n")
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
    # 3. ARCHITECTURE LAYOUT (10.0m W x 4.5m D x 2.4m H)
    # Zone 1: Master Bedroom (X: -450 to -75, Width 375cm)
    # Zone 2: Living Room (X: -75 to +300, Width 375cm)
    # Zone 3: Electrical / MEP Room (X: +300 to +550, Width 250cm)
    # =============================================================

    # Floor Slabs (Y: -6 to 0, Z: -225 to +225)
    add_box((-450, -6, -225), (-75, 0, 225), "Floor_Bedroom", "Mat_FloorBedroom")
    add_box((-75, -6, -225), (300, 0, 225), "Floor_Living", "Mat_FloorLiving")
    add_box((300, -6, -225), (550, 0, 225), "Floor_Electrical_Room", "Mat_FloorConcrete")

    # Electrical Room NEC 36-Inch Yellow Safety Zone
    add_box((330, 0, -225), (480, 1, -135), "SafetyZone_NEC_Clearance", "Mat_HazardYellow")

    # Perimeter Walls (Thickness 15cm, Height 240cm)
    add_box((-450, 0, -240), (-75, 240, -225), "Wall_Back_Bedroom_Accent", "Mat_AccentWall")
    add_box((-75, 0, -240), (300, 240, -225), "Wall_Back_Living_Accent", "Mat_AccentWall")
    add_box((300, 0, -240), (550, 240, -225), "Wall_Back_Electrical_Room", "Mat_IndustrialWall")
    add_box((-465, 0, -225), (-450, 240, 225), "Wall_Left_Bedroom", "Mat_Drywall")
    add_box((550, 0, -225), (565, 240, 225), "Wall_Right_Electrical_Room", "Mat_IndustrialWall")
    add_box((-450, 0, 225), (550, 15, 235), "Foundation_Front_Threshold", "Mat_Drywall")

    # Partition 1: Between Bedroom & Living Room (X: -82.5 to -67.5) with Walkthrough Doorway
    add_box((-82.5, 0, -225), (-67.5, 240, 20), "Wall_Partition_Bed_Living_Back", "Mat_Drywall")
    add_box((-82.5, 210, 20), (-67.5, 240, 115), "Wall_Door_Header_Bed_Living", "Mat_Drywall")
    add_box((-82.5, 0, 115), (-67.5, 240, 225), "Wall_Partition_Bed_Living_Front", "Mat_Drywall")

    # Partition 2: Between Living Room & Electrical Room (X: 292.5 to 307.5) with Fire Doorway
    add_box((292.5, 0, -225), (307.5, 240, -10), "Wall_Partition_Living_Elec_Back", "Mat_Drywall")
    add_box((292.5, 210, -10), (307.5, 240, 80), "Wall_Door_Header_Living_Elec", "Mat_Drywall")
    add_box((292.5, 0, 80), (307.5, 240, 225), "Wall_Partition_Living_Elec_Front", "Mat_Drywall")

    # =============================================================
    # 4. BEDROOM FURNITURE (LEFT ROOM)
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
    # 5. LIVING ROOM FURNITURE (CENTER ROOM)
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
    # 6. ELECTRICAL ROOM: REALISTIC RESIDENTIAL BREAKER PANEL SYSTEM
    # Centered at X = 380, Y = 140, Z = -225 on Back Wall
    # =============================================================

    # A. Panel Back Box (Enclosure Cabinet: 65cm wide, 95cm high, 15cm deep)
    # Box spans X: 347.5 to 412.5, Y: 95 to 190, Z: -225 to -210
    add_box((347.5, 95, -225), (412.5, 190, -210), "Panel_Enclosure_Cabinet", "Mat_PanelCabinet")

    # B. Open Hinged Door (Swung open forward 85° to the left so interior is fully exposed)
    # Door attached at X = 347.5, extends forward to Z = -150
    add_box((345.5, 95, -210), (347.5, 190, -150), "Panel_Hinged_Door_Open", "Mat_PanelCabinet")
    # Circuit Directory Schedule glued on the inside face of the open door
    add_box((347.6, 115, -200), (348.0, 175, -160), "Panel_Circuit_Directory_Index", "Mat_CircuitDirectory")

    # C. Interior Steel Deadfront Chassis (Galvanized faceplate with breaker rows)
    add_box((352.5, 100, -210), (407.5, 185, -207), "Panel_Interior_Deadfront", "Mat_PanelChassis")

    # D. Top Main 200A Service Breaker (Double-Pole Master Disconnect)
    # Centered at X = 380, Y: 170 to 180, Z: -207 to -202
    add_box((372.0, 170, -207), (388.0, 180, -203), "Breaker_200A_Main_Case", "Mat_BreakerBlack")
    add_box((376.0, 173, -203), (384.0, 177, -199), "Breaker_200A_Main_Handle", "Mat_MainBreakerRed")

    # E. Dual-Column Branch Circuit Breakers:
    # -------------------------------------------------------------
    # LEFT COLUMN (X: 356 to 376):
    # Breaker 1: Master Bedroom (20A) - Controls Scenario 1 Circuit
    add_box((356.0, 153, -207), (376.0, 161, -203), "Breaker_1_Case_MasterBed", "Mat_BreakerBlack")
    add_box((370.0, 155, -203), (375.0, 159, -200), "Breaker_1_Handle_20A", "Mat_BreakerHandle")

    # Breaker 3: Living Room Sofa & Floor Lamp (15A) - Controls Scenario 3
    add_box((356.0, 141, -207), (376.0, 149, -203), "Breaker_3_Case_SofaBranch", "Mat_BreakerBlack")
    add_box((370.0, 143, -203), (375.0, 147, -200), "Breaker_3_Handle_15A", "Mat_BreakerHandle")

    # Breaker 5: Spare Circuit
    add_box((356.0, 129, -207), (376.0, 137, -203), "Breaker_5_Case_Spare", "Mat_BreakerBlack")
    add_box((370.0, 131, -203), (375.0, 135, -200), "Breaker_5_Handle_15A", "Mat_BreakerHandle")

    # Breaker 7: Spare Circuit
    add_box((356.0, 117, -207), (376.0, 125, -203), "Breaker_7_Case_Spare", "Mat_BreakerBlack")
    add_box((370.0, 119, -203), (375.0, 123, -200), "Breaker_7_Handle_15A", "Mat_BreakerHandle")

    # -------------------------------------------------------------
    # RIGHT COLUMN (X: 384 to 404):
    # Breaker 2: Living Room 65" TV & Media Console (15A) - Controls Scenario 2
    add_box((384.0, 153, -207), (404.0, 161, -203), "Breaker_2_Case_LivingTV", "Mat_BreakerBlack")
    add_box((385.0, 155, -203), (390.0, 159, -200), "Breaker_2_Handle_15A", "Mat_BreakerHandle")

    # Breaker 4: Utility & Battery Storage (30A) - Controls Scenario 4
    add_box((384.0, 141, -207), (404.0, 149, -203), "Breaker_4_Case_Utility", "Mat_BreakerBlack")
    add_box((385.0, 143, -203), (390.0, 147, -200), "Breaker_4_Handle_30A", "Mat_BreakerHandle")

    # Breaker 6: Spare Circuit
    add_box((384.0, 129, -207), (404.0, 137, -203), "Breaker_6_Case_Spare", "Mat_BreakerBlack")
    add_box((385.0, 131, -203), (390.0, 135, -200), "Breaker_6_Handle_15A", "Mat_BreakerHandle")

    # Breaker 8: Spare Circuit
    add_box((384.0, 117, -207), (404.0, 125, -203), "Breaker_8_Case_Spare", "Mat_BreakerBlack")
    add_box((385.0, 119, -203), (390.0, 123, -200), "Breaker_8_Handle_15A", "Mat_BreakerHandle")

    # F. Copper Neutral & Ground Bus Bars
    add_box((350.0, 110, -209), (352.0, 170, -207), "Panel_Neutral_Bus_Bar", "Mat_CopperBus")
    add_box((408.0, 110, -209), (410.0, 170, -207), "Panel_Ground_Bus_Bar", "Mat_CopperBus")

    # G. Other Electrical Room Equipment:
    # Heavy-Duty Emergency Disconnect Box & Big Red Lever
    add_box((435, 115, -225), (470, 165, -210), "Electrical_Emergency_Disconnect_Box", "Mat_PanelCabinet")
    add_box((462, 130, -210), (478, 150, -202), "Electrical_Emergency_Red_Lever", "Mat_SafetyRed")

    # Smart Energy Storage Battery (Powerwall) with Active Green LED strip
    add_box((535, 35, -160), (550, 185, -40), "Electrical_Smart_Battery_Powerwall", "Mat_Powerwall")
    add_box((534, 165, -150), (535, 170, -50), "Electrical_Battery_Status_LED", "Mat_LedGreen")

    # Step-Down Transformer
    add_box((460, 0, 110), (535, 95, 185), "Electrical_Transformer_Unit", "Mat_TransformerSteel")
    add_box((458, 20, 125), (460, 80, 170), "Electrical_Transformer_CoolingFins", "Mat_PanelCabinet")

    # Overhead Conduit Trunk Rack & Service Feeder Riser
    add_box((330, 220, -218), (480, 226, -212), "Electrical_Conduit_Trunk_Header", "Mat_ConduitMetallic")
    add_box((375, 0, -220), (385, 95, -212), "Electrical_Feeder_Riser_Pipe", "Mat_ConduitMetallic")

    # Fire Extinguisher
    add_box((320, 85, -5), (335, 140, 10), "Safety_Fire_Extinguisher_Tank", "Mat_SafetyRed")
    add_box((324, 140, -1), (331, 150, 6), "Safety_Fire_Extinguisher_Valve", "Mat_BrassLamp")

    # =============================================================
    # 7. WRITE OUT OBJ FILE
    # =============================================================
    with open(obj_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway 3D Model with Detailed Breaker Panel\n")
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
    # 8. EXPORT MEP BLUEPRINT SPECIFICATION WITH EXACT BREAKER TERMINALS
    # =============================================================
    blueprint = {
        "house_dimensions_cm": {"width": 1000, "depth": 450, "height": 240},
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
                }
            ]
        }
    }

    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(blueprint, f, indent=2)

    print("==============================================================")
    print(f" SUCCESS! Generated 3D House with Realistic Breaker System:")
    print(f" -> OBJ: {obj_path} ({len(verts)} vertices, {len(objects)} objects)")
    print(f" -> MTL: {mtl_path} ({len(materials)} materials)")
    print(f" -> Blueprint Spec: {spec_path}")
    print("==============================================================")

if __name__ == "__main__":
    build_house()
