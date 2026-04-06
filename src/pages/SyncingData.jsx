import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const TERMINAL_LOGS = [
  "System initialized. Connecting to FPL API...",
  "Connection established. Status 200 OK.",
  "Fetching Manager Data...",
  "Manager verified successfully.",
  "Downloading Gameweek History...",
  "History synced. 380 players updated.",
  "Fetching upcoming fixtures...",
  "Fixtures loaded. FDR calculated.",
  "Initializing Predictive AI Models...",
  "All models ready. Sync complete!",
];

const MODULES = [
  { title: "Squad Optimization", icon: "fa-users", tasks: ["Formation Analysis", "Captain Selection"] },
  { title: "Fixture Mapping", icon: "fa-calendar", tasks: ["FDR Calculation", "Blank GW Detection"] },
  { title: "Transfer Logic", icon: "fa-rotate", tasks: ["Price Change Tracking", "Differential Models"] },
];

export default function SyncingData() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [taskStatus, setTaskStatus] = useState([[false,false],[false,false],[false,false]]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let step = 0;
    const total = 10;
    const interval = setInterval(() => {
      step++;
      const pct = Math.round((step / total) * 100);
      setProgress(pct);
      const time = new Date().toLocaleTimeString();
      setLogs(prev => [...prev, `[${time}] ${TERMINAL_LOGS[step - 1] || ""}`]);
      // Update task statuses
      setTaskStatus([
        [step >= 3, step >= 5],
        [step >= 6, step >= 7],
        [step >= 8, step >= 9],
      ]);
      if (step >= total) {
        clearInterval(interval);
        setDone(true);
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen" style={{ background: "#0F121D" }}>
      {/* Header */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <i className="fa-solid fa-bolt text-white text-xs"></i>
          </div>
          <span className="text-white font-bold"><span className="text-blue-400">Predictive</span>FPL</span>
        </div>
        <span className="text-gray-400 text-sm">Help & Support</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex gap-1">
            <div className="w-8 h-1 rounded bg-blue-600"></div>
            <div className="w-8 h-1 rounded bg-blue-600"></div>
          </div>
          <span className="text-gray-400 text-sm">STEP 2/2</span>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-white text-3xl font-bold mb-2">
            <i className="fa-solid fa-microchip text-blue-400 mr-2"></i>
            Engine Room Active
          </h1>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            AI models are processing your FPL data and running predictive simulations across 380 players and 38 gameweeks.
          </p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {MODULES.map((mod, mi) => (
            <div key={mi} className="rounded-xl p-4 border border-white/10" style={{ background: "#1A1D2E" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${mod.icon} text-blue-400 text-sm`}></i>
                  <span className="text-white font-semibold text-sm">{mod.title}</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${taskStatus[mi][1] ? "bg-green-400" : "bg-blue-400 animate-pulse"}`}></div>
              </div>
              {mod.tasks.map((task, ti) => (
                <div key={ti} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{task}</span>
                    <span className={taskStatus[mi][ti] ? "text-white font-semibold" : "text-blue-400"}>
                      {taskStatus[mi][ti] ? "Complete" : "Running..."}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-blue-500 transition-all duration-1000"
                      style={{ width: taskStatus[mi][ti] ? "100%" : `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-3 gap-4">
          {/* Circular progress */}
          <div className="col-span-2 rounded-xl p-6 border border-white/10 flex items-center justify-center" style={{ background: "#1A1D2E" }}>
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#1e3a5f" strokeWidth="8"/>
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke="#3b82f6" strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white text-3xl font-bold">{progress}<span className="text-lg">%</span></span>
                <span className="text-blue-400 text-xs font-semibold tracking-widest">{done ? "COMPLETE" : "SYNCING..."}</span>
              </div>
            </div>

            {/* Terminal */}
            <div className="ml-6 flex-1">
              <div className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Terminal Output</div>
              <div className="bg-black/50 rounded-lg p-3 font-mono text-xs h-40 overflow-y-auto space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-green-400">{log}</div>
                ))}
                {!done && <span className="text-gray-500 animate-pulse">_</span>}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl p-4 border border-white/10 flex-1" style={{ background: "#1A1D2E" }}>
              <div className="flex items-center gap-2 mb-4">
                <i className="fa-solid fa-sliders text-blue-400 text-sm"></i>
                <span className="text-white font-semibold text-sm">Sync Preferences</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm">Background Sync</div>
                    <div className="text-gray-500 text-xs">Continue syncing if app is closed</div>
                  </div>
                  <div className="w-10 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm">Notify on Complete</div>
                    <div className="text-gray-500 text-xs">Send alert when models are ready</div>
                  </div>
                  <div className="w-10 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute left-1 top-1"></div>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 py-2 rounded-lg border border-white/10 text-gray-400 text-sm hover:border-blue-500 hover:text-white transition-colors">
                <i className="fa-solid fa-rotate mr-2"></i>Restart Connection
              </button>
            </div>

            <div className="rounded-xl p-4 border border-white/10" style={{ background: "#1A1D2E" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-database text-blue-400 text-sm"></i>
                <span className="text-white font-semibold text-sm">Data Summary</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-white font-bold text-lg">380</div>
                  <div className="text-gray-500 text-xs">Players</div>
                </div>
                <div>
                  <div className="text-white font-bold text-lg">25</div>
                  <div className="text-gray-500 text-xs">Gameweeks</div>
                </div>
                <div>
                  <div className="text-green-400 font-bold text-lg">{done ? "✓" : "..."}</div>
                  <div className="text-gray-500 text-xs">AI Models</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
