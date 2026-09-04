---
name: check-ruflo-mcp
description: Ensures the ruflo MCP is running and connected before starting any task.
trigger: always_on
---
# Ruflo MCP Check
Whenever the user gives a prompt, before executing the task, you MUST verify two things:
1. The `ruflo` MCP server is running and healthy by executing `ruflo mcp health` or checking its status.
2. The MCP is successfully connected to Antigravity, by confirming that you have access to `ruflo` tools in your environment.

Do not proceed with the main task until you have confirmed both that the server is running and that it is connected to Antigravity.
