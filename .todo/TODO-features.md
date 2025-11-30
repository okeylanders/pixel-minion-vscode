# Upcoming Features & Enhancements (Summary)

## Ready to Plan
- UI cleanup / alignment across tabs and settings panel.
- Show Loading Animation during generates
- Better system prompt management (consider exposing/editing prompts).
- Token cost widget in the main view (consume TOKEN_USAGE updates).
- Settings panel dropdown polish (consistent selectors for models/aspect).
- Prompt library (save/reuse prompts).
- Model switch midstream behavior (decide if conversations adopt new model).
- SVG attachment handling for SVG generator (attach prior SVG as text in outgoing prompt).
- TAIO “Enhance” flow (hidden text suite) with history-based rehydration.

## Notes
- Text rehydration is infra-ready; webview wiring pending (will be used by the Enhance flow).
- Image/SVG rehydration is implemented; model/aspect currently sticky per conversation.
