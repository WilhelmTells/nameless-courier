// Placeholder rider and stick, built from primitives. The group's origin is
// the tip of the stick, and its local Y axis is the stick axis.

import * as THREE from "three";

const PARCEL_COLOR = 0xd9772b; // faded signal orange, used on nothing else

export function createPogoRig(): THREE.Group {
  const rig = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x3c3f44 });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x5a5e57 });
  const skin = new THREE.MeshLambertMaterial({ color: 0x4a4a4c });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    rig.add(m);
    return m;
  };

  // Stick: tip, spring housing, shaft, foot pegs, handlebar.
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), rubber, 0, 0.04, 0);
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 10), metal, 0, 0.27, 0);
  add(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 8), metal, 0, 0.625, 0);
  add(new THREE.BoxGeometry(0.42, 0.03, 0.07), metal, 0, 0.35, 0.03);
  add(new THREE.BoxGeometry(0.5, 0.03, 0.03), metal, 0, 1.25, 0);

  // Rider: stands on the pegs just behind the shaft, faces away from the camera.
  const riderZ = 0.1;
  add(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), cloth, -0.1, 0.62, riderZ);
  add(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), cloth, 0.1, 0.62, riderZ);
  add(new THREE.CapsuleGeometry(0.2, 0.34, 4, 10), cloth, 0, 1.2, riderZ);
  add(new THREE.SphereGeometry(0.13, 12, 8), skin, 0, 1.62, riderZ);

  // Parcel on the back.
  add(new THREE.BoxGeometry(0.36, 0.3, 0.2), new THREE.MeshLambertMaterial({ color: PARCEL_COLOR }), 0, 1.25, riderZ + 0.3);

  return rig;
}
