# UI Cleanup & Alignment Plan

**Goal**: Align Pixel Minion UI with Prose Minion design language

## Design Reference (from screenshots)

### Main View Layout
```
┌─────────────────────────────────────────────────────┐
│  PIXEL MINION: AI GRAPHICS               [⚙️]      │  ← VSCode title bar (handled by VSCode)
├─────────────────────────────────────────────────────┤
│                                                     │
│  Pixel Minion                          [ICON 64px] │  ← App header
│  AI-powered graphics generation      0 tokens | $0 │  ← Token widget under icon
│                                                     │
├─────────────────────────────────────────────────────┤
│ [🖼️ Image] [📐 SVG]                                │  ← Button-style tabs with icons
├─────────────────────────────────────────────────────┤
│                                                     │
│              Tab Content                            │  ← Main content area
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Settings Overlay Layout
```
┌─────────────────────────────────────────────────────┐
│                    [ICON]                           │
│                   Settings              [Close]     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🔐 OpenRouter API Key (Secure Storage)          │ │
│ │                                                 │ │
│ │ Your API key is stored securely...             │ │
│ │ [••••••••••••••••••••••••••••••]               │ │
│ │ [Save API Key]  [Clear API Key]                │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Models                                          │ │
│ │                                                 │ │
│ │ Image Model                                     │ │
│ │ [Google Gemini 2.5 Flash              ▼]       │ │
│ │ Powers text-to-image and image-to-image.       │ │
│ │                                                 │ │
│ │ SVG Model                                       │ │
│ │ [Google Gemini 3 Pro Preview          ▼]       │ │
│ │ Powers SVG code generation from prompts.       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ General                                         │ │
│ │                                                 │ │
│ │ Max Conversation Turns                          │ │
│ │ [10                                   ]         │ │
│ │ Maximum turns before conversation resets.       │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Phase 1: App Header Component (New)

**Task 1.1: Create AppHeader component**
- File: `src/presentation/webview/components/layout/AppHeader.tsx`
- Layout: Flex row with title on left, icon+token widget on right
- Elements:
  - `h1`: "Pixel Minion"
  - `p`: "AI-powered graphics generation"
  - Icon (64x64) - use inline SVG or image
  - Token widget (placeholder: "0 tokens | $0.000")

**Task 1.2: Add header styles**
- Add to `global.css`:
  - `.app-header` - flex layout, padding
  - `.app-header-left` - title container
  - `.app-header-right` - icon + token widget column
  - `.app-header-icon` - 64x64, themed color
  - `.token-widget` - small font, highlight color

**Task 1.3: Wire AppHeader into App.tsx**
- Import and render `<AppHeader />` above TabBar

### Phase 2: Button-Style Tab Bar

**Task 2.1: Update TabBar component**
- File: `src/presentation/webview/components/layout/TabBar.tsx`
- Add icon support to Tab interface
- Update button rendering to include icon span

**Task 2.2: Update tab styles**
- File: `src/presentation/webview/styles/components/tabs.css`
- New button-style tabs:
  - Background color
  - 2px border
  - Hover lift effect
  - Active state with focus border
  - Icon + label layout with gap

**Task 2.3: Update tab definitions in App.tsx**
- Add icons to TABS array:
  - Image: '🖼️' or similar
  - SVG: '📐' or similar

### Phase 3: Settings Overlay Redesign

**Task 3.1: Restructure SettingsView component**
- File: `src/presentation/webview/components/views/SettingsView.tsx`
- New layout:
  - Icon centered at top
  - "Settings" title centered with Close button right-aligned
  - Card sections with rounded borders
  - Dropdown selectors for models (not text inputs)
  - Descriptions below each field

**Task 3.2: Update settings overlay styles**
- File: `src/presentation/webview/styles/global.css`
- New classes:
  - `.settings-header` - grid layout (icon center, close right)
  - `.settings-header-content` - icon + title stacked
  - `.settings-section` - card with rounded border, padding
  - `.settings-section-title` - section header styling
  - `.settings-label-title` - field label styling
  - `.settings-description` - muted description text

**Task 3.3: Create ModelDropdown component (optional)**
- Reusable dropdown for model selection
- Shows model display name
- Description below

### Phase 4: Output Toggle Icon Update

**Task 4.1: Update package.json**
- Change `pixelMinion.showOutput` icon from `$(output)` to `$(bug)`
- This changes the icon in the VSCode title bar

### Phase 5: Token Widget Integration (Future - separate ticket)

**Task 5.1: Wire TOKEN_USAGE messages**
- Already have message type infrastructure
- Need to track accumulated tokens in App state
- Display in header widget

---

## CSS Variable Reference (from Prose Minion)

```css
/* Header */
.app-header {
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.app-header-icon {
  width: 64px;
  height: 64px;
}

.token-widget {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-list-highlightForeground);
}

/* Button-style tabs */
.tab-button {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--vscode-button-secondaryBackground);
  border: 2px solid var(--vscode-panel-border);
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.tab-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
  border-color: var(--vscode-focusBorder);
  transform: translateY(-1px);
}

.tab-button.active {
  background-color: var(--vscode-editor-background);
  border-color: var(--vscode-focusBorder);
  font-weight: 600;
}

/* Settings sections */
.settings-section {
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  padding: var(--spacing-md);
  margin-top: var(--spacing-sm);
}

.settings-section-title {
  font-size: 1.3em;
  font-weight: 600;
  border-bottom: 1px solid var(--vscode-panel-border);
  padding-bottom: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.settings-description {
  color: var(--vscode-descriptionForeground);
  font-size: 0.9em;
  margin-top: 4px;
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `components/layout/AppHeader.tsx` | Create | New header component |
| `components/layout/TabBar.tsx` | Modify | Add icon support |
| `components/views/SettingsView.tsx` | Modify | Restructure with cards |
| `styles/global.css` | Modify | Add header + settings styles |
| `styles/components/tabs.css` | Modify | Button-style tabs |
| `App.tsx` | Modify | Add AppHeader, update tabs |
| `package.json` | Modify | Change output icon to bug |

---

## Estimated Scope

- **Files to create**: 1
- **Files to modify**: 6
- **New CSS classes**: ~15
- **Component changes**: Moderate complexity

## Dependencies

- Icon SVG for header (can use existing `assets/icon.svg` or inline SVG)
- Model list for dropdowns (already have in providers.ts)
