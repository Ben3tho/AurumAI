// CSV parser for XAUUSD M15 historical data.
// Handles common MT4/MT5/TickData export formats flexibly.
// Returns: { candles: [{time, open, high, low, close, volume}], meta: {...} }

function detectDelimiter(headerLine) {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(";")) return ";";
  if (headerLine.includes(",")) return ",";
  return ",";
}

const COLUMN_ALIASES = {
  time: ["time", "timestamp", "date", "datetime", "gmt"],
  open: ["open", "o"],
  high: ["high", "h"],
  low: ["low", "l"],
  close: ["close", "c", "price", "last"],
  volume: ["volume", "vol", "tickvol", "tick_volume", "v"]
};

function normalizeHeader(name) {
  return String(name).trim().toLowerCase().replace(/[\s_]/g, "");
}

function mapHeader(raw) {
  const n = normalizeHeader(raw);
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => normalizeHeader(a) === n)) return field;
    // also match if the normalized name starts with the alias
    if (aliases.some((a) => n.startsWith(normalizeHeader(a)))) return field;
  }
  return null;
}

function parseTimestamp(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  // Pure number -> epoch seconds or ms
  if (/^\d{10,13}$/.test(s)) {
    const num = Number(s);
    return num > 1e12 ? num : num * 1000; // ms
  }
  // Try the raw value first (handles MM/DD/YYYY HH:MM as local time),
  // then an ISO-converted form (space->T, dotted date).
  let t = Date.parse(s);
  if (!Number.isNaN(t)) return t;
  let iso = s.replace(" ", "T");
  iso = iso.replace(/(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3");
  t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function toNumber(value) {
  if (value == null || value === "") return NaN;
  const n = Number(String(value).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function parseCSV(text) {
  const trimmed = String(text).replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { candles: [], meta: { error: "Empty file" } };

  const lines = trimmed.split(/\r?\n/);
  const delimiter = detectDelimiter(lines.find((l) => l.includes(",")) || lines[0]);

  // Some exports prepend a title line before the real header (e.g.
  // "XAUUSD Historical Data" then "Date,Open,High,Low,Close,...").
  // Scan the first few lines for the real header row.
  let headerIdx = -1;
  let headerCells = [];
  let mapping = {};
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const cells = lines[i].split(delimiter);
    if (cells.some((c) => mapHeader(c) != null)) {
      headerIdx = i;
      headerCells = cells;
      break;
    }
  }

  let startIdx = 0;
  if (headerIdx >= 0) {
    startIdx = headerIdx + 1;
    headerCells.forEach((c, i) => {
      const field = mapHeader(c);
      if (field && mapping[field] == null) mapping[field] = i;
    });
  } else {
    // No header — assume order: time, open, high, low, close, volume
    mapping = { time: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 };
  }

  const candles = [];
  let skipped = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(delimiter);
    const time = parseTimestamp(cells[mapping.time]);
    const open = toNumber(cells[mapping.open]);
    const high = toNumber(cells[mapping.high]);
    const low = toNumber(cells[mapping.low]);
    const close = toNumber(cells[mapping.close]);
    const volume = mapping.volume != null ? toNumber(cells[mapping.volume]) : 0;

    if (time == null || [open, high, low, close].some(Number.isNaN)) {
      skipped++;
      continue;
    }
    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0
    });
  }

  candles.sort((a, b) => a.time - b.time);

  // Detect MT4/MT5 integer price format (e.g. gold stored ×100: 172497 -> 1724.97).
  let priceScale = 1;
  if (candles.length) {
    const sortedCloses = candles.map((c) => c.close).sort((a, b) => a - b);
    const medianClose = sortedCloses[Math.floor(sortedCloses.length / 2)];
    if (medianClose > 10000) {
      priceScale = 100;
      for (const c of candles) {
        c.open /= 100;
        c.high /= 100;
        c.low /= 100;
        c.close /= 100;
      }
    }
  }

  return {
    candles,
    meta: {
      delimiter,
      hasHeader: headerIdx >= 0,
      mapping,
      skipped,
      totalLines: lines.length,
      priceScale
    }
  };
}