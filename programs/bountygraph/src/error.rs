use anchor_lang::prelude::*;

#[error_code]
pub enum BountyGraphError {
    #[msg("Invalid graph configuration")]
    InvalidConfig,
    #[msg("Invalid reward amount")]
    InvalidReward,
    #[msg("Too many dependencies")]
    TooManyDependencies,
    #[msg("Invalid dependency list")]
    InvalidDependency,
    #[msg("Circular dependency detected")]
    CircularDependency,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Task is not open")]
    TaskNotOpen,
    #[msg("Invalid URI")]
    InvalidUri,
    #[msg("Missing dependency accounts")]
    MissingDependencyAccounts,
    #[msg("A dependency task is not completed")]
    DependencyNotCompleted,
    #[msg("Task is not completed")]
    TaskNotCompleted,
    #[msg("Signer is not the task completer")]
    NotTaskCompleter,
    #[msg("Escrow has no lamports")]
    EscrowEmpty,
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
    #[msg("Only creator or worker can raise dispute")]
    UnauthorizedDispute,
    #[msg("Only arbiter can resolve dispute")]
    UnauthorizedResolution,
    #[msg("Task status does not allow disputes")]
    InvalidTaskStatus,
    #[msg("Invalid split percentage")]
    InvalidSplit,
}
