import { useState, useCallback } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
  SmoothStepEdge, // For 90-degree bends with rounded corners
} from 'reactflow';
import 'reactflow/dist/style.css'; // Required CSS
import './App.css';

// Custom nodes
import TankNode from './components/TankNode';
import PumpNode from './components/PumpNode';
import ValveNode from './components/ValveNode';

// Map node types
const nodeTypes = {
  tank: TankNode,
  pump: PumpNode,
  valve: ValveNode,
};

// Custom edge types for pipe-like connections
const edgeTypes = {
  pipe: (props) => (
    <g>
      {/* Black border/outline */}
      <SmoothStepEdge
        {...props}
        style={{
          stroke: '#000',
          strokeWidth: 8,
          strokeDasharray: '5,5',
        }}
      />
      {/* Blue pipe interior */}
      <SmoothStepEdge
        {...props}
        style={{
          stroke: '#4A90E2',
          strokeWidth: 6,
          strokeDasharray: '5,5',
        }}
      />
    </g>
  ),
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'pipe' }, eds)),
    [setEdges]
  );

  // Handle drag/drop from sidebar
  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = { x: event.clientX - 200, y: event.clientY - 100 }; // Adjust for canvas offset
    const newNode = {
      id: `${type}-${nodes.length + 1}`,
      type,
      position,
      data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)}` }, // e.g., "Tank"
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar Palette */}
      <div style={{ width: '200px', padding: '10px', borderRight: '1px solid #ccc' }}>
        <h3>Components</h3>
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'tank')}
          style={{ padding: '10px', margin: '5px', background: '#eee', cursor: 'grab' }}
        >
          Tank
        </div>
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'pump')}
          style={{ padding: '10px', margin: '5px', background: '#eee', cursor: 'grab' }}
        >
          Pump
        </div>
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'valve')}
          style={{ padding: '10px', margin: '5px', background: '#eee', cursor: 'grab' }}
        >
          Valve
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }} onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
