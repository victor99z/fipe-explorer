from typing import Optional

def format_currency(val: Optional[float]) -> str:
    """Formats float number as Brazilian Real (R$ 123.456,78)."""
    if val is None:
        return "R$ 0,00"
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def calculate_percentage_variation(initial: float, current: float) -> float:
    """Calculates relative variation between initial and current value."""
    if initial > 0:
        return round(((current - initial) / initial) * 100.0, 2)
    return 0.0

def calculate_cagr(initial: float, current: float, num_periods: int) -> float:
    """Calculates Compound Annual Growth Rate (CAGR)."""
    if num_periods > 1 and initial > 0 and current > 0:
        return round((((current / initial) ** (1 / (num_periods - 1))) - 1) * 100.0, 2)
    return 0.0

def determine_trend(var_pct: float) -> str:
    """Determines market behavior based on variation threshold."""
    if var_pct > 1.5:
        return "valorizou"
    elif var_pct < -1.5:
        return "desvalorizou"
    return "estavel"
