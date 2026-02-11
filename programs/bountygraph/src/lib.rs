use anchor_lang::prelude::*;

pub mod error;
pub mod state;

use crate::error::BountyGraphError;
use crate::state::*;

declare_id!("9xQeWvG816bUx9EPfVb1zZQzQpimeJVFRCGDpa2BkLom");

#[program]
pub mod bountygraph {
    use super::*;

    pub fn initialize_graph(ctx: Context<InitializeGraph>, params: InitializeGraphParams) -> Result<()> {
        require!(params.max_dependencies_per_task > 0, BountyGraphError::InvalidConfig);

        let graph = &mut ctx.accounts.graph;
        graph.authority = ctx.accounts.authority.key();
        graph.bump = ctx.bumps.graph;
        graph.max_dependencies_per_task = params.max_dependencies_per_task;
        graph.task_count = 0;

        Ok(())
    }

    pub fn create_task(ctx: Context<CreateTask>, params: CreateTaskParams) -> Result<()> {
        let graph = &mut ctx.accounts.graph;

        require!(params.reward_lamports > 0, BountyGraphError::InvalidReward);
        require!(
            (params.dependencies.len() as u16) <= graph.max_dependencies_per_task,
            BountyGraphError::TooManyDependencies
        );

        let mut prev: Option<u64> = None;
        for dep in params.dependencies.iter() {
            require!(*dep != params.task_id, BountyGraphError::InvalidDependency);
            if let Some(p) = prev {
                require!(*dep > p, BountyGraphError::InvalidDependency);
            }
            prev = Some(*dep);
        }

        let task = &mut ctx.accounts.task;
        task.graph = graph.key();
        task.task_id = params.task_id;
        task.creator = ctx.accounts.creator.key();
        task.reward_lamports = params.reward_lamports;
        task.status = TaskStatus::Open;
        task.dependencies = params.dependencies;
        task.created_at_slot = Clock::get()?.slot;
        task.completed_by = None;
        task.bump = ctx.bumps.task;

        graph.task_count = graph
            .task_count
            .checked_add(1)
            .ok_or(BountyGraphError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn fund_task(ctx: Context<FundTask>, lamports: u64) -> Result<()> {
        require!(lamports > 0, BountyGraphError::InvalidReward);
        require!(ctx.accounts.task.status == TaskStatus::Open, BountyGraphError::TaskNotOpen);

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.funder.key(),
            &ctx.accounts.escrow.key(),
            lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.funder.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let escrow = &mut ctx.accounts.escrow;
        escrow.task = ctx.accounts.task.key();
        escrow.bump = ctx.bumps.escrow;

        Ok(())
    }

    pub fn submit_receipt(ctx: Context<SubmitReceipt>, params: SubmitReceiptParams) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, BountyGraphError::TaskNotOpen);
        require!(!params.uri.is_empty(), BountyGraphError::InvalidUri);
        require!(params.uri.len() <= Receipt::MAX_URI_LEN, BountyGraphError::InvalidUri);

        require!(
            ctx.remaining_accounts.len() == task.dependencies.len(),
            BountyGraphError::MissingDependencyAccounts
        );

        for (i, dep_task_info) in ctx.remaining_accounts.iter().enumerate() {
            let expected_dep_id = task.dependencies[i];
            let dep_task: Account<Task> = Account::try_from(dep_task_info)?;
            require!(dep_task.graph == task.graph, BountyGraphError::InvalidDependency);
            require!(dep_task.task_id == expected_dep_id, BountyGraphError::InvalidDependency);
            require!(
                dep_task.status == TaskStatus::Completed,
                BountyGraphError::DependencyNotCompleted
            );
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.task = task.key();
        receipt.agent = ctx.accounts.agent.key();
        receipt.work_hash = params.work_hash;
        receipt.uri = params.uri;
        receipt.submitted_at_slot = Clock::get()?.slot;
        receipt.bump = ctx.bumps.receipt;

        task.status = TaskStatus::Completed;
        task.completed_by = Some(ctx.accounts.agent.key());

        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        require!(
            ctx.accounts.task.status == TaskStatus::Completed,
            BountyGraphError::TaskNotCompleted
        );
        require!(
            ctx.accounts.task.completed_by == Some(ctx.accounts.agent.key()),
            BountyGraphError::NotTaskCompleter
        );

        let escrow_lamports = ctx.accounts.escrow.to_account_info().lamports();
        require!(escrow_lamports > 0, BountyGraphError::EscrowEmpty);

        let seeds: &[&[u8]] = &[
            Escrow::SEED_PREFIX,
            ctx.accounts.task.key().as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.escrow.key(),
                &ctx.accounts.agent.key(),
                escrow_lamports,
            ),
            &[
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.agent.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        Ok(())
    }

    pub fn dispute_task(ctx: Context<DisputeTask>, params: DisputeTaskParams) -> Result<()> {
        require!(!params.reason.is_empty(), BountyGraphError::InvalidUri);
        require!(params.reason.len() <= Dispute::MAX_REASON_LEN, BountyGraphError::InvalidUri);

        let task = &ctx.accounts.task;
        let signer = &ctx.accounts.initiator;

        // Only creator or worker can initiate a dispute
        require!(
            signer.key() == task.creator || signer.key() == task.completed_by.unwrap_or_default(),
            BountyGraphError::UnauthorizedDispute
        );

        let dispute = &mut ctx.accounts.dispute;
        dispute.task = task.key();
        dispute.creator = task.creator;
        dispute.worker = task.completed_by.unwrap_or_default();
        dispute.raised_by = signer.key();
        dispute.reason = params.reason;
        dispute.status = DisputeStatus::Raised;
        dispute.raised_at_slot = Clock::get()?.slot;
        dispute.resolved_at_slot = None;
        dispute.arbiter = None;
        dispute.creator_pct = None;
        dispute.worker_pct = None;
        dispute.bump = ctx.bumps.dispute;

        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, params: ResolveDisputeParams) -> Result<()> {
        require!(
            params.creator_pct + params.worker_pct == 100,
            BountyGraphError::InvalidSplit
        );

        let dispute = &mut ctx.accounts.dispute;

        // Only arbiter (authority) can resolve disputes
        require!(
            ctx.accounts.arbiter.key() == ctx.accounts.graph.authority,
            BountyGraphError::UnauthorizedResolution
        );

        require!(
            dispute.status == DisputeStatus::Raised,
            BountyGraphError::InvalidTaskStatus
        );

        let escrow_lamports = ctx.accounts.escrow.to_account_info().lamports();
        require!(escrow_lamports > 0, BountyGraphError::EscrowEmpty);

        // Calculate split
        let creator_amount = escrow_lamports
            .checked_mul(params.creator_pct as u64)
            .ok_or(BountyGraphError::ArithmeticOverflow)?
            .checked_div(100)
            .ok_or(BountyGraphError::ArithmeticOverflow)?;

        let worker_amount = escrow_lamports
            .checked_sub(creator_amount)
            .ok_or(BountyGraphError::ArithmeticOverflow)?;

        let seeds: &[&[u8]] = &[
            Escrow::SEED_PREFIX,
            dispute.task.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        // Pay creator
        if creator_amount > 0 {
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.escrow.key(),
                    &ctx.accounts.creator.key(),
                    creator_amount,
                ),
                &[
                    ctx.accounts.escrow.to_account_info(),
                    ctx.accounts.creator.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer_seeds,
            )?;
        }

        // Pay worker
        if worker_amount > 0 {
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.escrow.key(),
                    &ctx.accounts.worker.key(),
                    worker_amount,
                ),
                &[
                    ctx.accounts.escrow.to_account_info(),
                    ctx.accounts.worker.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signer_seeds,
            )?;
        }

        dispute.status = DisputeStatus::Resolved;
        dispute.resolved_at_slot = Some(Clock::get()?.slot);
        dispute.arbiter = Some(ctx.accounts.arbiter.key());
        dispute.creator_pct = Some(params.creator_pct);
        dispute.worker_pct = Some(params.worker_pct);

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeGraphParams {
    pub max_dependencies_per_task: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DisputeTaskParams {
    pub reason: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ResolveDisputeParams {
    pub creator_pct: u8,
    pub worker_pct: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateTaskParams {
    pub task_id: u64,
    pub reward_lamports: u64,
    pub dependencies: Vec<u64>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitReceiptParams {
    pub work_hash: [u8; 32],
    pub uri: String,
}

#[derive(Accounts)]
pub struct InitializeGraph<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Graph::INIT_SPACE,
        seeds = [Graph::SEED_PREFIX, authority.key().as_ref()],
        bump
    )]
    pub graph: Account<'info, Graph>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: CreateTaskParams)]
pub struct CreateTask<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [Graph::SEED_PREFIX, authority.key().as_ref()],
        bump = graph.bump
    )]
    pub graph: Account<'info, Graph>,

    pub authority: Signer<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Task::space_for(&params.dependencies),
        seeds = [Task::SEED_PREFIX, graph.key().as_ref(), &params.task_id.to_le_bytes()],
        bump
    )]
    pub task: Account<'info, Task>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundTask<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        init_if_needed,
        payer = funder,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [Escrow::SEED_PREFIX, task.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub funder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: SubmitReceiptParams)]
pub struct SubmitReceipt<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        init,
        payer = agent,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [Receipt::SEED_PREFIX, task.key().as_ref(), agent.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [Escrow::SEED_PREFIX, task.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: DisputeTaskParams)]
pub struct DisputeTask<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        init,
        payer = initiator,
        space = 8 + Dispute::space_for(&params.reason),
        seeds = [Dispute::SEED_PREFIX, task.key().as_ref(), initiator.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub graph: Account<'info, Graph>,

    #[account(mut)]
    pub dispute: Account<'info, Dispute>,

    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [Escrow::SEED_PREFIX, task.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// CHECK: Verified in instruction
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,

    /// CHECK: Verified in instruction
    #[account(mut)]
    pub worker: UncheckedAccount<'info>,

    pub arbiter: Signer<'info>,

    pub system_program: Program<'info, System>,
}
