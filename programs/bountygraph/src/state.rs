use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Graph {
    pub authority: Pubkey,
    pub max_dependencies_per_task: u16,
    pub task_count: u64,
    pub bump: u8,
}

impl Graph {
    pub const SEED_PREFIX: &'static [u8] = b"graph";
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    Completed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeStatus {
    None,
    Raised,
    Resolved,
}

#[account]
pub struct Task {
    pub graph: Pubkey,
    pub task_id: u64,
    pub creator: Pubkey,
    pub reward_lamports: u64,
    pub status: TaskStatus,
    pub dispute_status: DisputeStatus,
    pub dependencies: Vec<u64>,
    pub created_at_slot: u64,
    pub completed_by: Option<Pubkey>,
    pub disputed_by: Option<Pubkey>,
    pub dispute_raised_at_slot: u64,
    pub resolved_by: Option<Pubkey>,
    pub dispute_resolved_at_slot: u64,
    pub worker_award_lamports: u64,
    pub bump: u8,
}

impl Task {
    pub const SEED_PREFIX: &'static [u8] = b"task";

    pub fn space_for(dependencies: &Vec<u64>) -> usize {
        let fixed = 32 + 8 + 32 + 8 + 1 + 1 + 8 + (1 + 32) + (1 + 32) + 8 + (1 + 32) + 8 + 8 + 1;
        let vec = 4 + dependencies.len() * 8;
        fixed + vec
    }
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub task: Pubkey,
    pub bump: u8,
}

impl Escrow {
    pub const SEED_PREFIX: &'static [u8] = b"escrow";
}

#[account]
pub struct Receipt {
    pub task: Pubkey,
    pub agent: Pubkey,
    pub work_hash: [u8; 32],
    pub uri: String,
    pub submitted_at_slot: u64,
    pub bump: u8,
}

impl Receipt {
    pub const SEED_PREFIX: &'static [u8] = b"receipt";
    pub const MAX_URI_LEN: usize = 200;

    pub const INIT_SPACE: usize = 32 + 32 + 32 + 4 + Self::MAX_URI_LEN + 8 + 1;
}

#[account]
pub struct Dispute {
    pub task: Pubkey,
    pub creator: Pubkey,
    pub worker: Pubkey,
    pub raised_by: Pubkey,
    pub reason: String,
    pub status: DisputeStatus,
    pub raised_at_slot: u64,
    pub resolved_at_slot: Option<u64>,
    pub arbiter: Option<Pubkey>,
    pub creator_pct: Option<u8>,
    pub worker_pct: Option<u8>,
    pub bump: u8,
}

impl Dispute {
    pub const SEED_PREFIX: &'static [u8] = b"dispute";
    pub const MAX_REASON_LEN: usize = 500;

    pub fn space_for(reason: &str) -> usize {
        // discriminator + task + creator + worker + raised_by + reason + status + raised_at_slot
        // + resolved_at_slot + arbiter + creator_pct + worker_pct + bump
        let fixed = 32 + 32 + 32 + 32 + 1 + 8 + (1 + 32) + (1 + 8) + (1 + 1) + (1 + 1) + 1;
        let reason_size = 4 + reason.len();
        fixed + reason_size
    }
}
