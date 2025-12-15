import { Handle, Position } from 'reactflow';

export default function PumpNode({ data }) {
  const isRunning = data.running !== false;

  return (
    <div style={{ background: 'transparent', border: 'none', padding: 0 }}>
      {/* Handles positioned at realistic suction/discharge points */}
      <Handle
        type="target"
        position={Position.Left}
        id="inlet"
        style={{
          top: '41%',
          left: '-2px',
          width: '8px',
          height: '8px',
          background: '#555',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />

      {/* Professional Centrifugal Pump with Metallic Finish */}
      <svg width="110" height="100" viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Pump casing gradient (volute shell) */}
          <linearGradient id="pumpCasing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DCDCDC" />
            <stop offset="30%" stopColor="#C0C0C0" />
            <stop offset="70%" stopColor="#A0A0A0" />
            <stop offset="100%" stopColor="#808080" />
          </linearGradient>

          {/* Impeller metallic gradient */}
          <radialGradient id="impellerMetal" cx="50%" cy="30%">
            <stop offset="0%" stopColor="#F0F0F0" />
            <stop offset="70%" stopColor="#B8B8B8" />
            <stop offset="100%" stopColor="#909090" />
          </radialGradient>

          {/* Motor gradient */}
          <linearGradient id="motorCasing" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2C3E50" />
            <stop offset="50%" stopColor="#34495E" />
            <stop offset="100%" stopColor="#2C3E50" />
          </linearGradient>

          {/* Shadow filter */}
          <filter id="pumpShadow">
            <feDropShadow dx="3" dy="3" stdDeviation="2" floodOpacity="0.4"/>
          </filter>

          {/* Flow arrow marker */}
          <marker id="flowArrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#E74C3C" />
          </marker>
        </defs>

        {/* Pump base and mounting */}
        <g filter="url(#pumpShadow)">
          <rect x="20" y="80" width="70" height="10" rx="3" fill="#555" stroke="#333" strokeWidth="1" />
          <circle cx="30" cy="85" r="2" fill="#666" />
          <circle cx="80" cy="85" r="2" fill="#666" />
        </g>

        {/* Motor housing */}
        <g filter="url(#pumpShadow)">
          <rect x="35" y="10" width="40" height="25" rx="3" fill="url(#motorCasing)" stroke="#1A252F" strokeWidth="2" />
          <rect x="45" y="8" width="20" height="4" rx="2" fill="#444" />
          <circle cx="55" cy="12" r="1.5" fill="#FFD700" />
        </g>

        {/* Main pump volute casing */}
        <g filter="url(#pumpShadow)">
          {/* Volute spiral shape */}
          <path d="M 25 50 Q 15 35 25 25 Q 45 15 65 25 Q 95 35 85 50 Q 95 65 85 75 Q 65 85 45 75 Q 25 65 25 50 Z"
                fill="url(#pumpCasing)" stroke="#555" strokeWidth="2" />

          {/* Discharge nozzle with flange */}
          <rect x="85" y="45" width="20" height="10" rx="2" fill="url(#pumpCasing)" stroke="#555" strokeWidth="1.5" />
          {/* Flange bolts */}
          <circle cx="87" cy="47" r="1" fill="#666" />
          <circle cx="87" cy="53" r="1" fill="#666" />
          <circle cx="103" cy="47" r="1" fill="#666" />
          <circle cx="103" cy="53" r="1" fill="#666" />

          {/* Suction nozzle with flange */}
          <rect x="5" y="45" width="20" height="10" rx="2" fill="url(#pumpCasing)" stroke="#555" strokeWidth="1.5" />
          {/* Flange bolts */}
          <circle cx="7" cy="47" r="1" fill="#666" />
          <circle cx="7" cy="53" r="1" fill="#666" />
          <circle cx="23" cy="47" r="1" fill="#666" />
          <circle cx="23" cy="53" r="1" fill="#666" />
        </g>

        {/* Impeller assembly */}
        <g>
          {/* Impeller eye/hub */}
          <circle cx="55" cy="50" r="18" fill="url(#impellerMetal)" stroke="#666" strokeWidth="1.5" />

          {/* Rotating impeller blades */}
          <g className={isRunning ? 'pump-rotating' : ''}>
            {/* Impeller vanes */}
            <path d="M 55 32 Q 65 40 55 50 Q 45 60 55 68 Q 65 60 55 50 Q 45 40 55 32"
                  fill="#C0C0C0" stroke="#888" strokeWidth="1" opacity="0.8" />
            <path d="M 37 50 Q 45 60 55 50 Q 65 40 73 50 Q 65 60 55 50 Q 45 40 37 50"
                  fill="#C0C0C0" stroke="#888" strokeWidth="1" opacity="0.8" />

            {/* Central shaft */}
            <circle cx="55" cy="50" r="4" fill="#333" stroke="#111" strokeWidth="1" />

            {/* Rotation animation when running */}
            {isRunning && (
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0 55 50"
                to="360 55 50"
                dur="0.8s"
                repeatCount="indefinite"
              />
            )}
          </g>
        </g>

        {/* Flow indicators */}
        <g opacity={isRunning ? "1" : "0.4"}>
          {/* Suction flow */}
          <line x1="25" y1="50" x2="37" y2="50" stroke="#4A90E2" strokeWidth="3" markerEnd="url(#flowArrow)" strokeDasharray={isRunning ? "5,3" : "0"}>
            {isRunning && <animate attributeName="stroke-dashoffset" values="0;-8;0" dur="1s" repeatCount="indefinite" />}
          </line>

          {/* Discharge flow */}
          <line x1="73" y1="50" x2="85" y2="50" stroke="#E74C3C" strokeWidth="3" markerEnd="url(#flowArrow)" strokeDasharray={isRunning ? "5,3" : "0"}>
            {isRunning && <animate attributeName="stroke-dashoffset" values="0;-8;0" dur="1s" repeatCount="indefinite" />}
          </line>
        </g>

        {/* Instrumentation */}
        {/* Pressure gauge */}
        <circle cx="85" cy="30" r="6" fill="#F8F9FA" stroke="#333" strokeWidth="1" />
        <circle cx="85" cy="30" r="4" fill="none" stroke="#666" strokeWidth="1" />
        <line x1="85" y1="26" x2="85" y2="30" stroke="#E74C3C" strokeWidth="1" transform="rotate(45 85 30)" />

        {/* Running indicator LED */}
        {isRunning && (
          <circle cx="25" cy="25" r="3" fill="#2ECC71" stroke="#27AE60" strokeWidth="1">
            <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Nameplate */}
        <rect x="20" y="70" width="50" height="8" rx="1" fill="#F8F9FA" stroke="#666" strokeWidth="1" />
        <text x="45" y="75.5" fontSize="4" textAnchor="middle" fill="#333">CENTRIFUGAL PUMP</text>

        {/* Connection shaft to motor */}
        <rect x="53" y="35" width="4" height="10" fill="#666" stroke="#444" strokeWidth="0.5" />
      </svg>

      {/* Minimal label below pump */}
      <div style={{
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '600',
        color: '#2C3E50',
        marginTop: '2px',
        fontFamily: 'Arial, sans-serif'
      }}>
        {data.label || 'Pump'}
      </div>

      {/* Property display */}
      {(data.head !== undefined || data.flow !== undefined || data.power !== undefined) && (
        <div style={{
          fontSize: '9px',
          color: '#666',
          textAlign: 'center',
          fontFamily: 'monospace',
          marginTop: '2px'
        }}>
          {data.head !== undefined && `H: ${data.head}m`}
          {data.flow !== undefined && ` | Q: ${data.flow.toFixed(1)}m³/h`}
          {data.power !== undefined && ` | P: ${data.power}kW`}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="outlet"
        style={{
          top: '41%',
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