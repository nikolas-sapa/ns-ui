import assert from "node:assert/strict";
import { nameComparisonKey, validateProfileName } from "../lib/name-policy.ts";

assert.equal(nameComparisonKey("Níkólas-Sapalidis"), "nikolassapalidis");
assert.equal(nameComparisonKey("h1tl3r"), "hitler");
assert.deepEqual(validateProfileName("Hitlër"), { ok: false, code: "name_not_allowed" });
assert.deepEqual(validateProfileName("nikolas.sapalidis"), {
  ok: false,
  code: "owner_name_reserved",
});
assert.deepEqual(validateProfileName("nikolas.sapalidis", true), { ok: true });
assert.deepEqual(validateProfileName("nikolas.sapalidis hitler", true), {
  ok: false,
  code: "name_not_allowed",
});
assert.deepEqual(validateProfileName("Nikolas' Sapa", true), { ok: true });
assert.deepEqual(validateProfileName("Alex Rivera"), { ok: true });

console.log("name policy: pass");
