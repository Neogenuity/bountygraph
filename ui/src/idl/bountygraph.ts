export const BOUNTYGRAPH_IDL = {
  version: "0.1.0",
  name: "bountygraph",
  instructions: [
    {
      name: "initializeGraph",
      accounts: [
        { name: "graph", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "InitializeGraphParams",
          },
        },
      ],
    },
    {
      name: "createTask",
      accounts: [
        { name: "graph", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
        { name: "creator", isMut: true, isSigner: true },
        { name: "task", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "CreateTaskParams",
          },
        },
      ],
    },
    {
      name: "fundTask",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "funder", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "lamports", type: "u64" }],
    },
    {
      name: "submitReceipt",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "receipt", isMut: true, isSigner: false },
        { name: "agent", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "SubmitReceiptParams",
          },
        },
      ],
    },
    {
      name: "claimReward",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "agent", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "disputeTask",
      accounts: [
        { name: "task", isMut: true, isSigner: false },
        { name: "dispute", isMut: true, isSigner: false },
        { name: "initiator", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "DisputeTaskParams",
          },
        },
      ],
    },
    {
      name: "resolveDispute",
      accounts: [
        { name: "graph", isMut: false, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
        { name: "task", isMut: true, isSigner: false },
        { name: "dispute", isMut: true, isSigner: false },
        { name: "escrow", isMut: true, isSigner: false },
        { name: "creator", isMut: true, isSigner: false },
        { name: "worker", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        {
          name: "params",
          type: {
            defined: "ResolveDisputeParams",
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: "Graph",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "maxDependenciesPerTask", type: "u16" },
          { name: "taskCount", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Task",
      type: {
        kind: "struct",
        fields: [
          { name: "graph", type: "publicKey" },
          { name: "taskId", type: "u64" },
          { name: "creator", type: "publicKey" },
          { name: "rewardLamports", type: "u64" },
          { name: "status", type: { defined: "TaskStatus" } },
          { name: "disputeStatus", type: { defined: "DisputeStatus" } },
          { name: "dependencies", type: { vec: "u64" } },
          { name: "createdAtSlot", type: "u64" },
          { name: "completedBy", type: { option: "publicKey" } },
          { name: "disputedBy", type: { option: "publicKey" } },
          { name: "disputeRaisedAtSlot", type: "u64" },
          { name: "resolvedBy", type: { option: "publicKey" } },
          { name: "disputeResolvedAtSlot", type: "u64" },
          { name: "workerAwardLamports", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Escrow",
      type: {
        kind: "struct",
        fields: [
          { name: "task", type: "publicKey" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Receipt",
      type: {
        kind: "struct",
        fields: [
          { name: "task", type: "publicKey" },
          { name: "agent", type: "publicKey" },
          { name: "workHash", type: { array: ["u8", 32] } },
          { name: "uri", type: "string" },
          { name: "submittedAtSlot", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Dispute",
      type: {
        kind: "struct",
        fields: [
          { name: "task", type: "publicKey" },
          { name: "creator", type: "publicKey" },
          { name: "worker", type: "publicKey" },
          { name: "raisedBy", type: "publicKey" },
          { name: "reason", type: "string" },
          { name: "status", type: { defined: "DisputeStatus" } },
          { name: "raisedAtSlot", type: "u64" },
          { name: "resolvedAtSlot", type: { option: "u64" } },
          { name: "arbiter", type: { option: "publicKey" } },
          { name: "creatorPct", type: { option: "u8" } },
          { name: "workerPct", type: { option: "u8" } },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "InitializeGraphParams",
      type: {
        kind: "struct",
        fields: [{ name: "maxDependenciesPerTask", type: "u16" }],
      },
    },
    {
      name: "CreateTaskParams",
      type: {
        kind: "struct",
        fields: [
          { name: "taskId", type: "u64" },
          { name: "rewardLamports", type: "u64" },
          { name: "dependencies", type: { vec: "u64" } },
        ],
      },
    },
    {
      name: "SubmitReceiptParams",
      type: {
        kind: "struct",
        fields: [
          { name: "workHash", type: { array: ["u8", 32] } },
          { name: "uri", type: "string" },
        ],
      },
    },
    {
      name: "DisputeTaskParams",
      type: {
        kind: "struct",
        fields: [{ name: "reason", type: "string" }],
      },
    },
    {
      name: "ResolveDisputeParams",
      type: {
        kind: "struct",
        fields: [
          { name: "creatorPct", type: "u8" },
          { name: "workerPct", type: "u8" },
        ],
      },
    },
    {
      name: "TaskStatus",
      type: {
        kind: "enum",
        variants: [{ name: "Open" }, { name: "Completed" }],
      },
    },
    {
      name: "DisputeStatus",
      type: {
        kind: "enum",
        variants: [{ name: "None" }, { name: "Raised" }, { name: "Resolved" }],
      },
    },
  ],
  metadata: {
    address: "Ghm5zPnHy5yJwQ6P22NYgNVrqPokDqAV3otdut3DSbSS",
  },
};
