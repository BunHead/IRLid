// v6.8.22 - a kiosk must not sit on "Offline mode" because the calendar saved
// in the browser names an event the Worker has since archived (16 Nov 2026).
// The functions are lifted out of Org.html and run against stubs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../Org.html", import.meta.url), "utf8");

function extract(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, "found " + name);
  const from = html.lastIndexOf("\n", start) + 1;
  let i = html.indexOf("{", start), depth = 0;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) break;
  }
  return html.slice(from, i + 1);
}

function makeContext({ nonceError, onLine = true } = {}) {
  const badges = [];
  const toasts = [];
  const calendarReloads = [];
  const slot = {
    parentNode: {
      querySelector: () => badges[0] || null
    },
    insertAdjacentElement: (_, el) => { badges.push(el); }
  };
  const ctx = {
    console,
    URL,
    Promise,
    Date,
    navigator: { onLine },
    location: { href: "https://irlid.co.uk/Org.html" },
    currentOrg: { id: "org_1" },
    currentMode: "venue",
    currentCheckinEventContext: { eventId: "ev_gone", eventName: "Test 1", orgKey: "org_1" },
    venueQrNonceRequestId: 0,
    venueQrLiveNonce: null,
    venueQrOffline: false,
    venueQrOfflineReason: "network",
    venueQrCalendarLoadedOrg: null,
    venueQrCalendarReloadAt: 0,
    document: {
      body: { dataset: { activePanel: "checkin" } },
      getElementById: (id) => id === "venueQrBox" ? slot : (id === "qrPayloadPreview" ? { textContent: "" } : null),
      createElement: () => ({ className: "", textContent: "" })
    },
    window: {
      QRCode: {},
      refreshV511CalendarData: () => { calendarReloads.push(Date.now()); return Promise.resolve(); },
      IRLidOrgApi: {
        createCheckinNonce: async () => {
          if (nonceError) throw nonceError;
          return { nonce: "cin_x" };
        }
      }
    },
    activeCheckinEventContext: (c) => c || ctx.currentCheckinEventContext,
    updateCheckinQrTitle() {},
    buildVenuePayload: () => "https://irlid.co.uk/org-entry.html?org=x",
    renderVenueQR() {},
    showToast: (m) => toasts.push(m)
  };
  vm.createContext(ctx);
  // Org.html uses top-level `let`; in the vm they are plain globals on ctx.
  vm.runInContext(
    [extract("reloadCheckinCalendar"), extract("setVenueQrOfflineMode"), extract("generateVenueQR")].join("\n") +
      "\nthis.reloadCheckinCalendar = reloadCheckinCalendar; this.generateVenueQR = generateVenueQR;",
    ctx
  );
  return { ctx, badges, toasts, calendarReloads };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

test("a refused event is not reported as offline, and the live calendar is reloaded", async () => {
  const { ctx, badges, toasts, calendarReloads } = makeContext({ nonceError: httpError(404, "Event not found") });
  await ctx.generateVenueQR();
  assert.equal(ctx.venueQrOffline, true, "backup QR still shown so the door keeps working");
  assert.equal(badges.length, 1);
  assert.equal(badges[0].textContent, "Backup QR · live code refused");
  assert.ok(!/^Offline/.test(toasts[0]), "toast does not say offline: " + toasts[0]);
  assert.equal(calendarReloads.length, 1, "live calendar reloaded once");
  await ctx.generateVenueQR();
  assert.equal(calendarReloads.length, 1, "reload is throttled to once a minute");
});

test("a real network failure still says Offline mode", async () => {
  const { ctx, badges, calendarReloads } = makeContext({ nonceError: new TypeError("Failed to fetch") });
  await ctx.generateVenueQR();
  assert.equal(badges[0].textContent, "Offline mode · backup QR");
  assert.equal(calendarReloads.length, 0);
});

test("the live calendar loads once per organisation when the check-in panel starts", () => {
  const { ctx, calendarReloads } = makeContext();
  ctx.reloadCheckinCalendar(false);
  ctx.reloadCheckinCalendar(false);
  assert.equal(calendarReloads.length, 1);
  ctx.currentOrg = { id: "org_2" };
  ctx.reloadCheckinCalendar(false);
  assert.equal(calendarReloads.length, 2);
});

test("startCurrentEventQrPolling asks for the live calendar", () => {
  assert.match(extract("startCurrentEventQrPolling"), /reloadCheckinCalendar\(false\)/);
});
