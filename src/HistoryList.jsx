import { formatClock, formatTimeOfDay } from './queue';

function HistoryList({ history }) {
  if (history.length === 0) {
    return <p className="empty-state">No one has rolled off the queue yet.</p>;
  }

  return (
    <ul className="history-list">
      {history.map((entry, i) => (
        <li className="history-item" key={`${entry.id}-${entry.assignedAt}-${i}`}>
          <div className="history-main">
            <span className="history-name">{entry.name}</span>
          </div>
          <div className="history-details">
            <span>
              {formatTimeOfDay(new Date(entry.assignedAt))}–{formatTimeOfDay(new Date(entry.end))}
            </span>
            <span className="history-duration">{formatClock(entry.end - entry.assignedAt)}</span>
          </div>
          <div className={`history-reason ${entry.reason !== 'Scheduled roll' ? 'flagged' : ''}`}>
            {entry.reason}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default HistoryList;
