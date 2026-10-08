# The Endless Journey of a Nameless Courier

A third-person pogo stick climbing game in the browser. A lonely courier
bounces up a fog-bound brutalist megastructure, carrying a parcel for someone
who may not exist. One bad bounce can cost a lot of progress.

**▶ Play: https://wilhelmtells.github.io/nameless-courier/**

**Movement playground** (test blocks, with the tuning panel):
https://wilhelmtells.github.io/nameless-courier/?debug&level=playground

Early prototype: playable from start to end, all six zones, in a
low-resolution retro look. Your
run is saved as you climb; continue it from the title screen. Desktop browsers
with keyboard and mouse.

## Controls

**Mouse controls** (the default): moving the mouse tilts the stick, which
stays where you leave it. Hold the left button (or Space) to charge, and
hold the right button to orbit the camera. The camera turns to stay behind
the direction you lean.

**Keyboard controls** (switch in Settings): W A S D lean the stick relative
to the camera, Space charges, and the mouse orbits the camera.

| Input | Action |
|---|---|
| Mouse wheel | Zoom |
| R | Reset the camera: behind you, at the usual angle and distance |
| E | Get off the pogo at a calm spot, and back on |
| Q | Back to the last checkpoint (easy mode only) |
| Esc | Pause (resume, settings, volumes, quit to title) |

Settings also hold the mouse sensitivity and the volumes.

The pogo never stops bouncing. The lean at the moment the tip touches the
ground decides where the next bounce goes; there is no control in the air.
Leaning with your motion builds speed, leaning against it brakes.
Only at a few calm spots can the courier get off and stand for a while.

**Easy mode** (off by default, in Settings): getting off at a calm spot saves
a checkpoint there, and Q or the pause menu takes you back to it after a
fall. A run that uses it is marked as an easy run, and its time does not
count as a best time.

Higher up, the ground changes: pale tarp pads throw the courier much higher,
dark mud swallows the bounce and the speed. Further still, old machinery keeps
running for nobody: platforms carry you along, and anything that swings or
turns will knock you off. At the very top, a last crossing over the open
drop: miss it and you fall all the way down.

You are not quite alone. Here and there, tall dark figures stand on the
ledges, and when you come close, they talk. Not to you, exactly.

Sound is best with headphones: wind that grows as you climb, the hum and
clank of the structure, and somewhere behind the walls, a party that never
ended. Every sound is generated in the browser.

## Development

Requires Node 22.

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build in dist/
```

Built with [Three.js](https://threejs.org/) and
[Rapier](https://rapier.rs/), bundled with [Vite](https://vite.dev/).
