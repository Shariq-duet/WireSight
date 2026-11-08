"""
generate_house_obj.py
Creates an Architectural Cutaway 3D Interior Model (.obj + .mtl) for Snap Spectacles.

Layout:
- Left Room: Master Bedroom (King Bed, Pillows, Duvet, 2 Nightstands, Lamps, Wardrobe)
- Right Room: Living Room (Modern Sofa, Coffee Table, Media Console, 65" TV, Area Rug, Floor Lamp)
- Center: 15cm Interior Partition Wall with a framed 90cm x 210cm Walkthrough Doorway
- Dimensions: 8.0m wide (X: -400 to +400), 5.0m deep (Z: -250 to +250), 2.4m wall height
- Open-top / Cutaway ceiling: Perfect for Spectacles spatial inspection & in-wall MEP wiring
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
        "Mat_FloorBedroom": {"Kd": "0.72 0.54 0.38", "Ks": "0.12 0.12 0.12", "Ns": "30"},
        "Mat_FloorLiving": {"Kd": "0.80 0.65 0.48", "Ks": "0.15 0.15 0.15", "Ns": "35"},
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
    }

    with open(mtl_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway Materials\n\n")
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
    objects = [] # (obj_name, mat_name, [faces])

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

    def add_cylinder(center_bottom, radius, height, sides, obj_name, mat_name):
        bx, by, bz = center_bottom
        top_y = by + height
        base_v = len(verts) + 1
        bot_idx = []
        top_idx = []
        for i in range(sides):
            angle = 2.0 * math.pi * i / sides
            vx = bx + radius * math.cos(angle)
            vz = bz + radius * math.sin(angle)
            verts.append((vx, by, vz))
            bot_idx.append(base_v + i * 2)
            verts.append((vx, top_y, vz))
            top_idx.append(base_v + i * 2 + 1)

        faces = []
        for i in range(sides):
            next_i = (i + 1) % sides
            b1 = bot_idx[i]
            t1 = top_idx[i]
            b2 = bot_idx[next_i]
            t2 = top_idx[next_i]
            faces.append((b1, t1, t2, b2, 3)) # side quad
        objects.append((obj_name, mat_name, faces))

    # =============================================================
    # 3. ARCHITECTURE LAYOUT
    # Total Width: 800cm (X: -400 to +400)
    # Total Depth: 500cm (Z: -250 to +250)
    # Height: 240cm (Standard 8ft residential)
    # =============================================================

    # Floor Slabs (Y: -6 to 0)
    add_box((-400, -6, -250), (0, 0, 250), "Floor_Bedroom", "Mat_FloorBedroom")
    add_box((0, -6, -250), (400, 0, 250), "Floor_Living", "Mat_FloorLiving")

    # Perimeter Walls (Thickness 15cm, Height 240cm)
    # Back Accent Wall (-Z): X: -400 to +400, Z: -265 to -250
    add_box((-400, 0, -265), (0, 240, -250), "Wall_Back_Bedroom_Accent", "Mat_AccentWall")
    add_box((0, 0, -265), (400, 240, -250), "Wall_Back_Living_Accent", "Mat_AccentWall")

    # Left Wall (-X): X: -415 to -400, Z: -250 to +250
    add_box((-415, 0, -250), (-400, 240, 250), "Wall_Left_Bedroom", "Mat_Drywall")

    # Right Wall (+X): X: +400 to +415, Z: -250 to +250
    add_box((400, 0, -250), (415, 240, 250), "Wall_Right_Living", "Mat_Drywall")

    # Low Front Cutaway Threshold (Z: 250 to 260, Height 15cm - architectural boundary)
    add_box((-400, 0, 250), (400, 15, 260), "Foundation_Front_Threshold", "Mat_Drywall")

    # Center Partition Wall (X: -7.5 to +7.5) with Doorway between Bedroom & Living Room
    # Doorway: Z: 20cm to 115cm (95cm wide, 210cm high)
    # Segment 1: Back to Door (Z: -250 to 20, Length 270cm, Full Height 240cm)
    add_box((-7.5, 0, -250), (7.5, 240, 20), "Wall_Center_Partition_Back", "Mat_Drywall")
    # Segment 2: Door Header / Lintel (Z: 20 to 115, Y: 210 to 240cm)
    add_box((-7.5, 210, 20), (7.5, 240, 115), "Wall_Center_Door_Header", "Mat_Drywall")
    # Segment 3: Door to Front (Z: 115 to 250, Length 135cm, Full Height 240cm)
    add_box((-7.5, 0, 115), (7.5, 240, 250), "Wall_Center_Partition_Front", "Mat_Drywall")

    # =============================================================
    # 4. BEDROOM FURNITURE (LEFT ROOM, X: -400 to 0)
    # =============================================================
    # King Bed (Centered at X = -200, Back at Z = -245)
    # Bed Frame / Base (X: -295 to -105, Width 190cm; Z: -245 to -45, Length 200cm; Y: 0 to 25)
    add_box((-295, 0, -245), (-105, 25, -45), "Bed_Frame", "Mat_WoodWalnut")
    
    # Headboard (X: -305 to -95, Width 210cm; Z: -250 to -240, Thick 10cm; Y: 0 to 115, Height 115cm)
    add_box((-305, 0, -250), (-95, 115, -240), "Bed_Headboard", "Mat_WoodWalnut")

    # Mattress (X: -290 to -110, Width 180cm; Z: -240 to -50, Length 190cm; Y: 25 to 55)
    add_box((-290, 25, -240), (-110, 55, -50), "Bed_Mattress", "Mat_BedLinen")

    # Duvet Comforter (Drapes over bottom 2/3 of mattress: Z: -180 to -48, Y: 25 to 58)
    add_box((-293, 25, -180), (-107, 58, -48), "Bed_Duvet", "Mat_DuvetNavy")

    # Pillows (Left: X: -275 to -215; Right: X: -185 to -125; Z: -235 to -195; Y: 55 to 68)
    add_box((-275, 55, -235), (-215, 68, -195), "Bed_Pillow_Left", "Mat_Pillow")
    add_box((-185, 55, -235), (-125, 68, -195), "Bed_Pillow_Right", "Mat_Pillow")

    # Left Nightstand (X: -365 to -315, Width 50cm; Z: -245 to -200, Depth 45cm; Y: 0 to 52)
    add_box((-365, 0, -245), (-315, 52, -200), "Nightstand_Left", "Mat_WoodWalnut")
    # Left Lamp: Base + Stem + Shade
    add_box((-345, 52, -227), (-335, 55, -217), "Lamp_Left_Base", "Mat_BrassLamp")
    add_box((-342, 55, -224), (-338, 75, -220), "Lamp_Left_Stem", "Mat_BrassLamp")
    add_box((-350, 75, -232), (-330, 92, -212), "Lamp_Left_Shade", "Mat_LampShade")

    # Right Nightstand (X: -85 to -35, Width 50cm; Z: -245 to -200, Depth 45cm; Y: 0 to 52)
    add_box((-85, 0, -245), (-35, 52, -200), "Nightstand_Right", "Mat_WoodWalnut")
    # Right Lamp: Base + Stem + Shade
    add_box((-65, 52, -227), (-55, 55, -217), "Lamp_Right_Base", "Mat_BrassLamp")
    add_box((-62, 55, -224), (-58, 75, -220), "Lamp_Right_Stem", "Mat_BrassLamp")
    add_box((-70, 75, -232), (-50, 92, -212), "Lamp_Right_Shade", "Mat_LampShade")

    # Wardrobe / Closet on Bedroom Left Wall (X: -400 to -340, Z: -20 to 160, Y: 0 to 215)
    add_box((-400, 0, -20), (-340, 215, 160), "Bedroom_Wardrobe", "Mat_WoodWalnut")

    # =============================================================
    # 5. LIVING ROOM FURNITURE (RIGHT ROOM, X: 0 to +400)
    # =============================================================
    # Media TV Console (Centered at X = 200 along Back Accent Wall: Z = -250 to -205)
    add_box((110, 0, -250), (290, 48, -205), "TV_Media_Console", "Mat_WoodWalnut")

    # Wall-Mounted 65" 4K Smart TV (Centered at X = 200, Y: 90 to 175, Mounted at Z = -249)
    # Bezel Frame: Width 150cm (X: 125 to 275), Height 85cm (Y: 90 to 175), Depth 4cm (Z: -250 to -246)
    add_box((125, 90, -250), (275, 175, -246), "TV_Bezel_Frame", "Mat_TVBezel")
    # Screen Glass: Inset 2cm
    add_box((127, 92, -246), (273, 173, -245), "TV_Screen_Display", "Mat_TVScreen")

    # Modern Plush Area Rug (X: 75 to 325, Width 250cm; Z: -175 to 65, Depth 240cm; Y: 0 to 2)
    add_box((75, 0, -175), (325, 2, 65), "Living_Room_Rug", "Mat_Rug")

    # Modern 3-Seater Sofa (Facing TV, Centered at X = 200, Z: -35 to 55)
    # Base Seat: Width 220cm (X: 90 to 310); Depth 85cm (Z: -30 to 55); Height 42cm
    add_box((90, 0, -30), (310, 42, 55), "Sofa_Seat_Base", "Mat_SofaCharcoal")
    # Backrest Cushion: Height 80cm (Y: 42 to 80); Depth 20cm (Z: 35 to 55)
    add_box((90, 42, 35), (310, 80, 55), "Sofa_Backrest", "Mat_SofaCharcoal")
    # Left Armrest (X: 90 to 110, Y: 42 to 62, Z: -30 to 55)
    add_box((90, 42, -30), (110, 62, 55), "Sofa_Armrest_Left", "Mat_SofaCharcoal")
    # Right Armrest (X: 290 to 310, Y: 42 to 62, Z: -30 to 55)
    add_box((290, 42, -30), (310, 62, 55), "Sofa_Armrest_Right", "Mat_SofaCharcoal")

    # Coffee Table (Centered between TV and Sofa at X = 200, Z: -140 to -80)
    # Legs (4 walnut posts)
    add_box((145, 0, -135), (155, 38, -125), "CoffeeTable_Leg_1", "Mat_WoodWalnut")
    add_box((245, 0, -135), (255, 38, -125), "CoffeeTable_Leg_2", "Mat_WoodWalnut")
    add_box((145, 0, -95), (155, 38, -85), "CoffeeTable_Leg_3", "Mat_WoodWalnut")
    add_box((245, 0, -95), (255, 38, -85), "CoffeeTable_Leg_4", "Mat_WoodWalnut")
    # Glass Tabletop (Width 120cm: X: 140 to 260; Depth 60cm: Z: -140 to -80; Y: 38 to 42)
    add_box((140, 38, -140), (260, 42, -80), "CoffeeTable_GlassTop", "Mat_Glass")

    # Standing Floor Lamp in Back Right Corner (X = 355, Z = -220)
    add_box((345, 0, -230), (365, 4, -210), "FloorLamp_Base", "Mat_BrassLamp")
    add_box((353, 4, -222), (357, 155, -218), "FloorLamp_Pole", "Mat_BrassLamp")
    add_box((340, 155, -235), (370, 185, -205), "FloorLamp_Shade", "Mat_LampShade")

    # =============================================================
    # 6. WRITE OUT OBJ FILE
    # =============================================================
    with open(obj_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway 3D Model\n")
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
    # 7. EXPORT MEP BLUEPRINT COORDINATE SPECIFICATION
    # Exactly maps every wall, outlet, switch, and breaker location
    # =============================================================
    blueprint = {
        "house_dimensions_cm": {"width": 800, "depth": 500, "height": 240},
        "rooms": {
            "bedroom": {
                "name": "Master Bedroom",
                "bounds": {"x_min": -400, "x_max": 0, "z_min": -250, "z_max": 250},
                "accent_wall": {"x_center": -200, "y": 120, "z": -250, "normal": [0, 0, 1]},
                "left_wall": {"x": -400, "y": 120, "z_center": 0, "normal": [1, 0, 0]},
                "partition_wall": {"x": 0, "y": 120, "z_center": -115, "normal": [-1, 0, 0]}
            },
            "living_room": {
                "name": "Living Room",
                "bounds": {"x_min": 0, "x_max": 400, "z_min": -250, "z_max": 250},
                "tv_wall": {"x_center": 200, "y": 120, "z": -250, "normal": [0, 0, 1]},
                "right_wall": {"x": 400, "y": 120, "z_center": 0, "normal": [-1, 0, 0]},
                "partition_wall": {"x": 0, "y": 120, "z_center": -115, "normal": [1, 0, 0]}
            }
        },
        "doorway": {
            "name": "Bedroom to Living Room Passage",
            "position": {"x": 0, "y_floor": 0, "z_start": 20, "z_end": 115},
            "width_cm": 95,
            "height_cm": 210
        },
        "planned_mep_nodes": {
            "main_breaker_panel": {"x": -390, "y": 140, "z": 200, "description": "200A Main Service Panel on Bedroom Entrance Wall"},
            "bedroom_outlet_left": {"x": -340, "y": 40, "z": -248, "description": "120V 15A Duplex Receptacle (Nightstand Left)"},
            "bedroom_outlet_right": {"x": -60, "y": 40, "z": -248, "description": "120V 15A Duplex Receptacle (Nightstand Right)"},
            "bedroom_light_switch": {"x": -15, "y": 120, "z": 15, "description": "Single-Pole Switch by Bedroom Doorway"},
            "bedroom_ceiling_box": {"x": -200, "y": 240, "z": 0, "description": "Octagonal J-Box for Ceiling Fan / Chandelier"},
            "living_tv_quad_receptacle": {"x": 200, "y": 110, "z": -248, "description": "Dedicated Quad Outlet behind 65in TV"},
            "living_console_receptacle": {"x": 130, "y": 40, "z": -248, "description": "120V 20A Duplex Receptacle for Audio/Console"},
            "living_sofa_receptacle": {"x": 395, "y": 40, "z": 10, "description": "120V 15A Convenience Receptacle by Sofa"},
            "living_floor_lamp_outlet": {"x": 395, "y": 40, "z": -220, "description": "Switched Receptacle for Corner Floor Lamp"},
            "living_light_switch": {"x": 15, "y": 120, "z": 15, "description": "3-Way Switch by Living Room Walkthrough"},
            "living_ceiling_box": {"x": 200, "y": 240, "z": -60, "description": "Octagonal J-Box for Living Room Recessed Light Array"}
        }
    }

    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(blueprint, f, indent=2)

    print("==============================================================")
    print(f" SUCCESS! Generated Architectural 3D Cutaway House:")
    print(f" -> OBJ: {obj_path} ({len(verts)} vertices, {len(objects)} objects)")
    print(f" -> MTL: {mtl_path} ({len(materials)} materials)")
    print(f" -> MEP Blueprint: {spec_path}")
    print("==============================================================")

if __name__ == "__main__":
    build_house()
