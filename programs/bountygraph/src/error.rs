use anchor_lang::prelude::*;

#[error_code]
pub enum BountyGraphError {
    #[msg("Invalid graph configuration (max_dependencies_per_task must be > 0)")]
    InvalidConfig,
    #[msg("Invalid reward amount (must be > 0 and within declared bounds)")]
    InvalidReward,
    #[msg("Too many dependencies (exceeds graph.max_dependencies_per_task)")]
    TooManyDependencies,
    #[msg("Invalid dependency list (must be strictly increasing, no self refs, and match provided accounts)")]
    InvalidDependency,
    #[msg("Circular dependency detected (immediate back-edge / 2-cycle)")]
    CircularDependency,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Task is not open (expected status = Open)")]
    TaskNotOpen,
    #[msg("Invalid receipt URI (non-empty and <= Receipt::MAX_URI_LEN)")]
    InvalidUri,
    #[msg("Missing dependency accounts (pass all prerequisite Task accounts in dependency order)")]
    MissingDependencyAccounts,
    #[msg("A dependency task is not completed")]
    DependencyNotCompleted,
    #[msg("Task is not completed")]
    TaskNotCompleted,
    #[msg("Signer is not the task completer")]
    NotTaskCompleter,
    #[msg("Escrow has no lamports")]
    EscrowEmpty,
    #[msg("Escrow already funded")]
    EscrowAlreadyFunded,
    #[msg("Task is in dispute")]
    TaskInDispute,
    #[msg("Signer is not authorized to dispute")]
    UnauthorizedDisputer,
    #[msg("Dispute already raised")]
    DisputeAlreadyRaised,
    #[msg("No dispute raised")]
    NoDisputeRaised,
    #[msg("Invalid dispute resolution")]
    InvalidResolution,
    #[msg("Invalid graph account")]
    InvalidGraph,
    #[msg("Invalid creator account")]
    InvalidCreator,
    #[msg("Invalid worker account")]
    InvalidWorker,
    #[msg("Only creator or participating worker can raise dispute")]
    UnauthorizedDispute,
    #[msg("Only arbiter can resolve dispute")]
    UnauthorizedResolution,
    #[msg("Task status does not allow disputes")]
    InvalidTaskStatus,
    #[msg("Invalid split percentage")]
    InvalidSplit,
}
