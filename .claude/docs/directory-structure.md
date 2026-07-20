# Directory Structure — Socher Hayam

```text
/
├── README.md                     # Project entry point
├── CLAUDE.md                     # Mandatory instructions for language models
├── PROJECT-STATUS.md             # Current stage and next task
├── package.json                  # test, verify and serve commands
├── src/                          # The only active game implementation
│   ├── core/                     # Verified gameplay engine
│   ├── ui/                       # Presentation and interaction layer
│   ├── tests/                    # 56 regression/fidelity tests
│   └── index.html                # Browser entry point
├── design/
│   ├── reference-materials/      # User plans, mockups and original screenshots
│   ├── gdd/                      # Approved game-design documents
│   ├── ux/                       # Screen flows and UX specifications
│   └── registry/                 # Studio entity registry
├── docs/
│   ├── reverse-engineering/      # Canonical binary analysis and final spec
│   └── studio-framework/         # Generic process/framework documentation
├── reference/original-game/      # Read-only DOS source snapshot
├── tools/                        # Verification, local server and audit utilities
├── archive/legacy-analysis/      # Non-authoritative historical analysis
├── .claude/                      # Optional agents, skills and process tooling
└── production/                   # Optional production tracking
```

All active work starts from the repository root. Do not create a second project tree or a parallel staging copy inside the repository.
