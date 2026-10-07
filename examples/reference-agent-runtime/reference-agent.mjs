import { createActionProposal, createApprovalReceipt } from '../../runtime/action-proposal.mjs';
import { runHardenedSafeAction } from '../../runtime/hardened-safe-action.mjs';
import { runWorkflow } from '../../runtime/workflow/run-workflow.mjs';
import { githubTools } from '../github-actions/tools.mjs';
import { tradingViewTools } from '../tradingview-mcp/tools.mjs';

const find = (tools, name) => {
  const tool = tools.find(item => item.name === name);
  if (!tool) throw new Error(`UNKNOWN_TOOL:${name}`);
  return tool;
};

export function createReferenceAgent({ stateStore, lock, budget, github, tradingView }) {
  async function runTool({ tool, actor, proposal, approval, input, invoke, verify, inspectState, rollbackAction, compensationAction }) {
    return runHardenedSafeAction({
      tool,
      actor,
      proposal,
      approval,
      input,
      invoke,
      verify,
      inspectState,
      rollbackAction,
      compensationAction,
      stateStore,
      lock,
      budget,
    });
  }

  return {
    async analyzeAndCreateAlert({ actor, symbol = 'NVDA', threshold, condition = 'cross_up', approverId = 'human-1' }) {
      const matches = await tradingView.searchSymbols(symbol);
      const resolved = matches[0]?.symbol;
      if (!resolved) return { resolved: false, reason: 'SYMBOL_NOT_FOUND' };

      const screener = await tradingView.runScreener();
      const proposal = createActionProposal({
        toolName: 'create_alert',
        target: resolved,
        params: { symbol: resolved, threshold, condition },
      });
      const approval = createApprovalReceipt({
        proposal,
        actorId: approverId,
        approvedAt: new Date().toISOString(),
      });

      const action = await runTool({
        tool: find(tradingViewTools, 'create_alert'),
        actor,
        proposal,
        approval,
        input: proposal.params,
        invoke: input => tradingView.createAlert(input),
        verify: async () => ({
          verified: Boolean(tradingView.findAlert(proposal.params)),
        }),
        inspectState: async () => ({
          desiredState: Boolean(tradingView.findAlert(proposal.params)),
        }),
      });

      return { resolved: action.resolved, resolvedSymbol: resolved, screener, proposal, action };
    },

    async githubChangeWorkflow({ actor, path = 'README.md', content, branch = 'agent/change', approveMerge = false }) {
      const tools = githubTools;
      let prNumber = null;

      const steps = [
        { id: 'fetch', compensate: false },
        { id: 'branch', compensate: false },
        { id: 'update', compensate: false },
        { id: 'pr', compensate: false },
        { id: 'merge', compensate: false },
      ];

      const result = await runWorkflow({
        steps,
        executeStep: async step => {
          if (step.id === 'fetch') {
            const proposal = createActionProposal({ toolName: 'fetch_file', target: path });
            const action = await runTool({
              tool: find(tools, 'fetch_file'),
              actor,
              proposal,
              input: { path },
              invoke: () => github.fetchFile(path),
            });
            return { resolved: action.execution.status === 'SUCCEEDED', action };
          }

          if (step.id === 'branch') {
            const proposal = createActionProposal({ toolName: 'create_branch', target: branch, params: { base: 'main' } });
            const action = await runTool({
              tool: find(tools, 'create_branch'),
              actor,
              proposal,
              input: proposal.params,
              invoke: () => github.createBranch(branch),
              verify: async () => ({ verified: github.branches.has(branch) }),
            });
            return { resolved: action.resolved, action };
          }

          if (step.id === 'update') {
            const proposal = createActionProposal({ toolName: 'update_file', target: path, params: { content, branch } });
            const approval = createApprovalReceipt({
              proposal,
              actorId: 'human-1',
              approvedAt: new Date().toISOString(),
            });
            const action = await runTool({
              tool: find(tools, 'update_file'),
              actor,
              proposal,
              approval,
              input: proposal.params,
              invoke: () => github.updateFile(path, content),
              verify: async () => ({ verified: (await github.fetchFile(path)).content === content }),
              inspectState: async () => ({ desiredState: (await github.fetchFile(path)).content === content }),
            });
            return { resolved: action.resolved, action };
          }

          if (step.id === 'pr') {
            const proposal = createActionProposal({ toolName: 'create_pull_request', target: branch, params: { head: branch, base: 'main' } });
            const approval = createApprovalReceipt({
              proposal,
              actorId: 'human-1',
              approvedAt: new Date().toISOString(),
            });
            const action = await runTool({
              tool: find(tools, 'create_pull_request'),
              actor,
              proposal,
              approval,
              input: proposal.params,
              invoke: async () => {
                const pr = await github.createPullRequest({ head: branch, base: 'main', title: 'Agent change' });
                prNumber = pr.number;
                return pr;
              },
              verify: async ({ providerResult }) => ({ verified: Boolean(github.pullRequests.get(providerResult.number)) }),
            });
            return { resolved: action.resolved, action };
          }

          const proposal = createActionProposal({
            toolName: 'merge_pull_request',
            target: `PR#${prNumber}`,
            params: { prNumber, base: 'main' },
          });
          const approval = approveMerge
            ? createApprovalReceipt({ proposal, actorId: 'human-1', approvedAt: new Date().toISOString() })
            : null;
          const action = await runTool({
            tool: find(tools, 'merge_pull_request'),
            actor,
            proposal,
            approval,
            input: proposal.params,
            invoke: () => github.mergePullRequest(prNumber),
            verify: async () => ({ verified: github.pullRequests.get(prNumber)?.merged === true }),
          });
          return { resolved: action.execution.status === 'SUCCEEDED', action };
        },
      });

      return { ...result, prNumber };
    },
  };
}
