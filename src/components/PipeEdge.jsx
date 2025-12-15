import { getBezierPath } from 'reactflow';

export default function PipeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isFlowing = data?.isFlowing || false;
  const velocity = data?.velocity || 1;
  const animationDuration = Math.max(0.5, 3 / velocity);

  return (
    <>
      {/* Static outer border (pipe wall): thick, solid black */}
      <path
        id={`${id}-border`}
        style={{
          stroke: 'black',
          strokeWidth: 6,
          ...style,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* Animated inner flow: thinner, dashed blue, only if flowing */}
      <path
        id={`${id}-flow`}
        style={{
          stroke: 'blue',
          strokeWidth: 4,
          strokeDasharray: '5,5',
          animation: isFlowing ? `flow ${animationDuration}s linear infinite` : 'none',
        }}
        className="react-flow__edge-path"
        d={edgePath}
      />
      {/* Label if any */}
      <text>
        <textPath href={`#${id}-border`} style={{ fontSize: '12px' }} startOffset="50%" textAnchor="middle">
          {data?.label}
        </textPath>
      </text>
    </>
  );
}