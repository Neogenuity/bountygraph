use anchor_lang::prelude::*;

pub mod error;
pub mod state;

use crate::error::BountyGraphError;
use crate::state::*;

declare_id!("Ghm5zPnHy5yJwQ6P22NYgNVrqPokDqAV3otdut3DSbSS");

#[program]
pub mod bountygraph {
    use super::*;

    pub fn initialize_graph(
        ctx: Context<InitializeGraph>,
        params: InitializeGraphParams,
    ) -> Result<()> {
        require!(
            params.max_dependencies_per_task > 0,
            BountyGraphError::InvalidConfig
        );

        let graph = &mut ctx.accounts.graph;
        graph.authority = ctx.accounts.authority.key();
        graph.bump = ctx.bumps.graph;
        graph.max_dependencies_per_task = params.max_dependencies_per_task;
        graph.task_count = 0;

        Ok(())
    }

    pub fn create_task<'a>(
        ctx: Context<'_, '_, 'a, 'a, CreateTask<'a>>,
        params: CreateTaskParams,
    ) -> Result<()> {
        const MIN_REWARD_LAMPORTS: u64 = 1_000;

        let graph_key = ctx.accounts.graph.key();
        let max_deps = ctx.accounts.graph.max_dependencies_per_task;
        let deps = params.dependencies.clone();

        require!(
            params.reward_lamports >= MIN_REWARD_LAMPORTS,
            BountyGraphError::InvalidReward
        );
        require!(
            (deps.len() as u16) <= max_deps,
            BountyGraphError::TooManyDependencies
        );

        // SECURITY: Validate dependency array is sorted and contains no self-references
        // Sorting requirement ensures O(log n) binary search during dependency queries
        let mut prev: Option<u64> = None;
        for dep in deps.iter() {
            require!(*dep != params.task_id, BountyGraphError::InvalidDependency);
            if let Some(p) = prev {
                require!(*dep > p, BountyGraphError::InvalidDependency);
            }
            prev = Some(*dep);
        }

        if !deps.is_empty() {
            require!(
                ctx.remaining_accounts.len() == deps.len(),
                BountyGraphError::MissingDependencyAccounts
            );

            // SECURITY: Circular dependency prevention - verify no dependency points back to this task.
            //
            // WHY this check exists on-chain:
            // - The easiest class of cycles to accidentally introduce is a 2-cycle (A depends on B while
            //   B already depends on A). That can be prevented deterministically at instruction time.
            // - Full transitive cycle checks require walking the dependency graph, which would either
            //   require passing a large transitive-closure account set or doing unbounded account loads.
            //   We keep the on-chain rule bounded and deterministic, while the client/API performs the
            //   complete DFS-based cycle check before submitting the transaction.
            for (i, dep_task_info) in ctx.remaining_accounts.iter().enumerate() {
                let expected_dep_id = deps[i];
                let dep_task: Account<Task> = Account::try_from(dep_task_info)?;

                // Verify dependency account belongs to same graph
                require!(
                    dep_task.graph == graph_key,
                    BountyGraphError::InvalidDependency
                );
                // Verify dependency task ID matches expected (prevents account substitution)
                require!(
                    dep_task.task_id == expected_dep_id,
                    BountyGraphError::InvalidDependency
                );

                // CRITICAL: Prevent the immediate back-edge (2-cycle).
                // If any dependency already lists this task, adding (this -> dependency) would create
                // A -> B and B -> A, which we must reject at the protocol layer.
                require!(
                    !dep_task.dependencies.contains(&params.task_id),
                    BountyGraphError::CircularDependency
                );
            }
        } else {
            // No dependencies: verify no dependency accounts provided
            require!(
                ctx.remaining_accounts.is_empty(),
                BountyGraphError::MissingDependencyAccounts
            );
        }

        // Initialize task PDA with validated parameters
        let task = &mut ctx.accounts.task;
        task.graph = graph_key;
        task.task_id = params.task_id;
        task.creator = ctx.accounts.creator.key();
        task.reward_lamports = params.reward_lamports;
        task.status = TaskStatus::Open;
        task.dispute_status = DisputeStatus::None;
        task.dependencies = deps;
        task.created_at_slot = Clock::get()?.slot;
        task.completed_by = None;
        task.disputed_by = None;
        task.dispute_raised_at_slot = 0;
        task.resolved_by = None;
        task.dispute_resolved_at_slot = 0;
        task.worker_award_lamports = 0;
        task.bump = ctx.bumps.task;

        // Increment graph task counter with overflow protection
        let graph = &mut ctx.accounts.graph;
        graph.task_count = graph
            .task_count
            .checked_add(1)
            .ok_or(BountyGraphError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn fund_task(ctx: Context<FundTask>, lamports: u64) -> Result<()> {
        require!(lamports > 0, BountyGraphError::InvalidReward);
        require!(
            ctx.accounts.task.status == TaskStatus::Open,
            BountyGraphError::TaskNotOpen
        );
        // SECURITY: Ensure funder doesn't over-commit compared to declared reward
        require!(
            lamports <= ctx.accounts.task.reward_lamports,
            BountyGraphError::InvalidReward
        );

        // ESCROW SAFETY: Verify escrow account links to correct task (if already initialized)
        let existing_task = ctx.accounts.escrow.task;
        if existing_task != Pubkey::default() {
            require!(
                existing_task == ctx.accounts.task.key(),
                BountyGraphError::InvalidDependency
            );
        }

        // ESCROW SAFETY: Prevent double-funding same task
        // Empty balance ensures first funder establishes escrow custody
        let escrow_balance = ctx.accounts.escrow.to_account_info().lamports();
        require!(escrow_balance == 0, BountyGraphError::EscrowAlreadyFunded);

        let funder = ctx.accounts.funder.key();
        let escrow_key = ctx.accounts.escrow.key();

        // Transfer lamports from funder to program-owned escrow PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &funder,
            &escrow_key,
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

        // Initialize escrow PDA - marks escrow as associated with this task
        let escrow = &mut ctx.accounts.escrow;
        escrow.task = ctx.accounts.task.key();
        escrow.bump = ctx.bumps.escrow;

        Ok(())
    }

    pub fn submit_receipt<'a>(
        ctx: Context<'_, '_, 'a, 'a, SubmitReceipt<'a>>,
        params: SubmitReceiptParams,
    ) -> Result<()> {
        // Copy dependencies to local variable to avoid lifetime issues
        let task_status = ctx.accounts.task.status;
        let task_graph = ctx.accounts.task.graph;
        let dependencies = ctx.accounts.task.dependencies.clone();

        require!(
            task_status == TaskStatus::Open,
            BountyGraphError::TaskNotOpen
        );
        require!(!params.uri.is_empty(), BountyGraphError::InvalidUri);
        require!(
            params.uri.len() <= Receipt::MAX_URI_LEN,
            BountyGraphError::InvalidUri
        );

        // TOPOLOGICAL VALIDATION: Ensure all dependency accounts provided.
        //
        // NOTE ON ORDERING:
        // - `task.dependencies` is stored on-chain as a strictly increasing list (validated at create_task).
        // - Clients must pass the corresponding Task accounts in the exact same order.
        // - This keeps the check O(n) and avoids extra sorting / indexing syscalls on-chain.
        require!(
            ctx.remaining_accounts.len() == dependencies.len(),
            BountyGraphError::MissingDependencyAccounts
        );

        // TOPOLOGICAL CONSTRAINT: Verify ALL dependencies are marked Completed before allowing this task to complete.
        // This enforces the DAG execution rule: a task cannot be completed until all prerequisites are satisfied.
        for (i, dep_task_info) in ctx.remaining_accounts.iter().enumerate() {
            let expected_dep_id = dependencies[i];
            let dep_task: Account<Task> = Account::try_from(dep_task_info)?;
            // Verify dependency belongs to same graph
            require!(
                dep_task.graph == task_graph,
                BountyGraphError::InvalidDependency
            );
            // Verify task ID matches (prevents account substitution attacks)
            require!(
                dep_task.task_id == expected_dep_id,
                BountyGraphError::InvalidDependency
            );
            // CRITICAL: Only allow completion if ALL dependencies are Completed
            // This is the enforcement mechanism that prevents parallel execution of dependent tasks
            require!(
                dep_task.status == TaskStatus::Completed,
                BountyGraphError::DependencyNotCompleted
            );
        }

        // Create receipt: proof-of-work anchor
        let task = &mut ctx.accounts.task;
        let receipt = &mut ctx.accounts.receipt;
        receipt.task = task.key();
        receipt.agent = ctx.accounts.agent.key();
        receipt.work_hash = params.work_hash; // Hash of work artifact (e.g., commit hash, file hash)
        receipt.uri = params.uri; // URI to work details (IPFS, GitHub, etc.)
        receipt.submitted_at_slot = Clock::get()?.slot;
        receipt.bump = ctx.bumps.receipt;

        // Mark task as completed (atomically with receipt creation)
        task.status = TaskStatus::Completed;
        task.completed_by = Some(ctx.accounts.agent.key());

        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        // PAYMENT SAFETY: Verify task is completed
        require!(
            ctx.accounts.task.status == TaskStatus::Completed,
            BountyGraphError::TaskNotCompleted
        );
        // PAYMENT SAFETY: Verify no dispute is pending
        require!(
            ctx.accounts.task.dispute_status == DisputeStatus::None,
            BountyGraphError::TaskInDispute
        );
        // PAYMENT SAFETY: Verify caller is the worker who completed the task
        require!(
            ctx.accounts.task.completed_by == Some(ctx.accounts.agent.key()),
            BountyGraphError::NotTaskCompleter
        );

        let escrow_lamports = ctx.accounts.escrow.to_account_info().lamports();
        require!(escrow_lamports > 0, BountyGraphError::EscrowEmpty);

        // DESIGN: PDA lamport transfer pattern (not system_instruction::transfer)
        // Reason: system_instruction::transfer requires a signer for the source account.
        // Since escrow is a program-owned PDA (not a keypair), we cannot sign with it.
        // Instead, we directly manipulate lamports via &mut reference (allowed for PDAs).
        // This is safe because Anchor enforces PDA ownership at the account deserialization layer.
        **ctx.accounts.escrow.to_account_info().lamports.borrow_mut() -= escrow_lamports;
        **ctx.accounts.agent.to_account_info().lamports.borrow_mut() += escrow_lamports;

        // Close escrow account: zero out discriminator and data to reclaim rent
        ctx.accounts.escrow.task = Pubkey::default();
        ctx.accounts.escrow.bump = 0;

        Ok(())
    }

    pub fn dispute_task(ctx: Context<DisputeTask>, params: DisputeTaskParams) -> Result<()> {
        require!(!params.reason.is_empty(), BountyGraphError::InvalidUri);
        require!(
            params.reason.len() <= Dispute::MAX_REASON_LEN,
            BountyGraphError::InvalidUri
        );

        let task = &mut ctx.accounts.task;
        let signer = &ctx.accounts.initiator;

        // DISPUTE STATE: Disputes are only meaningful after a task is completed and before payout.
        // This also prevents "pre-emptive" disputes that could freeze tasks.
        require!(
            task.status == TaskStatus::Completed,
            BountyGraphError::InvalidTaskStatus
        );
        require!(
            task.dispute_status == DisputeStatus::None,
            BountyGraphError::DisputeAlreadyRaised
        );

        // AUTHORIZATION: Only creator or the worker who completed the task can initiate dispute.
        let worker = task
            .completed_by
            .ok_or(BountyGraphError::InvalidTaskStatus)?;
        require!(
            signer.key() == task.creator || signer.key() == worker,
            BountyGraphError::UnauthorizedDispute
        );

        let raised_at_slot = Clock::get()?.slot;

        // Update task dispute flags so reward claims are blocked while dispute is open.
        task.dispute_status = DisputeStatus::Raised;
        task.disputed_by = Some(signer.key());
        task.dispute_raised_at_slot = raised_at_slot;

        let dispute = &mut ctx.accounts.dispute;
        dispute.task = task.key();
        dispute.creator = task.creator;
        dispute.worker = worker;
        dispute.raised_by = signer.key();
        dispute.reason = params.reason;
        dispute.status = DisputeStatus::Raised;
        dispute.raised_at_slot = raised_at_slot;
        dispute.resolved_at_slot = None;
        dispute.arbiter = None;
        dispute.creator_pct = None;
        dispute.worker_pct = None;
        dispute.bump = ctx.bumps.dispute;

        Ok(())
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        params: ResolveDisputeParams,
    ) -> Result<()> {
        require!(
            params.creator_pct + params.worker_pct == 100,
            BountyGraphError::InvalidSplit
        );

        require!(
            ctx.accounts.authority.key() == ctx.accounts.graph.authority,
            BountyGraphError::UnauthorizedResolution
        );

        let task = &mut ctx.accounts.task;
        let dispute = &mut ctx.accounts.dispute;

        require!(dispute.task == task.key(), BountyGraphError::InvalidResolution);
        require!(
            dispute.creator == task.creator,
            BountyGraphError::InvalidCreator
        );

        let worker = task
            .completed_by
            .ok_or(BountyGraphError::InvalidTaskStatus)?;
        require!(dispute.worker == worker, BountyGraphError::InvalidWorker);
        require!(
            ctx.accounts.creator.key() == task.creator,
            BountyGraphError::InvalidCreator
        );
        require!(ctx.accounts.worker.key() == worker, BountyGraphError::InvalidWorker);

        require!(
            task.dispute_status == DisputeStatus::Raised,
            BountyGraphError::NoDisputeRaised
        );
        require!(
            dispute.status == DisputeStatus::Raised,
            BountyGraphError::InvalidTaskStatus
        );

        let escrow_lamports = ctx.accounts.escrow.to_account_info().lamports();
        require!(escrow_lamports > 0, BountyGraphError::EscrowEmpty);

        let creator_amount = escrow_lamports
            .checked_mul(params.creator_pct as u64)
            .ok_or(BountyGraphError::ArithmeticOverflow)?
            .checked_div(100)
            .ok_or(BountyGraphError::ArithmeticOverflow)?;

        let worker_amount = escrow_lamports
            .checked_sub(creator_amount)
            .ok_or(BountyGraphError::ArithmeticOverflow)?;

        let task_key = task.key();
        let seeds: &[&[u8]] = &[
            Escrow::SEED_PREFIX,
            task_key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

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

        let resolved_at_slot = Clock::get()?.slot;

        task.dispute_status = DisputeStatus::Resolved;
        task.resolved_by = Some(ctx.accounts.authority.key());
        task.dispute_resolved_at_slot = resolved_at_slot;
        task.worker_award_lamports = worker_amount;

        dispute.status = DisputeStatus::Resolved;
        dispute.resolved_at_slot = Some(resolved_at_slot);
        dispute.arbiter = Some(ctx.accounts.authority.key());
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
        constraint = escrow.task == task.key() @ BountyGraphError::InvalidDependency,
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
    #[account(
        has_one = authority,
        seeds = [Graph::SEED_PREFIX, authority.key().as_ref()],
        bump = graph.bump
    )]
    pub graph: Account<'info, Graph>,

    pub authority: Signer<'info>,

    #[account(mut, constraint = task.graph == graph.key() @ BountyGraphError::InvalidGraph)]
    pub task: Account<'info, Task>,

    #[account(mut)]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        seeds = [Escrow::SEED_PREFIX, task.key().as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub creator: SystemAccount<'info>,

    #[account(mut)]
    pub worker: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
