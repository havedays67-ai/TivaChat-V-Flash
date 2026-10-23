# Automated checks

Requirements: Node.js 18+, npm, Python 3.10+.

```bash
npm install
node tests/engine.test.mjs
python3 tests/native_checks.py
```

`engine.test.mjs` loads the real `android/assets/assistant.html` and the generated
`tiva_knowledge.js` in jsdom, then checks command parsing, native bridge arguments,
and dataset quality gates. `native_checks.py` verifies safety-sensitive native
configuration such as read-contacts, no direct ACTION_CALL/ACTION_DELETE,
App Info, media picker, the overlay's non-modal flag, and build versions.
