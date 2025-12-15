"""
Pipe Flow & Pump System Solver
CHME 2310 - Transport Processes I

Features:
- Mechanical Energy Balance solver
- System curve generation
- Pump selection & operating point
- NPSH & cavitation analysis
- Full unit conversion support
- Comprehensive error handling
"""

import numpy as np
from scipy.optimize import brentq, fsolve
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Tuple, Union, Any
from enum import Enum

# =============================================================================
# CONSTANTS
# =============================================================================

G = 9.81  # m/s²
G_FT = 32.174  # ft/s²
ALPHA_TURB = 1.0
ALPHA_LAM = 2.0

# =============================================================================
# UNIT CONVERSION SYSTEM
# =============================================================================

class Units:
    """Comprehensive unit conversion system."""
    
    # Conversion factors TO SI base units
    LENGTH = {
        'm': 1.0,
        'cm': 0.01,
        'mm': 0.001,
        'ft': 0.3048,
        'in': 0.0254,
    }
    
    AREA = {
        'm2': 1.0,
        'cm2': 1e-4,
        'mm2': 1e-6,
        'ft2': 0.092903,
        'in2': 6.4516e-4,
    }
    
    VOLUME_FLOW = {
        'm3/s': 1.0,
        'm3/hr': 1/3600,
        'L/min': 1e-3/60,
        'L/s': 1e-3,
        'ft3/s': 0.0283168,
        'gpm': 6.309e-5,
        'gal/min': 6.309e-5,
    }
    
    MASS_FLOW = {
        'kg/s': 1.0,
        'kg/hr': 1/3600,
        'lbm/s': 0.453592,
        'lbm/hr': 0.453592/3600,
    }
    
    PRESSURE = {
        'Pa': 1.0,
        'kPa': 1000.0,
        'MPa': 1e6,
        'bar': 1e5,
        'atm': 101325.0,
        'psi': 6894.76,
        'psig': 6894.76,  # gauge - user must handle atmospheric offset
        'psia': 6894.76,
        'ft_H2O': 2989.07,
        'in_H2O': 249.09,
        'in_Hg': 3386.39,
        'mmHg': 133.322,
    }
    
    DENSITY = {
        'kg/m3': 1.0,
        'g/cm3': 1000.0,
        'lbm/ft3': 16.0185,
        'slug/ft3': 515.379,
    }
    
    VISCOSITY = {
        'Pa_s': 1.0,
        'Pa*s': 1.0,
        'kg/(m*s)': 1.0,
        'cP': 0.001,
        'P': 0.1,
        'lbm/(ft*s)': 1.48816,
        'g/(cm*s)': 0.1,
        'slug/(ft*s)': 47.8803,
    }
    
    POWER = {
        'W': 1.0,
        'kW': 1000.0,
        'hp': 745.7,
        'ft_lbf/s': 1.35582,
    }
    
    VELOCITY = {
        'm/s': 1.0,
        'ft/s': 0.3048,
        'cm/s': 0.01,
    }
    
    @classmethod
    def convert(cls, value: float, from_unit: str, to_unit: str, quantity: str) -> float:
        """
        Convert a value between units.
        
        Parameters:
            value: The numerical value to convert
            from_unit: Source unit string
            to_unit: Target unit string
            quantity: Type of quantity ('length', 'pressure', 'flow', etc.)
        
        Returns:
            Converted value
        """
        conversion_tables = {
            'length': cls.LENGTH,
            'area': cls.AREA,
            'volume_flow': cls.VOLUME_FLOW,
            'flow': cls.VOLUME_FLOW,
            'mass_flow': cls.MASS_FLOW,
            'pressure': cls.PRESSURE,
            'density': cls.DENSITY,
            'viscosity': cls.VISCOSITY,
            'power': cls.POWER,
            'velocity': cls.VELOCITY,
        }
        
        table = conversion_tables.get(quantity.lower())
        if table is None:
            raise ValueError(f"Unknown quantity type: {quantity}")
        
        if from_unit not in table:
            raise ValueError(f"Unknown {quantity} unit: {from_unit}")
        if to_unit not in table:
            raise ValueError(f"Unknown {quantity} unit: {to_unit}")
        
        # Convert to SI, then to target
        si_value = value * table[from_unit]
        return si_value / table[to_unit]
    
    @classmethod
    def to_si(cls, value: float, unit: str, quantity: str) -> float:
        """Convert to SI base unit."""
        conversion_tables = {
            'length': cls.LENGTH,
            'area': cls.AREA,
            'volume_flow': cls.VOLUME_FLOW,
            'flow': cls.VOLUME_FLOW,
            'mass_flow': cls.MASS_FLOW,
            'pressure': cls.PRESSURE,
            'density': cls.DENSITY,
            'viscosity': cls.VISCOSITY,
            'power': cls.POWER,
            'velocity': cls.VELOCITY,
        }
        table = conversion_tables.get(quantity.lower())
        if table is None:
            raise ValueError(f"Unknown quantity type: {quantity}")
        if unit not in table:
            raise ValueError(f"Unknown {quantity} unit: {unit}")
        return value * table[unit]
    
    @classmethod
    def from_si(cls, value: float, unit: str, quantity: str) -> float:
        """Convert from SI base unit."""
        conversion_tables = {
            'length': cls.LENGTH,
            'area': cls.AREA,
            'volume_flow': cls.VOLUME_FLOW,
            'flow': cls.VOLUME_FLOW,
            'mass_flow': cls.MASS_FLOW,
            'pressure': cls.PRESSURE,
            'density': cls.DENSITY,
            'viscosity': cls.VISCOSITY,
            'power': cls.POWER,
            'velocity': cls.VELOCITY,
        }
        table = conversion_tables.get(quantity.lower())
        if table is None:
            raise ValueError(f"Unknown quantity type: {quantity}")
        if unit not in table:
            raise ValueError(f"Unknown {quantity} unit: {unit}")
        return value / table[unit]


# =============================================================================
# FLUID PROPERTIES DATABASE
# =============================================================================

FLUID_PROPS = {
    'water_20C': {'rho': 998.0, 'mu': 0.001, 'Pvap': 2337.0},
    'water_100F': {'rho': 993.0, 'mu': 0.00068, 'Pvap': 6340.0},
    'water_60F': {'rho': 999.0, 'mu': 0.00114, 'Pvap': 1770.0},
    'water_10C': {'rho': 999.7, 'mu': 0.00131, 'Pvap': 1228.0},
    'air_20C': {'rho': 1.204, 'mu': 1.82e-5, 'Pvap': 0.0},
    'air_80C': {'rho': 1.0, 'mu': 2.0e-5, 'Pvap': 0.0},
    'toluene_114C': {'rho': 866.0, 'mu': 0.0004, 'Pvap': 101325 * 0.223},
}

# =============================================================================
# MINOR LOSS COEFFICIENTS
# =============================================================================

MINOR_LOSS_K = {
    # Elbows
    'elbow_90_flanged': 0.3,
    'elbow_90_threaded': 1.5,
    'elbow_90_long_radius_flanged': 0.2,
    'elbow_90_long_radius_threaded': 0.7,
    'elbow_45_flanged': 0.2,
    'elbow_45_threaded': 0.4,
    
    # Return bends
    'return_bend_180_flanged': 0.2,
    'return_bend_180_threaded': 1.5,
    
    # Tees
    'tee_line_flow_flanged': 0.2,
    'tee_line_flow_threaded': 0.9,
    'tee_branch_flow_flanged': 1.0,
    'tee_branch_flow_threaded': 2.0,
    
    # Valves
    'valve_globe_open': 10.0,
    'valve_globe_half_open': 20.0,
    'valve_angle_open': 2.0,
    'valve_gate_open': 0.15,
    'valve_gate_1/4_closed': 0.26,
    'valve_gate_1/2_closed': 2.1,
    'valve_gate_3/4_closed': 17.0,
    'valve_ball_open': 0.05,
    'valve_check_swing': 2.0,
    
    # Entrances and exits
    'entrance_square': 0.5,
    'entrance_rounded': 0.04,
    'entrance_reentrant': 0.8,
    'exit': 1.0,
    
    # Unions
    'union_threaded': 0.08,
}


# =============================================================================
# RESULT CLASSES
# =============================================================================

class SolverStatus(Enum):
    SUCCESS = "success"
    MISSING_INPUTS = "missing_inputs"
    NO_SOLUTION = "no_solution"
    WARNING = "warning"


@dataclass
class SolverResult:
    """Standard result container for all solver functions."""
    status: SolverStatus
    result: Optional[Dict[str, Any]] = None
    missing: Optional[List[Dict[str, str]]] = None
    reason: Optional[str] = None
    details: Optional[str] = None
    partial_results: Optional[Dict[str, Any]] = None
    warnings: List[str] = field(default_factory=list)
    
    def is_success(self) -> bool:
        return self.status == SolverStatus.SUCCESS
    
    def __repr__(self):
        if self.status == SolverStatus.SUCCESS:
            return f"SolverResult(SUCCESS, Q={self.result.get('Q', 'N/A')}, h_a={self.result.get('h_a', 'N/A')})"
        elif self.status == SolverStatus.MISSING_INPUTS:
            missing_params = [m['param'] for m in self.missing] if self.missing else []
            return f"SolverResult(MISSING_INPUTS: {missing_params})"
        else:
            return f"SolverResult({self.status.value}: {self.reason})"


# =============================================================================
# GEOMETRY FUNCTIONS
# =============================================================================

def calculate_hydraulic_diameter(shape: str, **kwargs) -> SolverResult:
    """
    Calculate hydraulic diameter for various cross-sections.
    
    Parameters:
        shape: 'circular', 'rectangular', or 'annular'
        For circular: D (diameter)
        For rectangular: a, b (side lengths)
        For annular: D_outer, D_inner
    
    Returns:
        SolverResult with D_h and area
    """
    shape = shape.lower()
    
    if shape == 'circular':
        if 'D' not in kwargs:
            return SolverResult(
                status=SolverStatus.MISSING_INPUTS,
                missing=[{'param': 'D', 'description': 'Pipe diameter'}]
            )
        D = kwargs['D']
        A = np.pi * (D / 2) ** 2
        P = np.pi * D
        D_h = D  # For circular, D_h = D
        
    elif shape == 'rectangular':
        missing = []
        if 'a' not in kwargs:
            missing.append({'param': 'a', 'description': 'Rectangle side length a'})
        if 'b' not in kwargs:
            missing.append({'param': 'b', 'description': 'Rectangle side length b'})
        if missing:
            return SolverResult(status=SolverStatus.MISSING_INPUTS, missing=missing)
        
        a, b = kwargs['a'], kwargs['b']
        A = a * b
        P = 2 * (a + b)
        D_h = 4 * A / P  # = 2ab/(a+b)
        
    elif shape == 'annular':
        missing = []
        if 'D_outer' not in kwargs:
            missing.append({'param': 'D_outer', 'description': 'Outer diameter'})
        if 'D_inner' not in kwargs:
            missing.append({'param': 'D_inner', 'description': 'Inner diameter'})
        if missing:
            return SolverResult(status=SolverStatus.MISSING_INPUTS, missing=missing)
        
        D_o, D_i = kwargs['D_outer'], kwargs['D_inner']
        A = np.pi / 4 * (D_o**2 - D_i**2)
        P = np.pi * (D_o + D_i)
        D_h = D_o - D_i
        
    else:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='unknown_shape',
            details=f"Unknown shape: {shape}. Use 'circular', 'rectangular', or 'annular'."
        )
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={'D_h': D_h, 'A': A, 'P': P, 'shape': shape}
    )


def calculate_area(D: float) -> float:
    """Cross-sectional area of circular pipe: A = πD²/4"""
    return np.pi * (D / 2) ** 2


def calculate_velocity(Q: float, A: float) -> float:
    """Velocity from volumetric flow rate: v = Q/A"""
    if A <= 0:
        return 0.0
    return Q / A


def calculate_Q_from_velocity(v: float, A: float) -> float:
    """Volumetric flow rate from velocity: Q = v·A"""
    return v * A


# =============================================================================
# REYNOLDS NUMBER & FLOW REGIME
# =============================================================================

def calculate_Re(rho: float, v: float, D_h: float, mu: float) -> float:
    """
    Calculate Reynolds number.
    
    Re = ρvD_h/μ
    
    Parameters:
        rho: Density (kg/m³)
        v: Velocity (m/s)
        D_h: Hydraulic diameter (m)
        mu: Dynamic viscosity (Pa·s)
    
    Returns:
        Reynolds number (dimensionless)
    """
    if mu <= 0 or v <= 0 or D_h <= 0:
        return 0.0
    return rho * v * D_h / mu


def calculate_Re_from_Q(rho: float, Q: float, D_h: float, mu: float) -> float:
    """
    Calculate Reynolds number directly from Q (for circular pipes).
    
    Re = 4ρQ/(πD_h·μ)
    """
    if mu <= 0 or Q <= 0 or D_h <= 0:
        return 0.0
    return 4 * rho * Q / (np.pi * D_h * mu)


def get_flow_regime(Re: float) -> str:
    """Determine flow regime from Reynolds number."""
    if Re < 2300:
        return 'laminar'
    elif Re < 4000:
        return 'transitional'
    else:
        return 'turbulent'


def get_alpha(Re: float) -> float:
    """Get kinetic energy correction factor based on flow regime."""
    if Re < 2300:
        return ALPHA_LAM  # 2.0 for laminar
    else:
        return ALPHA_TURB  # 1.0 for turbulent


# =============================================================================
# FRICTION FACTOR (Fanning, Auto-Select)
# =============================================================================

def calculate_friction_factor(Re: float, epsilon_D: float = 0.0) -> Tuple[float, str]:
    """
    Calculate Fanning friction factor with automatic method selection.
    
    Logic:
        - Re < 2300: f = 16/Re (laminar)
        - Re >= 2300 and ε/D < 1e-6: f = 0.0791/Re^0.25 (Blasius, smooth)
        - Re >= 2300 and ε/D >= 1e-6: Colebrook-White (rough turbulent)
    
    Parameters:
        Re: Reynolds number
        epsilon_D: Relative roughness (ε/D)
    
    Returns:
        (f, method_used) tuple
    """
    if Re <= 0:
        return 0.01, 'default'
    
    if Re < 2300:
        # Laminar flow
        f = 16.0 / Re
        return f, 'laminar'
    
    if epsilon_D < 1e-6:
        # Smooth turbulent - Blasius
        f = 0.0791 / Re ** 0.25
        return f, 'blasius'
    
    # Rough turbulent - Colebrook-White iteration
    # Colebrook: 1/√f = -4 log₁₀(ε/3.7D + 1.256/(Re√f))
    
    # Initial guess from Blasius
    f_init = 0.0791 / Re ** 0.25
    
    def colebrook_eq(f):
        if f <= 0:
            return 1e10
        sqrt_f = np.sqrt(f)
        term = epsilon_D / 3.7 + 1.256 / (Re * sqrt_f)
        if term <= 0:
            return 1e10
        return 1.0 / sqrt_f + 4.0 * np.log10(term)
    
    try:
        # Try Brent's method
        f_low, f_high = 0.001, 0.1
        if colebrook_eq(f_low) * colebrook_eq(f_high) < 0:
            f = brentq(colebrook_eq, f_low, f_high)
        else:
            # Fall back to fsolve
            result = fsolve(colebrook_eq, f_init, full_output=True)
            f = max(result[0][0], 0.001)
        return f, 'colebrook'
    except Exception:
        return f_init, 'blasius_fallback'


# =============================================================================
# HEAD LOSS CALCULATIONS
# =============================================================================

def calculate_major_head_loss(L: float, D: float, Q: float, rho: float, mu: float,
                               epsilon: float = 0.0, g: float = G) -> Dict[str, float]:
    """Calculate major head loss: h_L = 2f(L/D)(v²/g)"""
    if Q <= 0 or D <= 0:
        return {'h_L': 0.0, 'f': 0.0, 'Re': 0.0, 'v': 0.0, 'regime': 'none'}
    
    A = calculate_area(D)
    v = Q / A
    Re = calculate_Re(rho, v, D, mu)
    epsilon_D = epsilon / D if D > 0 else 0.0
    f, method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    
    h_L = 2 * f * (L / D) * (v ** 2) / g
    
    return {
        'h_L': h_L,
        'f': f,
        'f_method': method,
        'Re': Re,
        'v': v,
        'regime': regime,
        'epsilon_D': epsilon_D
    }


def calculate_minor_head_loss(K: float, Q: float, A: float, g: float = G) -> float:
    """Calculate minor head loss: h_L = K(v²/2g)"""
    if A <= 0 or Q <= 0:
        return 0.0
    v = Q / A
    return K * (v ** 2) / (2 * g)


def calculate_total_minor_head_loss(K_values: List[float], Q: float, A: float, g: float = G) -> float:
    """Calculate total minor head loss: h_L = Σ K_i (v²/2g)"""
    K_total = sum(K_values)
    return calculate_minor_head_loss(K_total, Q, A, g)


def get_K_from_name(fitting_name: str) -> Optional[float]:
    return MINOR_LOSS_K.get(fitting_name)


def calculate_K_sudden_contraction(D_small: float, D_large: float) -> float:
    beta = D_small / D_large
    return 0.5 * (1 - beta ** 2)


def calculate_K_sudden_expansion(D_small: float, D_large: float) -> float:
    beta = D_small / D_large
    return (1 - beta ** 2) ** 2


# =============================================================================
# MECHANICAL ENERGY BALANCE
# =============================================================================

def mechanical_energy_balance(
    P1: Optional[float] = None,
    P2: Optional[float] = None,
    v1: Optional[float] = None,
    v2: Optional[float] = None,
    z1: Optional[float] = None,
    z2: Optional[float] = None,
    h_L: float = 0.0,
    h_a: Optional[float] = None,
    h_t: float = 0.0,
    rho: float = 1000.0,
    g: float = G,
    alpha1: float = ALPHA_TURB,
    alpha2: float = ALPHA_TURB,
    solve_for: Optional[str] = None
) -> SolverResult:
    """
    Solve the Mechanical Energy Balance.
    
    Equation:
    P₁/(ρg) + α₁v₁²/(2g) + z₁ + h_a = P₂/(ρg) + α₂v₂²/(2g) + z₂ + h_L + h_t
    
    Parameters:
        P1, P2: Pressures at points 1 and 2 (Pa)
        v1, v2: Velocities at points 1 and 2 (m/s)
        z1, z2: Elevations at points 1 and 2 (m)
        h_L: Total head loss (m)
        h_a: Pump head added (m) - positive for pump
        h_t: Turbine head extracted (m) - positive for turbine
        rho: Fluid density (kg/m³)
        g: Gravitational acceleration (m/s²)
        alpha1, alpha2: Kinetic energy correction factors
        solve_for: Variable to solve for ('h_a', 'h_L', 'P1', 'P2', 'z1', 'z2', 'v1', 'v2', None)
                   If None, returns the residual (should be 0 if balanced)
    
    Returns:
        SolverResult with solved value or residual
    """
    # Default values for velocities if not provided (large tanks)
    if v1 is None:
        v1 = 0.0
    if v2 is None:
        v2 = 0.0
    
    # Check what we need based on solve_for
    required = []
    if solve_for != 'P1' and P1 is None:
        required.append({'param': 'P1', 'description': 'Pressure at point 1'})
    if solve_for != 'P2' and P2 is None:
        required.append({'param': 'P2', 'description': 'Pressure at point 2'})
    if solve_for != 'z1' and z1 is None:
        required.append({'param': 'z1', 'description': 'Elevation at point 1'})
    if solve_for != 'z2' and z2 is None:
        required.append({'param': 'z2', 'description': 'Elevation at point 2'})
    if solve_for != 'h_a' and h_a is None:
        required.append({'param': 'h_a', 'description': 'Pump head'})
    
    if required and solve_for is not None:
        return SolverResult(status=SolverStatus.MISSING_INPUTS, missing=required)
    
    # Set defaults for missing non-solve variables
    P1 = P1 if P1 is not None else 0.0
    P2 = P2 if P2 is not None else 0.0
    z1 = z1 if z1 is not None else 0.0
    z2 = z2 if z2 is not None else 0.0
    h_a = h_a if h_a is not None else 0.0
    
    # Convert pressures to head
    H1 = P1 / (rho * g)
    H2 = P2 / (rho * g)
    
    # Kinetic energy heads
    KE1 = alpha1 * v1**2 / (2 * g)
    KE2 = alpha2 * v2**2 / (2 * g)
    
    # MEB: H1 + KE1 + z1 + h_a = H2 + KE2 + z2 + h_L + h_t
    
    if solve_for is None:
        # Return residual
        LHS = H1 + KE1 + z1 + h_a
        RHS = H2 + KE2 + z2 + h_L + h_t
        residual = LHS - RHS
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'residual': residual, 'LHS': LHS, 'RHS': RHS, 'balanced': abs(residual) < 1e-9}
        )
    
    elif solve_for == 'h_a':
        # h_a = H2 + KE2 + z2 + h_L + h_t - H1 - KE1 - z1
        h_a_solved = H2 + KE2 + z2 + h_L + h_t - H1 - KE1 - z1
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'h_a': h_a_solved}
        )
    
    elif solve_for == 'h_L':
        # h_L = H1 + KE1 + z1 + h_a - H2 - KE2 - z2 - h_t
        h_L_solved = H1 + KE1 + z1 + h_a - H2 - KE2 - z2 - h_t
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'h_L': h_L_solved}
        )
    
    elif solve_for == 'P1':
        # H1 = H2 + KE2 + z2 + h_L + h_t - KE1 - z1 - h_a
        H1_solved = H2 + KE2 + z2 + h_L + h_t - KE1 - z1 - h_a
        P1_solved = H1_solved * rho * g
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'P1': P1_solved}
        )
    
    elif solve_for == 'P2':
        # H2 = H1 + KE1 + z1 + h_a - KE2 - z2 - h_L - h_t
        H2_solved = H1 + KE1 + z1 + h_a - KE2 - z2 - h_L - h_t
        P2_solved = H2_solved * rho * g
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'P2': P2_solved}
        )
    
    elif solve_for == 'z1':
        # z1 = H2 + KE2 + z2 + h_L + h_t - H1 - KE1 - h_a
        z1_solved = H2 + KE2 + z2 + h_L + h_t - H1 - KE1 - h_a
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'z1': z1_solved}
        )
    
    elif solve_for == 'z2':
        # z2 = H1 + KE1 + z1 + h_a - H2 - KE2 - h_L - h_t
        z2_solved = H1 + KE1 + z1 + h_a - H2 - KE2 - h_L - h_t
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'z2': z2_solved}
        )
    
    elif solve_for == 'v1':
        # KE1 = H2 + KE2 + z2 + h_L + h_t - H1 - z1 - h_a
        KE1_solved = H2 + KE2 + z2 + h_L + h_t - H1 - z1 - h_a
        if KE1_solved < 0:
            return SolverResult(
                status=SolverStatus.NO_SOLUTION,
                reason='negative_kinetic_energy',
                details='Solved kinetic energy is negative - check input values'
            )
        v1_solved = np.sqrt(2 * g * KE1_solved / alpha1)
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'v1': v1_solved}
        )
    
    elif solve_for == 'v2':
        # KE2 = H1 + KE1 + z1 + h_a - H2 - z2 - h_L - h_t
        KE2_solved = H1 + KE1 + z1 + h_a - H2 - z2 - h_L - h_t
        if KE2_solved < 0:
            return SolverResult(
                status=SolverStatus.NO_SOLUTION,
                reason='negative_kinetic_energy',
                details='Solved kinetic energy is negative - check input values'
            )
        v2_solved = np.sqrt(2 * g * KE2_solved / alpha2)
        return SolverResult(
            status=SolverStatus.SUCCESS,
            result={'v2': v2_solved}
        )
    
    else:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='unknown_solve_for',
            details=f"Unknown solve_for parameter: {solve_for}"
        )


# =============================================================================
# SYSTEM DEFINITION
# =============================================================================

@dataclass
class PipeSystem:
    """
    Define a piping system for analysis.
    
    All units should be SI (m, Pa, kg/m³, Pa·s, etc.)
    """
    # Fluid properties
    rho: Optional[float] = None          # Density (kg/m³)
    mu: Optional[float] = None           # Dynamic viscosity (Pa·s)
    Pvap: float = 0.0                    # Vapor pressure (Pa)
    
    # Pipe geometry
    D: Optional[float] = None            # Diameter (m) - for circular
    L: Optional[float] = None            # Length (m)
    epsilon: float = 0.0                 # Roughness (m)
    
    # Non-circular geometry (optional)
    shape: str = 'circular'
    rect_a: Optional[float] = None       # Rectangle dimension a (m)
    rect_b: Optional[float] = None       # Rectangle dimension b (m)
    D_outer: Optional[float] = None      # Annulus outer diameter (m)
    D_inner: Optional[float] = None      # Annulus inner diameter (m)
    
    # Boundary conditions
    P1: Optional[float] = None           # Inlet pressure (Pa)
    P2: Optional[float] = None           # Outlet pressure (Pa)
    z1: Optional[float] = None           # Inlet elevation (m)
    z2: Optional[float] = None           # Outlet elevation (m)
    v1: float = 0.0                      # Inlet velocity (m/s) - 0 for large tanks
    v2: float = 0.0                      # Outlet velocity (m/s) - 0 for large tanks
    
    # Minor losses
    K_total: float = 0.0                 # Sum of all K values
    K_list: List[float] = field(default_factory=list)  # Individual K values
    fittings: List[str] = field(default_factory=list)  # Fitting names to look up
    
    # Pump (optional)
    pump_curve: Optional[List[Tuple[float, float]]] = None  # [(Q, H), ...]
    pump_efficiency_curve: Optional[List[Tuple[float, float]]] = None  # [(Q, η), ...]
    pump_NPSHR_curve: Optional[List[Tuple[float, float]]] = None  # [(Q, NPSH_R), ...]
    
    # Suction side (for NPSH)
    z_suction: float = 0.0               # Pump elevation above liquid surface (m)
    h_L_suction: float = 0.0             # Head loss in suction line (m)
    
    def get_D_h_and_A(self) -> SolverResult:
        """Get hydraulic diameter and area for the pipe."""
        if self.shape == 'circular':
            if self.D is None:
                return SolverResult(
                    status=SolverStatus.MISSING_INPUTS,
                    missing=[{'param': 'D', 'description': 'Pipe diameter'}]
                )
            return calculate_hydraulic_diameter('circular', D=self.D)
        elif self.shape == 'rectangular':
            return calculate_hydraulic_diameter('rectangular', a=self.rect_a, b=self.rect_b)
        elif self.shape == 'annular':
            return calculate_hydraulic_diameter('annular', D_outer=self.D_outer, D_inner=self.D_inner)
        else:
            return SolverResult(
                status=SolverStatus.NO_SOLUTION,
                reason='unknown_shape',
                details=f"Unknown pipe shape: {self.shape}"
            )
    
    def get_total_K(self) -> float:
        """Get total minor loss coefficient."""
        K = self.K_total
        K += sum(self.K_list)
        for fitting in self.fittings:
            k_val = get_K_from_name(fitting)
            if k_val is not None:
                K += k_val
        return K
    
    def validate(self, required_params: List[str]) -> SolverResult:
        """Check if required parameters are present."""
        missing = []
        param_map = {
            'rho': ('rho', 'Fluid density'),
            'mu': ('mu', 'Dynamic viscosity'),
            'D': ('D', 'Pipe diameter'),
            'L': ('L', 'Pipe length'),
            'P1': ('P1', 'Inlet pressure'),
            'P2': ('P2', 'Outlet pressure'),
            'z1': ('z1', 'Inlet elevation'),
            'z2': ('z2', 'Outlet elevation'),
            'pump_curve': ('pump_curve', 'Pump curve data'),
        }
        
        for param in required_params:
            if param in param_map:
                attr_name, desc = param_map[param]
                if getattr(self, attr_name, None) is None:
                    missing.append({'param': param, 'description': desc})
        
        if missing:
            return SolverResult(status=SolverStatus.MISSING_INPUTS, missing=missing)
        return SolverResult(status=SolverStatus.SUCCESS)


# =============================================================================
# PUMP CURVES
# =============================================================================

def interpolate_pump_curve(Q: float, curve_data: List[Tuple[float, float]]) -> float:
    """
    Interpolate pump curve to get head at given flow rate.
    
    Parameters:
        Q: Flow rate (m³/s)
        curve_data: List of (Q, H) tuples
    
    Returns:
        Interpolated head (m)
    """
    if not curve_data:
        return 0.0
    Qs, Hs = zip(*curve_data)
    return float(np.interp(Q, Qs, Hs))


def interpolate_efficiency(Q: float, curve_data: List[Tuple[float, float]]) -> float:
    """Interpolate pump efficiency at given flow rate."""
    if not curve_data:
        return 0.75  # Default assumption
    Qs, etas = zip(*curve_data)
    return float(np.interp(Q, Qs, etas))


def interpolate_NPSHR(Q: float, curve_data: List[Tuple[float, float]]) -> float:
    """Interpolate NPSH required at given flow rate."""
    if not curve_data:
        return 0.0
    Qs, NPSHRs = zip(*curve_data)
    return float(np.interp(Q, Qs, NPSHRs))


def find_BEP(efficiency_curve: List[Tuple[float, float]]) -> Tuple[float, float]:
    """
    Find Best Efficiency Point.
    
    Returns:
        (Q_BEP, η_max)
    """
    if not efficiency_curve:
        return (0.0, 0.0)
    Qs, etas = zip(*efficiency_curve)
    idx = np.argmax(etas)
    return (Qs[idx], etas[idx])


# =============================================================================
# AFFINITY LAWS
# =============================================================================

def affinity_rpm_scaling(
    Q1: Optional[float] = None,
    H1: Optional[float] = None,
    P1: Optional[float] = None,
    n1: float = 1.0,
    n2: float = 1.0
) -> Dict[str, Optional[float]]:
    """
    Apply affinity laws for RPM change.
    
    Q₂/Q₁ = n₂/n₁
    H₂/H₁ = (n₂/n₁)²
    P₂/P₁ = (n₂/n₁)³
    
    Parameters:
        Q1: Original flow rate
        H1: Original head
        P1: Original power
        n1: Original RPM
        n2: New RPM
    
    Returns:
        Dict with Q2, H2, P2
    """
    ratio = n2 / n1
    return {
        'Q2': Q1 * ratio if Q1 is not None else None,
        'H2': H1 * ratio**2 if H1 is not None else None,
        'P2': P1 * ratio**3 if P1 is not None else None,
        'ratio': ratio
    }


def affinity_diameter_scaling(
    Q1: Optional[float] = None,
    H1: Optional[float] = None,
    P1: Optional[float] = None,
    D1: float = 1.0,
    D2: float = 1.0
) -> Dict[str, Optional[float]]:
    """
    Apply affinity laws for impeller diameter change.
    
    Q₂/Q₁ = D₂/D₁
    H₂/H₁ = (D₂/D₁)²
    P₂/P₁ = (D₂/D₁)³
    """
    ratio = D2 / D1
    return {
        'Q2': Q1 * ratio if Q1 is not None else None,
        'H2': H1 * ratio**2 if H1 is not None else None,
        'P2': P1 * ratio**3 if P1 is not None else None,
        'ratio': ratio
    }


def scale_pump_curve(
    curve: List[Tuple[float, float]],
    n1: float,
    n2: float
) -> List[Tuple[float, float]]:
    """
    Scale entire pump curve for new RPM.
    
    Returns:
        New curve as list of (Q, H) tuples
    """
    ratio = n2 / n1
    return [(Q * ratio, H * ratio**2) for Q, H in curve]


# =============================================================================
# NPSH & CAVITATION
# =============================================================================

def calculate_NPSH_A(
    P_surface: float,
    Pvap: float,
    rho: float,
    h_L_suction: float = 0.0,
    z_suction: float = 0.0,
    g: float = G
) -> float:
    """
    Calculate Net Positive Suction Head Available.
    
    NPSH_A = (P_surface - P_vap)/(ρg) - h_L,suction - z_suction
    
    Parameters:
        P_surface: Pressure at liquid surface (Pa)
        Pvap: Vapor pressure (Pa)
        rho: Fluid density (kg/m³)
        h_L_suction: Head loss in suction line (m)
        z_suction: Height of pump above liquid surface (m) - positive if pump is above
        g: Gravitational acceleration (m/s²)
    
    Returns:
        NPSH_A (m)
    """
    return (P_surface - Pvap) / (rho * g) - h_L_suction - z_suction


def check_cavitation(NPSH_A: float, NPSH_R: float) -> Dict[str, Any]:
    """
    Check for cavitation.
    
    Returns:
        Dict with cavitation status, margin, and warnings
    """
    margin = NPSH_A - NPSH_R
    cavitates = NPSH_A < NPSH_R
    
    warnings = []
    if cavitates:
        warnings.append(f"CAVITATION WILL OCCUR: NPSH_A ({NPSH_A:.2f} m) < NPSH_R ({NPSH_R:.2f} m)")
    elif margin < 0.5:
        warnings.append(f"Low NPSH margin ({margin:.2f} m) - cavitation risk")
    elif margin < 1.0:
        warnings.append(f"Moderate NPSH margin ({margin:.2f} m) - monitor conditions")
    
    return {
        'cavitates': cavitates,
        'NPSH_A': NPSH_A,
        'NPSH_R': NPSH_R,
        'margin': margin,
        'warnings': warnings
    }


def calculate_max_suction_lift(
    P_surface: float,
    Pvap: float,
    rho: float,
    NPSH_R: float,
    h_L_suction: float = 0.0,
    g: float = G
) -> float:
    """
    Calculate maximum allowable suction lift (pump height above liquid).
    
    z_max = (P_surface - P_vap)/(ρg) - h_L,suction - NPSH_R
    """
    return (P_surface - Pvap) / (rho * g) - h_L_suction - NPSH_R


# =============================================================================
# PUMP COMBINATIONS
# =============================================================================

def pumps_in_series(
    curves: List[List[Tuple[float, float]]],
    Q_range: Optional[np.ndarray] = None
) -> List[Tuple[float, float]]:
    """
    Combine pump curves in series (heads add at same Q).
    
    H_total(Q) = H₁(Q) + H₂(Q) + ...
    
    Parameters:
        curves: List of pump curves, each as [(Q, H), ...]
        Q_range: Flow rates to evaluate (uses first curve's Q values if None)
    
    Returns:
        Combined curve as [(Q, H_total), ...]
    """
    if not curves:
        return []
    
    if Q_range is None:
        # Use Q values from first curve
        Q_range = np.array([pt[0] for pt in curves[0]])
    
    combined = []
    for Q in Q_range:
        H_total = sum(interpolate_pump_curve(Q, curve) for curve in curves)
        combined.append((float(Q), float(H_total)))
    
    return combined


def pumps_in_parallel(
    curves: List[List[Tuple[float, float]]],
    H_range: Optional[np.ndarray] = None
) -> List[Tuple[float, float]]:
    """
    Combine pump curves in parallel (flows add at same H).
    
    Q_total(H) = Q₁(H) + Q₂(H) + ...
    
    Parameters:
        curves: List of pump curves, each as [(Q, H), ...]
        H_range: Head values to evaluate
    
    Returns:
        Combined curve as [(Q_total, H), ...]
    """
    if not curves:
        return []
    
    # Get all H values from curves
    all_H = []
    for curve in curves:
        all_H.extend([pt[1] for pt in curve])
    
    if H_range is None:
        H_range = np.linspace(min(all_H), max(all_H), 50)
    
    combined = []
    for H in H_range:
        Q_total = 0.0
        for curve in curves:
            # Interpolate Q at this H (need to invert the curve)
            Qs, Hs = zip(*curve)
            # Only add if H is within this pump's range
            if min(Hs) <= H <= max(Hs):
                Q_total += float(np.interp(H, Hs[::-1], Qs[::-1]))  # Reverse because H decreases with Q
        combined.append((float(Q_total), float(H)))
    
    # Sort by Q
    combined.sort(key=lambda x: x[0])
    return combined


# =============================================================================
# POWER CALCULATIONS
# =============================================================================

def calculate_hydraulic_power(Q: float, h_a: float, rho: float, g: float = G) -> float:
    """
    Calculate hydraulic power.
    
    P_hydraulic = ρgQh_a [W]
    """
    return rho * g * Q * h_a


def calculate_shaft_power(P_hydraulic: float, efficiency: float) -> float:
    """
    Calculate shaft (brake) power.
    
    P_shaft = P_hydraulic / η [W]
    """
    if efficiency <= 0:
        return float('inf')
    return P_hydraulic / efficiency


def calculate_water_horsepower(Q_gpm: float, H_ft: float) -> float:
    """
    Calculate water horsepower (US units).
    
    WHP = Q(gpm) × H(ft) / 3960
    """
    return Q_gpm * H_ft / 3960


def calculate_brake_horsepower(WHP: float, efficiency: float) -> float:
    """
    Calculate brake horsepower.
    
    BHP = WHP / η
    """
    if efficiency <= 0:
        return float('inf')
    return WHP / efficiency


# =============================================================================
# SOLVER MODES
# =============================================================================

def solve_system_curve(
    system: PipeSystem,
    Q_range: Optional[np.ndarray] = None,
    n_points: int = 50
) -> SolverResult:
    """
    MODE A: Generate system curve h_a(Q).
    
    For each Q, calculate the head the pump must provide.
    
    Parameters:
        system: PipeSystem object with geometry and conditions
        Q_range: Array of Q values to evaluate (m³/s)
        n_points: Number of points if Q_range not provided
    
    Returns:
        SolverResult with system curve data
    """
    # Validate required inputs
    validation = system.validate(['rho', 'mu', 'L', 'P1', 'P2', 'z1', 'z2'])
    if not validation.is_success():
        return validation
    
    # Get geometry
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    # Set up Q range
    if Q_range is None:
        Q_max = 0.5 * A  # Rough estimate: v_max ~ 0.5/π ≈ 0.16 m/s per unit area? No, let's do better
        Q_max = A * 10  # v_max ~ 10 m/s
        Q_range = np.linspace(0.001, Q_max, n_points)
    
    # Get constants
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    g = G
    
    # Calculate system curve
    curve_data = []
    detailed_data = []
    warnings = []
    
    for Q in Q_range:
        # Calculate velocity
        v = Q / A
        
        # Reynolds number
        Re = calculate_Re(rho, v, D_h, mu)
        regime = get_flow_regime(Re)
        alpha = get_alpha(Re)
        
        # Friction factor
        epsilon_D = epsilon / D_h if D_h > 0 else 0
        f, f_method = calculate_friction_factor(Re, epsilon_D)
        
        # Head losses
        h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
        h_L_minor = K_total * (v ** 2) / (2 * g)
        h_L_total = h_L_major + h_L_minor
        
        # Kinetic energy terms (assuming v1=0 for tank, v2=v for pipe exit, or both ~0 for tank-to-tank)
        v1, v2 = system.v1, system.v2
        if v2 == 0:
            v2 = v  # Pipe exit velocity
        
        # Solve MEB for h_a
        meb_result = mechanical_energy_balance(
            P1=P1, P2=P2, v1=v1, v2=v2, z1=z1, z2=z2,
            h_L=h_L_total, rho=rho, g=g,
            alpha1=get_alpha(0), alpha2=alpha,  # alpha1 for tank (assume turbulent)
            solve_for='h_a'
        )
        
        h_a = meb_result.result['h_a']
        
        curve_data.append((float(Q), float(h_a)))
        detailed_data.append({
            'Q': float(Q),
            'h_a': float(h_a),
            'v': float(v),
            'Re': float(Re),
            'regime': regime,
            'f': float(f),
            'f_method': f_method,
            'h_L_major': float(h_L_major),
            'h_L_minor': float(h_L_minor),
            'h_L_total': float(h_L_total)
        })
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={
            'curve': curve_data,
            'detailed': detailed_data,
            'Q_range': Q_range.tolist(),
            'D_h': D_h,
            'A': A
        },
        warnings=warnings
    )


def solve_gravity_flow(system: PipeSystem, Q_guess: float = 0.01, max_iter: int = 100) -> SolverResult:
    """
    MODE B: Find flow rate for gravity-driven flow (no pump, h_a = 0).
    
    Iteratively solve for Q where MEB balances with h_a = 0.
    """
    # Validate
    validation = system.validate(['rho', 'mu', 'L', 'P1', 'P2', 'z1', 'z2'])
    if not validation.is_success():
        return validation
    
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    g = G
    
    def residual(Q):
        if Q <= 0:
            return 1e10
        
        v = Q / A
        Re = calculate_Re(rho, v, D_h, mu)
        epsilon_D = epsilon / D_h if D_h > 0 else 0
        f, _ = calculate_friction_factor(Re, epsilon_D)
        
        h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
        h_L_minor = K_total * (v ** 2) / (2 * g)
        h_L_total = h_L_major + h_L_minor
        
        alpha = get_alpha(Re)
        v1, v2 = system.v1, v  # v2 = pipe velocity
        
        # MEB with h_a = 0
        meb = mechanical_energy_balance(
            P1=P1, P2=P2, v1=v1, v2=v2, z1=z1, z2=z2,
            h_L=h_L_total, h_a=0, rho=rho, g=g,
            alpha1=ALPHA_TURB, alpha2=alpha,
            solve_for=None
        )
        return meb.result['residual']
    
    # Try to find solution
    try:
        # Try Brent's method first
        Q_low, Q_high = 1e-6, A * 20  # v_max ~ 20 m/s
        
        # Check if solution exists (residuals have opposite signs)
        res_low = residual(Q_low)
        res_high = residual(Q_high)
        
        if res_low * res_high < 0:
            Q_solved = brentq(residual, Q_low, Q_high)
        else:
            # Try fsolve
            result = fsolve(residual, Q_guess, full_output=True)
            Q_solved = result[0][0]
            if Q_solved <= 0:
                # Check if flow should be reversed
                if z1 < z2 and P1 <= P2:
                    return SolverResult(
                        status=SolverStatus.NO_SOLUTION,
                        reason='reverse_flow',
                        details='Flow would be from point 2 to point 1 (z2 > z1 and P2 >= P1)'
                    )
                return SolverResult(
                    status=SolverStatus.NO_SOLUTION,
                    reason='no_positive_solution',
                    details='Could not find positive flow rate solution'
                )
    except Exception as e:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='iteration_failed',
            details=str(e)
        )
    
    # Get final values
    Q = Q_solved
    v = Q / A
    Re = calculate_Re(rho, v, D_h, mu)
    epsilon_D = epsilon / D_h if D_h > 0 else 0
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    
    h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
    h_L_minor = K_total * (v ** 2) / (2 * g)
    h_L_total = h_L_major + h_L_minor
    
    warnings = []
    if 2000 < Re < 4000:
        warnings.append(f"Re = {Re:.0f} is in transitional regime - results uncertain")
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={
            'Q': float(Q),
            'v': float(v),
            'Re': float(Re),
            'regime': regime,
            'f': float(f),
            'f_method': f_method,
            'h_L_major': float(h_L_major),
            'h_L_minor': float(h_L_minor),
            'h_L_total': float(h_L_total),
            'h_a': 0.0
        },
        warnings=warnings
    )


def solve_given_pump_head(system: PipeSystem, h_a: float, Q_guess: float = 0.01) -> SolverResult:
    """
    MODE C: Find Q given a fixed pump head h_a.
    """
    validation = system.validate(['rho', 'mu', 'L', 'P1', 'P2', 'z1', 'z2'])
    if not validation.is_success():
        return validation
    
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    g = G
    
    def residual(Q):
        if Q <= 0:
            return 1e10
        
        v = Q / A
        Re = calculate_Re(rho, v, D_h, mu)
        epsilon_D = epsilon / D_h if D_h > 0 else 0
        f, _ = calculate_friction_factor(Re, epsilon_D)
        
        h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
        h_L_minor = K_total * (v ** 2) / (2 * g)
        h_L_total = h_L_major + h_L_minor
        
        alpha = get_alpha(Re)
        v2 = v
        
        meb = mechanical_energy_balance(
            P1=P1, P2=P2, v1=system.v1, v2=v2, z1=z1, z2=z2,
            h_L=h_L_total, h_a=h_a, rho=rho, g=g,
            alpha1=ALPHA_TURB, alpha2=alpha,
            solve_for=None
        )
        return meb.result['residual']
    
    try:
        Q_low, Q_high = 1e-6, A * 20
        if residual(Q_low) * residual(Q_high) < 0:
            Q_solved = brentq(residual, Q_low, Q_high)
        else:
            Q_solved = fsolve(residual, Q_guess)[0]
    except Exception as e:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='iteration_failed',
            details=str(e)
        )
    
    if Q_solved <= 0:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='negative_flow',
            details='Solved flow rate is negative or zero'
        )
    
    # Final calculations
    Q = Q_solved
    v = Q / A
    Re = calculate_Re(rho, v, D_h, mu)
    epsilon_D = epsilon / D_h if D_h > 0 else 0
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    
    h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
    h_L_minor = K_total * (v ** 2) / (2 * g)
    h_L_total = h_L_major + h_L_minor
    
    P_hydraulic = calculate_hydraulic_power(Q, h_a, rho, g)
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={
            'Q': float(Q),
            'v': float(v),
            'Re': float(Re),
            'regime': regime,
            'f': float(f),
            'f_method': f_method,
            'h_L_major': float(h_L_major),
            'h_L_minor': float(h_L_minor),
            'h_L_total': float(h_L_total),
            'h_a': float(h_a),
            'P_hydraulic': float(P_hydraulic)
        }
    )


def solve_given_pump_power(
    system: PipeSystem,
    W_shaft: float,
    efficiency: float = 1.0,
    Q_guess: float = 0.01
) -> SolverResult:
    """
    MODE D: Find Q given shaft power W_shaft and efficiency.
    
    Constraint: h_a = η·W_shaft/(ρQg)
    """
    validation = system.validate(['rho', 'mu', 'L', 'P1', 'P2', 'z1', 'z2'])
    if not validation.is_success():
        return validation
    
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    g = G
    
    def residual(Q):
        if Q <= 0:
            return 1e10
        
        # h_a from power
        h_a = efficiency * W_shaft / (rho * Q * g)
        
        v = Q / A
        Re = calculate_Re(rho, v, D_h, mu)
        epsilon_D = epsilon / D_h if D_h > 0 else 0
        f, _ = calculate_friction_factor(Re, epsilon_D)
        
        h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
        h_L_minor = K_total * (v ** 2) / (2 * g)
        h_L_total = h_L_major + h_L_minor
        
        alpha = get_alpha(Re)
        v2 = v
        
        meb = mechanical_energy_balance(
            P1=P1, P2=P2, v1=system.v1, v2=v2, z1=z1, z2=z2,
            h_L=h_L_total, h_a=h_a, rho=rho, g=g,
            alpha1=ALPHA_TURB, alpha2=alpha,
            solve_for=None
        )
        return meb.result['residual']
    
    try:
        Q_low, Q_high = 1e-6, A * 20
        if residual(Q_low) * residual(Q_high) < 0:
            Q_solved = brentq(residual, Q_low, Q_high)
        else:
            Q_solved = fsolve(residual, Q_guess)[0]
    except Exception as e:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='iteration_failed',
            details=str(e)
        )
    
    if Q_solved <= 0:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='negative_flow',
            details='Solved flow rate is negative or zero'
        )
    
    Q = Q_solved
    h_a = efficiency * W_shaft / (rho * Q * g)
    v = Q / A
    Re = calculate_Re(rho, v, D_h, mu)
    epsilon_D = epsilon / D_h if D_h > 0 else 0
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    
    h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
    h_L_minor = K_total * (v ** 2) / (2 * g)
    h_L_total = h_L_major + h_L_minor
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={
            'Q': float(Q),
            'v': float(v),
            'Re': float(Re),
            'regime': regime,
            'f': float(f),
            'f_method': f_method,
            'h_L_major': float(h_L_major),
            'h_L_minor': float(h_L_minor),
            'h_L_total': float(h_L_total),
            'h_a': float(h_a),
            'W_shaft': float(W_shaft),
            'efficiency': float(efficiency),
            'P_hydraulic': float(rho * g * Q * h_a)
        }
    )


def solve_given_Q_and_power(
    system: PipeSystem,
    Q: float,
    W_shaft: float,
    efficiency: float = 1.0,
    solve_for: str = 'P2'
) -> SolverResult:
    """
    MODE E: Given Q and W_shaft, solve for unknown boundary condition.
    
    Since Q is known:
    - h_a = η·W_shaft/(ρQg)
    - h_L can be calculated directly
    - Solve MEB for remaining unknown (P1, P2, z1, z2)
    """
    validation = system.validate(['rho', 'mu', 'L'])
    if not validation.is_success():
        return validation
    
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    K_total = system.get_total_K()
    g = G
    
    # Calculate known values
    h_a = efficiency * W_shaft / (rho * Q * g)
    v = Q / A
    Re = calculate_Re(rho, v, D_h, mu)
    epsilon_D = epsilon / D_h if D_h > 0 else 0
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    alpha = get_alpha(Re)
    
    h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
    h_L_minor = K_total * (v ** 2) / (2 * g)
    h_L_total = h_L_major + h_L_minor
    
    # Solve MEB for requested variable
    meb_result = mechanical_energy_balance(
        P1=system.P1,
        P2=system.P2,
        v1=system.v1,
        v2=v,
        z1=system.z1,
        z2=system.z2,
        h_L=h_L_total,
        h_a=h_a,
        rho=rho,
        g=g,
        alpha1=ALPHA_TURB,
        alpha2=alpha,
        solve_for=solve_for
    )
    
    if not meb_result.is_success():
        return meb_result
    
    result = {
        'Q': float(Q),
        'v': float(v),
        'Re': float(Re),
        'regime': regime,
        'f': float(f),
        'f_method': f_method,
        'h_L_major': float(h_L_major),
        'h_L_minor': float(h_L_minor),
        'h_L_total': float(h_L_total),
        'h_a': float(h_a),
        'W_shaft': float(W_shaft),
        'efficiency': float(efficiency),
        solve_for: meb_result.result[solve_for]
    }
    
    return SolverResult(status=SolverStatus.SUCCESS, result=result)


def solve_operating_point(system: PipeSystem, Q_guess: float = 0.01) -> SolverResult:
    """
    MODE F: Find operating point where system curve meets pump curve.
    """
    # Validate
    required = ['rho', 'mu', 'L', 'P1', 'P2', 'z1', 'z2', 'pump_curve']
    validation = system.validate(required)
    if not validation.is_success():
        return validation
    
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    pump_curve = system.pump_curve
    g = G
    
    def system_head(Q):
        """Calculate required system head at flow Q."""
        if Q <= 0:
            return 1e10
        
        v = Q / A
        Re = calculate_Re(rho, v, D_h, mu)
        epsilon_D = epsilon / D_h if D_h > 0 else 0
        f, _ = calculate_friction_factor(Re, epsilon_D)
        alpha = get_alpha(Re)
        
        h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
        h_L_minor = K_total * (v ** 2) / (2 * g)
        h_L_total = h_L_major + h_L_minor
        
        v2 = v
        meb = mechanical_energy_balance(
            P1=P1, P2=P2, v1=system.v1, v2=v2, z1=z1, z2=z2,
            h_L=h_L_total, rho=rho, g=g,
            alpha1=ALPHA_TURB, alpha2=alpha,
            solve_for='h_a'
        )
        return meb.result['h_a']
    
    def residual(Q):
        """Difference between pump head and system head."""
        if Q <= 0:
            return 1e10
        h_system = system_head(Q)
        h_pump = interpolate_pump_curve(Q, pump_curve)
        return h_pump - h_system
    
    # Check if intersection exists
    Q_min = pump_curve[0][0] if pump_curve else 1e-6
    Q_max = pump_curve[-1][0] if pump_curve else A * 10
    
    h_sys_at_min = system_head(Q_min)
    h_pump_at_min = interpolate_pump_curve(Q_min, pump_curve)
    h_sys_at_max = system_head(Q_max)
    h_pump_at_max = interpolate_pump_curve(Q_max, pump_curve)
    
    # Check if pump can meet system requirements
    if h_pump_at_min < h_sys_at_min and h_pump_at_max < h_sys_at_max:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='pump_insufficient',
            details='Pump curve is always below system curve - pump cannot overcome system head',
            partial_results={
                'h_system_at_Q_min': h_sys_at_min,
                'h_pump_at_Q_min': h_pump_at_min,
                'h_system_at_Q_max': h_sys_at_max,
                'h_pump_at_Q_max': h_pump_at_max
            }
        )
    
    try:
        if residual(Q_min) * residual(Q_max) < 0:
            Q_op = brentq(residual, Q_min, Q_max)
        else:
            Q_op = fsolve(residual, Q_guess)[0]
    except Exception as e:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='iteration_failed',
            details=str(e)
        )
    
    if Q_op <= 0:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='no_intersection',
            details='Could not find positive operating point'
        )
    
    # Final values at operating point
    Q = Q_op
    h_a = interpolate_pump_curve(Q, pump_curve)
    v = Q / A
    Re = calculate_Re(rho, v, D_h, mu)
    epsilon_D = epsilon / D_h if D_h > 0 else 0
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    
    h_L_major = 2 * f * (L / D_h) * (v ** 2) / g
    h_L_minor = K_total * (v ** 2) / (2 * g)
    h_L_total = h_L_major + h_L_minor
    
    P_hydraulic = calculate_hydraulic_power(Q, h_a, rho, g)
    
    # Check efficiency if available
    efficiency = 1.0
    if system.pump_efficiency_curve:
        efficiency = interpolate_efficiency(Q, system.pump_efficiency_curve)
    P_shaft = calculate_shaft_power(P_hydraulic, efficiency)
    
    # Check NPSH if available
    cavitation_result = None
    if system.pump_NPSHR_curve:
        NPSH_R = interpolate_NPSHR(Q, system.pump_NPSHR_curve)
        NPSH_A = calculate_NPSH_A(P1, system.Pvap, rho, system.h_L_suction, system.z_suction, g)
        cavitation_result = check_cavitation(NPSH_A, NPSH_R)
    
    warnings = []
    if cavitation_result and cavitation_result['warnings']:
        warnings.extend(cavitation_result['warnings'])
    if efficiency < 0.5:
        warnings.append(f"Low pump efficiency ({efficiency:.1%}) at operating point")
    
    result = {
        'Q': float(Q),
        'h_a': float(h_a),
        'v': float(v),
        'Re': float(Re),
        'regime': regime,
        'f': float(f),
        'f_method': f_method,
        'h_L_major': float(h_L_major),
        'h_L_minor': float(h_L_minor),
        'h_L_total': float(h_L_total),
        'P_hydraulic': float(P_hydraulic),
        'efficiency': float(efficiency),
        'P_shaft': float(P_shaft)
    }
    
    if cavitation_result:
        result['NPSH_A'] = cavitation_result['NPSH_A']
        result['NPSH_R'] = cavitation_result['NPSH_R']
        result['cavitates'] = cavitation_result['cavitates']
    
    return SolverResult(status=SolverStatus.SUCCESS, result=result, warnings=warnings)


def solve_inverse_diameter(
    system: PipeSystem,
    Q: float,
    h_a: float,
    D_guess: float = 0.1
) -> SolverResult:
    """
    MODE G (partial): Given Q and h_a, find required pipe diameter D.
    """
    validation = system.validate(['rho', 'mu', 'L', 'P1', 'P2', 'z1', 'z2'])
    if not validation.is_success():
        return validation
    
    rho = system.rho
    mu = system.mu
    L = system.L
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    g = G
    
    def residual(D):
        if D <= 0:
            return 1e10
        
        A = np.pi * (D / 2) ** 2
        v = Q / A
        Re = calculate_Re(rho, v, D, mu)
        epsilon_D = epsilon / D if D > 0 else 0
        f, _ = calculate_friction_factor(Re, epsilon_D)
        alpha = get_alpha(Re)
        
        h_L_major = 2 * f * (L / D) * (v ** 2) / g
        h_L_minor = K_total * (v ** 2) / (2 * g)
        h_L_total = h_L_major + h_L_minor
        
        meb = mechanical_energy_balance(
            P1=P1, P2=P2, v1=system.v1, v2=v, z1=z1, z2=z2,
            h_L=h_L_total, h_a=h_a, rho=rho, g=g,
            alpha1=ALPHA_TURB, alpha2=alpha,
            solve_for=None
        )
        return meb.result['residual']
    
    try:
        D_low, D_high = 0.001, 10.0
        if residual(D_low) * residual(D_high) < 0:
            D_solved = brentq(residual, D_low, D_high)
        else:
            D_solved = fsolve(residual, D_guess)[0]
    except Exception as e:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='iteration_failed',
            details=str(e)
        )
    
    if D_solved <= 0:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='negative_diameter',
            details='Solved diameter is negative or zero'
        )
    
    # Final calculations
    D = D_solved
    A = np.pi * (D / 2) ** 2
    v = Q / A
    Re = calculate_Re(rho, v, D, mu)
    epsilon_D = epsilon / D
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    regime = get_flow_regime(Re)
    
    h_L_major = 2 * f * (L / D) * (v ** 2) / g
    h_L_minor = K_total * (v ** 2) / (2 * g)
    h_L_total = h_L_major + h_L_minor
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={
            'D': float(D),
            'Q': float(Q),
            'v': float(v),
            'Re': float(Re),
            'regime': regime,
            'f': float(f),
            'f_method': f_method,
            'h_L_total': float(h_L_total),
            'h_a': float(h_a)
        }
    )


def solve_inverse_length(
    system: PipeSystem,
    Q: float,
    h_a: float
) -> SolverResult:
    """
    MODE G (partial): Given Q and h_a, find maximum pipe length L.
    
    This can be solved directly (no iteration needed).
    """
    validation = system.validate(['rho', 'mu', 'D', 'P1', 'P2', 'z1', 'z2'])
    if not validation.is_success():
        return validation
    
    geom_result = system.get_D_h_and_A()
    if not geom_result.is_success():
        return geom_result
    
    D_h = geom_result.result['D_h']
    A = geom_result.result['A']
    
    rho = system.rho
    mu = system.mu
    D = system.D
    epsilon = system.epsilon
    P1, P2 = system.P1, system.P2
    z1, z2 = system.z1, system.z2
    K_total = system.get_total_K()
    g = G
    
    v = Q / A
    Re = calculate_Re(rho, v, D_h, mu)
    epsilon_D = epsilon / D_h if D_h > 0 else 0
    f, f_method = calculate_friction_factor(Re, epsilon_D)
    alpha = get_alpha(Re)
    regime = get_flow_regime(Re)
    
    # Minor head loss
    h_L_minor = K_total * (v ** 2) / (2 * g)
    
    # From MEB, solve for h_L_total
    meb = mechanical_energy_balance(
        P1=P1, P2=P2, v1=system.v1, v2=v, z1=z1, z2=z2,
        h_a=h_a, rho=rho, g=g,
        alpha1=ALPHA_TURB, alpha2=alpha,
        solve_for='h_L'
    )
    
    h_L_total = meb.result['h_L']
    h_L_major = h_L_total - h_L_minor
    
    if h_L_major < 0:
        return SolverResult(
            status=SolverStatus.NO_SOLUTION,
            reason='negative_major_loss',
            details='Minor losses exceed available head loss budget',
            partial_results={
                'h_L_total_available': h_L_total,
                'h_L_minor': h_L_minor
            }
        )
    
    # h_L_major = 2f(L/D)(v²/g)  =>  L = h_L_major * D * g / (2 * f * v²)
    L = h_L_major * D_h * g / (2 * f * v ** 2)
    
    return SolverResult(
        status=SolverStatus.SUCCESS,
        result={
            'L': float(L),
            'Q': float(Q),
            'v': float(v),
            'Re': float(Re),
            'regime': regime,
            'f': float(f),
            'f_method': f_method,
            'h_L_major': float(h_L_major),
            'h_L_minor': float(h_L_minor),
            'h_L_total': float(h_L_total),
            'h_a': float(h_a)
        }
    )


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def quick_head_loss(
    L: float,
    D: float,
    Q: float,
    rho: float = 1000.0,
    mu: float = 0.001,
    epsilon: float = 0.0,
    K_total: float = 0.0
) -> Dict[str, float]:
    """
    Quick calculation of total head loss for a simple pipe.
    
    All inputs in SI units.
    """
    A = np.pi * (D / 2) ** 2
    v = Q / A
    Re = calculate_Re(rho, v, D, mu)
    epsilon_D = epsilon / D if D > 0 else 0
    f, method = calculate_friction_factor(Re, epsilon_D)
    
    h_L_major = 2 * f * (L / D) * (v ** 2) / G
    h_L_minor = K_total * (v ** 2) / (2 * G)
    h_L_total = h_L_major + h_L_minor
    
    return {
        'v': v,
        'Re': Re,
        'regime': get_flow_regime(Re),
        'f': f,
        'f_method': method,
        'h_L_major': h_L_major,
        'h_L_minor': h_L_minor,
        'h_L_total': h_L_total
    }


def quick_pump_head(
    P1: float,
    P2: float,
    z1: float,
    z2: float,
    h_L: float,
    rho: float = 1000.0,
    v1: float = 0.0,
    v2: float = 0.0
) -> float:
    """
    Quick calculation of required pump head.
    
    h_a = (P2-P1)/(ρg) + (z2-z1) + h_L + (v2²-v1²)/(2g)
    """
    g = G
    delta_P_head = (P2 - P1) / (rho * g)
    delta_z = z2 - z1
    delta_KE = (v2**2 - v1**2) / (2 * g)
    
    return delta_P_head + delta_z + h_L + delta_KE


# =============================================================================
# MAIN / TESTING
# =============================================================================

if __name__ == "__main__":
    print("Pipe Flow Solver - Test Suite")
    print("=" * 50)
    
    # Test 1: Hydraulic diameter
    print("\n1. Hydraulic Diameter Tests")
    print("-" * 30)
    
    result = calculate_hydraulic_diameter('circular', D=0.1)
    print(f"Circular D=0.1m: D_h={result.result['D_h']:.4f}m, A={result.result['A']:.6f}m²")
    
    result = calculate_hydraulic_diameter('rectangular', a=0.3, b=0.6)
    print(f"Rectangular 0.3×0.6m: D_h={result.result['D_h']:.4f}m, A={result.result['A']:.6f}m²")
    
    result = calculate_hydraulic_diameter('annular', D_outer=0.2, D_inner=0.1)
    print(f"Annular 0.2/0.1m: D_h={result.result['D_h']:.4f}m, A={result.result['A']:.6f}m²")
    
    # Test 2: Friction factor
    print("\n2. Friction Factor Tests")
    print("-" * 30)
    
    f, method = calculate_friction_factor(1000, 0)
    print(f"Re=1000 (laminar): f={f:.6f}, method={method}")
    
    f, method = calculate_friction_factor(100000, 0)
    print(f"Re=100000, smooth: f={f:.6f}, method={method}")
    
    f, method = calculate_friction_factor(100000, 0.001)
    print(f"Re=100000, ε/D=0.001: f={f:.6f}, method={method}")
    
    # Test 3: Simple gravity flow
    print("\n3. Gravity Flow Test")
    print("-" * 30)
    
    system = PipeSystem(
        rho=1000, mu=0.001,
        D=0.1, L=100, epsilon=0.00015,
        P1=101325, P2=101325,
        z1=10, z2=0,
        K_total=2.0
    )
    
    result = solve_gravity_flow(system)
    if result.is_success():
        r = result.result
        print(f"Q = {r['Q']*1000:.2f} L/s")
        print(f"v = {r['v']:.2f} m/s")
        print(f"Re = {r['Re']:.0f} ({r['regime']})")
        print(f"f = {r['f']:.6f} ({r['f_method']})")
        print(f"h_L = {r['h_L_total']:.2f} m")
    else:
        print(f"Failed: {result.reason}")
    
    # Test 4: System curve
    print("\n4. System Curve Test")
    print("-" * 30)
    
    Q_range = np.linspace(0.001, 0.05, 10)
    result = solve_system_curve(system, Q_range)
    if result.is_success():
        print("Q (L/s)    h_a (m)")
        for Q, h_a in result.result['curve'][:5]:
            print(f"{Q*1000:8.2f}   {h_a:8.2f}")
        print("...")
    
    # Test 5: Operating point with pump
    print("\n5. Operating Point Test")
    print("-" * 30)
    
    # Create a system that needs a pump (pumping uphill)
    pump_system = PipeSystem(
        rho=1000, mu=0.001,
        D=0.1, L=100, epsilon=0.00015,
        P1=101325, P2=101325,
        z1=0, z2=20,  # Pumping UP 20 meters
        K_total=2.0,
        pump_curve=[
            (0.001, 50),
            (0.01, 48),
            (0.02, 44),
            (0.03, 38),
            (0.04, 30),
            (0.05, 20),
            (0.06, 8)
        ]
    )
    
    result = solve_operating_point(pump_system)
    if result.is_success():
        r = result.result
        print(f"Operating Point:")
        print(f"  Q = {r['Q']*1000:.2f} L/s")
        print(f"  H = {r['h_a']:.2f} m")
        print(f"  P_hydraulic = {r['P_hydraulic']/1000:.2f} kW")
    else:
        print(f"Failed: {result.reason}")
        if result.partial_results:
            print(f"Partial: {result.partial_results}")
    
    # Test 5b: Check NPSH
    print("\n5b. NPSH Check")
    print("-" * 30)
    
    NPSH_A = calculate_NPSH_A(
        P_surface=101325,  # Atmospheric
        Pvap=2337,         # Water at 20°C
        rho=1000,
        h_L_suction=0.5,
        z_suction=3.0      # Pump 3m above water
    )
    print(f"NPSH_A = {NPSH_A:.2f} m")
    
    cav_check = check_cavitation(NPSH_A, NPSH_R=4.0)
    print(f"NPSH_R = 4.0 m")
    print(f"Cavitates: {cav_check['cavitates']}")
    print(f"Margin: {cav_check['margin']:.2f} m")
    
    # Test 6: Unit conversion
    print("\n6. Unit Conversion Test")
    print("-" * 30)
    
    Q_gpm = 100
    Q_m3s = Units.convert(Q_gpm, 'gpm', 'm3/s', 'flow')
    print(f"{Q_gpm} gpm = {Q_m3s:.6f} m³/s")
    
    P_psi = 50
    P_Pa = Units.convert(P_psi, 'psi', 'Pa', 'pressure')
    print(f"{P_psi} psi = {P_Pa:.0f} Pa")
    
    # Test 7: Affinity Laws
    print("\n7. Affinity Laws Test")
    print("-" * 30)
    
    result = affinity_rpm_scaling(Q1=0.05, H1=30, P1=15, n1=1750, n2=1400)
    print(f"RPM change 1750→1400:")
    print(f"  Q: 0.05 → {result['Q2']:.4f} m³/s")
    print(f"  H: 30 → {result['H2']:.2f} m")
    print(f"  P: 15 → {result['P2']:.2f} kW")
    
    # Test 8: Pump Combinations
    print("\n8. Pump Combinations Test")
    print("-" * 30)
    
    pump1 = [(0.01, 40), (0.02, 35), (0.03, 28), (0.04, 18)]
    pump2 = [(0.01, 38), (0.02, 33), (0.03, 26), (0.04, 16)]
    
    series_curve = pumps_in_series([pump1, pump2])
    print("Series (H adds at same Q):")
    for Q, H in series_curve[:3]:
        print(f"  Q={Q:.3f}: H={H:.1f} m")
    
    # Test 9: Inverse problem - find max length
    print("\n9. Inverse Problem Test (Max Length)")
    print("-" * 30)
    
    inv_system = PipeSystem(
        rho=1000, mu=0.001,
        D=0.05, epsilon=0,
        P1=101325, P2=101325,
        z1=0, z2=0,
        K_total=0
    )
    
    result = solve_inverse_length(inv_system, Q=0.005, h_a=10)
    if result.is_success():
        print(f"Given Q=5 L/s, h_a=10m, smooth pipe D=5cm:")
        print(f"  Max L = {result.result['L']:.1f} m")
        print(f"  v = {result.result['v']:.2f} m/s")
        print(f"  Re = {result.result['Re']:.0f}")
    
    # Test 10: Error handling - missing inputs
    print("\n10. Error Handling Test")
    print("-" * 30)
    
    bad_system = PipeSystem(rho=1000)  # Missing most params
    result = solve_gravity_flow(bad_system)
    print(f"Missing input detection:")
    print(f"  Status: {result.status.value}")
    if result.missing:
        missing_params = [m['param'] for m in result.missing]
        print(f"  Missing: {missing_params}")

    print("\n" + "=" * 50)
    print("All tests completed.")