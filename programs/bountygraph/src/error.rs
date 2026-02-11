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
}
