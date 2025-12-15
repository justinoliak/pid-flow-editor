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

// Solver constants for dropdowns
const fluidTypes = ['water_20C', 'water_100F', 'water_60F', 'water_10C', 'air_20C', 'air_80C', 'toluene_114C'];
const valveKTypes = ['elbow_90_flanged', 'elbow_90_threaded', 'valve_globe_open', 'valve_gate_open', 'entrance_square', 'exit'];

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
        }}
      />
      {/* Blue pipe interior */}
      <SmoothStepEdge
        {...props}
        style={{
          stroke: '#4A90E2',
          strokeWidth: 6,
        }}
      />
    </g>
  ),
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Modal state for property editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null); // Node or Edge being edited
  const [formData, setFormData] = useState({}); // Temp state for editing

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

  // Open modal on node click
  const onNodeClick = useCallback((event, node) => {
    setCurrentItem({ ...node, isNode: true });
    setFormData(node.data || {});
    setIsModalOpen(true);
  }, []);

  // Open modal on edge click
  const onEdgeClick = useCallback((event, edge) => {
    setCurrentItem({ ...edge, isNode: false });
    setFormData(edge.data || {});
    setIsModalOpen(true);
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numericFields = ['P', 'z', 'h_a', 'D', 'L', 'rho', 'epsilon', 'K'];
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value
    }));
  };

  // Save changes
  const handleSave = () => {
    if (currentItem.isNode) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === currentItem.id ? { ...n, data: { ...n.data, ...formData } } : n
        )
      );
    } else {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === currentItem.id ? { ...e, data: { ...e.data, ...formData } } : e
        )
      );
    }
    setIsModalOpen(false);
  };

  // Close modal
  const handleClose = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
    setFormData({});
  };

  // Conditional form fields based on type
  const renderFormFields = () => {
    if (!currentItem) return null;

    if (currentItem.isNode) {
      switch (currentItem.type) {
        case 'tank':
          return (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Fluid Type:
                </label>
                <select
                  name="fluidType"
                  value={formData.fluidType || 'water_20C'}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  {fluidTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Pressure P (Pa):
                </label>
                <input
                  type="number"
                  name="P"
                  value={formData.P || 101325}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Elevation z (m):
                </label>
                <input
                  type="number"
                  name="z"
                  value={formData.z || 0}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </>
          );
        case 'pump':
          return (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Pump Head h_a (m):
              </label>
              <input
                type="number"
                name="h_a"
                value={formData.h_a || 0}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          );
        case 'valve':
          return (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Minor Loss K Type:
                </label>
                <select
                  name="K_type"
                  value={formData.K_type || 'valve_gate_open'}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  {valveKTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Custom K Value (override):
                </label>
                <input
                  type="number"
                  name="K"
                  value={formData.K || 0}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </>
          );
        default:
          return <p>No editable properties for this node.</p>;
      }
    } else {
      // For edges (piping)
      return (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Diameter D (m):
            </label>
            <input
              type="number"
              name="D"
              value={formData.D || 0.1}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="0.01"
              min="0"
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Length L (m):
            </label>
            <input
              type="number"
              name="L"
              value={formData.L || 100}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="1"
              min="0"
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Density ρ (kg/m³):
            </label>
            <input
              type="number"
              name="rho"
              value={formData.rho || 1000}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="1"
              min="0"
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Roughness ε (m):
            </label>
            <input
              type="number"
              name="epsilon"
              value={formData.epsilon || 0.00015}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="0.00001"
              min="0"
            />
          </div>
        </>
      );
    }
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
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Property Editing Modal */}
      {isModalOpen && (
        <>
          {/* Modal backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0,0,0,0.5)',
              zIndex: 999,
            }}
            onClick={handleClose}
          />

          {/* Modal content */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              padding: '20px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              zIndex: 1000,
              minWidth: '350px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              Edit {currentItem?.isNode
                ? `${currentItem.data?.label || currentItem.type} Properties`
                : 'Pipe Properties'
              }
            </h3>

            {renderFormFields()}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Save
              </button>
              <button
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  background: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
