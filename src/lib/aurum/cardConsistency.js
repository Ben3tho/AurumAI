// AURUM AI v3.1 — Card Consistency Check.
// Enforces the single-source-of-truth rule: when FinalSignalGate = WAIT, no card
// may display an executable state (READY / ENTER / BUY NOW / SELL NOW / SNIPER ENTRY CONFIRMED).
// Allowed display states when WAIT: BUY SETUP DETECTED, SELL SETUP DETECTED,
// WAITING, BLOCKED, STALE, MIXED, NOT CONFIRMED, WAIT, WAITING FOR RETEST.

const FORBIDDEN_WHEN_WAIT = ["READY", "ENTER", "BUY NOW", "SELL NOW", "SNIPER ENTRY CONFIRMED"];

// Derive the display state each card SHOULD show, purely from the gate.
export function deriveCardStates(gate) {
  if (!gate) return { sniper: "WAITING", m15h1: "WAIT", live: "WAIT", signal: "WAIT" };
  // v3.2 — BLOCKED (data degraded) is treated like WAIT: no executable state.
  if (gate.blocked) {
    return { sniper: "BLOCKED", m15h1: "BLOCKED", live: "BLOCKED", signal: "BLOCKED" };
  }
  const wait = gate.finalSignal === "WAIT";
  if (!wait) {
    return {
      sniper: gate.finalSignal,
      m15h1: "ENTER NOW",
      live: gate.finalSignal,
      signal: gate.finalSignal
    };
  }
  const s = gate.setup;
  let m15h1 = "WAIT";
  if (s?.status === "WAITING_RETEST") m15h1 = "WAITING FOR RETEST";
  else if (s?.status === "STALE") m15h1 = "STALE";
  else if (s?.detected) m15h1 = `${s.direction} SETUP DETECTED`;
  const sniper = s?.detected ? `${s.direction} SETUP DETECTED` : "WAITING";
  const live = s?.detected ? "BLOCKED" : "WAIT";
  return { sniper, m15h1, live, signal: "WAIT" };
}

export function checkCardConsistency(gate) {
  const states = deriveCardStates(gate);
  const wait = !gate || gate.finalSignal === "WAIT" || !!gate?.blocked;
  const violations = [];
  if (wait) {
    for (const [card, state] of Object.entries(states)) {
      const upper = String(state).toUpperCase();
      if (FORBIDDEN_WHEN_WAIT.some((f) => upper.includes(f))) {
        violations.push({ card, state });
      }
    }
  }
  return { pass: violations.length === 0, violations, states };
}