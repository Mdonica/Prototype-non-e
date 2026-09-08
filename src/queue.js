import { useEffect, useMemo, useRef, useState } from 'react';

export const ROLL_INTERVAL_MS = 60 * 60 * 1000; // one hour
export const HISTORY_LIMIT = 12;
export const ESCALATION_LIMIT = 20;

const FIRST_NAMES = [
  'James', 'Maria', 'David', 'Linda', 'Robert', 'Patricia', 'Michael', 'Barbara',
  'William', 'Elizabeth', 'John', 'Jennifer', 'Carlos', 'Susan', 'Anthony', 'Jessica',
  'Kevin', 'Sarah', 'Brian', 'Karen', 'Marcus', 'Nancy', 'Steven', 'Lisa',
  'Andre', 'Michelle', 'Ryan', 'Amanda', 'Jason', 'Melissa', 'Eric', 'Stephanie',
  'Derek', 'Rebecca', 'Tyler', 'Laura', 'Jordan', 'Christine', 'Aaron', 'Angela',
  'Nathan', 'Kimberly', 'Justin', 'Emily', 'Samuel', 'Rachel', 'Victor', 'Diane',
  'Omar', 'Natalie',
];

const LAST_NAMES = [
  'Ortiz', 'Nguyen', 'Fisher', 'Bennett', 'Cole', 'Hayes', 'Reyes', 'Foster',
  'Grant', 'Powell', 'Ramirez', 'Sutton', 'Barnes', 'Price', 'Ellis', 'Chavez',
  'Wallace', 'Mercer', 'Douglas', 'Reid', 'Hendricks', 'Fuller', 'Vaughn', 'Kramer',
  'Sanders', 'Mosley', 'Dawson', 'Whitfield', 'Bowman', 'Larkin', 'Pruitt', 'Holloway',
  'Sharpe', 'Osborne', 'Delgado', 'Marsh', 'Winters', 'Kellerman', 'Boyd', 'Castillo',
  'Trent', 'Abernathy', 'Vega', 'Prescott', 'Lowery', 'Chandler', 'Novak', 'Briggs',
  'Salazar', 'Whitmore',
];

export const ISSUE_REASONS = [
  'Going to lunch',
  'On scheduled break',
  'Other',
];

export function generateRoster(count) {
  const usedDesks = new Set();
  const roster = [];
  for (let i = 0; i < count; i++) {
    let desk;
    do {
      desk = String(1000 + Math.floor(Math.random() * 9000));
    } while (usedDesks.has(desk));
    usedDesks.add(desk);
    roster.push({
      id: i + 1,
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
      desk,
    });
  }
  return roster;
}

export function pickNext(roster, excludeId) {
  const pool = roster.length > 1 ? roster.filter((p) => p.id !== excludeId) : roster;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Picks `count` unique roster members, skipping anyone already in `excludeIds`.
function pickMany(roster, count, excludeIds = []) {
  const pool = roster.filter((p) => !excludeIds.includes(p.id));
  const picks = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

// Gives every slot a distinct "up next" person, excluding anyone currently on deck.
function assignNextUps(slotsArr, roster) {
  const currentIds = slotsArr.map((s) => s.id);
  const chosenIds = [];
  return slotsArr.map((slot) => {
    const [next] = pickMany(roster, 1, [...currentIds, ...chosenIds]);
    if (next) chosenIds.push(next.id);
    return { ...slot, nextUp: next ? { id: next.id, name: next.name, desk: next.desk } : null };
  });
}

export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTimeOfDay(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatPreciseTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function shiftLabel(date) {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 'A DETAIL';
  if (hour >= 14 && hour < 22) return 'B DETAIL';
  return 'C DETAIL';
}

export const MIN_SLOTS = 1;

// Shared queue engine so the calltaker and supervisor views stay in sync.
export function useQueueEngine(rosterSize = 50, initialSlotCount = 3) {
  const roster = useMemo(() => generateRoster(rosterSize), [rosterSize]);
  const [slotCount, setSlotCountState] = useState(initialSlotCount);
  const [slots, setSlots] = useState([]);
  const [history, setHistory] = useState([]);
  const [nextRollAt, setNextRollAt] = useState(() => Date.now() + ROLL_INTERVAL_MS);
  const [now, setNow] = useState(Date.now());
  const [escalations, setEscalations] = useState([]);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const slotCountRef = useRef(slotCount);
  slotCountRef.current = slotCount;

  // Roll everyone at once (used for the hourly auto-roll and manual "Roll All").
  const rollAll = (reasonLabel) => {
    const rolledAt = Date.now();
    const prevSlots = slotsRef.current;
    if (prevSlots.length > 0) {
      setHistory((h) =>
        [...prevSlots.map((s) => ({ ...s, end: rolledAt, reason: reasonLabel })), ...h].slice(
          0,
          HISTORY_LIMIT
        )
      );
    }
    // Automatic hourly rolls randomize the active lineup; supervisor rolls can use pending replacements.
    const canPromoteNextUps =
      reasonLabel !== 'Scheduled roll' &&
      prevSlots.length === slotCountRef.current &&
      prevSlots.every((s) => s.nextUp);
    const newCurrents = canPromoteNextUps
      ? prevSlots.map((s, i) => ({
          ...roster.find((p) => p.id === s.nextUp.id),
          assignedAt: rolledAt,
          slotIndex: i,
          accepted: false,
          acceptedAt: null,
          relieving: { name: s.name, desk: s.desk },
        }))
      : pickMany(roster, slotCountRef.current).map((p, i) => ({
          ...p,
          assignedAt: rolledAt,
          slotIndex: i,
          accepted: false,
          acceptedAt: null,
          relieving: prevSlots[i] ? { name: prevSlots[i].name, desk: prevSlots[i].desk } : null,
        }));
    setSlots(assignNextUps(newCurrents, roster));
    setNextRollAt(rolledAt + ROLL_INTERVAL_MS);
  };

  // Roll just one slot (used for "Have an issue?" and manual single assignment).
  const rollSlot = (slotIndex, reasonLabel, targetId) => {
    const rolledAt = Date.now();
    const prevSlots = slotsRef.current;
    const prev = prevSlots.find((s) => s.slotIndex === slotIndex);
    if (prev) {
      setHistory((h) =>
        [{ ...prev, end: rolledAt, reason: reasonLabel }, ...h].slice(0, HISTORY_LIMIT)
      );
    }
    const excludeIds = prevSlots.map((s) => s.id);
    const next = targetId
      ? roster.find((p) => p.id === targetId)
      : prev?.nextUp
        ? roster.find((p) => p.id === prev.nextUp.id)
        : pickMany(roster, 1, excludeIds)[0];
    if (!next) return;
    setSlots((s) => {
      const updated = s.map((slot) =>
        slot.slotIndex === slotIndex
          ? {
              ...next,
              assignedAt: rolledAt,
              slotIndex,
              accepted: false,
              acceptedAt: null,
              relieving: prev ? { name: prev.name, desk: prev.desk } : null,
            }
          : slot
      );
      return assignNextUps(updated, roster);
    });
    if (prev && ISSUE_REASONS.includes(reasonLabel)) {
      setEscalations((e) =>
        [
          {
            id: `${prev.id}-${rolledAt}`,
            name: prev.name,
            desk: prev.desk,
            wasReplacing: prev.relieving?.name ?? null,
            reason: reasonLabel,
            at: rolledAt,
            acknowledged: false,
          },
          ...e,
        ].slice(0, ESCALATION_LIMIT)
      );
    }
  };

  // Supervisor staffing-level control: grow or shrink how many people are in the queue at once.
  const setSlotCount = (count) => {
    const clamped = Math.max(MIN_SLOTS, Math.min(roster.length, Math.round(count) || MIN_SLOTS));
    const prevSlots = slotsRef.current;
    setSlotCountState(clamped);
    if (clamped === prevSlots.length) return;
    const rolledAt = Date.now();
    if (clamped < prevSlots.length) {
      const removed = prevSlots.slice(clamped);
      setHistory((h) =>
        [
          ...removed.map((s) => ({ ...s, end: rolledAt, reason: 'Staffing reduced by supervisor' })),
          ...h,
        ].slice(0, HISTORY_LIMIT)
      );
      setSlots(prevSlots.slice(0, clamped));
    } else {
      const excludeIds = prevSlots.map((s) => s.id);
      const additions = pickMany(roster, clamped - prevSlots.length, excludeIds);
      const newSlots = additions.map((p, i) => ({
        ...p,
        assignedAt: rolledAt,
        slotIndex: prevSlots.length + i,
        accepted: false,
        acceptedAt: null,
        relieving: null,
      }));
      setSlots(assignNextUps([...prevSlots, ...newSlots], roster));
    }
  };

  const acknowledgeSlot = (slotIndex) => {
    const acceptedAt = Date.now();
    setSlots((s) =>
      s.map((slot) => (slot.slotIndex === slotIndex ? { ...slot, accepted: true, acceptedAt } : slot))
    );
  };

  const acknowledgeEscalation = (id) => {
    setEscalations((e) => e.map((x) => (x.id === id ? { ...x, acknowledged: true } : x)));
  };

  // Fill the initial slots on mount.
  useEffect(() => {
    rollAll('Scheduled roll');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clock tick + automatic hourly roll trigger.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= nextRollAt) {
        rollAll('Scheduled roll');
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextRollAt]);

  return {
    roster,
    slots,
    slotCount,
    setSlotCount,
    history,
    nextRollAt,
    now,
    escalations,
    rollAll,
    rollSlot,
    acknowledgeSlot,
    acknowledgeEscalation,
  };
}

