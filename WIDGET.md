# IRLid Receipt Verification Widget — Integration Guide

The IRLid widget lets any website embed receipt verification in an `iframe`. When a user pastes a valid IRLid receipt hash, the widget checks it against the IRLid database and signals success to the parent page via `postMessage`.

## Quick Start

```html
<iframe
  src="https://irlid.co.uk/widget.html"
  width="100%"
  height="130"
  style="border: 0;"
  allow="camera"
></iframe>

<script>
  window.addEventListener("message", function (event) {
    if (event.origin !== "https://irlid.co.uk") return;
    if (event.data?.type === "irlid-verified") {
      console.log("Verified!", event.data.hash);
      // Unlock your sign-in button, proceed with registration, etc.
    }
  });
</script>
```

See `demo-login.html` for a full working example.

---

## Messages from the Widget

### Success

Sent when a receipt hash is found in the IRLid database.

```json
{
  "type": "irlid-verified",
  "hash": "abc123…",
  "timestamp": "2026-04-11T14:32:00.000Z",
  "lat": 51.50741,
  "lon": -0.12776
}
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"irlid-verified"` |
| `hash` | string | The receipt hash that was verified |
| `timestamp` | string | ISO 8601 timestamp from the receipt |
| `lat` | number \| null | Latitude from the receipt payload |
| `lon` | number \| null | Longitude from the receipt payload |

### Failure / Not Found

The widget shows an error message inline. No `postMessage` is sent on failure — the parent page simply never receives an `irlid-verified` event.

---

## Security

**Always validate `event.origin`** before trusting any message:

```js
if (event.origin !== "https://irlid.co.uk") return;
```

Also validate `event.data` is an object and `event.data.type` is a known value before acting on it.

---

## What the Widget Verifies

The widget calls the IRLid Cloudflare Worker (`/receipts/{hash}`) to confirm the receipt exists in the database. For full cryptographic verification (signature checks, GPS distance, timestamp window), link users to:

```
https://irlid.co.uk/check.html#receipt={hash}
```

The widget includes a "Full verification →" link for this automatically.

---

## Notes

- The widget is self-contained — no JavaScript SDK needed on the parent page
- GPS coordinates in the success message come from the receipt payload; they reflect what both parties attested to at signing time
- Receipt hashes are permanent — a hash that verifies today will verify indefinitely
- For a live demo, open `demo-login.html` in a browser alongside `widget.html` in the same folder
