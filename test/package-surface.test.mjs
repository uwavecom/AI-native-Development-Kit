import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createActionGuard,
  createSignedApprovalAuthority,
} from 'ai-native-development-kit';
import { createOpenAIAgentsToolAdapter } from 'ai-native-development-kit/openai-agents';
import { createMcpToolCallGuard } from 'ai-native-development-kit/mcp';

test('package self-reference exposes the documented public API', () => {
  assert.equal(typeof createActionGuard, 'function');
  assert.equal(typeof createSignedApprovalAuthority, 'function');
  assert.equal(typeof createOpenAIAgentsToolAdapter, 'function');
  assert.equal(typeof createMcpToolCallGuard, 'function');
});
