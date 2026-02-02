# BMAD (Business Model Analysis and Design) Usage Guide

## What is BMAD?

BMAD is a comprehensive framework for business model analysis and design that integrates with Cline to provide:

- **Business Management Module (bmm)**: Complete project lifecycle management
- **Builder Module (bmb)**: Tools for creating and managing agents, modules, and workflows
- **Creative Innovation System (cis)**: Human-centered design and problem-solving
- **Core Utilities (core)**: Essential tools for documentation and analysis
- **Testing and Automation (tea)**: Comprehensive testing and quality assurance

## Current Configuration

Your BMAD setup is located in:
- `_bmad/` - Main BMAD installation and resources
- `.agent/workflows/` - Workflow definitions for Cline integration
- `.clinerules` - Configuration file for Cline integration

## Prerequisites

1. **VS Code with Cline Extension**: Ensure you have Cline installed in VS Code
2. **Git**: For version control
3. **Node.js (optional)**: For certain operations

## How to Use BMAD

### Starting a New Project

1. **Get Help**: `/bmad-help` - Display available workflows and next steps
2. **Quick Spec**: `/bmad-quick-spec` - Rapid specification for simple tasks
3. **Quick Dev**: `/bmad-quick-dev` - Rapid development for small changes

### Comprehensive Project Management

For a complete project lifecycle:

1. **Research**: `/bmad-bmm-research` - Conduct market/domain/technical research
2. **Create Product Brief**: `/bmad-bmm-create-product-brief` - Define product idea
3. **Create PRD**: `/bmad-bmm-create-prd` - Write product requirements document
4. **Create UX Design**: `/bmad-bmm-create-ux-design` - Design user experience
5. **Create Architecture**: `/bmad-bmm-create-architecture` - Document technical decisions
6. **Create Epics & Stories**: `/bmad-bmm-create-epics-and-stories` - Break into tasks
7. **Sprint Planning**: `/bmad-bmm-sprint-planning` - Plan implementation
8. **Dev Story**: `/bmad-bmm-dev-story` - Execute story implementation
9. **Code Review**: `/bmad-bmm-code-review` - Review and improve code
10. **QA Automation**: `/bmad-bmm-qa-automate` - Add automated testing

### Builder Module (Creating Your Own Components)

1. **Create Agent**: `/bmad-bmb-agent` - Create new BMAD agents with best practices
2. **Edit Agent**: `/bmad-bmb-agent` - Edit existing BMAD agents
3. **Validate Agent**: `/bmad-bmb-agent` - Validate agents against standards
4. **Create Module**: `/bmad-bmb-module` - Create complete BMAD modules
5. **Create Workflow**: `/bmad-bmb-workflow` - Build custom workflows

### Creative Innovation System

1. **Design Thinking**: `/bmad-cis-design-thinking` - Human-centered design
2. **Problem Solving**: `/bmad-cis-problem-solving` - Systematic problem-solving
3. **Brainstorming**: `/bmad-cis-brainstorming` - Idea generation sessions
4. **Storytelling**: `/bmad-cis-storytelling` - Compelling narrative creation

### Testing & Automation

1. **Teach Me Testing**: `/bmad-tea-teach-me-testing` - Learn testing fundamentals
2. **Test Framework**: `/bmad-tea-framework` - Initialize test framework
3. **ATDD**: `/bmad-tea-atdd` - Generate failing tests (TDD red phase)
4. **Test Automation**: `/bmad-tea-automate` - Expand test coverage
5. **Test Review**: `/bmad-tea-test-review` - Quality audit (0-100 scoring)

### Core Utilities

1. **Brainstorming**: `/bmad-brainstorming` - Interactive brainstorming sessions
2. **Party Mode**: `/bmad-party-mode` - Multi-agent discussions
3. **Index Docs**: `/bmad-index-docs` - Quick document indexing
4. **Shard Doc**: `/bmad-shard-doc` - Split large documents
5. **Editorial Review**: `/bmad-editorial-review-prose` - Content review

## Workflow Examples

### Example 1: Building a New Feature

```
/bmad-bmm-research (conduct research)
→ /bmad-bmm-create-prd (define requirements)
→ /bmad-bmm-create-architecture (design technical solution)
→ /bmad-bmm-sprint-planning (plan implementation)
→ /bmad-bmm-dev-story (implement the feature)
→ /bmad-bmm-qa-automate (add tests)
→ /bmad-bmm-code-review (review and optimize)
```

### Example 2: Quick Task

```
/bmad-quick-spec (document requirements)
→ /bmad-quick-dev (implement and test)
```

### Example 3: Creating Documentation

```
/bmad-bmm-generate-project-context (analyze existing codebase)
→ /bmad-bmm-document-project (create comprehensive docs)
→ /bmad-bmm-write-document (create specific docs)
```

## Output Locations

BMAD stores artifacts in:
- `_bmad-output/planning-artifacts/` - Planning documents (PRDs, architecture, etc.)
- `_bmad-output/implementation-artifacts/` - Implementation files (code, tests, etc.)
- `_bmad-output/testing-artifacts/` - Test results and reports

## Configuration Details

### .clinerules Configuration

The BMAD integration is configured in the `.clinerules` file at your project root. Key settings:

```yaml
# BMAD Integration Configuration
bmad:
  enabled: true
  version: "v1"
  root: "_bmad"
  workflows: "_bmad/_config/bmad-help.csv"
  agents: "_bmad/_config/agents"
  modules:
    - "_bmad/bmb"  # Builder module
    - "_bmad/bmm"  # Business module
    - "_bmad/cis"  # Creative innovation system
    - "_bmad/core"  # Core utilities
    - "_bmad/tea"  # Testing and automation

# Output Configuration
output:
  planning: "_bmad-output/planning-artifacts"
  implementation: "_bmad-output/implementation-artifacts"
  testing: "_bmad-output/testing-artifacts"
```

### Workflow Discovery

Workflows are discovered from:
- `_bmad/` - Main BMAD resources
- `.agent/` - Cline workflow definitions

## Troubleshooting

### Common Issues

1. **Workflow not recognized**:
   - Check that `.agent/workflows/` contains the workflow file
   - Verify the workflow command matches exactly (case-sensitive)
   - Restart VS Code

2. **Output directories not created**:
   - Ensure `_bmad-output/` directory exists
   - Check permissions on the output directory

3. **Workflow fails to execute**:
   - Review the workflow file in `.agent/workflows/`
   - Check the bmad-help.csv file for configuration
   - Look for error messages in VS Code terminal

### Verification Steps

To verify BMAD integration is working:

1. Open a file in VS Code
2. Press `/` to trigger Cline
3. Type "bmad" and see available commands
4. Select `/bmad-help` to test

## Updating BMAD

BMAD is self-contained in the `_bmad/` directory. To update:

1. Replace the `_bmad/` directory with new version
2. Ensure `.agent/workflows/` has matching workflow definitions
3. Update `.clinerules` configuration if needed

## Resources

- **Help**: `/bmad-help` - Get workflow recommendations
- **Documentation**: `_bmad/bmm/agents/tech-writer/` - Documentation guidelines
- **Architecture**: `_bmad/_config/manifest.yaml` - System configuration

---

**Note**: BMAD works best when used through the VS Code Cline extension. All commands are invoked by typing `/` followed by the workflow name.