import { Handle, Position } from 'reactflow';

export default function ValveNode({ data }) {
  const isOpen = data.isOpen !== false; // Default to open
  const openingPercentage = data.opening || (isOpen ? 100 : 0);

  return (
    <div style={{ background: 'transparent', border: 'none', padding: 0 }}>
      {/* Handles positioned at realistic pipe connection points */}
      <Handle
        type="target"
        position={Position.Left}
        id="inlet"
        style={{
          top: '60%',
          left: '-2px',
          width: '8px',
          height: '8px',
          background: '#555',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />

      {/* Professional Gate Valve with Metallic Industrial Design */}
      <svg width="120" height="110" viewBox="0 0 120 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Valve body metallic gradient */}
          <linearGradient id="valveBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8E8E8" />
            <stop offset="30%" stopColor="#C0C0C0" />
            <stop offset="70%" stopColor="#A8A8A8" />
            <stop offset="100%" stopColor="#888888" />
          </linearGradient>

          {/* Handwheel gradient */}
          <radialGradient id="handwheelGrad" cx="40%" cy="20%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="70%" stopColor="#DAA520" />
            <stop offset="100%" stopColor="#B8860B" />
          </radialGradient>

          {/* Gate/disc gradient */}
          <linearGradient id="gateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isOpen ? "#2ECC71" : "#E74C3C"} />
            <stop offset="100%" stopColor={isOpen ? "#27AE60" : "#C0392B"} />
          </linearGradient>

          {/* Pipe gradient */}
          <linearGradient id="pipeGrad" x1="0%" y1="30%" x2="0%" y2="70%">
            <stop offset="0%" stopColor="#95A5A6" />
            <stop offset="50%" stopColor="#7F8C8D" />
            <stop offset="100%" stopColor="#95A5A6" />
          </linearGradient>

          {/* Shadow filter */}
          <filter id="valveShadow">
            <feDropShadow dx="2" dy="3" stdDeviation="2" floodOpacity="0.4"/>
          </filter>

          {/* Flow arrow */}
          <marker id="valveFlowArrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={isOpen ? "#27AE60" : "#95A5A6"} />
          </marker>
        </defs>

        {/* Inlet pipe */}
        <g filter="url(#valveShadow)">
          <rect x="5" y="52" width="25" height="12" rx="2" fill="url(#pipeGrad)" stroke="#666" strokeWidth="1.5" />
          {/* Flange with more bolts */}
          <rect x="25" y="48" width="8" height="20" fill="#B8B8B8" stroke="#666" strokeWidth="1" />
          <circle cx="29" cy="50" r="1" fill="#666" />
          <circle cx="29" cy="56" r="1" fill="#666" />
          <circle cx="29" cy="62" r="1" fill="#666" />
          <circle cx="29" cy="68" r="1" fill="#666" />
        </g>

        {/* Outlet pipe */}
        <g filter="url(#valveShadow)">
          <rect x="90" y="52" width="25" height="12" rx="2" fill="url(#pipeGrad)" stroke="#666" strokeWidth="1.5" />
          {/* Flange with more bolts */}
          <rect x="87" y="48" width="8" height="20" fill="#B8B8B8" stroke="#666" strokeWidth="1" />
          <circle cx="91" cy="50" r="1" fill="#666" />
          <circle cx="91" cy="56" r="1" fill="#666" />
          <circle cx="91" cy="62" r="1" fill="#666" />
          <circle cx="91" cy="68" r="1" fill="#666" />
        </g>

        {/* Main valve body */}
        <g filter="url(#valveShadow)">
          <rect x="30" y="45" width="60" height="25" rx="5" fill="url(#valveBody)" stroke="#555" strokeWidth="2" />

          {/* Valve body details */}
          <rect x="35" y="40" width="50" height="35" rx="3" fill="none" stroke="#666" strokeWidth="1" opacity="0.6" />

          {/* Body reinforcement ribs */}
          <line x1="40" y1="45" x2="40" y2="70" stroke="#999" strokeWidth="1" />
          <line x1="50" y1="45" x2="50" y2="70" stroke="#999" strokeWidth="1" />
          <line x1="70" y1="45" x2="70" y2="70" stroke="#999" strokeWidth="1" />
          <line x1="80" y1="45" x2="80" y2="70" stroke="#999" strokeWidth="1" />
        </g>

        {/* Gate/disc mechanism */}
        <g>
          {/* Gate guide slots */}
          <rect x="55" y="47" width="10" height="21" fill="none" stroke="#777" strokeWidth="1" strokeDasharray="2,1" />

          {/* Gate/disc */}
          <rect
            x="57"
            y={isOpen ? "40" : "50"}
            width="6"
            height="18"
            rx="1"
            fill="url(#gateGrad)"
            stroke="#555"
            strokeWidth="1"
          >
            {/* Subtle animation when operating */}
            <animateTransform
              attributeName="transform"
              type="translate"
              values={isOpen ? "0,0; 0,-2; 0,0" : "0,0; 0,2; 0,0"}
              dur="3s"
              repeatCount="indefinite"
            />
          </rect>

          {/* Gate stem */}
          <rect x="58.5" y="25" width="3" height="25" fill="#7F8C8D" stroke="#555" strokeWidth="1" />
        </g>

        {/* Handwheel assembly */}
        <g filter="url(#valveShadow)">
          {/* Handwheel */}
          <circle cx="60" cy="20" r="15" fill="url(#handwheelGrad)" stroke="#B8860B" strokeWidth="2" />

          {/* Handwheel spokes */}
          <g stroke="#B8860B" strokeWidth="2">
            <line x1="45" y1="20" x2="75" y2="20" />
            <line x1="60" y1="5" x2="60" y2="35" />
            <line x1="49.4" y1="9.4" x2="70.6" y2="30.6" />
            <line x1="70.6" y1="9.4" x2="49.4" y2="30.6" />
          </g>

          {/* Center hub */}
          <circle cx="60" cy="20" r="4" fill="#DAA520" stroke="#B8860B" strokeWidth="1" />

          {/* Handwheel rim texture */}
          <circle cx="60" cy="20" r="13" fill="none" stroke="#B8860B" strokeWidth="1" opacity="0.5" />
          <circle cx="60" cy="20" r="11" fill="none" stroke="#B8860B" strokeWidth="0.5" opacity="0.3" />
        </g>

        {/* Position indicator */}
        <rect x="85" y="12" width="25" height="16" rx="3" fill="#F8F9FA" stroke="#666" strokeWidth="1" />
        <text x="97.5" y="18" fontSize="6" textAnchor="middle" fill="#333" fontWeight="bold">
          {isOpen ? "OPEN" : "SHUT"}
        </text>
        <text x="97.5" y="25" fontSize="4" textAnchor="middle" fill="#666">
          {openingPercentage}%
        </text>

        {/* Flow indication */}
        {isOpen && (
          <g opacity="0.8">
            <line
              x1="40"
              y1="58"
              x2="80"
              y2="58"
              stroke="#27AE60"
              strokeWidth="3"
              markerEnd="url(#valveFlowArrow)"
              strokeDasharray="6,4"
            >
              <animate attributeName="stroke-dashoffset" values="0;-10;0" dur="1.5s" repeatCount="indefinite" />
            </line>
          </g>
        )}

        {/* Valve rating nameplate */}
        <rect x="35" y="75" width="50" height="10" rx="2" fill="#F8F9FA" stroke="#666" strokeWidth="1" />
        <text x="60" y="81" fontSize="5" textAnchor="middle" fill="#333">GATE VALVE</text>
        <text x="60" y="86" fontSize="3.5" textAnchor="middle" fill="#666">DN80 PN16 | API 600</text>

        {/* Pressure test points */}
        <circle cx="42" cy="42" r="2" fill="#FF6B6B" stroke="#C0392B" strokeWidth="1" />
        <circle cx="78" cy="42" r="2" fill="#FF6B6B" stroke="#C0392B" strokeWidth="1" />

        {/* Bonnet bolts */}
        <circle cx="40" cy="35" r="1.5" fill="#666" />
        <circle cx="50" cy="35" r="1.5" fill="#666" />
        <circle cx="70" cy="35" r="1.5" fill="#666" />
        <circle cx="80" cy="35" r="1.5" fill="#666" />

        {/* Operating torque indicator */}
        {!isOpen && (
          <text x="20" y="35" fontSize="6" fill="#E74C3C" fontWeight="bold">⚠</text>
        )}
      </svg>

      {/* Minimal label below valve */}
      <div style={{
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '600',
        color: '#2C3E50',
        marginTop: '2px',
        fontFamily: 'Arial, sans-serif'
      }}>
        {data.label || 'Gate Valve'}
      </div>

      {/* Property display */}
      <div style={{
        fontSize: '9px',
        color: '#666',
        textAlign: 'center',
        fontFamily: 'monospace',
        marginTop: '2px'
      }}>
        <div>Status: {isOpen ? "Open" : "Closed"}</div>
        {data.cv !== undefined && <div>Cv: {data.cv}</div>}
        {data.dp !== undefined && <div>ΔP: {data.dp.toFixed(2)} bar</div>}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="outlet"
        style={{
          top: '60%',
          right: '-2px',
          width: '8px',
          height: '8px',
          background: '#555',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />
    </div>
  );
}