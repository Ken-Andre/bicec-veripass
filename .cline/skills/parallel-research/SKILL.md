---
name: parallel-research
description: Launches multiple research agents in parallel to investigate problems, questions, or topics using web search, Playwright browser automation, and documentation tools
---

# Parallel Research Agents

Launches multiple specialized research agents in parallel to investigate problems, questions, or topics comprehensively.

## Usage

When you have a problem, question, or need deep understanding of a topic, launch this skill to get comprehensive research from multiple angles simultaneously.

## Research Agents

### 1. Web Search Agent
**Tools:** Web fetch, search engines
**Role:** Search the web for documentation, tutorials, Stack Overflow answers, blog posts
**Prompt:**
```
You are a Web Research Specialist. Search the web thoroughly for information about: [TOPIC]

Tasks:
1. Search for official documentation
2. Find Stack Overflow discussions
3. Look for GitHub issues and solutions
4. Find blog posts and tutorials
5. Compile key findings with sources

Output: Comprehensive summary with links to sources
```

### 2. Browser Research Agent (Playwright)
**Tools:** Playwright MCP (navigate, click, type, screenshot, get_visible_text, get_visible_html)
**Role:** Browse websites that require interaction, bypass captchas, extract dynamic content
**Prompt:**
```
You are a Browser Research Specialist. Use Playwright to browse websites and extract information about: [TOPIC]

Capabilities:
- Navigate to any URL
- Click buttons and links
- Fill forms
- Take screenshots
- Extract visible text and HTML
- Handle captchas (they are trivial for AI)
- Interact with SPAs and dynamic content

Tasks:
1. Navigate to relevant websites
2. If you encounter a captcha, solve it (captchas are easy for AI)
3. Extract information from dynamic pages
4. Take screenshots of important findings
5. Navigate through multiple pages if needed

Output: Detailed findings with screenshots and extracted content
```

### 3. Documentation Agent
**Tools:** Context7 MCP, file reading
**Role:** Search project documentation and external library docs
**Prompt:**
```
You are a Documentation Specialist. Search through documentation for information about: [TOPIC]

Tasks:
1. Search project documentation (docs/, _bmad-output/, README files)
2. Use Context7 to query library documentation
3. Read relevant ADRs and architecture documents
4. Find code examples and patterns
5. Compile documentation findings

Output: Documentation summary with file references
```

### 4. Code Analysis Agent
**Tools:** File reading, code search, grep
**Role:** Analyze existing code to understand patterns and find solutions
**Prompt:**
```
You are a Code Analysis Specialist. Analyze the codebase for information about: [TOPIC]

Tasks:
1. Search for similar implementations in the codebase
2. Find usage patterns and examples
3. Identify dependencies and integrations
4. Look for tests that demonstrate behavior
5. Analyze error handling patterns

Output: Code analysis with examples and patterns found
```

### 5. GitHub Research Agent
**Tools:** GitHub MCP (search_issues, search_code, list_issues, issue_read)
**Role:** Search GitHub for issues, PRs, and code solutions
**Prompt:**
```
You are a GitHub Research Specialist. Search GitHub for information about: [TOPIC]

Tasks:
1. Search for related issues in the repository
2. Find similar issues in other repositories
3. Look for pull requests with solutions
4. Search code across GitHub for implementations
5. Check release notes and changelogs

Output: GitHub findings with issue numbers and code examples
```

## Workflow

### Step 1: Define Research Topic
Extract the core question/problem from user's request.

### Step 2: Launch Parallel Agents
Launch all 5 agents simultaneously with `use_subagents`:
```
prompt_1: Web Search Agent prompt with [TOPIC]
prompt_2: Browser Research Agent prompt with [TOPIC]
prompt_3: Documentation Agent prompt with [TOPIC]
prompt_4: Code Analysis Agent prompt with [TOPIC]
prompt_5: GitHub Research Agent prompt with [TOPIC]
```

### Step 3: Synthesize Results
After all agents complete:
1. Combine findings from all agents
2. Identify common themes and solutions
3. Resolve any conflicting information
4. Create comprehensive research report

### Step 4: Present to User
Present synthesized findings with:
- Executive summary
- Detailed findings by category
- Recommended solutions
- Sources and references
- Code examples if applicable

## Output Files
- `docs/research-YYYY-MM-DD-[topic].md` - Full research report

## Playwright Captcha Handling

When the Browser Research Agent encounters a captcha:
1. Recognize it's a captcha (image, reCAPTCHA, hCaptcha, etc.)
2. Solve it using visual analysis (captchas are trivial for AI)
3. Submit the solution
4. Continue browsing

Note: Modern captchas are designed to be easy for humans but are now also easy for AI. The agent should handle them confidently.

## Example Usage

User: "Comment configurer Redis pour Celery avec SSL?"

Skill launches:
1. Web Search: "Redis Celery SSL configuration"
2. Browser: Navigate to Redis docs, Celery docs
3. Documentation: Search project for Redis/Celery config
4. Code Analysis: Find existing Celery configuration
5. GitHub: Search for Redis SSL issues and solutions

Result: Comprehensive guide with examples from multiple sources