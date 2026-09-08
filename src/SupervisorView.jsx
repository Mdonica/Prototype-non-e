import { useState } from 'react';
import { AUTO_ROLL_DELAYS, MIN_SLOTS, formatClock, formatTimeOfDay, shiftLabel } from './queue';
import HistoryList from './HistoryList';

function SupervisorView({
  roster,
  slots,
  slotCount,
  setSlotCount,
  autoRollDelayMs,
  setAutoRollDelayMs,
  history,
  nextRollAt,
  now,
  escalations,
  rollAll,
  rollSlot,
  acknowledgeSlot,
  acknowledgeEscalation,
  joinRequests,
  approveJoinRequest,
  denyJoinRequest,
}) {
  const [assignSlot, setAssignSlot] = useState('');
  const [assignPerson, setAssignPerson] = useState('');
  const [staffingInput, setStaffingInput] = useState(String(slotCount));

  const countdown = nextRollAt - now;
  const pendingEscalations = escalations.filter((e) => !e.acknowledged);

  const assignSelected = () => {
    if (assignSlot === '' || !assignPerson) return;
    rollSlot(Number(assignSlot), 'Manual roll', Number(assignPerson));
    setAssignSlot('');
    setAssignPerson('');
  };

  const applyStaffing = () => {
    const value = Number(staffingInput);
    if (!value || value < 1) {
      setStaffingInput(String(slotCount));
      return;
    }
    setSlotCount(value);
  };

  return (
    <div className="dispatch">
      <header className="dispatch-header">
        <div className="brand">
          <span className="live-dot" aria-hidden="true" />
          <span className="brand-sub">SUPERVISOR CONSOLE</span>
        </div>
        <div className="header-meta">
          <span className="shift-label">{shiftLabel(new Date(now))}</span>
          <span className="clock">{formatTimeOfDay(new Date(now))}</span>
        </div>
      </header>

      <main className="dispatch-main">
        <section className="on-deck-panel">
          <div className="panel-title">
            ON DECK ({slots.length}) · Next auto-roll in {formatClock(countdown)}
          </div>

          <div className="staffing-control">
            <label htmlFor="staffing-input">
              Number of people to roll into the queue — currently {slotCount}
            </label>
            <div className="staffing-row">
              <input
                id="staffing-input"
                type="number"
                min={MIN_SLOTS}
                max={roster.length}
                value={staffingInput}
                onChange={(e) => setStaffingInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyStaffing()}
              />
              <button className="btn btn-ghost" onClick={applyStaffing}>
                Set
              </button>
            </div>
          </div>

          <div className="staffing-control">
            <label htmlFor="roll-delay-select">Delay between automatic calltaker swaps</label>
            <select
              id="roll-delay-select"
              value={autoRollDelayMs}
              onChange={(e) => setAutoRollDelayMs(Number(e.target.value))}
            >
              {AUTO_ROLL_DELAYS.map((delay) => (
                <option key={delay.value} value={delay.value}>
                  {delay.label}
                </option>
              ))}
            </select>
            <p className="control-help">
              Immediate swaps everyone at once. Delayed options give each calltaker time to
              accept, sign out, and clear the queue before the next slot changes.
            </p>
          </div>

          <div className="on-deck-grid">
            {slots.map((slot) => (
              <div className="on-deck-card" key={slot.slotIndex}>
                <div className="on-deck-name">{slot.name}</div>
                <div className="on-deck-stats">
                  <div className="stat">
                    <span className="stat-label">Time in queue</span>
                    <span className="stat-value">
                      {slot.acceptedAt ? formatClock(now - slot.acceptedAt) : '—'}
                    </span>
                  </div>
                </div>
                <div className="next-up">
                  {slot.nextUp ? `Up next: ${slot.nextUp.name}` : 'Up next: —'}
                </div>
                {!slot.accepted && (
                  <div className="accept-banner">
                    <span>Awaiting accept</span>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => acknowledgeSlot(slot.slotIndex)}
                    >
                      Accept
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>

          <div className="on-deck-actions">
            <button className="btn btn-primary" onClick={() => rollAll('Manual roll')}>
              🎲 Roll All Now
            </button>
          </div>

          <div className="assign-picker">
            <label htmlFor="assign-slot">Insert a specific calltaker</label>
            <div className="assign-row">
              <select
                id="assign-slot"
                value={assignSlot}
                onChange={(e) => setAssignSlot(e.target.value)}
              >
                <option value="">Slot…</option>
                {slots.map((slot) => (
                  <option key={slot.slotIndex} value={slot.slotIndex}>
                    Slot {slot.slotIndex + 1} ({slot.name})
                  </option>
                ))}
              </select>
              <select
                value={assignPerson}
                onChange={(e) => setAssignPerson(e.target.value)}
              >
                <option value="">Choose a name…</option>
                {roster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-ghost"
                onClick={assignSelected}
                disabled={assignSlot === '' || !assignPerson}
              >
                Assign
              </button>
            </div>
          </div>

          <p className="disclaimer">
            Prototype concept — staffing level controls how many people are pulled into the
            queue at once. Nothing here is wired to a real backend yet.
          </p>
        </section>

        <section className="history-panel">
          <div className="panel-title">
            QUEUE REQUESTS {joinRequests.filter((request) => request.status === 'pending').length > 0 &&
              `(${joinRequests.filter((request) => request.status === 'pending').length} PENDING)`}
          </div>
          {joinRequests.filter((request) => request.status === 'pending').length === 0 ? (
            <p className="empty-state">No pending requests to join the queue.</p>
          ) : (
            <ul className="history-list">
              {joinRequests.filter((request) => request.status === 'pending').map((request) => (
                <li className="history-item flagged-item" key={request.id}>
                  <div className="history-main">
                    <span className="history-name">{request.name}</span>
                    <span className="history-unit">Requested {formatTimeOfDay(new Date(request.requestedAt))}</span>
                  </div>
                  <div className="request-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => approveJoinRequest(request.id)}
                    >
                      Accept request
                    </button>
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => denyJoinRequest(request.id)}
                    >
                      Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="history-panel">
          <div className="panel-title">
            ESCALATIONS {pendingEscalations.length > 0 && `(${pendingEscalations.length} PENDING)`}
          </div>
          {escalations.length === 0 ? (
            <p className="empty-state">No escalations reported this shift.</p>
          ) : (
            <ul className="history-list">
              {escalations.map((e) => (
                <li className={`history-item ${!e.acknowledged ? 'flagged-item' : ''}`} key={e.id}>
                  <div className="history-main">
                    <span className="history-name">{e.name}</span>
                  </div>
                  <div className="history-details">
                    <span>{formatTimeOfDay(new Date(e.at))}</span>
                    <span className="history-duration">{e.reason}</span>
                    {e.wasReplacing && <span>Was replacing: {e.wasReplacing}</span>}
                  </div>
                  <div className="history-reason">
                    {e.acknowledged ? (
                      <span>Acknowledged</span>
                    ) : (
                      <button className="btn btn-ghost btn-small" onClick={() => acknowledgeEscalation(e.id)}>
                        Acknowledge
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <section className="history-panel history-panel-wide">
        <div className="panel-title">RECENT HISTORY — THIS SHIFT</div>
        <HistoryList history={history} />
      </section>
    </div>
  );
}

export default SupervisorView;

