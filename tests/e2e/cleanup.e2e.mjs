// The e2e clean-up helper must close servers even with a browser-style
// keep-alive connection open, and as soon as a test is cancelled or times
// out (that is what left the deploy job hanging for hours).
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { cleanup, closeServer } from "./cleanup.mjs";

function keepAliveServer() {
  const server = http.createServer((req, res) => { res.setHeader("Connection", "keep-alive"); res.end("ok"); });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
async function openKeepAlive(server) {
  const agent = new http.Agent({ keepAlive: true });
  await new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: server.address().port, agent }, (res) => { res.resume(); res.on("end", resolve); }).on("error", reject);
  });
  return agent;
}

test("closeServer closes a server that still has a keep-alive connection open", async () => {
  const server = await keepAliveServer();
  const agent = await openKeepAlive(server);
  const t0 = Date.now();
  await closeServer(server, 3000);
  assert.equal(server.listening, false);
  assert.ok(Date.now() - t0 < 2000, "close waited on the open connection");
  agent.destroy();
});

test("cleanup closes everything when the test is aborted (timeout), before its body finishes", async () => {
  const ac = new AbortController();
  const res = cleanup({ signal: ac.signal });
  const a = res.server(await keepAliveServer());
  const b = res.server(await keepAliveServer());
  const agent = await openKeepAlive(a);
  ac.abort();
  await res.closeAll();
  assert.equal(a.listening, false);
  assert.equal(b.listening, false);
  agent.destroy();
});

test("cleanup tolerates a server that was never started or already closed", async () => {
  const res = cleanup();
  res.server(http.createServer());
  const s = res.server(await keepAliveServer());
  await closeServer(s);
  await res.closeAll();
  assert.equal(s.listening, false);
});
