import { getSmoothStepPath } from 'reactflow';

export default function CustomPipeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Static outer border: Black border with white fill */}
      <path
        id={`${id}-border`}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          stroke: 'black',
          strokeWidth: 8,
          fill: 'none',
          strokeDasharray: 'none',
          animation: 'none',
        }}
        markerEnd={markerEnd}
      />

      {/* White background pipe interior */}
      <path
        id={`${id}-background`}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          stroke: 'white',
          strokeWidth: 6,
          fill: 'none',
          strokeDasharray: 'none',
          animation: 'none',
        }}
      />

      {/* Animated inner flow: Dashed blue, animates on top */}
      <path
        id={`${id}-flow`}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: '#007bff',
          strokeWidth: 6,
          fill: 'none',
        }}
        markerEnd={markerEnd}
      />

      {/* Optional: Label */}
      <text>
        <textPath href={`#${id}-flow`} style={{ fontSize: '12px' }} startOffset="50%" textAnchor="middle">
          {data?.label || ''}
        </textPath>
      </text>
    </>
  );
}