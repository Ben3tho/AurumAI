// Live XAUUSD spot gold price proxy.
// Fetches the current spot gold price from a free, keyless public API
// (gold-api.com) server-side to avoid browser CORS restrictions.
// Returns: { price, timestamp, source } on success, { error } on failure.

export default async function (req) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return Response.json({ error: `Upstream error (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const price = Number(data.price);

    if (!Number.isFinite(price) || price <= 0) {
      return Response.json({ error: "Invalid price from upstream" }, { status: 502 });
    }

    return Response.json({
      price,
      timestamp: data.updatedAt || new Date().toISOString(),
      source: "gold-api.com"
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Live feed error" }, { status: 500 });
  }
}