# BountyGraph API - New Features

## Recent Additions (Feb 11, 2026)

### 1. DAG Cycle Detection & Validation

Added robust utilities for managing task dependency graphs and preventing cycles:

#### `wouldCreateCycle(taskId, newDependencyId, existingDependencies)`
- **Purpose**: Detect if adding a dependency would create a cycle in the task graph
- **Algorithm**: Depth-first search (DFS) with recursion stack tracking
- **Use Cases**: 
  - Validate task dependencies before creation
  - Prevent circular dependencies that would deadlock the system
  - Ensure DAG integrity for topological execution

```typescript
const deps = new Map([
  ['task-B', ['task-A']],
  ['task-C', ['task-B']],
]);
const hasCycle = wouldCreateCycle('task-A', 'task-C', deps);
// Returns: true (would create A -> C -> B -> A cycle)
```

#### `validateDependencyList(dependencies)`
- **Purpose**: Ensure dependency lists are valid, sorted, and duplicate-free
- **Validation**:
  - All entries are strings
  - No duplicate dependencies
  - Dependencies are sorted in ascending order (required for efficient lookups)

```typescript
validateDependencyList(['task-1', 'task-2', 'task-3']); // null (valid)
validateDependencyList(['task-2', 'task-1']); // Error: must be sorted
```

#### `topologicalSort(taskIds, dependencies)`
- **Purpose**: Sort tasks in dependency-safe execution order
- **Algorithm**: Kahn's algorithm (in-degree based)
- **Returns**: Sorted task IDs, or `null` if cycle detected
- **Use Cases**:
  - Determine optimal task execution sequence
  - Validate DAG structure (cycle detection)
  - Schedule parallel execution of independent tasks

```typescript
const sorted = topologicalSort(
  ['A', 'B', 'C', 'D'],
  new Map([
    ['A', ['B', 'C']],
    ['B', ['D']],
    ['C', ['D']],
  ])
);
// Returns: ['D', 'B', 'C', 'A'] or ['D', 'C', 'B', 'A']
```

---

### 2. Reputation System

Comprehensive reputation calculation aligned with BountyGraph's on-chain incentives:

#### `calculateReputationDelta(data)`
- **Purpose**: Calculate reputation points earned for completing a bounty
- **Inputs**:
  - `bountyValue` (lamports): Bounty payment amount
  - `completedOnTime` (boolean): Whether completed before deadline
  - `verificationTier` ('schema' | 'oracle' | 'optimistic'): Verification method
  - `complexityScore` (1-5): Task complexity rating

- **Scoring Breakdown**:
  - **Base**: 10 points
  - **Complexity**: +1 to +5 points (capped)
  - **On-time bonus**: +3 points
  - **Verification tier**:
    - Schema: +2 points
    - Oracle: +5 points
    - Optimistic: +3 points
  - **Value scaling**:
    - ≥1 SOL: +5 points
    - ≥0.1 SOL: +3 points
    - ≥0.01 SOL: +1 point

```typescript
const delta = calculateReputationDelta({
  bountyValue: 1_000_000_000, // 1 SOL
  completedOnTime: true,
  verificationTier: 'oracle',
  complexityScore: 4,
});
// Returns: 10 (base) + 4 (complexity) + 3 (on-time) + 5 (oracle) + 5 (value) = 27 points
```

#### `getReputationLevel(points)`
- **Purpose**: Map total reputation points to level/tier
- **Returns**: `{ level, name, nextLevelPoints }`
- **Levels**:
  1. **Novice** (0-49 pts)
  2. **Apprentice** (50-149 pts)
  3. **Journeyman** (150-399 pts)
  4. **Expert** (400-999 pts)
  5. **Master** (1000-2499 pts)
  6. **Grandmaster** (2500+ pts)

```typescript
const level = getReputationLevel(1200);
// Returns: { level: 5, name: 'Master', nextLevelPoints: 2500 }
```

---

### 3. Bounty Status Formatting

#### `formatBountyStatus(status)`
- **Purpose**: Convert internal status codes to human-readable labels
- **Mappings**:
  - `open` → "Open for Workers"
  - `in_progress` → "In Progress"
  - `completed` → "Completed"
  - `disputed` → "Under Dispute"
  - `resolved` → "Dispute Resolved"
  - `cancelled` → "Cancelled"

```typescript
formatBountyStatus('open'); // "Open for Workers"
formatBountyStatus('DISPUTED'); // "Under Dispute" (case-insensitive)
```

---

## Integration Examples

### Task Dependency Validation Flow

```typescript
// Before creating a task with dependencies
const existingDeps = new Map([
  ['task-2', ['task-1']],
  ['task-3', ['task-2']],
]);

// Validate dependency list format
const validationError = validateDependencyList(['task-1', 'task-2']);
if (validationError) {
  return sendValidationError(res, validationError);
}

// Check for cycles
for (const dep of ['task-1', 'task-2']) {
  if (wouldCreateCycle('task-3', dep, existingDeps)) {
    return sendValidationError(res, `Dependency ${dep} would create a cycle`);
  }
}

// Create task (safe - no cycles)
await createTask({ id: 'task-3', dependencies: ['task-1', 'task-2'] });
```

### Reputation Update on Bounty Completion

```typescript
// When a receipt is verified
const bountyData = {
  bountyValue: 500_000_000, // 0.5 SOL
  completedOnTime: worker.submittedAt < bounty.deadline,
  verificationTier: 'oracle',
  complexityScore: getBountyComplexity(bounty),
};

const reputationDelta = calculateReputationDelta(bountyData);

// Update worker profile
await updateWorkerReputation(worker.id, reputationDelta);

// Check for level-up
const newLevel = getReputationLevel(worker.totalReputation + reputationDelta);
if (newLevel.level > worker.currentLevel) {
  await mintReputationBadge(worker.id, newLevel.name);
}
```

### Execution Scheduling with Topological Sort

```typescript
// Get all pending tasks
const pendingTasks = await getPendingTasks();

// Build dependency map
const depMap = new Map(
  pendingTasks.map(task => [task.id, task.dependencies])
);

// Sort for safe execution
const executionOrder = topologicalSort(
  pendingTasks.map(t => t.id),
  depMap
);

if (!executionOrder) {
  throw new Error('Cycle detected in task dependencies');
}

// Execute in order
for (const taskId of executionOrder) {
  await executeTask(taskId);
}
```

---

## Testing

Comprehensive test suite added in `api/tests/utils.test.ts`:

- **DAG Cycle Detection**: 6 test cases covering self-reference, simple/complex cycles, valid DAGs
- **Dependency List Validation**: 6 test cases for format, sorting, duplicates
- **Topological Sort**: 5 test cases for linear chains, diamond graphs, cycles, edge cases
- **Reputation Calculation**: 6 test cases for bonuses, tiers, value scaling, complexity capping
- **Reputation Levels**: 6 test cases for all level thresholds and transitions
- **Status Formatting**: 3 test cases for common statuses and edge cases

**Total New Tests**: 32 test cases

### Run Tests

```bash
cd api
npm install
npm test
```

---

## Performance Notes

- **Cycle Detection**: O(V + E) time complexity using DFS
- **Topological Sort**: O(V + E) time complexity using Kahn's algorithm
- **Dependency Validation**: O(n) where n = number of dependencies
- **Reputation Calculation**: O(1) - constant time computation

All functions are optimized for production use with large dependency graphs (1000+ tasks).

---

## Future Enhancements

1. **Weighted Reputation**: Different bounty types earn different multipliers
2. **Decay System**: Reputation decay for inactivity
3. **Parallel Execution**: Identify independent task groups for concurrent execution
4. **Graph Visualization**: Export dependency graph in DOT format for visualization
5. **Reputation Leaderboard**: Global ranking system with time-based decay

---

## API Integration

These utilities are automatically available in all API routes via the `utils` module:

```typescript
import {
  wouldCreateCycle,
  calculateReputationDelta,
  getReputationLevel,
  formatBountyStatus,
} from './utils';
```

No additional configuration required.
