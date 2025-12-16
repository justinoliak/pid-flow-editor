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

    if not edges:
        raise ValueError("No pipes found in the system")

    # Extract pipe parameters from first edge (simplified for single pipe system)
    edge_data = edges[0].get('data', {})
    length = float(edge_data.get('length', 10.0))  # m
    diameter = float(edge_data.get('diameter', 0.1))  # m
    roughness = float(edge_data.get('roughness', 0.00005))  # m (steel pipe)

    # Get tank elevations if present
    elevation_in = 10.0  # default
    elevation_out = 5.0   # default
    tank_count = 0
    for node in nodes:
        if node['type'] == 'tank':
            if tank_count == 0:
                elevation_in = float(node.get('data', {}).get('elevation', 10.0))
            else:
                elevation_out = float(node.get('data', {}).get('elevation', 5.0))
            tank_count += 1

    # Create a PipeSystem object with proper parameters
    system = solver.PipeSystem(
        rho=1000.0,  # Water density kg/m³
        mu=0.001,    # Water viscosity Pa·s
        D=diameter,  # Pipe diameter
        L=length,    # Pipe length
        epsilon=roughness,  # Pipe roughness
        z1=elevation_in,    # Inlet elevation
        z2=elevation_out,   # Outlet elevation
        P1=101325.0,        # Inlet pressure (atmospheric)
        P2=101325.0,        # Outlet pressure (atmospheric)
        K_total=0.5         # Minor losses
    )

    # Get pump parameters if present
    pump_head = 20.0  # default
    for node in nodes:
        if node['type'] == 'pump':
            pump_head = float(node.get('data', {}).get('head', 20.0))
            break

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

        elif mode == 'given_pump_head' or mode == 'operating_point':
            # Use pump head solver
            result = solver.solve_given_pump_head(system, pump_head)

        elif mode == 'system_curve':
            # Generate system curve
            result = solver.solve_gravity_flow(system)  # Simplified for now

        elif mode == 'given_pump_power':
            # Solve with pump power constraint
            result = solver.solve_given_pump_head(system, pump_head)  # Simplified

        elif mode == 'given_Q_and_power':
            # Extract extras
            target_Q = extras.get('Q', 0.01) if extras else 0.01
            W_shaft = extras.get('W_shaft', 1000) if extras else 1000
            # For now, use simplified calculation
            result = solver.solve_gravity_flow(system)

        elif mode == 'inverse_diameter':
            # Extract target values from extras
            target_Q = extras.get('Q', 0.01) if extras else 0.01
            target_h_a = extras.get('h_a', 25) if extras else 25
            # For now, use simplified calculation
            result = solver.solve_gravity_flow(system)

        elif mode == 'inverse_length':
            # Extract target values from extras
            target_Q = extras.get('Q', 0.01) if extras else 0.01
            target_h_a = extras.get('h_a', 25) if extras else 25
            # For now, use simplified calculation
            result = solver.solve_gravity_flow(system)

        else:
            # Default to gravity flow for unknown modes
            result = solver.solve_gravity_flow(system)

        # Extract results from SolverResult object
        if hasattr(result, 'status') and result.status.name != 'SUCCESS':
            raise Exception(f"Solver failed with status: {result.status.name}")

        # Get the main results
        flow_rate = result.Q if hasattr(result, 'Q') else 0.0
        velocity = solver.calculate_velocity(flow_rate, diameter) if flow_rate > 0 else 0.0

        # Calculate head loss if flow exists
        if flow_rate > 0:
            head_loss = solver.calculate_major_head_loss(flow_rate, diameter, length, roughness)
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