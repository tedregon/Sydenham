const statusEl = document.getElementById('status');
const liveTimeEl = document.getElementById('live-time');
const SLOT_COUNT = 8;
const AXIS_MAX_MIN = 60;
const COLLISION_GAP_PX = 8;
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

function upcomingDepartures(departures) {
    const now = Date.now();
    return departures
        .filter(d => !d.cancelled && d.expectedArrival && (d.platform === '1' || d.platform === '2'))
        .map(d => ({
            ...d,
            minutes: Math.max(0, Math.floor((d.expectedArrival.getTime() - now) / 60000))
        }))
        .filter(d => d.expectedArrival.getTime() >= now)
        .sort((a, b) => a.minutes - b.minutes || a.expectedArrival - b.expectedArrival);
}

function renderTrains(departures) {
    const upcoming = upcomingDepartures(departures);

    for (const platform of ['1', '2']) {
        const el = document.querySelector(`[data-trains="${platform}"]`);
        if (!el) continue;
        const trains = upcoming.filter(d => d.platform === platform).slice(0, SLOT_COUNT);
        el.innerHTML = trains.map(trainMarkup).join('');
        resolveCollisions(el);
    }
}

function trainMarkup(d) {
    const t = Math.min(1, d.minutes / AXIS_MAX_MIN);
    const bottom = (1 - t) * 100;
    const initials = destinationInitials(d.destination);
    const title = `${d.destination} · ${d.minutes} min · ${d.operator}`;

    return `<article class="train" data-operator="${d.operator}" style="bottom: ${bottom}%" title="${escapeAttr(title)}">
        <div class="train-info">
            <p class="train-minutes">${d.minutes}</p>
            <p class="train-dest">${escapeHtml(initials)}</p>
        </div>
        <div class="train-dot" aria-hidden="true"></div>
    </article>`;
}

function resolveCollisions(container) {
    const trains = Array.from(container.querySelectorAll('.train'));
    if (trains.length < 2) return;
    const height = container.getBoundingClientRect().height;
    if (height <= 0) return;

    for (let i = 1; i < trains.length; i++) {
        const prev = trains[i - 1].getBoundingClientRect();
        const curr = trains[i];
        const currRect = curr.getBoundingClientRect();
        const overlap = prev.top - COLLISION_GAP_PX - currRect.bottom;
        if (overlap >= 0) continue;
        const current = parseFloat(curr.style.bottom) || 0;
        curr.style.bottom = `${current + ((-overlap) / height) * 100}%`;
    }
}

function destinationInitials(name) {
    const skip = new Set(['and', 'the', '&', 'via', 'rail', 'station']);
    const words = String(name).split(/[\s\-/]+/).map(w => w.replace(/[^A-Za-z]/g, '')).filter(w => w && !skip.has(w.toLowerCase()));
    if (!words.length) return '??';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
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

window.addEventListener('resize', () => {
    if (latestDepartures.length) renderTrains(latestDepartures);
});

fetchDepartures();
setInterval(fetchDepartures, 60000);
updateLiveTime();
setInterval(updateLiveTime, 15000);
