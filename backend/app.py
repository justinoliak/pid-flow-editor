from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from scipy.optimize import brentq, fsolve
import traceback
from typing import Dict, List, Any, Optional

# Import the solver functions
import pipe_flow_solver as solver

app = FastAPI(title="P&ID Flow Solver API", description="API for solving pipe flow systems")

# CORS for React (allow localhost:5173 and any origin for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SolveRequest(BaseModel):
    graph: Dict[str, Any]  # {nodes: [...], edges: [...]}
    mode: str              # e.g., 'gravity', 'operating_point', etc.
    extras: Optional[Dict[str, Any]] = None  # Additional parameters for specific modes

class SolverResult(BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

def solve_graph(graph_data: Dict, mode: str, extras: Optional[Dict] = None) -> Dict:
    """
    Convert ReactFlow graph data and solve using the specified mode.
    Creates a PipeSystem object and uses the solver functions.
    """
    nodes = graph_data.get('nodes', [])
    edges = graph_data.get('edges', [])

    print(f"DEBUG: Translating graph with {len(nodes)} nodes and {len(edges)} edges")
    print(f"DEBUG: Nodes: {[{n['type']: n.get('data', {})} for n in nodes]}")
    print(f"DEBUG: Edges: {[e.get('data', {}) for e in edges]}")

    if not edges:
        raise ValueError("No pipes found in the system")

    # Extract pipe parameters (use correct property names from frontend)
    edge_data = edges[0].get('data', {})
    length = float(edge_data.get('L', 100.0))  # m - correct property name
    diameter = float(edge_data.get('D', 0.1))  # m - correct property name
    roughness = float(edge_data.get('epsilon', 0.00015))  # m - correct property name
    density = float(edge_data.get('rho', 1000.0))  # kg/m³ - from pipe or default water

    # Get tank parameters (use correct property names)
    elevation_in = 0.0  # default
    elevation_out = 0.0   # default
    pressure_in = 101325.0  # default atmospheric
    pressure_out = 101325.0  # default atmospheric

    tank_count = 0
    for node in nodes:
        if node['type'] == 'tank':
            node_data = node.get('data', {})
            if tank_count == 0:  # First tank (inlet)
                elevation_in = float(node_data.get('z', 0.0))  # Correct property name
                pressure_in = float(node_data.get('P', 101325.0))  # Correct property name
            else:  # Second tank (outlet)
                elevation_out = float(node_data.get('z', 0.0))
                pressure_out = float(node_data.get('P', 101325.0))
            tank_count += 1

    # Get pump parameters if present (use correct property name)
    pump_head = 20.0  # default
    has_pump = False
    for node in nodes:
        if node['type'] == 'pump':
            pump_data = node.get('data', {})
            pump_head = float(pump_data.get('h_a', 20.0))  # Correct property name
            has_pump = True
            break

    print(f"DEBUG: Extracted parameters:")
    print(f"  Pipe: L={length}m, D={diameter}m, ε={roughness}m, ρ={density}kg/m³")
    print(f"  Tanks: z1={elevation_in}m (P1={pressure_in}Pa), z2={elevation_out}m (P2={pressure_out}Pa)")
    if has_pump:
        print(f"  Pump: h_a={pump_head}m")
    else:
        print(f"  No pump in system")

    # Create a PipeSystem object with extracted parameters
    system = solver.PipeSystem(
        rho=density,         # Fluid density from pipe properties
        mu=0.001,           # Water viscosity Pa·s (TODO: extract from fluid type)
        D=diameter,         # Pipe diameter from edge data
        L=length,           # Pipe length from edge data
        epsilon=roughness,  # Pipe roughness from edge data
        z1=elevation_in,    # Inlet tank elevation
        z2=elevation_out,   # Outlet tank elevation
        P1=pressure_in,     # Inlet tank pressure
        P2=pressure_out,    # Outlet tank pressure
        K_total=0.5         # Minor losses (TODO: extract from fittings)
    )

    # Handle modes requiring extras
    if mode in ['inverse_diameter', 'inverse_length', 'given_Q_and_power'] and not extras:
        return {
            'status': 'missing_inputs',
            'message': f'Mode "{mode}" requires additional parameters',
            'missing_inputs': [
                'Q (flow rate)' if mode.startswith('inverse') else 'Q (flow rate)',
                'h_a (pump head)' if mode.startswith('inverse') else 'W_shaft (shaft power)'
            ]
        }

    # Solve based on mode using the available functions
    try:
        if mode == 'gravity':
            # Use gravity flow solver
            result = solver.solve_gravity_flow(system)

        elif mode == 'given_pump_head':
            # Fixed pump head solver
            result = solver.solve_given_pump_head(system, pump_head)

        elif mode == 'operating_point':
            # Find intersection of pump curve and system curve
            # TODO: Extract pump curve data from pump node
            result = solver.solve_operating_point(system)

        elif mode == 'system_curve':
            # Generate system curve (multiple flow points)
            Q_min = extras.get('Q_min', 0.001) if extras else 0.001
            Q_max = extras.get('Q_max', 0.05) if extras else 0.05
            n_points = extras.get('n_points', 20) if extras else 20
            # Create Q range array
            import numpy as np
            Q_range = np.linspace(Q_min, Q_max, n_points)
            # Call actual system curve solver
            result = solver.solve_system_curve(system, Q_range, n_points)

        elif mode == 'given_pump_power':
            # Extract power and efficiency from pump node or extras
            W_shaft = extras.get('W_shaft', 1000.0) if extras else 1000.0  # Watts
            efficiency = extras.get('efficiency', 0.8) if extras else 0.8
            # Call actual pump power solver
            result = solver.solve_given_pump_power(system, W_shaft, efficiency)

        elif mode == 'given_Q_and_power':
            # Extract extras
            target_Q = extras.get('Q', 0.01) if extras else 0.01
            W_shaft = extras.get('W_shaft', 1000) if extras else 1000
            efficiency = extras.get('efficiency', 0.8) if extras else 0.8
            # Call actual solver function
            result = solver.solve_given_Q_and_power(system, target_Q, W_shaft, efficiency)

        elif mode == 'inverse_diameter':
            # Extract target values from extras
            target_Q = extras.get('Q', 0.01) if extras else 0.01
            target_h_a = extras.get('h_a', 25) if extras else 25
            # Call actual inverse diameter solver
            result = solver.solve_inverse_diameter(system, target_Q, target_h_a)

        elif mode == 'inverse_length':
            # Extract target values from extras
            target_Q = extras.get('Q', 0.01) if extras else 0.01
            target_h_a = extras.get('h_a', 25) if extras else 25
            # Call actual inverse length solver
            result = solver.solve_inverse_length(system, target_Q, target_h_a)

        else:
            # Unknown mode - raise error instead of silent fallback
            raise ValueError(f"Unknown solver mode: {mode}. Valid modes are: gravity, given_pump_head, operating_point, system_curve, given_pump_power, given_Q_and_power, inverse_diameter, inverse_length")

        # Extract results from SolverResult object
        if hasattr(result, 'status') and result.status.name != 'SUCCESS':
            raise Exception(f"Solver failed with status: {result.status.name}")

        # Get the main results
        flow_rate = result.Q if hasattr(result, 'Q') else 0.0

        # Calculate velocity safely (Q = A * v, so v = Q / A)
        if flow_rate > 0:
            pipe_area = 3.14159 * (diameter / 2) ** 2  # π * r²
            velocity = flow_rate / pipe_area  # m/s
        else:
            velocity = 0.0

        # Calculate head loss if flow exists
        if flow_rate > 0:
            # calculate_major_head_loss(L, D, Q, rho, mu, epsilon, g)
            head_loss_result = solver.calculate_major_head_loss(
                L=length, D=diameter, Q=flow_rate,
                rho=density, mu=0.001, epsilon=roughness
            )
            head_loss = head_loss_result.get('h_L', 0.0)
        else:
            head_loss = 0.0

        # Format results for frontend
        formatted_results = {
            'mode': mode,
            'converged': result.status.name == 'SUCCESS' if hasattr(result, 'status') else True,
            'iterations': result.iterations if hasattr(result, 'iterations') else 1,
            'flows': {},
            'pressures': {},
            'velocities': {},
            'head_losses': {},
            'raw_results': {
                'flow_rate': flow_rate,
                'velocity': velocity,
                'head_loss': head_loss,
                'delta_z': elevation_in - elevation_out,
                'pump_head': pump_head if mode in ['given_pump_head', 'operating_point'] else None
            }
        }

        # Populate results for each pipe/component
        for edge in edges:
            pipe_id = f"{edge['source']}-{edge['target']}"
            formatted_results['flows'][pipe_id] = float(flow_rate)
            formatted_results['velocities'][pipe_id] = float(velocity)
            formatted_results['head_losses'][pipe_id] = float(head_loss)

        # Add pressure data for tanks/pumps
        for node in nodes:
            node_id = node['id']
            if node['type'] == 'tank':
                # Calculate pressure based on elevation and atmospheric pressure
                elevation = float(node.get('data', {}).get('elevation', 10.0))
                pressure = 101325 + (1000 * 9.81 * elevation)  # Hydrostatic pressure
                formatted_results['pressures'][node_id] = pressure
            elif node['type'] == 'pump':
                # Pump outlet pressure (simplified)
                formatted_results['pressures'][node_id] = 101325 + (1000 * 9.81 * pump_head)

        return formatted_results

    except Exception as e:
        raise Exception(f"Solver failed: {str(e)}")

@app.get("/")
def read_root():
    return {"message": "P&ID Flow Solver API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/solve")
def solve(request: SolveRequest) -> SolverResult:
    """
    Solve a P&ID flow system.

    Expected request format:
    {
        "graph": {
            "nodes": [
                {"id": "tank1", "type": "tank", "data": {"elevation": 10, "pressure": 101325}},
                {"id": "pump1", "type": "pump", "data": {"head": 20, "efficiency": 0.8}},
                ...
            ],
            "edges": [
                {"source": "tank1", "target": "pump1", "data": {"length": 10, "diameter": 0.1}},
                ...
            ]
        },
        "mode": "gravity"
    }
    """
    try:
        result = solve_graph(request.graph, request.mode, request.extras)

        # Handle missing inputs response
        if isinstance(result, dict) and result.get('status') == 'missing_inputs':
            return SolverResult(
                status="missing_inputs",
                message=result.get('message'),
                data={"missing_inputs": result.get('missing_inputs', [])}
            )

        return SolverResult(status="success", data=result)
    except Exception as e:
        error_message = str(e)
        traceback_str = traceback.format_exc()
        print(f"Error solving system: {error_message}")
        print(f"Traceback: {traceback_str}")
        return SolverResult(
            status="error",
            message=error_message,
            data={"traceback": traceback_str}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)