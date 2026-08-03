const statusEl = document.getElementById('status');
const liveTimeEl = document.getElementById('live-time');
const SLOT_COUNT = 8;
const TFL_ARRIVALS_URL = 'https://api.tfl.gov.uk/StopPoint/910GSYDENHM/Arrivals?lineId=windrush';
const NATIONAL_RAIL_URL = 'https://national-rail-api.davwheat.dev/departures/SYD/50';

let latestDepartures = [];

async function fetchDepartures() {
    const [overgroundResult, southernResult] = await Promise.allSettled([
        fetchOvergroundDepartures(),
        fetchSouthernDepartures()
    ]);

    const overground = overgroundResult.status === 'fulfilled' ? overgroundResult.value : [];
    const southern = southernResult.status === 'fulfilled' ? southernResult.value : [];

    if (overgroundResult.status === 'rejected' && southernResult.status === 'rejected') {
        setStatus('Error fetching departure data. Please try again later.', true);
        latestDepartures = [];
        renderTrains([]);
        return;
    }

    setStatus('');
    latestDepartures = [...overground, ...southern];
    renderTrains(latestDepartures);
}

async function fetchOvergroundDepartures() {
    const response = await fetch(TFL_ARRIVALS_URL);
    if (!response.ok) throw new Error('TfL response was not ok');
    const data = await response.json();
    return data
        .filter(d => (d.lineId || '').toLowerCase() === 'windrush')
        .map(d => ({
            operator: 'overground',
            platform: parsePlatform(d.platformName) || inferOvergroundPlatform(d.direction, d.destinationName),
            destination: cleanDestination(d.destinationName),
            expectedArrival: new Date(d.expectedArrival),
            cancelled: false
        }))
        .filter(d => d.platform);
}

async function fetchSouthernDepartures() {
    const response = await fetch(NATIONAL_RAIL_URL);
    if (!response.ok) throw new Error('National Rail response was not ok');
    const data = await response.json();
    return (data.trainServices || [])
        .filter(s => s.operatorCode === 'SN')
        .map(s => {
            const cancelled = Boolean(s.isCancelled) || s.etd === 'Cancelled';
            const destination = cleanDestination(s.destination?.[0]?.locationName);
            return {
                operator: 'southern',
                platform: parsePlatform(s.platform) || inferSouthernPlatform(destination),
                destination,
                expectedArrival: cancelled ? null : parseBoardTime(s.etd, s.std),
                cancelled
            };
        })
        .filter(s => s.destination && s.platform);
}

function renderTrains(departures) {
    const now = Date.now();
    const upcoming = departures
        .filter(d => !d.cancelled && d.expectedArrival && (d.platform === '1' || d.platform === '2'))
        .map(d => ({
            ...d,
            minutes: Math.max(0, Math.floor((d.expectedArrival.getTime() - now) / 60000))
        }))
        .filter(d => d.expectedArrival.getTime() >= now)
        .sort((a, b) => a.minutes - b.minutes || a.expectedArrival - b.expectedArrival);

    for (const platform of ['1', '2']) {
        const el = document.querySelector(`[data-trains="${platform}"]`);
        if (!el) continue;
        const trains = upcoming.filter(d => d.platform === platform).slice(0, SLOT_COUNT);
        const slots = Array.from({ length: SLOT_COUNT }, (_, i) => trains[i] || null);
        el.innerHTML = slots.map(rowMarkup).join('');
    }
}

function rowMarkup(d, index) {
    if (!d) return `<article class="row row-empty" aria-hidden="true"></article>`;
    const title = `${d.destination} · ${d.minutes} min · ${d.operator}`;
    return `<article class="row" data-operator="${d.operator}" data-index="${index}" title="${escapeAttr(title)}">
        <p class="row-minutes">${d.minutes}</p>
        <p class="row-dest">${escapeHtml(d.destination)}</p>
    </article>`;
}

function parsePlatform(platform) {
    if (platform === null || platform === undefined || platform === '') return null;
    const match = String(platform).match(/(\d+)/);
    return match && (match[1] === '1' || match[1] === '2') ? match[1] : null;
}

function inferOvergroundPlatform(direction, destination) {
    const dir = String(direction || '').toLowerCase();
    if (dir === 'inbound') return '1';
    if (dir === 'outbound') return '2';
    const dest = String(destination || '').toLowerCase();
    if (dest.includes('highbury')) return '1';
    if (dest.includes('croydon') || dest.includes('crystal palace')) return '2';
    return null;
}

function inferSouthernPlatform(destination) {
    const dest = String(destination || '').toLowerCase();
    if (dest.includes('london bridge')) return '1';
    if (dest.includes('victoria')) return '2';
    return null;
}

function parseBoardTime(etd, std) {
    const time = etd && /^\d{2}:\d{2}$/.test(etd) ? etd : std;
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const expected = new Date();
    expected.setSeconds(0, 0);
    expected.setHours(hours, minutes, 0, 0);
    if (expected.getTime() < Date.now() - 30 * 60000) expected.setDate(expected.getDate() + 1);
    return expected;
}

function cleanDestination(name) {
    return name ? name.replace(/\s+Rail Station$/i, '') : '';
}

function setStatus(message, isError = false) {
    if (!message) {
        statusEl.hidden = true;
        statusEl.textContent = '';
        return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
}

function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
}

function updateLiveTime() {
    liveTimeEl.textContent = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());
}

fetchDepartures();
setInterval(fetchDepartures, 60000);
updateLiveTime();
setInterval(updateLiveTime, 15000);
