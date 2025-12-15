import { Handle, Position } from 'reactflow';

export default function TankNode({ data }) {
  return (
    <div style={{ background: 'transparent', border: 'none', padding: 0 }}>
      {/* Handles positioned at realistic connection points */}
      <Handle
        type="target"
        position={Position.Left}
        id="inlet"
        style={{
          top: '50%',
          left: '-2px',
          width: '8px',
          height: '8px',
          background: '#555',
          border: '2px solid white',
          borderRadius: '50%'
        }}
      />

      {/* Professional 3D Tank with Metallic Finish */}
      <svg width="100" height="130" viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Metallic tank gradient */}
          <linearGradient id="tankMetallic" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E8E8E8" />
            <stop offset="30%" stopColor="#C0C0C0" />
            <stop offset="70%" stopColor="#A8A8A8" />
            <stop offset="100%" stopColor="#808080" />
          </linearGradient>

          {/* Top cap gradient */}
          <radialGradient id="tankTop" cx="50%" cy="30%">
            <stop offset="0%" stopColor="#F5F5F5" />
            <stop offset="100%" stopColor="#C0C0C0" />
          </radialGradient>

          {/* Liquid gradient */}
          <linearGradient id="liquidFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4A90E2" />
            <stop offset="50%" stopColor="#357ABD" />
            <stop offset="100%" stopColor="#2E6BA8" />
          </linearGradient>

          {/* Tank clipping path */}
          <clipPath id="tankBodyClip">
            <ellipse cx="50" cy="25" rx="35" ry="8" />
            <rect x="15" y="25" width="70" height="75" />
            <ellipse cx="50" cy="100" rx="35" ry="8" />
          </clipPath>

          {/* Shadow filter */}
          <filter id="tankShadow">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Tank main body (cylindrical) */}
        <g filter="url(#tankShadow)">
          {/* Bottom ellipse */}
          <ellipse cx="50" cy="100" rx="35" ry="8" fill="url(#tankMetallic)" stroke="#555" strokeWidth="1.5" />

          {/* Cylindrical walls */}
          <rect x="15" y="25" width="70" height="75" fill="url(#tankMetallic)" stroke="#555" strokeWidth="1.5" />

          {/* Top ellipse (3D cap) */}
          <ellipse cx="50" cy="25" rx="35" ry="8" fill="url(#tankTop)" stroke="#555" strokeWidth="1.5" />
        </g>

        {/* Liquid inside tank with animated waves */}
        <g clipPath="url(#tankBodyClip)">
          {/* Main liquid body */}
          <rect x="15" y="55" width="70" height="45" fill="url(#liquidFill)" opacity="0.8" />

          {/* Animated liquid surface wave */}
          <path d="M 15 55 Q 30 50 50 55 T 85 55 V 100 H 15 Z" fill="url(#liquidFill)" opacity="0.9">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 3 -2; 0 0; -3 2; 0 0"
              dur="4s"
              repeatCount="indefinite"
            />
          </path>

          {/* Secondary wave pattern */}
          <path d="M 15 57 Q 35 52 55 57 T 85 57" stroke="#2E6BA8" strokeWidth="1.5" fill="none" opacity="0.6">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; -2 1; 0 0; 2 -1; 0 0"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        {/* Tank nozzles/connections - Enhanced flanges */}
        <g>
          {/* Inlet nozzle (left) */}
          <rect x="8" y="66" width="16" height="10" rx="2" fill="#B8B8B8" stroke="#555" strokeWidth="1.5" />
          <rect x="10" y="68" width="12" height="6" rx="1" fill="#696969" stroke="#333" strokeWidth="1" />
          {/* Flange bolts */}
          <circle cx="11" cy="68" r="1" fill="#777" />
          <circle cx="11" cy="74" r="1" fill="#777" />
          <circle cx="21" cy="68" r="1" fill="#777" />
          <circle cx="21" cy="74" r="1" fill="#777" />

          {/* Outlet nozzle (right) */}
          <rect x="76" y="66" width="16" height="10" rx="2" fill="#B8B8B8" stroke="#555" strokeWidth="1.5" />
          <rect x="78" y="68" width="12" height="6" rx="1" fill="#696969" stroke="#333" strokeWidth="1" />
          {/* Flange bolts */}
          <circle cx="79" cy="68" r="1" fill="#777" />
          <circle cx="79" cy="74" r="1" fill="#777" />
          <circle cx="89" cy="68" r="1" fill="#777" />
          <circle cx="89" cy="74" r="1" fill="#777" />
        </g>

        {/* Level indicator gauge */}
        <rect x="92" y="30" width="4" height="65" fill="none" stroke="#555" strokeWidth="1" rx="2" />
        <rect x="91" y="55" width="6" height="3" fill="#FF6B6B" rx="1" />
        <text x="89" y="28" fontSize="6" fill="#555" textAnchor="end">100%</text>
        <text x="89" y="98" fontSize="6" fill="#555" textAnchor="end">0%</text>

        {/* Tank support structure */}
        <g stroke="#555" strokeWidth="2" opacity="0.7">
          <line x1="25" y1="100" x2="20" y2="115" />
          <line x1="75" y1="100" x2="80" y2="115" />
          <line x1="20" y1="115" x2="80" y2="115" />
        </g>

        {/* Industrial markings */}
        <rect x="20" y="110" width="60" height="8" rx="2" fill="#F8F9FA" stroke="#555" strokeWidth="1" />
        <text x="50" y="115" fontSize="5" textAnchor="middle" fill="#333">API 650 | 10000L</text>
      </svg>

      {/* Minimal label below tank */}
      <div style={{
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: '600',
        color: '#2C3E50',
        marginTop: '2px',
        fontFamily: 'Arial, sans-serif'
      }}>
        {data.label || 'Tank'}
      </div>

      {/* Property display */}
      {(data.pressure !== undefined || data.level !== undefined) && (
        <div style={{
          fontSize: '9px',
          color: '#666',
          textAlign: 'center',
          fontFamily: 'monospace',
          marginTop: '2px'
        }}>
          {data.pressure !== undefined && `P: ${data.pressure.toFixed(1)} bar`}
          {data.level !== undefined && ` | L: ${data.level}%`}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="outlet"
        style={{
          top: '50%',
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