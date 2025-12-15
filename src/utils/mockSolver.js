/**
 * Mock solver function that simulates pipe_flow_solver.py output
 * Takes a React Flow graph JSON and returns fake calculation results
 */
export const mockSolver = (graph) => {
  // Extract key parameters from the graph
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const defaultPipeProps = graph.defaultPipeProps || {};
  const globalFluid = graph.globalFluid || 'water_20C';
  const flowRateSettings = graph.flowRateSettings || { type: 'unknown', value: 0.01 };

  // Fluid properties lookup (simplified)
  const fluidProps = {
    'water_20C': { rho: 998, mu: 0.001, name: 'Water at 20°C' },
    'air_20C': { rho: 1.2, mu: 0.000018, name: 'Air at 20°C' },
    'oil_SAE30': { rho: 920, mu: 0.1, name: 'SAE 30 Oil' }
  };

  const fluid = fluidProps[globalFluid] || fluidProps['water_20C'];

  // Count different component types
  const tankCount = nodes.filter(n => n.type === 'tank').length;
  const pumpCount = nodes.filter(n => n.type === 'pump').length;
  const valveCount = nodes.filter(n => n.type === 'valve').length;

  // Extract pipe properties from first edge or use defaults
  const firstEdge = edges[0];
  const D = firstEdge?.data?.D || defaultPipeProps.D || 0.1; // m
  const L_segment = firstEdge?.data?.L || defaultPipeProps.L || 100; // m per segment
  const epsilon = firstEdge?.data?.epsilon || defaultPipeProps.epsilon || 0.000045; // m

  // Calculate total pipe length
  const totalLength = edges.length * L_segment;

  // Generate mock results based on system configuration
  let Q, h_a, warnings = [];

  // Determine flow rate based on settings
  if (flowRateSettings.type === 'volumetric') {
    Q = flowRateSettings.value; // m³/s
  } else if (flowRateSettings.type === 'mass') {
    Q = flowRateSettings.value / fluid.rho; // Convert mass flow to volumetric
  } else {
    // Unknown - solver would calculate this
    Q = 0.005 + Math.random() * 0.015; // Fake calculation: 0.005-0.02 m³/s
    warnings.push('Flow rate calculated by solver');
  }

  // Mock velocity calculation
  const A = Math.PI * (D / 2) ** 2; // Pipe cross-sectional area
  const v = Q / A; // m/s

  // Mock Reynolds number and flow regime
  const Re = (fluid.rho * v * D) / fluid.mu;
  const flowRegime = Re > 2300 ? 'Turbulent' : 'Laminar';

  // Mock friction factor (simplified Moody diagram)
  const f = Re > 2300
    ? 0.25 / Math.pow(Math.log10(epsilon/(3.7*D) + 5.74/Math.pow(Re, 0.9)), 2)
    : 64 / Re;

  // Mock head loss calculations
  const h_L_friction = f * (totalLength / D) * (v ** 2) / (2 * 9.81); // Darcy-Weisbach

  // Minor losses from fittings (if any)
  let h_L_minor = 0;
  edges.forEach(edge => {
    if (edge.data?.fittings) {
      edge.data.fittings.forEach(fitting => {
        h_L_minor += (fitting.K || 0) * (v ** 2) / (2 * 9.81);
      });
    }
  });

  const h_L_total = h_L_friction + h_L_minor;

  // Mock pump head (if pumps present)
  let h_pump = 0;
  if (pumpCount > 0) {
    h_pump = 15 + Math.random() * 25; // 15-40 m typical centrifugal pump
    warnings.push(`Estimated pump head: ${h_pump.toFixed(1)} m`);
  }

  // Mock system head
  h_a = h_pump - h_L_total;

  // Mock pressures (simplified)
  const P1 = 101325; // Pa, atmospheric at inlet
  const P2 = P1 + fluid.rho * 9.81 * h_a; // Pa, outlet pressure

  // Cavitation check for pumps
  const cavitates = pumpCount > 0 && (P1 - fluid.rho * 9.81 * 2) < 2000; // Simplified NPSH check
  if (cavitates) {
    warnings.push('Cavitation risk detected in pump');
  }

  // Velocity warnings
  if (v > 3) {
    warnings.push(`High velocity: ${v.toFixed(2)} m/s - consider larger pipe`);
  } else if (v < 0.5) {
    warnings.push(`Low velocity: ${v.toFixed(2)} m/s - check for blockages`);
  }

  // Reynolds number warnings
  if (Re < 2300) {
    warnings.push(`Laminar flow (Re=${Re.toFixed(0)}) - heat transfer may be poor`);
  }

  // Generate per-edge results
  const perEdgeResults = edges.map((edge, index) => {
    const edgeL = edge.data?.L || L_segment;
    const edgeD = edge.data?.D || D;
    const edgeA = Math.PI * (edgeD / 2) ** 2;
    const edgeV = Q / edgeA;

    // Proportional head loss for this segment
    const h_L_segment = h_L_friction * (edgeL / totalLength);

    return {
      edgeId: edge.id,
      Q: Q,
      v: edgeV,
      D: edgeD,
      L: edgeL,
      h_L_segment: h_L_segment,
      Re: (fluid.rho * edgeV * edgeD) / fluid.mu,
      f: f // Simplified - same for all segments
    };
  });

  // Generate comprehensive results object
  return {
    // System-wide results
    Q: Q,
    Q_mass: Q * fluid.rho, // kg/s
    h_a: h_a,
    h_pump: h_pump,
    h_L_total: h_L_total,
    h_L_friction: h_L_friction,
    h_L_minor: h_L_minor,

    // Flow properties
    v_avg: v,
    Re: Re,
    f: f,
    flowRegime: flowRegime,

    // Pressures
    P1: P1,
    P2: P2,
    deltaP: P2 - P1,

    // Fluid properties used
    fluid: {
      name: fluid.name,
      rho: fluid.rho,
      mu: fluid.mu
    },

    // System info
    systemInfo: {
      totalLength: totalLength,
      numSegments: edges.length,
      tankCount: tankCount,
      pumpCount: pumpCount,
      valveCount: valveCount,
      avgDiameter: D
    },

    // Flags and warnings
    cavitates: cavitates,
    warnings: warnings,

    // Per-edge detailed results
    perEdgeResults: perEdgeResults,

    // Metadata
    solverType: 'mock',
    timestamp: new Date().toISOString(),
    success: true
  };
};