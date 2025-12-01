# Feature-002: Settings Panel Expansion

**Status:** Deferred
**Planned Version:** v1.1
**Priority:** Medium
**Created:** 2025-11-30

## Summary

Expand the settings panel to include additional configuration options.

## Description

Add more settings to the Settings panel for better user control.

## New Settings

- [ ] Max output tokens configuration
- [ ] Save-to-directory path selection
- [ ] Delete all conversation history button
- [ ] Temperature control
- [ ] Other generation parameters

## Requirements

- [ ] Add settings to package.json
- [ ] Update SettingsHandler
- [ ] Update SettingsView UI
- [ ] Persist settings via VS Code configuration

## Notes

Some settings may need to be stored in SecretStorage if sensitive.
