import { useState } from 'react';
import './App.css';
import { useQueueEngine } from './queue';
import DispatcherView from './DispatcherView';
import SupervisorView from './SupervisorView';

function App() {
  const [view, setView] = useState('dispatcher');
  const engine = useQueueEngine(50);

  return (
    <div>
      <nav className="view-tabs">
        <button
          className={`view-tab ${view === 'dispatcher' ? 'active' : ''}`}
          onClick={() => setView('dispatcher')}
        >
          Calltaker View
        </button>
        <button
          className={`view-tab ${view === 'supervisor' ? 'active' : ''}`}
          onClick={() => setView('supervisor')}
        >
          Supervisor Console
        </button>
      </nav>
      {view === 'dispatcher' ? <DispatcherView {...engine} /> : <SupervisorView {...engine} />}
    </div>
  );
}

export default App;

