import { useEffect, useRef, useState } from 'react';
import { ISSUE_REASONS, formatClock, formatPreciseTime, formatTimeOfDay, shiftLabel } from './queue';

const MY_ID_STORAGE_KEY = 'nonEmergencyQueue.myId';

function DispatcherView({ roster, slots, history, nextRollAt, now, rollSlot, acknowledgeSlot }) {
  const [myId, setMyId] = useState(() => {
    const stored = Number(localStorage.getItem(MY_ID_STORAGE_KEY));
    return roster.some((p) => p.id === stored) ? stored : null;
  });
  const [loginPick, setLoginPick] = useState('');
  const [issueSlot, setIssueSlot] = useState(null);
  const [issueReason, setIssueReason] = useState(ISSUE_REASONS[0]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const prevIds = useRef('');
  const [announceKey, setAnnounceKey] = useState(null);
  const announcedRef = useRef(new Set());

  const showToast = (message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  // Announce whenever the roster of people on deck changes.
  useEffect(() => {
    const ids = slots.map((s) => `${s.id}-${s.assignedAt}`).join(',');
    if (ids && ids !== prevIds.current) {
      const reason = history[0]?.reason;
      const message = reason && ISSUE_REASONS.includes(reason)
        ? `A replacement was pulled in early — ${reason}.`
        : `${slots.length} calltaker${slots.length === 1 ? '' : 's'} now on deck for the queue.`;
      showToast(message);
    }
    prevIds.current = ids;
    return () => toastTimer.current && clearTimeout(toastTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // Pop up the full-screen "you've been picked" announcement only for this calltaker's own
  // slot, and only once per pick.
  useEffect(() => {
    if (myId == null) return;
    const mySlot = slots.find((s) => s.id === myId);
    if (!mySlot || mySlot.accepted) return;
    const key = `${mySlot.slotIndex}-${mySlot.assignedAt}`;
    if (!announcedRef.current.has(key)) {
      announcedRef.current.add(key);
      setAnnounceKey(key);
    }
  }, [slots, myId]);

  const logIn = () => {
    if (!loginPick) return;
    const id = Number(loginPick);
    localStorage.setItem(MY_ID_STORAGE_KEY, String(id));
    setMyId(id);
  };

  const logOut = () => {
    localStorage.removeItem(MY_ID_STORAGE_KEY);
    setMyId(null);
    setLoginPick('');
  };

  const openIssue = (slotIndex) => {
    setIssueReason(ISSUE_REASONS[0]);
    setIssueSlot(slotIndex);
  };

  const confirmIssue = () => {
    rollSlot(issueSlot, issueReason);
    setIssueSlot(null);
  };

  const countdown = nextRollAt - now;
  const issuePerson = issueSlot !== null ? slots.find((s) => s.slotIndex === issueSlot) : null;

  const activeAnnounceSlot = announceKey
    ? slots.find((s) => `${s.slotIndex}-${s.assignedAt}` === announceKey && !s.accepted)
    : null;

  const acceptAnnouncement = () => {
    if (activeAnnounceSlot) acknowledgeSlot(activeAnnounceSlot.slotIndex);
    setAnnounceKey(null);
  };

  const announceHasIssue = () => {
    if (activeAnnounceSlot) openIssue(activeAnnounceSlot.slotIndex);
    setAnnounceKey(null);
  };

  const myPerson = myId != null ? roster.find((p) => p.id === myId) : null;
  const mySlot = myId != null ? slots.find((s) => s.id === myId) : null;

  if (!myPerson) {
    return (
      <div className="dispatch">
        <header className="dispatch-header">
          <div className="brand">
            <span className="live-dot" aria-hidden="true" />
            <span className="brand-sub">NON-EMERGENCY QUEUE</span>
          </div>
        </header>
        <main className="login-main">
          <div className="login-card">
            <h2>Who&apos;s working this terminal?</h2>
            <p className="disclaimer">
              Prototype login — pick your name to identify yourself so the queue knows who to
              pop the &ldquo;you&apos;ve been picked&rdquo; alert for.
            </p>
            <label htmlFor="login-select">Your name</label>
            <select id="login-select" value={loginPick} onChange={(e) => setLoginPick(e.target.value)}>
              <option value="">Choose your name…</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={logIn} disabled={!loginPick}>
              Log In
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dispatch">
      <header className="dispatch-header">
        <div className="brand">
          <span className="live-dot" aria-hidden="true" />
          <span className="brand-sub">NON-EMERGENCY QUEUE</span>
        </div>
        <div className="header-meta">
          <span className="shift-label">{shiftLabel(new Date(now))}</span>
          <span className="clock">{formatTimeOfDay(new Date(now))}</span>
          <span className="logged-in-as">{myPerson.name}</span>
          <button className="btn btn-ghost btn-small" onClick={logOut}>
            Switch user
          </button>
        </div>
      </header>

      {!mySlot && (
        <div className="waiting-banner">
          You&apos;re logged in as <strong>{myPerson.name}</strong> — waiting to be rolled into
          the queue.
        </div>
      )}

      <main className="dispatch-main dispatch-main-single">
        <section className="on-deck-panel">
          <div className="panel-title-row">
            <div className="panel-title">ON DECK</div>
            <div className="panel-summary">
              <span className="summary-badge">{slots.length} in queue</span>
              <span className="summary-badge">Next auto-roll in {formatClock(countdown)}</span>
            </div>
          </div>
          <div className="on-deck-grid">
            {slots.map((slot) => (
              <div
                className={`on-deck-card ${!slot.accepted ? 'needs-action' : ''}`}
                key={slot.slotIndex}
              >
                <div className="on-deck-card-body">
                  {slot.id === myId && <div className="you-flag">This is you</div>}
                  <div className="on-deck-name">
                    {slot.accepted ? slot.name : `Calltaker ${slot.slotIndex + 1}`}
                  </div>
                  <div className="picked-at">Picked at {formatPreciseTime(new Date(slot.assignedAt))}</div>
                  <div className="on-deck-stats">
                    <div className="stat">
                      <span className="stat-label">Time in queue</span>
                      <span className="stat-value">
                        {slot.acceptedAt ? formatClock(now - slot.acceptedAt) : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="next-up">{slot.nextUp ? 'Up next: assigned' : 'Up next: —'}</div>
                </div>
                {slot.id === myId ? (
                  !slot.accepted ? (
                    <div className="accept-banner">
                      <span>Waiting {formatClock(now - slot.assignedAt)} for accept</span>
                      <button
                        className="btn btn-primary btn-pulse"
                        onClick={() => acknowledgeSlot(slot.slotIndex)}
                      >
                        Accept
                      </button>
                    </div>
                  ) : (
                    <div className="on-deck-actions">
                      <button className="btn btn-ghost" onClick={() => rollSlot(slot.slotIndex, 'Relieved')}>
                        Relieved
                      </button>
                      <button className="btn btn-warning" onClick={() => openIssue(slot.slotIndex)}>
                        Have an issue?
                      </button>
                    </div>
                  )
                ) : (
                  <div className="read-only-tag">
                    {slot.accepted ? 'Active in queue' : 'Awaiting their acceptance'}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="disclaimer">
            Prototype concept — rolls automatically every hour from a pool of {roster.length}{' '}
            on-shift staff. Each person must <strong>Accept</strong> before they show as active
            in the queue. Click <strong>Relieved</strong> when you&apos;re done, or &ldquo;Have
            an issue?&rdquo; to notify a supervisor and roll someone else in immediately.
            Staffing level (how many people are pulled at once) is set from the supervisor
            console.
          </p>
        </section>
      </main>

      {activeAnnounceSlot && (
        <div className="modal-backdrop announce-backdrop" role="alertdialog" aria-modal="true">
          <div className="announce-modal">
            <div className="announce-icon" aria-hidden="true">
              🚨
            </div>
            <h2>You&apos;ve been picked for Non-Emergency</h2>
            <p className="announce-detail">
              {activeAnnounceSlot.relieving
                ? "You're relieving the previous calltaker in this slot."
                : 'You are filling an open spot in the queue.'}
            </p>
            <button className="btn btn-primary btn-pulse btn-announce" onClick={acceptAnnouncement}>
              Accept
            </button>
            <button className="btn btn-ghost btn-announce-secondary" onClick={announceHasIssue}>
              Have a problem?
            </button>
          </div>
        </div>
      )}

      {issueSlot !== null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Escalate to Supervisor</h2>
            <p>
              Let a supervisor know <strong>{issuePerson?.name}</strong> can&apos;t take the next
              queue pull right now, and roll someone else in immediately.
            </p>
            <label htmlFor="issue-reason">Reason</label>
            <select
              id="issue-reason"
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value)}
            >
              {ISSUE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setIssueSlot(null)}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={confirmIssue}>
                Notify Supervisor &amp; Roll
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default DispatcherView;

