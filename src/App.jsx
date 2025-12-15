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
  const [currentItem, setCurrentItem] = useState(null); // Node, Edge, or 'defaults' being edited
  const [formData, setFormData] = useState({}); // Temp state for editing

  // Global pipe defaults
  const [defaultPipeProps, setDefaultPipeProps] = useState({
    D: 0.1,           // m - diameter
    L: 100,           // m - length
    rho: 1000,        // kg/m³ - density
    epsilon: 0.00015, // m - roughness
    shape: 'circular', // pipe shape
  });

  // Global fluid settings
  const [globalFluid, setGlobalFluid] = useState('water_20C');
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

  const onConnect = useCallback(
    (params) => {
      // Inherit defaults for new edges
      const newEdge = { ...params, type: 'pipe', data: { ...defaultPipeProps } };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, defaultPipeProps]
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
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        ...(type === 'tank' && { fluidType: globalFluid, P: 101325, z: 0 })
      },
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
    setFormData(edge.data || defaultPipeProps);
    setIsModalOpen(true);
  }, [defaultPipeProps]);

  // Open global pipe defaults modal
  const openDefaultsModal = () => {
    setCurrentItem({ type: 'defaults' });
    setFormData({ ...defaultPipeProps, applyToAll: false });
    setIsModalOpen(true);
  };

  // Open global settings modal
  const openGlobalSettingsModal = () => {
    setIsGlobalModalOpen(true);
  };

  // Close global settings modal
  const closeGlobalSettingsModal = () => {
    setIsGlobalModalOpen(false);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    const numericFields = ['P', 'z', 'h_a', 'D', 'L', 'rho', 'epsilon', 'K'];

    let processedValue;
    if (inputType === 'checkbox') {
      processedValue = checked;
    } else if (numericFields.includes(name)) {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    } else {
      processedValue = value;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue
    }));
  };

  // Save changes
  const handleSave = () => {
    if (currentItem.type === 'defaults') {
      // Update global defaults
      const newDefaults = {
        D: formData.D,
        L: formData.L,
        rho: formData.rho,
        epsilon: formData.epsilon
      };
      setDefaultPipeProps(newDefaults);

      // Optionally apply to all existing edges
      if (formData.applyToAll) {
        setEdges((eds) =>
          eds.map((e) => ({ ...e, data: { ...e.data, ...newDefaults } }))
        );
      }
    } else if (currentItem.isNode) {
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

  // Clear Canvas: Reset nodes and edges
  const clearCanvas = () => {
    if (nodes.length === 0 && edges.length === 0) {
      alert('Canvas is already empty!');
      return;
    }
    if (window.confirm('Are you sure you want to clear the entire canvas? This action cannot be undone.')) {
      setNodes([]);
      setEdges([]);
    }
  };

  // Save Diagram to localStorage
  const saveDiagram = () => {
    if (nodes.length === 0 && edges.length === 0) {
      alert('Cannot save an empty diagram!');
      return;
    }
    const diagram = {
      nodes,
      edges,
      defaultPipeProps,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('pid-flow-diagram', JSON.stringify(diagram));
    alert('Diagram saved successfully!');
  };

  // Load Diagram from localStorage
  const loadDiagram = () => {
    const saved = localStorage.getItem('pid-flow-diagram');
    if (!saved) {
      alert('No saved diagram found!');
      return;
    }

    if (nodes.length > 0 || edges.length > 0) {
      if (!window.confirm('Loading will replace the current diagram. Continue?')) {
        return;
      }
    }

    try {
      const diagram = JSON.parse(saved);
      setNodes(diagram.nodes || []);
      setEdges(diagram.edges || []);
      if (diagram.defaultPipeProps) {
        setDefaultPipeProps(diagram.defaultPipeProps);
      }
      alert(`Diagram loaded successfully!\nSaved: ${diagram.timestamp ? new Date(diagram.timestamp).toLocaleString() : 'Unknown date'}`);
    } catch (error) {
      alert('Error loading diagram: Invalid format');
    }
  };

  // Conditional form fields based on type
  const renderFormFields = () => {
    if (!currentItem) return null;

    // Handle defaults modal
    if (currentItem.type === 'defaults') {
      return (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Diameter D (m):
            </label>
            <input
              type="number"
              name="D"
              value={formData.D !== undefined ? formData.D : 0.1}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="0.01"
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Length L (m):
            </label>
            <input
              type="number"
              name="L"
              value={formData.L !== undefined ? formData.L : 100}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="1"
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Density ρ (kg/m³):
            </label>
            <input
              type="number"
              name="rho"
              value={formData.rho !== undefined ? formData.rho : 1000}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="1"
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Roughness ε (m):
            </label>
            <input
              type="number"
              name="epsilon"
              value={formData.epsilon !== undefined ? formData.epsilon : 0.00015}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="0.00001"
            />
          </div>
          <div style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="applyToAll"
                checked={formData.applyToAll || false}
                onChange={handleInputChange}
                style={{ marginRight: '8px' }}
              />
              Apply to All Existing Pipes
            </label>
            <p style={{ color: '#d32f2f', fontSize: '12px', margin: '5px 0 0 0' }}>
              ⚠️ Warning: This will overwrite all pipe-specific settings!
            </p>
          </div>
        </>
      );
    }

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
              Pipe Shape:
            </label>
            <select
              name="shape"
              value={formData.shape || 'circular'}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              <option value="circular">Circular</option>
              <option value="rectangular">Rectangular</option>
              <option value="annular">Annular</option>
            </select>
          </div>

          {(formData.shape || 'circular') === 'circular' && (
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
          )}

          {formData.shape === 'rectangular' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Side a (m):
                </label>
                <input
                  type="number"
                  name="rect_a"
                  value={formData.rect_a || 0.1}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  step="0.01"
                  min="0"
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Side b (m):
                </label>
                <input
                  type="number"
                  name="rect_b"
                  value={formData.rect_b || 0.1}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  step="0.01"
                  min="0"
                />
              </div>
            </>
          )}

          {formData.shape === 'annular' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Outer Diameter D_outer (m):
                </label>
                <input
                  type="number"
                  name="D_outer"
                  value={formData.D_outer || 0.15}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  step="0.01"
                  min="0"
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Inner Diameter D_inner (m):
                </label>
                <input
                  type="number"
                  name="D_inner"
                  value={formData.D_inner || 0.1}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  step="0.01"
                  min="0"
                />
              </div>
            </>
          )}

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
              value={formData.epsilon !== undefined ? formData.epsilon : 0.00015}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              step="0.00001"
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

        <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <button
          onClick={openDefaultsModal}
          style={{
            width: '100%',
            padding: '10px',
            background: '#4477ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '10px'
          }}
        >
          Set Pipe Defaults
        </button>

        <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #ddd' }} />

        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Tools</h3>

        <button
          onClick={clearCanvas}
          style={{
            width: '100%',
            padding: '10px',
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '8px'
          }}
        >
          Clear Canvas
        </button>

        <button
          onClick={saveDiagram}
          style={{
            width: '100%',
            padding: '10px',
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '8px'
          }}
        >
          Save Diagram
        </button>

        <button
          onClick={loadDiagram}
          style={{
            width: '100%',
            padding: '10px',
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '8px'
          }}
        >
          Load Diagram
        </button>

        <button
          onClick={openGlobalSettingsModal}
          style={{
            width: '100%',
            padding: '10px',
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px'
          }}
        >
          ⚙️ Settings
        </button>
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
              {currentItem?.type === 'defaults'
                ? 'Set Global Pipe Defaults'
                : currentItem?.isNode
                ? `Edit ${currentItem.data?.label || currentItem.type} Properties`
                : 'Edit Pipe Properties'
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

      {/* Global Settings Modal */}
      {isGlobalModalOpen && (
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
            onClick={closeGlobalSettingsModal}
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
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              Global Fluid Settings
            </h3>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Default Fluid Type:
              </label>
              <select
                value={globalFluid}
                onChange={(e) => setGlobalFluid(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                {fluidTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
              This fluid type will be automatically assigned to new tanks.
              Individual tanks can still be customized after creation.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                onClick={closeGlobalSettingsModal}
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
                onClick={closeGlobalSettingsModal}
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
