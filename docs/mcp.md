# MCP integration

MCP authentication/authorization determines whether a client may access an MCP server or protected capability.

The Development Kit governs the semantic action after access has been established.

Use `createMcpToolCallGuard()` to wrap an MCP-style tool call.

The wrapper binds policy and approval to:

- tool name;
- target;
- material arguments;
- scope;
- policy/tool-contract provenance.

A valid OAuth session or MCP authorization grant does not automatically imply permission to perform every consequential tool call.

Keep identity and approval decisions at a trusted application/gateway boundary.
