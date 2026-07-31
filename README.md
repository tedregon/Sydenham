# Sydenham Station Departures

Simple static web app that shows **live departures** for **Sydenham Station**:

- **Overground (Windrush)** — both directions, via the **TfL Unified API**
- **Southern** — both directions, via a **National Rail (Darwin)** JSON proxy

It also registers a **service worker** (`sw.js`) to cache basic assets for offline/slow-network use (PWA-style).

## What it displays

- A single departure list mixing **Overground** and **Southern**, sorted by expected departure time
- Overground: all Windrush arrivals at `910GSYDENHM` (inbound and outbound)
- Southern: National Rail departures at CRS `SYD` operated by Southern (`SN`)
- Each row shows platform direction (`→` for Platform 1, `←` for Platform 2), countdown, and destination
- Countdown shows minutes remaining (e.g. `3 min`), `Due`, `Cancelled`, or `Delayed`
- Refreshes the departures list every **60 seconds**

## Configuration

Data sources are configured in `index.html` inside the fetch helpers:

- TfL stop point: `910GSYDENHM` (Overground / Windrush)
- National Rail CRS: `SYD` (Southern), via `https://national-rail-api.davwheat.dev/`

If you need a different stop or operator, update the fetch URLs / filters in `index.html`.

## Local development / running

Because this is a static site, you can serve it with any local static server.

Example (Python):

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000`

## PWA / service worker notes

- The page registers `/sw.js` on load (`navigator.serviceWorker.register('/sw.js')`).
- For the service worker to work correctly:
  - Use **HTTPS** in production, or
  - Use `http://localhost` when testing locally.
- `manifest.json` references icon files (`icon-192.png`, `icon-512.png`). Those files are expected to exist in the site root.
  - If you don’t have them, update the `icons` section of `manifest.json` (or add the missing PNGs).

## License

Add a license header/file if you plan to publish this project.
