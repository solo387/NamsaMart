import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";
process.env.NODE_ENV ??= "test";

test("API exposes live and database readiness checks without leaking errors", async () => {
  const [{ createApi }, { configSchema }] = await Promise.all([
    import("../app.js"),
    import("../lib/config.js")
  ]);
  assert.throws(() => configSchema.parse({
    ...process.env,
    NODE_ENV: "production",
    JWT_SECRET: "replace-with-a-random-secret-that-is-long-enough"
  }));
  assert.throws(() => configSchema.parse({ ...process.env, JWT_EXPIRES_IN: "forever" }));
  let databaseReady = true;
  const api = createApi({
    checkDatabase: async () => {
      if (!databaseReady) throw new Error("private database connection detail");
    }
  });

  api.server.listen(0, "127.0.0.1");
  await once(api.server, "listening");
  const address = api.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const live = await fetch(`${baseUrl}/api/health/live`, { headers: { connection: "close" } });
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: "ok" });

    const ready = await fetch(`${baseUrl}/api/health/ready`, { headers: { connection: "close" } });
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: "ready" });

    databaseReady = false;
    const unavailable = await fetch(`${baseUrl}/api/health/ready`, { headers: { connection: "close" } });
    assert.equal(unavailable.status, 503);
    const unavailableBody = await unavailable.text();
    assert.match(unavailableBody, /Database is not ready/);
    assert.doesNotMatch(unavailableBody, /private database connection detail/);

    const missing = await fetch(`${baseUrl}/missing`, { headers: { connection: "close" } });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "Endpoint not found." });

    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", connection: "close" },
      body: "{\"email\":"
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "Request body must contain valid JSON." });
  } finally {
    api.server.closeAllConnections();
    await new Promise<void>((resolve) => api.io.close(() => resolve()));
  }
});
