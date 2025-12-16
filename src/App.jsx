import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import Modal from 'react-modal';
import 'reactflow/dist/style.css'; // Required CSS
import './App.css';

// Custom nodes
import TankNode from './components/TankNode';
import PumpNode from './components/PumpNode';
import ValveNode from './components/ValveNode';
import CustomPipeEdge from './components/CustomPipeEdge';


// Map node types
const nodeTypes = {
  tank: TankNode,
  pump: PumpNode,
  valve: ValveNode,
};

// Solver Mode Information
const SOLVER_MODE_INFO = {
  'auto': {
    name: 'Auto-Detect',
    description: 'Automatically selects the best mode based on your diagram components',
    required: {
      components: ['Any valid P&ID configuration'],
      variables: ['Based on detected mode']
    },
    optional: [],
    notes: 'Detects pumps, valves, and system configuration to choose optimal solver'
  },
  'gravity': {
    name: 'Gravity Flow',
    description: 'Calculates flow rate driven purely by elevation difference and pressure',
    required: {
      components: ['Two tanks at different elevations', 'Connecting pipe(s)'],
      variables: [
        'Tank 1: z1 (elevation), P1 (pressure)',
        'Tank 2: z2 (elevation), P2 (pressure)',
        'Pipe: D (diameter), L (length), ε (roughness)',
        'Fluid: ρ (density), μ (viscosity)'
      ]
    },
    optional: ['K_total (minor losses)', 'Fittings'],
    notes: 'Solves for Q when no pump is present'
  },
  'system_curve': {
    name: 'System Curve',
    description: 'Generates the system resistance curve (Head vs Flow)',
    required: {
      components: ['Complete piping system'],
      variables: [
        'All pipe dimensions (D, L, ε)',
        'Static head (z2 - z1)',
        'Pressure difference (P2 - P1)',
        'Fluid properties (ρ, μ)'
      ]
    },
    optional: ['Flow rate range for curve generation'],
    notes: 'Produces H vs Q curve for pump selection'
  },
  'given_pump_head': {
    name: 'Fixed Pump Head',
    description: 'Calculates flow rate when pump head is known',
    required: {
      components: ['Pump with specified head', 'Complete flow path'],
      variables: [
        'Pump: h_a (pump head in meters)',
        'System geometry (all elevations)',
        'All pipe properties',
        'Boundary pressures (P1, P2)'
      ]
    },
    optional: ['Pump efficiency', 'NPSH available'],
    notes: 'Finds Q given a fixed pump head'
  },
  'given_pump_power': {
    name: 'Fixed Pump Power',
    description: 'Calculates flow when shaft power is constrained',
    required: {
      components: ['Pump with power specification'],
      variables: [
        'Pump: W_shaft (shaft power in Watts)',
        'Pump efficiency η',
        'System parameters (same as gravity flow)'
      ]
    },
    optional: ['Motor specifications'],
    notes: 'Determines achievable flow with power limit'
  },
  'given_Q_and_power': {
    name: 'Fixed Q and Power',
    description: 'Validates if specified flow is achievable with given power',
    required: {
      components: ['Pump system'],
      variables: [
        '🔸 Q (target flow rate) - REQUIRES MODAL INPUT',
        '🔸 W_shaft (available power) - REQUIRES MODAL INPUT',
        'All system parameters'
      ]
    },
    optional: [],
    notes: '⚠️ Opens modal for Q and W_shaft input'
  },
  'operating_point': {
    name: 'Operating Point',
    description: 'Finds intersection of pump curve and system curve',
    required: {
      components: ['Pump with performance curve'],
      variables: [
        'Pump curve data (H vs Q points)',
        'Or curve coefficients (a, b, c for H = aQ² + bQ + c)',
        'Complete system parameters'
      ]
    },
    optional: ['Efficiency curve', 'NPSH curve'],
    notes: 'Most realistic pump analysis mode'
  },
  'inverse_diameter': {
    name: 'Inverse Diameter',
    description: 'Calculates required pipe diameter for target flow',
    required: {
      components: ['Complete system layout'],
      variables: [
        '🔸 Q (target flow rate) - REQUIRES MODAL INPUT',
        '🔸 h_a (available pump head) - REQUIRES MODAL INPUT',
        'Pipe length L',
        'All other system parameters'
      ]
    },
    optional: ['Diameter constraints (min/max)'],
    notes: '⚠️ Opens modal for target Q and h_a'
  },
  'inverse_length': {
    name: 'Inverse Length',
    description: 'Calculates maximum pipe length for target flow',
    required: {
      components: ['System with unknown pipe length'],
      variables: [
        '🔸 Q (target flow rate) - REQUIRES MODAL INPUT',
        '🔸 h_a (available pump head) - REQUIRES MODAL INPUT',
        'Pipe diameter D',
        'All other parameters'
      ]
    },
    optional: ['Route constraints'],
    notes: '⚠️ Opens modal for target Q and h_a'
  }
};

// Solver constants for dropdowns
const fluidTypes = ['water_20C', 'water_100F', 'water_60F', 'water_10C', 'air_20C', 'air_80C', 'toluene_114C'];
const valveKTypes = [
  'valve_globe_open',
  'valve_globe_half_open',
  'valve_angle_open',
  'valve_gate_open',
  'valve_gate_1/4_closed',
  'valve_gate_1/2_closed',
  'valve_gate_3/4_closed',
  'valve_ball_open',
  'valve_check_swing'
];

// Sorted fitting types for minor losses
const fittingTypes = [
  'elbow_45_flanged',
  'elbow_45_threaded',
  'elbow_90_flanged',
  'elbow_90_long_radius_flanged',
  'elbow_90_long_radius_threaded',
  'elbow_90_threaded',
  'entrance_reentrant',
  'entrance_rounded',
  'entrance_square',
  'exit',
  'return_bend_180_flanged',
  'return_bend_180_threaded',
  'tee_branch_flow_flanged',
  'tee_branch_flow_threaded',
  'tee_line_flow_flanged',
  'tee_line_flow_threaded',
  'union_threaded',
  'valve_angle_open',
  'valve_ball_open',
  'valve_check_swing',
  'valve_gate_1/4_closed',
  'valve_gate_1/2_closed',
  'valve_gate_3/4_closed',
  'valve_gate_open',
  'valve_globe_half_open',
  'valve_globe_open'
];

// Custom edge types for pipe-like connections
const edgeTypes = {
  pipe: CustomPipeEdge,
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Modal state for property editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null); // Node, Edge, or 'defaults' being edited
  const [formData, setFormData] = useState({}); // Temp state for editing

  // Mode selection and extras handling
  const [selectedMode, setSelectedMode] = useState('auto');
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [extras, setExtras] = useState({ Q: 0.01, h_a: 25, W_shaft: 1000 });
  const [showModeInfo, setShowModeInfo] = useState(false);

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

  // Global flow rate settings
  const [flowRateSettings, setFlowRateSettings] = useState({
    type: 'unknown', // 'volumetric', 'mass', or 'unknown'
    value: 0.01,     // m³/s or kg/s (when not unknown)
  });

  // Solver results state
  const [solverResults, setSolverResults] = useState(null);
  const [isSolving, setIsSolving] = useState(false);
  const [warnings, setWarnings] = useState([]);

  // Fittings modal state
  const [isFittingsModalOpen, setIsFittingsModalOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [fittingsFormData, setFittingsFormData] = useState({ fittings: [], K_total: '' });
  const [tempFittingName, setTempFittingName] = useState('');
  const [tempFittingQty, setTempFittingQty] = useState('');

  // Set app element for modal
  useEffect(() => {
    Modal.setAppElement('#root');
  }, []);

  const onConnect = useCallback(
    (params) => {
      // Inherit defaults for new edges with default animation
      const newEdge = {
        ...params,
        type: 'pipe',
        data: { ...defaultPipeProps },
        animated: true,
        style: {
          strokeDasharray: '10,5',
          animation: 'pipe-flow 0.5s linear infinite',
        }
      };
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
    setSelectedEdgeId(edge.id);
    setCurrentItem({ ...edge, isNode: false });
    setFormData(edge.data || defaultPipeProps);
    setIsModalOpen(true);
  }, [defaultPipeProps]);

  // Open global pipe defaults modal
  const openDefaultsModal = () => {
    setCurrentItem({ type: 'defaults' });
    setFormData({ ...defaultPipeProps, globalFluid, flowRateSettings });
    setIsModalOpen(true);
  };


  // Open fittings modal
  const openFittingsModal = () => {
    // Reset form data when opening
    setFittingsFormData({ fittings: [], K_total: '' });
    setIsFittingsModalOpen(true);
  };

  // Close fittings modal
  const closeFittingsModal = () => {
    setIsFittingsModalOpen(false);
    setTempFittingName('');
    setTempFittingQty('');
  };

  // Add fitting to list
  const addFitting = () => {
    if (tempFittingName) {
      const updatedFittings = [...fittingsFormData.fittings, {
        name: tempFittingName,
        qty: parseInt(tempFittingQty) || 1
      }];
      setFittingsFormData({ ...fittingsFormData, fittings: updatedFittings });
      setTempFittingName('');
      setTempFittingQty('');
    }
  };

  // Remove fitting from list
  const removeFitting = (index) => {
    const updated = fittingsFormData.fittings.filter((_, i) => i !== index);
    setFittingsFormData({ ...fittingsFormData, fittings: updated });
  };

  // Save fittings to selected edge
  const saveFittings = () => {
    if (selectedEdgeId) {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdgeId
            ? { ...e, data: { ...e.data, minorLosses: fittingsFormData } }
            : e
        )
      );
    }
    closeFittingsModal();
  };

  // Handle Solve button - serialize graph and run solver
  const handleSolve = async () => {
    setIsSolving(true);
    setWarnings([]);  // Clear previous warnings

    try {
      // Prepare graph data for API
      const graph = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          data: node.data,
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge.data,
        })),
      };

      // Auto-detect solver mode based on system components
      let effectiveMode = selectedMode;
      if (effectiveMode === 'auto') {
        const hasPump = nodes.some(node => node.type === 'pump');
        const hasPumpWithCurve = nodes.some(node => node.type === 'pump' && node.data?.pump_curve);

        if (hasPumpWithCurve) {
          effectiveMode = 'operating_point';
        } else if (hasPump) {
          effectiveMode = 'given_pump_head';
        } else {
          effectiveMode = 'gravity';
        }
      }

      // Check if mode needs extras - open modal if yes
      const modesNeedingExtras = ['inverse_diameter', 'inverse_length', 'given_Q_and_power'];
      if (modesNeedingExtras.includes(effectiveMode)) {
        setShowExtrasModal(true);
        setIsSolving(false); // Stop solving, wait for modal
        return;
      }

      console.log('Sending graph to API:', { graph, mode: effectiveMode });

      // Call FastAPI backend
      const response = await fetch('http://localhost:8000/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph, mode: effectiveMode })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const apiResult = await response.json();
      console.log('API Response:', apiResult);

      if (apiResult.status === 'success') {
        const results = apiResult.data;
        setSolverResults(results);

        // Apply flow animation to edges based on solver results
        const flowRate = results.raw_results?.flow_rate || 0;
        const velocity = results.raw_results?.velocity || 0;

        console.log('Animation Debug:', { flowRate, velocity, results: results.raw_results });

        if (flowRate > 0) {
          setEdges((eds) =>
            eds.map((edge) => {
              // Calculate animation duration based on velocity
              // Use velocity if available, otherwise base on flow rate
              let animationDuration;
              if (velocity > 0) {
                animationDuration = Math.max(0.3, 2.0 / velocity); // Slower base speed
              } else {
                // Fallback: use flow rate to estimate speed
                animationDuration = Math.max(0.5, 2.0 / (flowRate * 100));
              }

              return {
                ...edge,
                type: 'pipe',
                animated: true,
                style: {
                  ...edge.style,
                  strokeDasharray: '10,5', // Dashed for inner flow
                  animation: `pipe-flow ${animationDuration}s linear infinite`,
                },
                data: {
                  ...edge.data,
                },
              };
            })
          );
        } else {
          // No flow: Remove dashes and animation
          setEdges((eds) =>
            eds.map((edge) => ({
              ...edge,
              type: 'pipe',
              animated: false,
              style: {
                ...edge.style,
                strokeDasharray: 'none',
                animation: 'none',
              },
              data: {
                ...edge.data,
              },
            }))
          );
        }

        // Show success message
        alert(`Solver completed successfully!\n` +
              `Mode: ${results.mode}\n` +
              `Flow Rate: ${flowRate.toFixed(4)} m³/s\n` +
              `Velocity: ${velocity.toFixed(2)} m/s\n` +
              `Converged: ${results.converged ? 'Yes' : 'No'}\n` +
              `Iterations: ${results.iterations}\n` +
              `Check console for detailed results.`);

      } else if (apiResult.status === 'missing_inputs') {
        // Handle missing inputs from server
        const missingInputs = apiResult.data?.missing_inputs || ['Unknown missing inputs'];
        setWarnings(missingInputs.map(input => `Missing: ${input}`));
        alert('Solver failed: Missing required inputs.\n\n' +
              'Missing:\n' + missingInputs.join('\n') +
              '\n\nPlease check the warnings panel and edit component properties.');
      } else {
        setWarnings([apiResult.message || 'Unknown solver error']);
        alert('Solver failed: ' + (apiResult.message || 'Unknown error'));
      }

    } catch (error) {
      console.error('API Error:', error);
      const errorMessage = error.message || 'Failed to connect to solver API';
      setWarnings([errorMessage]);
      alert('Error calling solver: ' + errorMessage);
    }

    setIsSolving(false);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type: inputType, checked } = e.target;
    const numericFields = ['P', 'z', 'h_a', 'D', 'L', 'rho', 'epsilon', 'K', 'flowValue'];

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

  // Handle flow rate changes (special handler for nested object)
  const handleFlowRateChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      flowRateSettings: {
        ...prev.flowRateSettings,
        [field]: field === 'value' ? (parseFloat(value) || 0) : value
      }
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

      // Update global fluid type
      if (formData.globalFluid) {
        setGlobalFluid(formData.globalFluid);
        // Update all existing tank nodes with the new fluid type
        setNodes((nds) =>
          nds.map((node) =>
            node.type === 'tank'
              ? { ...node, data: { ...node.data, fluidType: formData.globalFluid } }
              : node
          )
        );
      }

      // Update global flow rate settings
      if (formData.flowRateSettings) {
        setFlowRateSettings(formData.flowRateSettings);
      }

      // Apply to all existing edges
      setEdges((eds) =>
        eds.map((e) => ({ ...e, data: { ...e.data, ...newDefaults } }))
      );
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
      globalFluid,
      flowRateSettings,
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
      if (diagram.globalFluid) {
        setGlobalFluid(diagram.globalFluid);
      }
      if (diagram.flowRateSettings) {
        setFlowRateSettings(diagram.flowRateSettings);
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
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Pipe Shape:
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
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Default Fluid Type:
            </label>
            <select
              name="globalFluid"
              value={formData.globalFluid || globalFluid}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            >
              {fluidTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <small style={{ color: '#666' }}>This fluid type will be applied to ALL existing tanks and automatically assigned to new tanks.</small>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Flow Rate:
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  name="flowRateType"
                  value="unknown"
                  checked={formData.flowRateSettings?.type === 'unknown'}
                  onChange={(e) => handleFlowRateChange('type', e.target.value)}
                />
                Unknown
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  name="flowRateType"
                  value="volumetric"
                  checked={formData.flowRateSettings?.type === 'volumetric'}
                  onChange={(e) => handleFlowRateChange('type', e.target.value)}
                />
                Volumetric (m³/s)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  name="flowRateType"
                  value="mass"
                  checked={formData.flowRateSettings?.type === 'mass'}
                  onChange={(e) => handleFlowRateChange('type', e.target.value)}
                />
                Mass (kg/s)
              </label>
            </div>
            <input
              type="number"
              step="0.001"
              min="0"
              value={formData.flowRateSettings?.value || 0}
              onChange={(e) => handleFlowRateChange('value', e.target.value)}
              placeholder={
                formData.flowRateSettings?.type === 'unknown' ? 'Flow rate (to be determined by solver)' :
                formData.flowRateSettings?.type === 'mass' ? 'Mass flow rate (kg/s)' : 'Volumetric flow rate (m³/s)'
              }
              disabled={formData.flowRateSettings?.type === 'unknown'}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: formData.flowRateSettings?.type === 'unknown' ? '#f5f5f5' : 'white'
              }}
            />
            <small style={{ color: '#666' }}>
              {formData.flowRateSettings?.type === 'unknown'
                ? 'Flow rate will be calculated by the solver'
                : formData.flowRateSettings?.type === 'mass'
                ? 'Total mass flow rate through the system'
                : 'Total volumetric flow rate through the system'}
            </small>
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

        {/* Mode Selection */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#333' }}>Solver Mode</h3>
            <button
              onClick={() => setShowModeInfo(true)}
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px'
              }}
              title="View solver mode requirements"
            >
              i
            </button>
          </div>
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white'
            }}
          >
            <option value="auto">Auto-Detect</option>
            <option value="gravity">Gravity Flow</option>
            <option value="system_curve">System Curve</option>
            <option value="given_pump_head">Fixed Pump Head</option>
            <option value="given_pump_power">Fixed Pump Power</option>
            <option value="given_Q_and_power">Fixed Q and Power</option>
            <option value="operating_point">Operating Point</option>
            <option value="inverse_diameter">Inverse Diameter</option>
            <option value="inverse_length">Inverse Length</option>
          </select>
          <small style={{ color: '#666', fontSize: '10px', display: 'block', marginTop: '4px' }}>
            Auto-detect analyzes your diagram components
          </small>
        </div>

        <button
          onClick={openDefaultsModal}
          style={{
            width: '100%',
            padding: '10px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '10px'
          }}
        >
          System Settings
        </button>

        <button
          onClick={openFittingsModal}
          style={{
            width: '100%',
            padding: '10px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '10px'
          }}
        >
          Minor Losses/Fittings
        </button>

        <button
          onClick={handleSolve}
          disabled={isSolving}
          style={{
            width: '100%',
            padding: '10px',
            background: isSolving ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSolving ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            marginBottom: '10px'
          }}
        >
          {isSolving ? 'Solving...' : 'Solve System'}
        </button>

        {/* Warnings Display */}
        {warnings.length > 0 && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '10px',
            fontSize: '11px'
          }}>
            <strong>Warnings:</strong>
            {warnings.map((warning, index) => (
              <div key={index} style={{ marginTop: '4px' }}>
                • {warning}
              </div>
            ))}
          </div>
        )}

        {/* Solver Results Display */}
        {solverResults && (
          <div style={{
            background: '#e8f5e8',
            border: '1px solid #4caf50',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '10px',
            fontSize: '10px',
            fontFamily: 'monospace'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '12px' }}>
              Solver Results
            </h4>
            <div style={{ color: '#1b5e20' }}>
              <div>Q: {(solverResults.raw_results?.flow_rate || 0).toFixed(4)} m³/s</div>
              <div>v: {(solverResults.raw_results?.velocity || 0).toFixed(2)} m/s</div>
              <div>Mode: {solverResults.mode || 'Unknown'}</div>
              <div>Converged: {solverResults.converged ? 'Yes' : 'No'}</div>
              {solverResults.iterations && <div>Iterations: {solverResults.iterations}</div>}
              {solverResults.raw_results?.head_loss && (
                <div>Head Loss: {solverResults.raw_results.head_loss.toFixed(2)} m</div>
              )}
            </div>
          </div>
        )}

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
            fontSize: '12px'
          }}
        >
          Load Diagram
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
                ? 'Global Pipe Defaults & Fluid Settings'
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


      {/* Minor Losses/Fittings Modal */}
      {isFittingsModalOpen && (
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
            onClick={closeFittingsModal}
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
              minWidth: '450px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              Minor Losses/Fittings Configuration
            </h3>

            {/* Pipe selector */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Select Pipe:
              </label>
              <select
                value={selectedEdgeId || ''}
                onChange={(e) => {
                  const edgeId = e.target.value;
                  setSelectedEdgeId(edgeId);
                  if (edgeId) {
                    const selectedEdge = edges.find((edge) => edge.id === edgeId);
                    setFittingsFormData(selectedEdge?.data?.minorLosses ? {
                      fittings: selectedEdge.data.minorLosses.fittings || [],
                      K_total: selectedEdge.data.minorLosses.K_total || ''
                    } : { fittings: [], K_total: '' });
                  } else {
                    setFittingsFormData({ fittings: [], K_total: '' });
                  }
                }}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="">Choose a pipe...</option>
                {edges.map((edge, index) => (
                  <option key={edge.id} value={edge.id}>
                    Pipe {index + 1} ({edge.source} → {edge.target})
                  </option>
                ))}
              </select>
              {edges.length === 0 && (
                <p style={{ color: '#666', fontStyle: 'italic', margin: '5px 0 0 0' }}>
                  No pipes found. Please connect some components first.
                </p>
              )}
            </div>

            {/* Fitting selector */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Select Fitting Type:
              </label>
              <select
                value={tempFittingName}
                onChange={(e) => setTempFittingName(e.target.value)}
                style={{ width: '70%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginRight: '10px' }}
              >
                <option value="">Choose fitting...</option>
                {fittingTypes.map((name) => (
                  <option key={name} value={name}>
                    {name.replace(/_/g, ' ').replace(/(\d\/\d)/g, '$1 ')}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Qty"
                min="1"
                value={tempFittingQty}
                onChange={(e) => setTempFittingQty(e.target.value)}
                style={{ width: '15%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginRight: '5px' }}
              />

              <button
                onClick={addFitting}
                disabled={!tempFittingName}
                style={{
                  padding: '8px 12px',
                  background: tempFittingName ? '#28a745' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: tempFittingName ? 'pointer' : 'not-allowed',
                  fontSize: '12px'
                }}
              >
                Add
              </button>
            </div>

            {/* Added fittings list */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Added Fittings:
              </label>
              {fittingsFormData.fittings.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic', margin: '0' }}>No fittings added yet</p>
              ) : (
                <ul style={{ margin: '0', padding: '0', listStyle: 'none', border: '1px solid #ddd', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                  {fittingsFormData.fittings.map((fit, idx) => (
                    <li key={idx} style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <strong>{fit.qty}</strong> x {fit.name.replace(/_/g, ' ').replace(/(\d\/\d)/g, '$1 ')}
                      </span>
                      <button
                        onClick={() => removeFitting(idx)}
                        style={{
                          padding: '4px 8px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Manual K_total override */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Manual K_total Override:
              </label>
              <input
                type="number"
                placeholder="Leave empty to auto-calculate from fittings"
                step="0.01"
                value={fittingsFormData.K_total}
                onChange={(e) => setFittingsFormData({ ...fittingsFormData, K_total: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <small style={{ color: '#666' }}>If specified, this will override the calculated total from individual fittings</small>
            </div>

            {/* Save and Cancel buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                onClick={saveFittings}
                disabled={!selectedEdgeId}
                style={{
                  padding: '10px 20px',
                  background: selectedEdgeId ? '#4CAF50' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedEdgeId ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Save Fittings
              </button>
              <button
                onClick={closeFittingsModal}
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

      {/* Mode Info Modal */}
      <Modal
        isOpen={showModeInfo}
        onRequestClose={() => setShowModeInfo(false)}
        style={{
          content: {
            width: '90%',
            maxWidth: '700px',
            height: '80%',
            maxHeight: '600px',
            margin: 'auto',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
            overflow: 'auto'
          },
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1002,
          }
        }}
      >
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2C3E50' }}>
            📚 Solver Mode Requirements Guide
          </h2>

          {Object.entries(SOLVER_MODE_INFO).map(([key, info]) => (
            <div
              key={key}
              style={{
                marginBottom: '25px',
                padding: '15px',
                background: selectedMode === key ? '#E3F2FD' : '#F5F5F5',
                borderRadius: '8px',
                border: selectedMode === key ? '2px solid #2196F3' : '1px solid #DDD'
              }}
            >
              <h3 style={{
                margin: '0 0 8px 0',
                color: '#1976D2',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                {info.name}
                {selectedMode === key && <span style={{
                  background: '#4CAF50',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>CURRENT</span>}
              </h3>

              <p style={{ margin: '8px 0', color: '#555', fontSize: '13px' }}>
                <em>{info.description}</em>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#333', fontWeight: 'bold' }}>
                    📌 Required Components:
                  </h4>
                  <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '12px', color: '#555' }}>
                    {info.required.components.map((comp, idx) => (
                      <li key={idx} style={{ marginBottom: '3px' }}>{comp}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#333', fontWeight: 'bold' }}>
                    🔢 Required Variables:
                  </h4>
                  <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '12px', color: '#555' }}>
                    {info.required.variables.map((variable, idx) => (
                      <li key={idx} style={{
                        marginBottom: '3px',
                        color: variable.includes('REQUIRES MODAL') ? '#FF5722' : '#555',
                        fontWeight: variable.includes('REQUIRES MODAL') ? 'bold' : 'normal'
                      }}>
                        {variable}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {info.optional && info.optional.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#666' }}>
                    ✨ Optional Variables:
                  </h4>
                  <div style={{ fontSize: '11px', color: '#777', paddingLeft: '15px' }}>
                    {info.optional.join(', ')}
                  </div>
                </div>
              )}

              {info.notes && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px',
                  background: info.notes.includes('⚠️') ? '#FFF3E0' : '#E8F5E9',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#555'
                }}>
                  <strong>Note:</strong> {info.notes}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => setShowModeInfo(false)}
            style={{
              width: '100%',
              padding: '12px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              marginTop: '20px'
            }}
          >
            Close Guide
          </button>
        </div>
      </Modal>

      {/* Extras Modal for modes requiring additional inputs */}
      <Modal
        isOpen={showExtrasModal}
        onRequestClose={() => setShowExtrasModal(false)}
        style={{
          content: {
            width: '400px',
            height: 'fit-content',
            margin: 'auto',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          },
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1001,
          }
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
          Additional Parameters for {selectedMode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </h3>

        {/* Conditional fields based on mode */}
        {(selectedMode === 'inverse_diameter' || selectedMode === 'inverse_length') && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Target Flow Rate Q (m³/s):
              </label>
              <input
                type="number"
                step="0.001"
                value={extras.Q}
                onChange={(e) => setExtras({...extras, Q: parseFloat(e.target.value) || 0})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="e.g., 0.01"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Target Pump Head h_a (m):
              </label>
              <input
                type="number"
                step="0.1"
                value={extras.h_a}
                onChange={(e) => setExtras({...extras, h_a: parseFloat(e.target.value) || 0})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="e.g., 25"
              />
            </div>
          </>
        )}

        {selectedMode === 'given_Q_and_power' && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Flow Rate Q (m³/s):
              </label>
              <input
                type="number"
                step="0.001"
                value={extras.Q}
                onChange={(e) => setExtras({...extras, Q: parseFloat(e.target.value) || 0})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="e.g., 0.01"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Shaft Power W_shaft (W):
              </label>
              <input
                type="number"
                step="10"
                value={extras.W_shaft}
                onChange={(e) => setExtras({...extras, W_shaft: parseFloat(e.target.value) || 0})}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="e.g., 1000"
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={async () => {
              setShowExtrasModal(false);
              setIsSolving(true);

              try {
                // Prepare graph data for API
                const graph = {
                  nodes: nodes.map(node => ({
                    id: node.id,
                    type: node.type,
                    data: node.data,
                  })),
                  edges: edges.map(edge => ({
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    data: edge.data,
                  })),
                };

                console.log('Sending graph to API:', { graph, mode: selectedMode, extras });

                // Call FastAPI backend with extras
                const response = await fetch('http://localhost:8000/solve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ graph, mode: selectedMode, extras })
                });

                if (!response.ok) {
                  throw new Error(`Server error: ${response.status}`);
                }

                const apiResult = await response.json();
                console.log('API Response:', apiResult);

                if (apiResult.status === 'success') {
                  const results = apiResult.data;
                  setSolverResults(results);
                  alert(`Solver completed successfully!\nMode: ${results.mode}\nCheck console for detailed results.`);
                } else if (apiResult.status === 'missing_inputs') {
                  setWarnings(apiResult.missing_inputs || ['Unknown missing inputs']);
                  alert('Solver failed: Missing required inputs. Check warnings panel.');
                } else {
                  setWarnings([apiResult.message || 'Unknown solver error']);
                  alert('Solver failed: ' + (apiResult.message || 'Unknown error'));
                }

              } catch (error) {
                console.error('API Error:', error);
                const errorMessage = error.message || 'Failed to connect to solver API';
                setWarnings([errorMessage]);
                alert('Error calling solver: ' + errorMessage);
              }

              setIsSolving(false);
            }}
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
            Submit and Solve
          </button>
          <button
            onClick={() => {
              setShowExtrasModal(false);
              setIsSolving(false);
            }}
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
      </Modal>
    </div>
  );
}

export default App;
