# The Endless Journey of a Nameless Courier

A third-person pogo stick climbing game in the browser. A lonely courier
bounces up a fog-bound brutalist megastructure, carrying a parcel for someone
who may not exist. One bad bounce can cost a lot of progress.

**▶ Play: https://wilhelmtells.github.io/nameless-courier/**

Early prototype: the pogo and the camera on a test floor. No level yet.
Desktop browsers with keyboard and mouse.

## Controls

| Input | Action |
|---|---|
| W A S D | Lean the stick (relative to the camera) |
| Space (hold, release) | Charge a big jump |
| Mouse | Orbit the camera (click to capture the mouse) |
| Mouse wheel | Zoom |
| R | Put the camera behind your direction of movement |
| Esc | Release the mouse |

The pogo never stops bouncing. The lean at the moment the tip touches the
ground decides where the next bounce goes; there is no control in the air.
Leaning with your motion builds speed, leaning against it brakes.

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
