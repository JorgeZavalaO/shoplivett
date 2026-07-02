// Test de dominio para AUD-SEC-002.
// Se ejecuta con: pnpm exec tsx scripts/_with-env.ts scripts/test-auth-rate-limit.ts

import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";
import {
  assertLoginAllowed,
  clearLoginFailures,
  LoginRateLimitError,
  recordLoginFailure,
} from "../lib/rate-limit";

async function main() {
  const request = new Request("https://shoplivett.test/login", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const token = await assertLoginAllowed({ email: "RateLimit@Test.Local", request });
  await clearLoginFailures(token);

  for (let i = 0; i < 5; i += 1) {
    await assertLoginAllowed({ email: "ratelimit@test.local", request });
    await recordLoginFailure(token);
  }

  await assert.rejects(
    () => assertLoginAllowed({ email: "ratelimit@test.local", request }),
    LoginRateLimitError,
  );

  await clearLoginFailures(token);
  await assert.doesNotReject(() => assertLoginAllowed({ email: "ratelimit@test.local", request }));

  console.log("AUD-SEC-002 ok rate limit blocks and resets");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
