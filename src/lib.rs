use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::clock::Clock;

declare_id!("BGRPHFnG8z7gxJnefVh3Y7LV9TjTuN2hfQdqzN9vNS5A");

#[program]
pub mod bountygraph {
    use super::*;

    /// Create a new bounty with multiple milestones
    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        bounty_id: String,
        title: String,
        description: String,
        total_amount: u64,
        milestone_count: u8,
    ) -> Result<()> {
        require!(milestone_count > 0 && milestone_count <= 10, BountyError::InvalidMilestoneCount);
        require!(total_amount > 0, BountyError::InvalidAmount);
        require!(
            !bounty_id.is_empty() && bounty_id.len() <= Bounty::MAX_ID_LEN,
            BountyError::InvalidStringLength
        );
        require!(
            !title.is_empty() && title.len() <= Bounty::MAX_TITLE_LEN,
            BountyError::InvalidStringLength
        );
        require!(
            !description.is_empty() && description.len() <= Bounty::MAX_DESCRIPTION_LEN,
            BountyError::InvalidStringLength
        );

        let bounty = &mut ctx.accounts.bounty;
        bounty.id = bounty_id;
        bounty.title = title;
        bounty.description = description;
        bounty.creator = ctx.accounts.creator.key();
        bounty.escrow_vault = ctx.accounts.escrow_vault.key();
        bounty.total_amount = total_amount;
        bounty.released_amount = 0;
        bounty.milestone_count = milestone_count;
        bounty.completed_milestones = 0;
        bounty.status = BountyStatus::Open;
        bounty.created_at = Clock::get()?.unix_timestamp;
        bounty.bump = ctx.bumps.bounty;

        // Transfer funds to escrow
        let transfer_instruction = Transfer {
            from: ctx.accounts.creator_token.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
            ),
            total_amount,
        )?;

        emit!(BountyCreated {
            bounty_id: bounty.id.clone(),
            creator: bounty.creator,
            total_amount,
            milestone_count,
        });

        Ok(())
    }

    /// Submit a proof-of-work receipt for a milestone
    pub fn submit_receipt(
        ctx: Context<SubmitReceipt>,
        receipt_id: String,
        milestone_index: u8,
        artifact_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        let bounty = &ctx.accounts.bounty;
        require!(bounty.status == BountyStatus::Open, BountyError::BountyNotActive);
        require!(milestone_index < bounty.milestone_count, BountyError::InvalidMilestoneIndex);
        require!(
            !receipt_id.is_empty() && receipt_id.len() <= Receipt::MAX_ID_LEN,
            BountyError::InvalidStringLength
        );
        require!(
            !metadata_uri.is_empty() && metadata_uri.len() <= Receipt::MAX_METADATA_URI_LEN,
            BountyError::InvalidStringLength
        );

        let receipt = &mut ctx.accounts.receipt;
        receipt.id = receipt_id;
        receipt.bounty_key = bounty.key();
        receipt.worker = ctx.accounts.worker.key();
        receipt.milestone_index = milestone_index;
        receipt.artifact_hash = artifact_hash;
        receipt.metadata_uri = metadata_uri;
        receipt.status = ReceiptStatus::Pending;
        receipt.submitted_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;

        emit!(ReceiptSubmitted {
            receipt_id: receipt.id.clone(),
            bounty_id: bounty.id.clone(),
            worker: receipt.worker,
            milestone_index,
        });

        Ok(())
    }

    /// Verify a receipt and release milestone payout
    pub fn verify_receipt(
        ctx: Context<VerifyReceipt>,
        approved: bool,
        verifier_note: String,
    ) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;
        let bounty = &mut ctx.accounts.bounty;

        require!(receipt.status == ReceiptStatus::Pending, BountyError::ReceiptAlreadyVerified);
        require!(bounty.status == BountyStatus::Open, BountyError::BountyNotActive);

        if approved {
            receipt.status = ReceiptStatus::Approved;
            bounty.completed_milestones += 1;

            // Calculate milestone payout
            let payout_amount = bounty.total_amount / bounty.milestone_count as u64;

            // Transfer from escrow to worker
            let seeds = &[
                b"bounty",
                bounty.id.as_bytes(),
                &[bounty.bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let transfer_instruction = Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.worker_token.to_account_info(),
                authority: ctx.accounts.bounty.to_account_info(),
            };

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    signer_seeds,
                ),
                payout_amount,
            )?;

            bounty.released_amount += payout_amount;

            // Close bounty if all milestones completed
            if bounty.completed_milestones == bounty.milestone_count {
                bounty.status = BountyStatus::Completed;
            }

            emit!(ReceiptApproved {
                receipt_id: receipt.id.clone(),
                bounty_id: bounty.id.clone(),
                worker: receipt.worker,
                payout_amount,
            });
        } else {
            receipt.status = ReceiptStatus::Rejected;
            emit!(ReceiptRejected {
                receipt_id: receipt.id.clone(),
                bounty_id: bounty.id.clone(),
                reason: verifier_note.clone(),
            });
        }

        Ok(())
    }

    /// Create a dependency edge between receipts
    pub fn create_dependency(
        ctx: Context<CreateDependency>,
        edge_id: String,
        source_receipt_key: Pubkey,
        target_receipt_key: Pubkey,
    ) -> Result<()> {
        require!(
            !edge_id.is_empty() && edge_id.len() <= DependencyEdge::MAX_ID_LEN,
            BountyError::InvalidStringLength
        );

        let edge = &mut ctx.accounts.edge;
        edge.id = edge_id;
        edge.source_receipt = source_receipt_key;
        edge.target_receipt = target_receipt_key;
        edge.created_at = Clock::get()?.unix_timestamp;
        edge.bump = ctx.bumps.edge;

        emit!(DependencyCreated {
            source: source_receipt_key,
            target: target_receipt_key,
        });

        Ok(())
    }
}

// ============ Account Structures ============

#[account]
pub struct Bounty {
    pub id: String,
    pub title: String,
    pub description: String,
    pub creator: Pubkey,
    pub escrow_vault: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub milestone_count: u8,
    pub completed_milestones: u8,
    pub status: BountyStatus,
    pub created_at: i64,
    pub bump: u8,
}

impl Bounty {
    pub const MAX_ID_LEN: usize = 32;
    pub const MAX_TITLE_LEN: usize = 96;
    pub const MAX_DESCRIPTION_LEN: usize = 512;

    pub const INIT_SPACE: usize =
        (4 + Self::MAX_ID_LEN)
        + (4 + Self::MAX_TITLE_LEN)
        + (4 + Self::MAX_DESCRIPTION_LEN)
        + 32
        + 32
        + 8
        + 8
        + 1
        + 1
        + 1
        + 8
        + 1;
}

#[account]
pub struct Receipt {
    pub id: String,
    pub bounty_key: Pubkey,
    pub worker: Pubkey,
    pub milestone_index: u8,
    pub artifact_hash: [u8; 32],
    pub metadata_uri: String,
    pub status: ReceiptStatus,
    pub submitted_at: i64,
    pub bump: u8,
}

impl Receipt {
    pub const MAX_ID_LEN: usize = 32;
    pub const MAX_METADATA_URI_LEN: usize = 200;

    pub const INIT_SPACE: usize =
        (4 + Self::MAX_ID_LEN)
        + 32
        + 32
        + 1
        + 32
        + (4 + Self::MAX_METADATA_URI_LEN)
        + 1
        + 8
        + 1;
}

#[account]
pub struct DependencyEdge {
    pub id: String,
    pub source_receipt: Pubkey,
    pub target_receipt: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

impl DependencyEdge {
    pub const MAX_ID_LEN: usize = 32;

    pub const INIT_SPACE: usize = (4 + Self::MAX_ID_LEN) + 32 + 32 + 8 + 1;
}

#[account]
pub struct WorkerProfile {
    pub worker: Pubkey,               // 32 bytes
    pub completed_receipts: u32,      // 4 bytes
    pub rejected_receipts: u32,       // 4 bytes
    pub total_earnings: u64,          // 8 bytes
    pub reputation_score: u32,        // 4 bytes (0-10000)
    pub created_at: i64,              // 8 bytes
    pub bump: u8,                     // 1 byte
}

// ============ Contexts ============

#[derive(Accounts)]
#[instruction(bounty_id: String)]
pub struct CreateBounty<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Bounty::INIT_SPACE,
        seeds = [b"bounty", bounty_id.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = bounty
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = creator)]
    pub creator_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, anchor_spl::token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(receipt_id: String)]
pub struct SubmitReceipt<'info> {
    #[account(mut)]
    pub worker: Signer<'info>,

    #[account(mut)]
    pub bounty: Account<'info, Bounty>,

    #[account(
        init,
        payer = worker,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", receipt_id.as_bytes()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct VerifyReceipt<'info> {
    #[account(mut)]
    pub verifier: Signer<'info>,

    #[account(mut)]
    pub bounty: Account<'info, Bounty>,

    #[account(mut)]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub worker_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(edge_id: String)]
pub struct CreateDependency<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + DependencyEdge::INIT_SPACE,
        seeds = [b"edge", edge_id.as_bytes()],
        bump
    )]
    pub edge: Account<'info, DependencyEdge>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ============ Enums ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum BountyStatus {
    Open = 0,
    Completed = 1,
    Cancelled = 2,
}

impl Default for BountyStatus {
    fn default() -> Self {
        BountyStatus::Open
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ReceiptStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
}

impl Default for ReceiptStatus {
    fn default() -> Self {
        ReceiptStatus::Pending
    }
}

// ============ Events ============

#[event]
pub struct BountyCreated {
    pub bounty_id: String,
    pub creator: Pubkey,
    pub total_amount: u64,
    pub milestone_count: u8,
}

#[event]
pub struct ReceiptSubmitted {
    pub receipt_id: String,
    pub bounty_id: String,
    pub worker: Pubkey,
    pub milestone_index: u8,
}

#[event]
pub struct ReceiptApproved {
    pub receipt_id: String,
    pub bounty_id: String,
    pub worker: Pubkey,
    pub payout_amount: u64,
}

#[event]
pub struct ReceiptRejected {
    pub receipt_id: String,
    pub bounty_id: String,
    pub reason: String,
}

#[event]
pub struct DependencyCreated {
    pub source: Pubkey,
    pub target: Pubkey,
}

// ============ Errors ============

#[error_code]
pub enum BountyError {
    #[msg("Invalid milestone count")]
    InvalidMilestoneCount,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Bounty not active")]
    BountyNotActive,
    #[msg("Invalid milestone index")]
    InvalidMilestoneIndex,
    #[msg("Receipt already verified")]
    ReceiptAlreadyVerified,
    #[msg("Invalid string length")]
    InvalidStringLength,
}
