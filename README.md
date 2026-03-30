# Sydenham Station Departures

Simple static web app that shows **live inbound departures** for **Sydenham Station** by fetching data from the **TfL (Transport for London) Unified API**.

It also registers a **service worker** (`sw.js`) to cache basic assets for offline/slow-network use (PWA-style).

## What it displays

- Filters arrivals to only those whose `direction` is `inbound`
- Sorts by `expectedArrival`
- Shows time remaining in minutes (e.g. `3 min`) or `Due` if the departure time has passed
- Refreshes the departures list every **60 seconds**

## Configuration

The data source is configured in `index.html` inside the `fetchDepartures()` function:

- `stopPoint` (currently `910GSYDENHM`)
- `lineId` (currently `windrush`)

If you need a different stop or line, update the fetch URL in `index.html`.

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
