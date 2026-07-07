---
name: performance-review
description: Review and optimize system performance across code, LLM, Docker, Build, Network, and DB
license: MIT
compatibility: opencode
metadata:
  audience: all
  workflow: performance
---

## What I do

I perform a comprehensive performance review of a specified component (file, Dockerfile, CI config, etc.) by calling `@performance-reviewer` and proposing technical optimizations.

## When to use me

Use this when you need a "Senior Performance Engineer" review of:

- Critical paths in your application code.
- Dockerfiles and container configurations.
- CI/CD pipeline definitions (e.g., GitHub Actions, GitLab CI).
- LLM prompt designs or inference logic.
- Database schema and query patterns.

## Preconditions

- The target file path must be provided by the user. If the path is missing or unreadable, ask the user for a valid file.
- The target domain (optional, defaults to all) should be specified if possible.
- The `@performance-reviewer` subagent must be available. If unavailable, stop and report that the review cannot proceed.

## Workflow

### Step 1: Read target file

Read the content of the user-specified target file.

> **Note**: If available, also gather the context in which the file was created and the user's intent behind it — this helps the reviewer make more relevant suggestions.

### Step 2: Call reviewer

Call `@performance-reviewer` with:

- The content of the file.
- The context of the target domain (if specified).
- The specific review criteria based on the file type (e.g., if it's a Dockerfile, focus on Docker & Build).

If `@performance-reviewer` returns no findings, inform the user that the component is already optimized and proceed directly to Step 7 (Complete).

### Step 3: Propose

Present the findings to the user. For each finding, ask whether to:

- Apply the suggested fix
- Apply with modification
- Dismiss (with reason)

### Step 4: Apply

Edit the file according to accepted findings.

### Step 5: Verify

Call `@performance-reviewer` on the modified file to verify that the issues were addressed and that no new bottlenecks were introduced. Include context from the previous discussion.

### Step 6: Iterate

If new findings remain, return to Step 3. **Maximum 3 rounds.**

### Step 7: Complete

Print a session summary of the optimizations made.

## Domain-specific Addenda

When calling `@performance-reviewer`, include these specific focuses based on the file type:

### Code Files (.py, .ts, .go, .rs, etc.)

- Focus on: General Code Performance, Network, Database.

### Dockerfiles

- Focus on: Docker & Container Optimization, Build & CI Performance.

### CI Configs (.github/workflows/\*.yml, etc.)

- Focus on: Build & CI Performance.

### LLM Prompts / Inference Logic

- Focus on: LLM Model Optimization, Token Efficiency.

### Database Schema / Query Files

- Focus on: Database & Storage Performance.
