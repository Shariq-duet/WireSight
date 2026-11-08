"""
generate_house_obj.py
Creates an Architectural Cutaway 3D Interior Model (.obj + .mtl) for Snap Spectacles.

Layout (3 Distinct Functional Zones):
1. Left Room: Master Bedroom (King Bed, Headboard, Duvet, 2 Nightstands, Lamps, Wardrobe)
2. Center Room: Modern Living Room (65" TV, Media Console, 3-Seater Sofa, Coffee Table, Rug, Floor Lamp)
3. Right Room: Electrical / MEP Utility Room (200A Main Service Panel, Sub-Panel, Emergency Red Disconnect,
   Smart Energy Storage Battery/Inverter, Step-Down Transformer, NEC 36" Yellow Safety Floor Zone,
   Overhead Conduit Trunking, Fire Extinguisher)
- Connectors: Framed interior doorways between all rooms for seamless AR walk-through
- Dimensions: 10.0m total width (X: -450 to +550), 4.5m depth (Z: -225 to +225), 2.4m standard wall height
- Open-top cutaway view: Designed for zero clipping & in-wall MEP wiring inspection on Snap Spectacles
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
        "Mat_PanelMetal": {"Kd": "0.30 0.33 0.36", "Ks": "0.40 0.40 0.42", "Ns": "50"},
        "Mat_SafetyRed": {"Kd": "0.88 0.15 0.15", "Ks": "0.30 0.30 0.30", "Ns": "40"},
        "Mat_Powerwall": {"Kd": "0.92 0.93 0.95", "Ks": "0.50 0.50 0.50", "Ns": "80"},
        "Mat_LedGreen": {"Kd": "0.10 0.95 0.30", "Ks": "0.80 0.80 0.80", "Ns": "100"},
        "Mat_TransformerSteel": {"Kd": "0.20 0.22 0.24", "Ks": "0.35 0.35 0.35", "Ns": "45"},
        "Mat_ConduitMetallic": {"Kd": "0.75 0.78 0.82", "Ks": "0.70 0.70 0.75", "Ns": "85"},
    }

    with open(mtl_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway Materials (3-Room Multi-Zone)\n\n")
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

    # Electrical Room NEC 36-Inch Yellow/Black Safety Zone in front of Panel
    add_box((330, 0, -225), (480, 1, -135), "SafetyZone_NEC_Clearance", "Mat_HazardYellow")

    # Perimeter Walls (Thickness 15cm, Height 240cm)
    # Back Wall (-Z): X: -450 to +550, Z: -240 to -225
    add_box((-450, 0, -240), (-75, 240, -225), "Wall_Back_Bedroom_Accent", "Mat_AccentWall")
    add_box((-75, 0, -240), (300, 240, -225), "Wall_Back_Living_Accent", "Mat_AccentWall")
    add_box((300, 0, -240), (550, 240, -225), "Wall_Back_Electrical_Room", "Mat_IndustrialWall")

    # Left Wall (-X): X: -465 to -450, Z: -225 to +225
    add_box((-465, 0, -225), (-450, 240, 225), "Wall_Left_Bedroom", "Mat_Drywall")

    # Right Wall (+X): X: +550 to +565, Z: -225 to +225
    add_box((550, 0, -225), (565, 240, 225), "Wall_Right_Electrical_Room", "Mat_IndustrialWall")

    # Low Front Threshold (Z: 225 to 235, Height 15cm - architectural border)
    add_box((-450, 0, 225), (550, 15, 235), "Foundation_Front_Threshold", "Mat_Drywall")

    # Partition 1: Between Bedroom & Living Room (X: -82.5 to -67.5, Width 15cm)
    # Doorway: Z: 20cm to 115cm (95cm wide, 210cm high)
    add_box((-82.5, 0, -225), (-67.5, 240, 20), "Wall_Partition_Bed_Living_Back", "Mat_Drywall")
    add_box((-82.5, 210, 20), (-67.5, 240, 115), "Wall_Door_Header_Bed_Living", "Mat_Drywall")
    add_box((-82.5, 0, 115), (-67.5, 240, 225), "Wall_Partition_Bed_Living_Front", "Mat_Drywall")

    # Partition 2: Between Living Room & Electrical Room (X: 292.5 to 307.5, Width 15cm)
    # Fire-Rated Utility Doorway: Z: -10cm to 80cm (90cm wide, 210cm high)
    add_box((292.5, 0, -225), (307.5, 240, -10), "Wall_Partition_Living_Elec_Back", "Mat_Drywall")
    add_box((292.5, 210, -10), (307.5, 240, 80), "Wall_Door_Header_Living_Elec", "Mat_Drywall")
    add_box((292.5, 0, 80), (307.5, 240, 225), "Wall_Partition_Living_Elec_Front", "Mat_Drywall")

    # =============================================================
    # 4. BEDROOM FURNITURE (LEFT ROOM, X: -450 to -75, Center X = -262.5)
    # =============================================================
    # King Bed (Centered at X = -262.5, Back at Z = -220)
    add_box((-357.5, 0, -220), (-167.5, 25, -20), "Bed_Frame", "Mat_WoodWalnut")
    add_box((-367.5, 0, -225), (-157.5, 115, -215), "Bed_Headboard", "Mat_WoodWalnut")
    add_box((-352.5, 25, -215), (-172.5, 55, -25), "Bed_Mattress", "Mat_BedLinen")
    add_box((-355.5, 25, -155), (-169.5, 58, -23), "Bed_Duvet", "Mat_DuvetNavy")
    add_box((-337.5, 55, -210), (-277.5, 68, -170), "Bed_Pillow_Left", "Mat_Pillow")
    add_box((-247.5, 55, -210), (-187.5, 68, -170), "Bed_Pillow_Right", "Mat_Pillow")

    # Left Nightstand & Lamp
    add_box((-427.5, 0, -220), (-377.5, 52, -175), "Nightstand_Left", "Mat_WoodWalnut")
    add_box((-407.5, 52, -202), (-397.5, 55, -192), "Lamp_Left_Base", "Mat_BrassLamp")
    add_box((-404.5, 55, -199), (-400.5, 75, -195), "Lamp_Left_Stem", "Mat_BrassLamp")
    add_box((-412.5, 75, -207), (-392.5, 92, -187), "Lamp_Left_Shade", "Mat_LampShade")

    # Right Nightstand & Lamp
    add_box((-147.5, 0, -220), (-97.5, 52, -175), "Nightstand_Right", "Mat_WoodWalnut")
    add_box((-127.5, 52, -202), (-117.5, 55, -192), "Lamp_Right_Base", "Mat_BrassLamp")
    add_box((-124.5, 55, -199), (-120.5, 75, -195), "Lamp_Right_Stem", "Mat_BrassLamp")
    add_box((-132.5, 75, -207), (-112.5, 92, -187), "Lamp_Right_Shade", "Mat_LampShade")

    # Wardrobe along Left Wall
    add_box((-450, 0, -10), (-390, 215, 170), "Bedroom_Wardrobe", "Mat_WoodWalnut")

    # =============================================================
    # 5. LIVING ROOM FURNITURE (CENTER ROOM, X: -75 to +300, Center X = 112.5)
    # =============================================================
    # Media Console (Centered at X = 112.5, Z = -225 to -180)
    add_box((22.5, 0, -225), (202.5, 48, -180), "TV_Media_Console", "Mat_WoodWalnut")

    # Wall-Mounted 65" TV
    add_box((37.5, 90, -225), (187.5, 175, -221), "TV_Bezel_Frame", "Mat_TVBezel")
    add_box((39.5, 92, -221), (185.5, 173, -220), "TV_Screen_Display", "Mat_TVScreen")

    # Modern Area Rug
    add_box((-12.5, 0, -150), (237.5, 2, 90), "Living_Room_Rug", "Mat_Rug")

    # 3-Seater Charcoal Sofa
    add_box((2.5, 0, -10), (222.5, 42, 75), "Sofa_Seat_Base", "Mat_SofaCharcoal")
    add_box((2.5, 42, 55), (222.5, 80, 75), "Sofa_Backrest", "Mat_SofaCharcoal")
    add_box((2.5, 42, -10), (22.5, 62, 75), "Sofa_Armrest_Left", "Mat_SofaCharcoal")
    add_box((202.5, 42, -10), (222.5, 62, 75), "Sofa_Armrest_Right", "Mat_SofaCharcoal")

    # Coffee Table
    add_box((57.5, 0, -115), (67.5, 38, -105), "CoffeeTable_Leg_1", "Mat_WoodWalnut")
    add_box((157.5, 0, -115), (167.5, 38, -105), "CoffeeTable_Leg_2", "Mat_WoodWalnut")
    add_box((57.5, 0, -75), (67.5, 38, -65), "CoffeeTable_Leg_3", "Mat_WoodWalnut")
    add_box((157.5, 0, -75), (167.5, 38, -65), "CoffeeTable_Leg_4", "Mat_WoodWalnut")
    add_box((52.5, 38, -120), (172.5, 42, -60), "CoffeeTable_GlassTop", "Mat_Glass")

    # Standing Floor Lamp in Corner
    add_box((260, 0, -210), (280, 4, -190), "FloorLamp_Base", "Mat_BrassLamp")
    add_box((268, 4, -202), (272, 155, -198), "FloorLamp_Pole", "Mat_BrassLamp")
    add_box((255, 155, -215), (285, 185, -185), "FloorLamp_Shade", "Mat_LampShade")

    # =============================================================
    # 6. ELECTRICAL & MEP UTILITY ROOM (RIGHT ROOM, X: 300 to 550)
    # Designed for Scenarios: Main Service, Breakers, Emergency Shutoff,
    # Battery Backup Inverter, Step-Down Transformer & Overhead Trunks
    # =============================================================

    # 1. Main 200A Service Distribution Center (Back Wall: X = 340 to 420, Y: 90 to 190, Z: -225 to -205)
    add_box((340, 90, -225), (420, 190, -205), "Electrical_200A_Main_Panel", "Mat_PanelMetal")
    # Panel Door Seam & Latch
    add_box((410, 135, -205), (418, 145, -202), "Electrical_Panel_Handle", "Mat_BrassLamp")

    # 2. Industrial Emergency Main Disconnect Red Switch Box (Next to Panel: X = 435 to 470, Y: 115 to 165)
    add_box((435, 115, -225), (470, 165, -210), "Electrical_Emergency_Disconnect_Box", "Mat_PanelMetal")
    # Big Red Disconnect Pull Lever (Heavy Duty)
    add_box((462, 130, -210), (478, 150, -202), "Electrical_Emergency_Red_Lever", "Mat_SafetyRed")

    # 3. Smart Home Battery Storage / Solar Inverter (Mounted on Right Wall: X = 535 to 550, Z = -160 to -40, Y = 35 to 185)
    # Sleek Powerwall unit with status LED strip
    add_box((535, 35, -160), (550, 185, -40), "Electrical_Smart_Battery_Powerwall", "Mat_Powerwall")
    # Glowing Active Green Status Indicator Bar
    add_box((534, 165, -150), (535, 170, -50), "Electrical_Battery_Status_LED", "Mat_LedGreen")

    # 4. Floor-Mounted Step-Down Transformer / AC Distribution Hub (Corner: X = 460 to 535, Z = 110 to 185, Y: 0 to 95)
    add_box((460, 0, 110), (535, 95, 185), "Electrical_Transformer_Unit", "Mat_TransformerSteel")
    # Transformer Cooling Fin Grids
    add_box((458, 20, 125), (460, 80, 170), "Electrical_Transformer_CoolingFins", "Mat_PanelMetal")

    # 5. Overhead Rigid Metallic Conduit Trunk Racks (Runs along ceiling at Y = 220cm from Electrical Panel through to Living Room)
    add_box((330, 220, -218), (480, 226, -212), "Electrical_Conduit_Trunk_Header", "Mat_ConduitMetallic")
    # Vertical Service Feeder Riser (From Floor into Main 200A Panel)
    add_box((375, 0, -220), (385, 90, -212), "Electrical_Feeder_Riser_Pipe", "Mat_ConduitMetallic")

    # 6. Wall-Mounted Safety Fire Extinguisher (Mounted beside utility door: X = 320 to 335, Y: 85 to 145, Z = -5 to 15)
    add_box((320, 85, -5), (335, 140, 10), "Safety_Fire_Extinguisher_Tank", "Mat_SafetyRed")
    add_box((324, 140, -1), (331, 150, 6), "Safety_Fire_Extinguisher_Valve", "Mat_BrassLamp")

    # =============================================================
    # 7. WRITE OBJ FILE
    # =============================================================
    with open(obj_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway 3D Model (3-Room Multi-Zone)\n")
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
    # 8. EXPORT MEP BLUEPRINT SPECIFICATION WITH SCENARIOS
    # =============================================================
    blueprint = {
        "house_dimensions_cm": {"width": 1000, "depth": 450, "height": 240},
        "rooms": {
            "bedroom": {
                "name": "Master Bedroom",
                "bounds": {"x_min": -450, "x_max": -75, "z_min": -225, "z_max": 225},
                "accent_wall": {"x_center": -262.5, "y": 120, "z": -225, "normal": [0, 0, 1]},
                "left_wall": {"x": -450, "y": 120, "z_center": 0, "normal": [1, 0, 0]},
                "partition_wall": {"x": -75, "y": 120, "z_center": -102.5, "normal": [-1, 0, 0]}
            },
            "living_room": {
                "name": "Living Room",
                "bounds": {"x_min": -75, "x_max": 300, "z_min": -225, "z_max": 225},
                "tv_wall": {"x_center": 112.5, "y": 120, "z": -225, "normal": [0, 0, 1]},
                "partition_bedroom": {"x": -75, "y": 120, "z_center": -102.5, "normal": [1, 0, 0]},
                "partition_electrical": {"x": 300, "y": 120, "z_center": -117.5, "normal": [-1, 0, 0]}
            },
            "electrical_room": {
                "name": "Electrical & MEP Utility Room",
                "bounds": {"x_min": 300, "x_max": 550, "z_min": -225, "z_max": 225},
                "service_wall": {"x_center": 425, "y": 120, "z": -225, "normal": [0, 0, 1]},
                "right_wall": {"x": 550, "y": 120, "z_center": 0, "normal": [-1, 0, 0]},
                "partition_wall": {"x": 300, "y": 120, "z_center": -117.5, "normal": [1, 0, 0]},
                "nec_safety_clearance_depth_cm": 90
            }
        },
        "doorways": [
            {
                "name": "Bedroom to Living Room Passage",
                "position": {"x": -75, "y_floor": 0, "z_start": 20, "z_end": 115},
                "width_cm": 95,
                "height_cm": 210
            },
            {
                "name": "Living Room to Electrical Room Fire Door",
                "position": {"x": 300, "y_floor": 0, "z_start": -10, "z_end": 80},
                "width_cm": 90,
                "height_cm": 210
            }
        ],
        "planned_mep_nodes": {
            "main_service_drop": {"x": 380, "y": 0, "z": -216, "description": "Underground 200A Utility Service Entrance Riser"},
            "main_breaker_panel": {"x": 380, "y": 140, "z": -205, "description": "200A 42-Circuit Main Distribution Load Center"},
            "emergency_disconnect_switch": {"x": 452.5, "y": 140, "z": -205, "description": "Heavy-Duty Red Safety Knife Disconnect Switch"},
            "battery_storage_powerwall": {"x": 542.5, "y": 110, "z": -100, "description": "13.5 kWh Lithium-Ion Energy Storage Battery"},
            "transformer_step_down": {"x": 497.5, "y": 47.5, "z": 147.5, "description": "480V to 120/240V Step-Down Transformer"},
            "fire_extinguisher": {"x": 327.5, "y": 112.5, "z": 2.5, "description": "Class C Electrical Safety Fire Extinguisher"},
            "conduit_trunk_junction": {"x": 300, "y": 223, "z": -215, "description": "High-Capacity Ceiling Feeder Penetration through Living Wall"},
            "living_tv_quad_outlet": {"x": 112.5, "y": 110, "z": -223, "description": "Quad 120V 20A Surge Receptacle for 65in TV"},
            "living_console_outlet": {"x": 50, "y": 40, "z": -223, "description": "120V 20A Duplex Receptacle for Media Console"},
            "living_sofa_outlet": {"x": 290, "y": 40, "z": 30, "description": "120V 15A Convenience Receptacle by Sofa"},
            "living_floor_lamp_switch": {"x": 285, "y": 120, "z": -15, "description": "Switched Circuit for Living Room Corner Lamp"},
            "bedroom_outlet_left": {"x": -402.5, "y": 40, "z": -223, "description": "120V 15A Duplex Receptacle (Nightstand Left)"},
            "bedroom_outlet_right": {"x": -122.5, "y": 40, "z": -223, "description": "120V 15A Duplex Receptacle (Nightstand Right)"},
            "bedroom_light_switch": {"x": -85, "y": 120, "z": 15, "description": "Single-Pole Switch by Bedroom Doorway"}
        },
        "interactive_scenarios": [
            {
                "id": "scenario_main_trip",
                "title": "Grid Power Outage & Main Breaker Trip",
                "trigger_node": "main_breaker_panel",
                "action": "Trip 200A Main Handle",
                "effect": "De-energizes all circuits across Bedroom & Living Room; Emergency Battery kicks in"
            },
            {
                "id": "scenario_emergency_shutoff",
                "title": "Hazard Lockout / Tagout (LOTO)",
                "trigger_node": "emergency_disconnect_switch",
                "action": "Pull Red Safety Disconnect Lever",
                "effect": "Instant mechanical isolation of all high-voltage feeders with safety warning"
            },
            {
                "id": "scenario_battery_backup",
                "title": "Solar & Battery Islanding",
                "trigger_node": "battery_storage_powerwall",
                "action": "Toggle Grid Island Mode",
                "effect": "Maintains critical loads (TV, Bedroom outlets) via green indicator flow"
            },
            {
                "id": "scenario_conduit_xray_trace",
                "title": "Source-to-Load In-Wall X-Ray Tracing",
                "trigger_node": "conduit_trunk_junction",
                "action": "Gaze/Pinch Overhead Trunk Line",
                "effect": "Illuminates full copper path from 200A panel, through studs, directly to the 65in TV"
            }
        ]
    }

    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(blueprint, f, indent=2)

    print("==============================================================")
    print(f" SUCCESS! Generated 3-Zone Architectural Cutaway House:")
    print(f" -> OBJ: {obj_path} ({len(verts)} vertices, {len(objects)} objects)")
    print(f" -> MTL: {mtl_path} ({len(materials)} materials)")
    print(f" -> MEP Blueprint & Scenarios: {spec_path}")
    print("==============================================================")

if __name__ == "__main__":
    build_house()
