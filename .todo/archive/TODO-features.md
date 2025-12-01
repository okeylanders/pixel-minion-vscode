# Upcoming Features & Enhancements (Summary)

## Items
- UI cleanup / alignment across tabs and settings panel. ( DONE )
- Show Loading Animation during generates ( DONE )
- Better system prompt management via PromptLoader that reads system prompts from resouces/system-prompts/[image, svg, enhance-image, enhance-svg, describe-image, describe-svg]/* (consider exposing/editing prompts). (Deferred V 1.1 )
- Token cost widget in the main view (consume TOKEN_USAGE updates). ( DONE )
- Settings panel expansion include other settings like: max-output, save-to-directory, delete-all-conversation-history,  (Deferred V 1.1 )
- Image/Svg Add Option for multiple generations per turn ( values 1-4 ) each with random seeds store in Settings so it persists
- Add Upscale Option
- Add ( NON AI ) Convert to SVG to PNG
- Add AI Inpainting
- ADD ( NON AI ) image utils resize, compress, [ create 16x16, 32x32, etc files from larger image ], [ create sm, md, lg, xl, 2xl, etc from single file ]
- Image/SVG Prompt library (save/reuse prompts). ( Deferred )
- Access Conversation History and Restore Prior Thread
- Flip through past generations in SVG Thread
- Branch from image in thread [ loads image as reference, opaques thread, restores original prompt 1 from that thread, allows for fresh generation ]
- Model switch midstream behavior (decide if conversations adopt new model).  (Deferred V 1.1 )
- SVG attachment handling for SVG/Image generator (attach prior SVG as text in outgoing prompt). ( DONE )
- TAIO “Enhance” flow (hidden text suite) with history-based rehydration. ( DONE - But there isn't history for enhance prompt )
- Describe image Button on both Image & SVG ( and/or send refrenced images to the Enhance Prompt Assistant ) ( Deferred 1.1 )

## Notes
- Text rehydration is infra-ready; webview wiring pending (will be used by the Enhance flow). ( 50% )
- Image/SVG rehydration is implemented; model/aspect currently sticky per conversation. ( DONE )
