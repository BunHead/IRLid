// Shared clean-up for the browser tests (not a test file: the runner only
// picks up *.e2e.mjs).
//
// Why: a browser test that failed or timed out used to leave its HTTP
// servers listening (and sometimes Chromium running). Node then never
// exits, so the Tests job, and the Deploy Worker job that waits on it, sat
// there until GitHub's 6-hour limit. Every server and browser a test opens
// is registered here and closed:
//   - in the test's `finally` (pass or fail), and
//   - as soon as the test is cancelled or times out (t.signal), because the
//     test body is still stuck at that point and its `finally` has not run.
// Closing is bounded: open keep-alive connections are dropped and a browser
// that won't close in time is killed. `--test-force-exit` (package.json) is
// the last backstop.

const CLOSE_LIMIT_MS = 10000;

function within(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((resolve) => { timer = setTimeout(resolve, ms); })
  ]).finally(() => clearTimeout(timer));
}

export function closeServer(server, ms = CLOSE_LIMIT_MS) {
  if (!server || !server.listening) return Promise.resolve();
  const closed = new Promise((resolve) => server.close(() => resolve()));
  // close() waits for open connections; a browser keeps some alive.
  try { server.closeAllConnections(); } catch (_) {}
  return within(closed, ms);
}

export async function closeBrowser(browser, ms = CLOSE_LIMIT_MS) {
  if (!browser) return;
  await within(browser.close(), ms);
  // Still running (close hung): kill it so it can't hold the process open.
  try { if (browser.isConnected()) browser.process?.()?.kill("SIGKILL"); } catch (_) {}
}

// const res = cleanup(t);  res.server(s);  res.browser(b);  await res.closeAll();
export function cleanup(t) {
  const items = [];
  let closing = null;
  const res = {
    server(server) { items.push(() => closeServer(server)); return server; },
    browser(browser) { items.push(() => closeBrowser(browser)); return browser; },
    closeAll() {
      if (!closing) {
        closing = (async () => {
          for (const close of items.slice().reverse()) { try { await close(); } catch (_) {} }
        })();
      }
      return closing;
    }
  };
  if (t && t.signal) {
    if (t.signal.aborted) res.closeAll();
    else t.signal.addEventListener("abort", () => { res.closeAll(); }, { once: true });
  }
  return res;
}
