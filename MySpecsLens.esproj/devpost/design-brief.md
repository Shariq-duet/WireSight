---
status: ready
---

# Design brief: WireSight (Spatial MEP & In-Wall AR Vision)

## The one spatial moment
An electrician on a ladder holding a drill looks at a wall through the glasses: instead of tearing up three meters of drywall to reach a distant outlet, the glasses reveal an "X-ray" view of hidden conduits, showing a live overhead circuit line directly above the target spot. As the electrician aligns the drill, a live proximity ring dynamically confirms the drill zone is clear of high-voltage wire and water pipes, preventing fatal shocks or pipe bursts.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, leaves your body free
- Why it's better than the phone or laptop version: 
  1. **The "Two-Hands-on-a-Ladder" Rule:** An electrician holds a heavy drill with one hand and a level or ladder rung with the other. You cannot hold a phone while drilling or testing with two multimeter probes.
  2. **Why a Pencil Mark Fails:** A phone and a pencil can only mark a 2D surface dot. A pencil mark cannot show what lies 3 inches deep behind the wall, nor can it warn you if your drill bit drifts at a 45-degree angle into a live 220V conduit.
  3. **Real-Time Depth & Collision Warnings:** Glasses provide true stereoscopic depth perception and live visual HUD warnings directly in your line of sight while your hands remain on the power tool.

## Product or overlay
- Type: overlay: it responds to something real (walls and building infrastructure)
- What the real version would sense: Room geometry via spatial mapping/World Mesh, anchoring conduit routes and pipe depths to physical walls
- Stand-in for the preview: A mock drywall section at real size in the Lens Studio preview room, with internal 3D conduits and pipes rendered at realistic wall depths

## Where things live
- Where the user is looking during the main task: Directly forward at the wall at eye/chest level (1.0 m to 1.5 m height, ~1.0 m to 1.5 m distance)
- Mock Wall Section: Anchored in front of the user, real size (approx 200 cm wide x 240 cm high x 15 cm deep)
- Electrical Conduits & Plumbing Pipes: Embedded inside the wall at distinct depths (shallow plumbing pipes in foreground, deep electrical conduits behind)
- Mode & Layer Palette: Floating toolbar at waist/chest height (approx 80 cm off ground, 80 cm from user), convenient for near-pinch or far-ray targeting
- Run Inspection Card: Floats 10-15 cm in front of the selected conduit or outlet node at eye level, size approx 25 cm x 18 cm, high-contrast light text with translucent backing
- Active Drill Proximity Target: Interactive drill target ring projected onto the wall surface

## Hands and input
- Layer & Mode Toggling: Pinch on floating palette buttons (Electrical, Plumbing, Mode)
- Inspecting Runs: Near pinch (touching directly) or far raycast pinch on a conduit or junction node opens its inspection card
- Active Drill Simulation: Moving/dragging the drill target across the wall tests live proximity against hidden lines
- Outlet Placement: Pinching the "Add Outlet" tool places the target outlet and links to the overhead live line
- Targets are big and highlight when aimed at.
- Voice: None needed (direct pinch interactions provide reliable tactile control).

## When things show
- Conduits: Visible when their layer (Electrical or Plumbing) is toggled on; clean, uncluttered lines by default
- Inspection Card: Shows when a conduit or node is pinched; hides when dismissed or unselected
- Active Drill Proximity Alert: Displays a green ring in clear wall areas; transitions to a pulsing red warning ring with an audible alert when within 10 cm of a live conduit or water pipe
- Conflict Warning: Pulsing badge appears at the intersection where an electrical run passes dangerously close to a plumbing pipe
- If something needs attention out of view: Spatial chime sound when a conflict is detected or when proximity warning triggers

## Done criteria
Each one can be checked in Lens Studio's preview.
1. **Layer Toggling:** Toggling the Electrical or Plumbing buttons on the palette shows or hides the corresponding glowing conduit runs inside the mock wall.
2. **Inspect Run Details:** Pinching any conduit line opens a floating inspection card displaying installer name, circuit voltage/gauge, and install date, and closes it when clicked again.
3. **Active Drill Safety Proximity Alert:** Dragging/positioning the drill tool across the wall displays a green safe indicator, which dynamically switches to a pulsing red danger alert with an audio chime when brought within 10 cm of a hidden conduit or pipe.
4. **Tap-In / Outlet Placement:** Pinching the "Add Outlet" tool on the wall shows the proposed outlet location and automatically illuminates the splice connection path to the live overhead line.
5. **Mode Switch (Create vs. View):** Toggling to View Mode locks the wall in read-only mode so runs cannot be modified, while Create Mode enables the placement tools.

## Out of scope
- Live scanning of real-world drywall through a laptop webcam in the preview
- Persistent cloud database synchronization across multiple physical buildings
- Arbitrary freeform text typing via virtual keyboard (realistic preset metadata is used)

## Risks and open questions
- Real hand vibration and tactile feedback during drilling cannot be simulated with a laptop mouse; labeled as "feel unproven" for the physical glasses, while the visual proximity logic is proven in preview.
- Additive display on glasses: Black renders as transparent, so all UI elements, cards, and conduit materials must use bright emissive accents, glowing lines, and crisp light typography.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
