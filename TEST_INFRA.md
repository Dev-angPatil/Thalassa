# E2E Test Infra: Thalassa Marine Digital Twin

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.
- Execution: Self-contained HTML/JS test runner (`tests/runner.html`) that loads the app in an iframe and inspects the DOM/events.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Premium UI & Layout | R1 | 5      | 5      | ✓      |
| 2 | High-Res Map Grid | R2 | 5      | 5      | ✓      |
| 3 | A* Eco-Routing | R3 | 5      | 5      | ✓      |
| 4 | Commercial Optimizer | R4 | 5      | 5      | ✓      |
| 5 | Satellite Sync & Presets | R5 | 5      | 5      | ✓      |

## Test Architecture
- Test runner: `tests/runner.html` - loads `../index.html` in an iframe.
- Test case format: JS functions returning pass/fail promises.
- Asserts: Custom assert functions validating DOM elements, styles, or mocked API calls.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Fishers checking max profit route avoiding active bans | F3, F4 | Medium |
| 2 | Exploring Heatwave Anomaly impact on Sardines in August | F4, F5 | High |
| 3 | Hovering over grid cells to find high Chlorophyll spots | F2, F5 | Low |
| 4 | Routing straight through ban zone vs eco-route comparison | F1, F3, F4 | Medium |
| 5 | Changing species and observing fuel/profit changes dynamically | F4 | Low |

## Coverage Thresholds
- Tier 1: ≥25 test cases (5 per feature)
- Tier 2: ≥25 test cases (boundary/corner cases)
- Tier 3: ≥5 test cases (pairwise interactions)
- Tier 4: ≥5 realistic application scenarios
- Total: 60 test cases
