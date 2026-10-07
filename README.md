# The Endless Journey of a Nameless Courier

A third-person pogo stick climbing game in the browser. A lonely courier
bounces up a fog-bound brutalist megastructure, carrying a parcel for someone
who may not exist. One bad bounce can cost a lot of progress.

**▶ Play: https://wilhelmtells.github.io/nameless-courier/**

**Movement playground** (test blocks, with the tuning panel):
https://wilhelmtells.github.io/nameless-courier/?debug&level=playground

Early prototype: the first three zones in grey-box. Desktop browsers with keyboard
and mouse.

## Controls

| Input | Action |
|---|---|
| W A S D | Lean the stick (relative to the camera) |
| Space (hold, release) | Charge a big jump |
| Mouse | Orbit the camera (click to capture the mouse) |
| Mouse wheel | Zoom |
| R | Put the camera behind your direction of movement |
| Esc | Release the mouse |
| C | Switch between keyboard and mouse controls |
| E | Get off the pogo at a calm spot, and back on |

**Mouse controls** (press C): moving the mouse tilts the stick, which stays
where you leave it. Hold the left button (or Space) to charge, and hold the
right button to orbit the camera.

The pogo never stops bouncing. The lean at the moment the tip touches the
ground decides where the next bounce goes; there is no control in the air.
Leaning with your motion builds speed, leaning against it brakes.
Only at a few calm spots can the courier get off and stand for a while.

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
