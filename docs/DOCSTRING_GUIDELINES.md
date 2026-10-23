# Docstring Examples

Repository policy is maintained in [AGENTS.md](../AGENTS.md). This document supplies examples, not a separate completion checklist.

## Write Useful Contracts

Write English summaries using imperative verbs such as “Calculate” or “Convert.” Explain units, parameter meaning, returned values, side effects, and errors where relevant. Keep comments proportional to complexity; avoid empty templates and restating obvious types. Add examples for non-trivial behavior and link to applicable design sections without presenting proposals as implemented guarantees.

## Python

Use Google-style docstrings with type hints:

```python
def ticks_to_seconds(ticks: float, ticks_per_second: float) -> float:
    """Convert game ticks to seconds.

    Args:
        ticks: Duration measured in game ticks.
        ticks_per_second: Positive game-clock frequency.

    Returns:
        Duration in seconds.

    Raises:
        ValueError: If the frequency is not positive.
    """
    if ticks_per_second <= 0:
        raise ValueError("ticks_per_second must be positive")
    return ticks / ticks_per_second
```

## TypeScript

Use JSDoc to explain the contract rather than repeat the signature:

```typescript
/**
 * Convert game ticks to seconds.
 * @param ticks - Duration measured in game ticks.
 * @param ticksPerSecond - Positive game-clock frequency.
 * @returns Duration in seconds.
 * @throws RangeError when the frequency is not positive.
 */
function ticksToSeconds(ticks: number, ticksPerSecond: number): number {
  if (ticksPerSecond <= 0) throw new RangeError('ticksPerSecond must be positive')
  return ticks / ticksPerSecond
}
```

These examples illustrate documentation style, not production validation or the proposed UnitSystem implementation.

## Validation

- `npm run lint` includes the JSDoc rules in `eslint.config.js`.
- If installed, `pydocstyle backend/` uses `pyproject.toml`; install with `python -m pip install pydocstyle`.
- Report actual output. Historical coverage claims in `DOCSTRING_STATUS.md` do not establish current lint success.
