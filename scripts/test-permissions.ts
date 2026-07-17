import assert from "node:assert/strict";

import { hasPermissionSync, rolesFor } from "../lib/authorization-core";

let passed = 0;
let failed = 0;

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  fail ${name}`);
    console.error(error);
  }
}

async function main() {
  console.log("Permisos - matriz básica");

  await run("ADMIN conserva accesos críticos", () => {
    assert.equal(hasPermissionSync("ADMIN", "settings.write"), true);
    assert.equal(hasPermissionSync("ADMIN", "audit.read"), true);
    assert.equal(hasPermissionSync("ADMIN", "reports.read"), true);
    assert.equal(hasPermissionSync("ADMIN", "expenses.read"), true);
    assert.equal(hasPermissionSync("ADMIN", "incidents.read"), true);
  });

  await run("SELLER no obtiene módulos admin-only", () => {
    assert.equal(hasPermissionSync("SELLER", "settings.write"), false);
    assert.equal(hasPermissionSync("SELLER", "audit.read"), false);
    assert.equal(hasPermissionSync("SELLER", "reports.read"), false);
  });

  await run("DISPATCH solo conserva envíos y lectura operativa", () => {
    assert.equal(hasPermissionSync("DISPATCH", "shipments.read"), true);
    assert.equal(hasPermissionSync("DISPATCH", "shipments.write"), true);
    assert.equal(hasPermissionSync("DISPATCH", "payments.read"), false);
    assert.equal(hasPermissionSync("DISPATCH", "customers.read"), false);
  });

  await run("rolesFor expone roles esperados", () => {
    assert.deepEqual(rolesFor("audit.read"), ["ADMIN"]);
    assert.deepEqual(rolesFor("shipments.read"), ["ADMIN", "DISPATCH"]);
  });

  console.log(`\nTotal: ${passed} ok / ${failed} fail`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
