"""
generate_house_obj.py
Generates a game-ready, open-top Architectural Cutaway House (.obj + .mtl)
tailored for Snap Spectacles & Lens Studio AR.

Features:
- Open ceiling (cutaway / dollhouse) so you can walk inside and see in-wall wiring
- Master Bedroom, Living Room, Kitchen, and Electrical/Utility Closet
- Standard 2.4m (240cm) wall heights, 15cm wall thicknesses, realistic door openings
- Grouped by named objects (o Room_*, o Floor_*, o Wall_*) for easy toggling in Lens Studio
"""

import os
import sys

def create_cutaway_house_obj(output_obj_path, output_mtl_path):
    os.makedirs(os.path.dirname(output_obj_path), exist_ok=True)
    mtl_filename = os.path.basename(output_mtl_path)

    # 1. Write MTL Material Library
    with open(output_mtl_path, "w", encoding="utf-8") as f:
        f.write("# Architectural Cutaway House Materials\n")
        f.write("newmtl Mat_Drywall\n")
        f.write("Ka 0.2 0.2 0.2\n")
        f.write("Kd 0.88 0.88 0.90\n")
        f.write("Ks 0.1 0.1 0.1\n")
        f.write("Ns 10.0\n")
        f.write("d 1.0\n\n")

        f.write("newmtl Mat_AccentWall\n")
        f.write("Ka 0.15 0.2 0.25\n")
        f.write("Kd 0.22 0.35 0.48\n")
        f.write("Ks 0.2 0.2 0.2\n")
        f.write("Ns 15.0\n")
        f.write("d 1.0\n\n")

        f.write("newmtl Mat_FloorWood\n")
        f.write("Ka 0.2 0.15 0.1\n")
        f.write("Kd 0.65 0.48 0.32\n")
        f.write("Ks 0.1 0.1 0.1\n")
        f.write("Ns 20.0\n")
        f.write("d 1.0\n\n")

        f.write("newmtl Mat_FloorTile\n")
        f.write("Ka 0.2 0.2 0.2\n")
        f.write("Kd 0.75 0.76 0.78\n")
        f.write("Ks 0.3 0.3 0.3\n")
        f.write("Ns 35.0\n")
        f.write("d 1.0\n\n")

        f.write("newmtl Mat_Baseboard\n")
        f.write("Ka 0.2 0.2 0.2\n")
        f.write("Kd 0.95 0.95 0.95\n")
        f.write("Ks 0.2 0.2 0.2\n")
        f.write("Ns 10.0\n")
        f.write("d 1.0\n\n")

    # 2. Write OBJ Geometry
    verts = []
    normals = [
        (0.0, 1.0, 0.0),   # 1: Up
        (0.0, -1.0, 0.0),  # 2: Down
        (0.0, 0.0, 1.0),   # 3: Forward (+Z)
        (0.0, 0.0, -1.0),  # 4: Backward (-Z)
        (1.0, 0.0, 0.0),   # 5: Right (+X)
        (-1.0, 0.0, 0.0)   # 6: Left (-X)
    ]

    objects = [] # list of (object_name, material_name, list of faces)

    def add_box(min_pt, max_pt, obj_name, mat_name):
        x0, y0, z0 = min_pt
        x1, y1, z1 = max_pt

        # 8 corners
        base_v = len(verts) + 1
        box_v = [
            (x0, y0, z0), # 1
            (x1, y0, z0), # 2
            (x1, y0, z1), # 3
            (x0, y0, z1), # 4
            (x0, y1, z0), # 5
            (x1, y1, z0), # 6
            (x1, y1, z1), # 7
            (x0, y1, z1)  # 8
        ]
        verts.extend(box_v)

        faces = [
            # Top (+Y, normal 1)
            (base_v + 4, base_v + 5, base_v + 6, base_v + 7, 1),
            # Bottom (-Y, normal 2)
            (base_v + 3, base_v + 2, base_v + 1, base_v + 0, 2),
            # Front (+Z, normal 3)
            (base_v + 3, base_v + 7, base_v + 6, base_v + 2, 3),
            # Back (-Z, normal 4)
            (base_v + 1, base_v + 5, base_v + 4, base_v + 0, 4),
            # Right (+X, normal 5)
            (base_v + 2, base_v + 6, base_v + 5, base_v + 1, 5),
            # Left (-X, normal 6)
            (base_v + 0, base_v + 4, base_v + 7, base_v + 3, 6)
        ]
        objects.append((obj_name, mat_name, faces))

    def add_wall_with_door(p_start, p_end, thickness, height, door_start_pct, door_width, door_height, obj_name, mat_name):
        """Creates a wall with an architectural door cutout opening."""
        import math
        dx = p_end[0] - p_start[0]
        dz = p_end[1] - p_start[1]
        length = math.hypot(dx, dz)
        if length < 1.0:
            return

        # Direction vectors
        ux = dx / length
        uz = dz / length
        nx = -uz * (thickness / 2.0)
        nz =  ux * (thickness / 2.0)

        # 3 parts: Left of door, Right of door, Lintel above door
        d_start = length * door_start_pct
        d_end = d_start + door_width

        # Part 1: Left segment (0 to d_start)
        if d_start > 5.0:
            p1 = (p_start[0], p_start[1])
            p2 = (p_start[0] + ux * d_start, p_start[1] + uz * d_start)
            _add_wall_segment(p1, p2, nx, nz, 0.0, height, f"{obj_name}_Left", mat_name)

        # Part 2: Right segment (d_end to length)
        if length - d_end > 5.0:
            p1 = (p_start[0] + ux * d_end, p_start[1] + uz * d_end)
            p2 = (p_end[0], p_end[1])
            _add_wall_segment(p1, p2, nx, nz, 0.0, height, f"{obj_name}_Right", mat_name)

        # Part 3: Header / Lintel above door (d_start to d_end, y from door_height to height)
        if height > door_height:
            p1 = (p_start[0] + ux * d_start, p_start[1] + uz * d_start)
            p2 = (p_start[0] + ux * d_end, p_start[1] + uz * d_end)
            _add_wall_segment(p1, p2, nx, nz, door_height, height, f"{obj_name}_Header", mat_name)

    def _add_wall_segment(p1, p2, nx, nz, y0, y1, obj_name, mat_name):
        base_v = len(verts) + 1
        # 4 ground points, 4 top points
        v = [
            (p1[0] - nx, y0, p1[1] - nz),
            (p2[0] - nx, y0, p2[1] - nz),
            (p2[0] + nx, y0, p2[1] + nz),
            (p1[0] + nx, y0, p1[1] + nz),
            (p1[0] - nx, y1, p1[1] - nz),
            (p2[0] - nx, y1, p2[1] - nz),
            (p2[0] + nx, y1, p2[1] + nz),
            (p1[0] + nx, y1, p1[1] + nz),
        ]
        verts.extend(v)
        faces = [
            (base_v + 4, base_v + 5, base_v + 6, base_v + 7, 1), # Top
            (base_v + 3, base_v + 2, base_v + 1, base_v + 0, 2), # Bottom
            (base_v + 3, base_v + 7, base_v + 6, base_v + 2, 3), # Side 1
            (base_v + 1, base_v + 5, base_v + 4, base_v + 0, 4), # Side 2
            (base_v + 2, base_v + 6, base_v + 5, base_v + 1, 5), # End 1
            (base_v + 0, base_v + 4, base_v + 7, base_v + 3, 6), # End 2
        ]
        objects.append((obj_name, mat_name, faces))

    # ==============================================================
    # ARCHITECTURAL HOUSE LAYOUT (in cm, 1 unit = 1 cm)
    # Total Floor: 900cm wide (X: -450 to +450), 700cm deep (Z: -350 to +350)
    # Height: 240cm (Standard 8ft residential walls)
    # ==============================================================

    # 1. Floor Slabs
    # Main Living & Bedroom: Hardwood
    add_box((-450, -6, -350), (150, 0, 350), "Floor_Living_Bedroom", "Mat_FloorWood")
    # Kitchen & Utility: Ceramic Tile
    add_box((150, -6, -350), (450, 0, 350), "Floor_Kitchen_Utility", "Mat_FloorTile")

    # 2. Outer Perimeter Walls (Cutaway style: full back & sides, low 60cm front cutaway)
    WALL_THICK = 15.0
    WALL_HEIGHT = 240.0
    LOW_FRONT = 60.0

    # Back Wall (-Z): 900cm long, full 240cm height
    add_box((-450, 0, -350 - WALL_THICK), (450, WALL_HEIGHT, -350), "Wall_Exterior_Back", "Mat_Drywall")

    # Left Wall (-X): 700cm long, full 240cm height
    add_box((-450 - WALL_THICK, 0, -350), (-450, WALL_HEIGHT, 350), "Wall_Exterior_Left", "Mat_Drywall")

    # Right Wall (+X): 700cm long, full 240cm height
    add_box((450, 0, -350), (450 + WALL_THICK, WALL_HEIGHT, 350), "Wall_Exterior_Right", "Mat_Drywall")

    # Front Cutaway Wall (+Z): low 60cm knee-wall for architectural dollhouse viewing
    add_box((-450, 0, 350), (450, LOW_FRONT, 350 + WALL_THICK), "Wall_Exterior_Front_Cutaway", "Mat_Drywall")

    # 3. Interior Partition Walls
    # Divider 1: Separates Bedroom (-X side) from Living Room (Center)
    # Run along Z from -350 to 50 with a bedroom door (90cm wide, 210cm high)
    add_wall_with_door((-150, -350), (-150, 100), WALL_THICK, WALL_HEIGHT, 0.45, 90.0, 210.0, "Wall_Bedroom_Partition", "Mat_AccentWall")

    # Divider 2: Separates Living Room from Kitchen/Utility (+X side)
    # Run along Z from -350 to 150 with a wide open walkway (140cm wide)
    add_wall_with_door((150, -350), (150, 200), WALL_THICK, WALL_HEIGHT, 0.35, 140.0, 210.0, "Wall_Kitchen_Partition", "Mat_Drywall")

    # Divider 3: Utility / Electrical Breaker Closet (Z: 100 to 350, X: 150 to 450)
    # This is where the Main 200A Electrical Panel and Water Heater live!
    add_wall_with_door((150, 100), (450, 100), WALL_THICK, WALL_HEIGHT, 0.25, 80.0, 210.0, "Wall_Utility_Closet", "Mat_Drywall")

    # Divider 4: Master Bedroom Closet & Bathroom partition
    add_box((-450, 0, 100), (-150, WALL_HEIGHT, 100 + WALL_THICK), "Wall_Bedroom_EnSuite", "Mat_Drywall")

    # 4. Write OBJ file
    with open(output_obj_path, "w", encoding="utf-8") as f:
        f.write("# WireSight Architectural Cutaway House (.obj)\n")
        f.write(f"mtllib {mtl_filename}\n\n")

        # Vertices
        for vx, vy, vz in verts:
            f.write(f"v {vx:.2f} {vy:.2f} {vz:.2f}\n")
        f.write("\n")

        # Normals
        for nx, ny, nz in normals:
            f.write(f"vn {nx:.2f} {ny:.2f} {nz:.2f}\n")
        f.write("\n")

        # Objects and faces
        for obj_name, mat_name, faces in objects:
            f.write(f"o {obj_name}\n")
            f.write(f"usemtl {mat_name}\n")
            f.write("s 1\n")
            for f1, f2, f3, f4, ni in faces:
                f.write(f"f {f1}//{ni} {f2}//{ni} {f3}//{ni} {f4}//{ni}\n")
            f.write("\n")

    print(f"Generated {output_obj_path} successfully!")
    print(f"Total Vertices: {len(verts)}, Objects/Rooms: {len(objects)}")

if __name__ == "__main__":
    out_obj = os.path.abspath("MySpecsLens.esproj/Assets/House_Interior_Cutaway.obj")
    out_mtl = os.path.abspath("MySpecsLens.esproj/Assets/House_Interior_Cutaway.mtl")
    create_cutaway_house_obj(out_obj, out_mtl)
