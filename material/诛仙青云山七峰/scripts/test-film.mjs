import assert from "node:assert/strict";
import * as THREE from "three";
import {
  FILM_DURATION,
  FILM_FPS,
  FILM_SHOTS,
  blackOpacityAt,
  sampleFilmCamera,
  shotIndexAt,
  subtitleAt,
  titleOpacityAt,
  transitionOpacityAt,
} from "../src/filmTimeline.js";

assert.equal(FILM_DURATION, 36);
assert.equal(FILM_FPS, 60);
assert.equal(FILM_SHOTS.length, 5);

assert.equal(shotIndexAt(0), 0);
assert.equal(shotIndexAt(7.9), 0);
assert.equal(shotIndexAt(8), 1);
assert.equal(shotIndexAt(35.9), 4);

const position = new THREE.Vector3();
const target = new THREE.Vector3();
for (let t = 0; t <= 36; t += 0.5) {
  sampleFilmCamera(t, position, target);
  assert.ok(Number.isFinite(position.x + position.y + position.z), `pos ${t}`);
  assert.ok(Number.isFinite(target.x + target.y + target.z), `target ${t}`);
}

assert.equal(transitionOpacityAt(8), 1);
assert.equal(transitionOpacityAt(15), 1);
assert.equal(transitionOpacityAt(22), 1);
assert.equal(transitionOpacityAt(29), 1);
assert.ok(transitionOpacityAt(4) < 0.01);

const middle = subtitleAt(4);
assert.ok(middle.opacity > 0.5, `subtitle mid ${middle.opacity}`);
assert.equal(middle.text, "云海初开，七峰浮青");
assert.ok(subtitleAt(8).opacity < 0.1, "subtitle at cut");
assert.ok(subtitleAt(11).opacity > 0.5);
assert.ok(subtitleAt(18).opacity > 0.5);
assert.ok(subtitleAt(25).opacity > 0.5);
assert.ok(subtitleAt(32).opacity > 0.5);

assert.ok(titleOpacityAt(34.5) > 0.5, "title visible");
assert.ok(blackOpacityAt(0.2) > 0.5, "intro fade");
assert.ok(blackOpacityAt(35.9) > 0.8, "ending fade");

console.log("film ok");
