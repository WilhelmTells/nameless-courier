import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VERSION } from "./version.ts";

const FLOOR_SIZE = 200; // metres, large enough that its edge is lost in fog
const GRID_SIZE = 60;

async function boot(): Promise<void> {
  document.querySelector<HTMLDivElement>("#version")!.textContent = VERSION;

  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -20, z: 0 });
  physics.createCollider(
    RAPIER.ColliderDesc.cuboid(FLOOR_SIZE / 2, 0.5, FLOOR_SIZE / 2).setTranslation(0, -0.5, 0),
  );

  const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x1a1b1d);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 15, 45);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 3, 6.5);
  camera.lookAt(0, 1, 0);

  scene.add(new THREE.HemisphereLight(0xd8d6d0, 0x3a3836, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 3);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x77777a }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x55555a, 0x5f5f63);
  grid.position.y = 0.001;
  scene.add(grid);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  renderer.setAnimationLoop(() => {
    physics.step();
    renderer.render(scene, camera);
  });
}

boot();
