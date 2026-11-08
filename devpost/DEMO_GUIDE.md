# WireSight: Hackathon Demo & Video Walkthrough Guide

This guide provides the exact 2-to-3 minute video script, LEAF test verification, and scene interaction walkthrough for your Devpost submission.

---

## 1. LEAF Test Results Summary (Automated Testing)

All 5 Done Criteria have been implemented and verified via automated test scenarios:

| Criterion | Test Scenario | Result | What was verified |
| :--- | :--- | :--- | :--- |
| **Criterion 1: Layer Toggling** | `LayerToggleScenario` | **PASS (100%)** | Toggling Electrical / Plumbing buttons toggles layer visibility and dynamically recalculates live clearance buffers. |
| **Criterion 2: Inspect Run Details** | `InspectRunDetailsScenario` | **PASS (100%)** | Pinching conduit lines opens floating inspection cards with circuit specs, voltage, certified installer ID, and install date. |
| **Criterion 3: Active Drill Proximity Alert** | `DrillSafetyProximityScenario` | **PASS (100%)** | Dragging the drill tool shifts from a Green Safe zone to a Pulsing Red Hazard Alert when clearance drops below 10 cm. |
| **Criterion 4: Tap-In Outlet Placement** | `TapInOutletPlacementScenario` | **PASS (100%)** | Blocked in View Mode; in Create Mode, places the outlet and illuminates the direct overhead splice to Circuit 4B. |
| **Criterion 5: Mode Switch (Locks)** | `ModeSwitchScenario` | **PASS (100%)** | Toggling between View Mode (read-only locks) and Create Mode (editable) functions reliably. |

---

## 2. Interactive Preview Walkthrough (In Lens Studio)

### How to navigate the Preview:
* **Move around:** Use <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> on your keyboard.
* **Height:** <kbd>Q</kbd> to lower camera, <kbd>E</kbd> to elevate.
* **Look around:** Hold **Right-Click** or <kbd>Shift</kbd> and drag the mouse.
* **Pinch / Interact:** **Left-Click** on any floating button or conduit node.

---

## 3. Recommended 2.5-Minute Video Recording Script

### [0:00 - 0:30] The Problem & The "Phone Test"
* **Visual:** Stand in the room looking at the plain partition wall.
* **Speech:**
  > *"Hi everyone. This is **WireSight**, an augmented reality spatial blueprint and safety HUD for electricians and plumbers built for Snap SPECS.*
  >
  > *In residential construction, wiring and plumbing plans are often lost or never recorded. When an electrician wants to install a new outlet, they have to guess where lines run or chisel through meters of finished drywall to reach distant outlets.*
  >
  > *Why glasses and not a phone? Because on a job site, you are on a ladder holding an 8-pound hammer drill with both hands. You cannot hold an iPhone while drilling, and a 2D pencil mark on a wall cannot show depth or warn you if your drill bit drifts into a live 220V conduit."*

### [0:30 - 1:15] The X-Ray View & Inspection
* **Visual:** Step up to the mock wall. The glowing conduits appear.
* **Speech:**
  > *"When we put on the glasses, the wall turns transparent. We see the 3D conduit network at 1:1 real-world scale:*
  > * *Glowing yellow for high-voltage electrical circuits.*
  > * *Blue and red for potable cold and hot water pipes.*
  >
  > *Notice that hot water pipe crossing right behind the light switch drop—the system immediately flags it with a red warning badge for a clearance violation under 10 centimeters.*
  >
  > *If I pinch the overhead conduit, a high-contrast inspection card opens, showing this is Circuit 4B, 230V AC, installed by certified electrician A. Khan."*

### [1:15 - 1:55] Active Drill Safety Proximity Alert
* **Visual:** Move the circular drill guide across the wall.
* **Speech:**
  > *"Now watch the Active Drill Safety HUD. When I move my drill target over clear plaster, the ring stays bright green: 'SAFE DRILL ZONE'.*
  >
  > *But watch what happens as I bring the drill within 10 centimeters of this live 230V feeder line: the HUD instantly flashes pulsing red with a collision warning alert. It protects the tradesperson in real time while their hands remain on the power tool."*

### [1:55 - 2:30] The Core Spatial Moment (Outlet Tap-In)
* **Visual:** Click Mode to switch to Create Mode, then click `[+ ADD OUTLET TAP-IN]`.
* **Speech:**
  > *"Here is the payoff: without glasses, I thought I had to chisel through 3 meters of wall to reach the outlet on the other side. But with WireSight, I see a live overhead circuit running directly above where I want the outlet.*
  >
  > *I switch to Create Mode, tap Add Outlet, and WireSight places the new receptacle and illuminates the exact vertical splice path straight up to the overhead line. We just saved half a day of labor and prevented breaking the wall.*
  >
  > *All 5 done criteria have been verified with automated LEAF tests in our public repository. Thank you!"*

---

## 4. Submission Checklist for Devpost
- [x] Design brief saved and finalized in `devpost/design-brief.md`.
- [x] All 5 LEAF scenarios coded and passing.
- [ ] Record the 2-to-3 minute video of the Lens Studio preview using OBS or Windows Game Bar (<kbd>Win</kbd> + <kbd>G</kbd>).
- [ ] Upload video to YouTube as Public or Unlisted.
- [ ] Push this repository to GitHub (including project files and `devpost/` folder).
- [ ] Fill out the Devpost form at `https://learn-specs.devpost.com`.

