# PRD: Brew Log — Coffee Consistency Tracker

**Author:** [Your name]
**Status:** Draft v1
**Last updated:** August 19, 2026

---

## 1. Overview

Brew Log is a web app that helps home coffee brewers achieve consistent, repeatable results by making it fast to record every variable of a brew (method, equipment, beans, tasting notes) and attach a photo of the finished cup. It replaces the friction of manually logging brews in a spreadsheet.

## 2. Problem Statement

Achieving a consistent cup of coffee requires tracking many variables (brew method, grind size, dose, water temp, time, bean origin, etc.) across many attempts. Doing this in a general-purpose tool like Google Sheets is slow and easy to abandon — there's no structure guiding what to log, and no easy way to capture the visual/sensory side of a brew (photo, tasting notes) without extra steps.

## 3. Goals

- Make logging a brew take under 60 seconds.
- Structure data entry so nothing important is forgotten (method, equipment, beans, notes).
- Let the user look back at past brews to identify what produced their best results.
- Let the user capture a photo of the cup and share it to social media in the same flow.

### Non-Goals (v1)

- No AI-driven brew recommendations ("try a finer grind").
- No social feed / browsing other users' brews within the app.
- No multi-user accounts, teams, or sharing between app users.
- No native mobile app (web app only for v1; mobile is a later phase).

## 4. Target User

Primarily the founder (you) as the first user — a home brewer using multiple methods (moka, pourover, espresso, Turkish, etc.) who wants to dial in consistency. Designed so it can later be opened up to other home-brewing enthusiasts with the same problem.

## 5. Core User Story

> "As a home brewer, when I finish making a cup of coffee, I want to quickly log exactly what I did and how it tasted, along with a photo, so that I can compare brews later and repeat the ones I liked."

## 6. Key Features (v1 scope)

### 6.1 Brew Logging

A guided entry form, structured as fields (not free text) so it's fast and consistent:

**Method**
- Brew method (Pourover, Moka pot, Espresso, Turkish, French Press, AeroPress, Cold Brew, Other — free text if "Other")

**Equipment**
- Machine/brewer brand
- Machine/brewer model
- Grinder brand + model (optional but useful for consistency)
- Grind size setting

**Beans**
- Bean name / roaster
- Variety (e.g. Bourbon, Typica, blend)
- Origin
- Processing/wash method (Washed, Natural, Honey, Anaerobic, Other)
- Roast date (optional) and roast level (Light / Medium / Dark)

**Brew Parameters**
- Dose (g)
- Water weight / yield (g or ml)
- Water temperature
- Brew time
- Ratio (auto-calculated from dose + water weight)

**Tasting Notes**
- Flavor tags, multi-select (Fruity, Nutty, Chocolatey, Floral, Acidic, Bitter, Sweet, Earthy, etc.) — extensible list
- Overall rating (e.g. 1–5 stars)
- Free-text notes (optional, for anything the structured fields don't capture)

### 6.2 Photo Capture & Social Share

- Attach/upload a photo of the finished cup as part of the same logging flow (from file upload or device camera on supported browsers).
- Photo is stored with the brew entry.
- One-tap "Share" action that generates a shareable image/card (photo + key brew details, e.g. method + beans + rating) for posting to social media (e.g. Instagram, X).

### 6.3 Brew History

- List/grid view of past brews, most recent first.
- View a single brew's full details.
- Basic filtering (by method, by bean, by rating) so the user can compare brews and spot what's working.

## 7. User Flow

1. User finishes brewing coffee.
2. User opens Brew Log → taps "New Brew."
3. User steps through structured fields: Method → Equipment → Beans → Brew Parameters → Tasting Notes.
4. User takes/uploads a photo of the cup.
5. User saves the brew — entry appears in history.
6. Optionally, user taps "Share" to generate a social-ready image and share externally.

## 8. Data Model (high-level)

**Brew**
- id, created_at
- method
- equipment: { machine_brand, machine_model, grinder_brand, grinder_model, grind_size }
- beans: { name, variety, origin, process, roast_date, roast_level }
- parameters: { dose_g, water_g, ratio (calculated), water_temp, brew_time }
- tasting: { flavor_tags[], rating, notes }
- photo_url

This structure also allows saving "presets" later (e.g. reusing the same beans/equipment across brews without re-entering).

## 9. Success Metrics

Since v1 is single-user, success is qualitative and behavioral:
- User logs a brew consistently after each coffee made (frequency of use).
- Logging a brew takes under ~60 seconds.
- User can look back and identify a "best brew" and reproduce it successfully.
- If/when opened to others: signups, weekly active loggers, brews logged per user per week.

## 10. Platform & Technical Notes

- **v1:** Web app (desktop + mobile browser responsive), so it's usable at the kitchen counter via phone browser without needing an app install.
- **Later phase:** Native or PWA-wrapped mobile app for camera access, offline logging, and push reminders.
- Photo storage and a lightweight backend/database needed to persist brews across sessions (not just local storage), since the goal is long-term comparison.

## 11. Open Questions

- Should equipment and beans be saved as reusable presets from the start, or added as a fast-follow once repeat entries become tedious?
- What's the minimum viable flavor-tag taxonomy, and should users be able to add custom tags?
- What does the generated "share card" look like — is a simple photo + text overlay enough for v1, or does it need a designed template?
- At what point (if any) does this move from single-user to public — and does that change the data model (auth, privacy of brews, etc.)?

## 12. Milestones (proposed)

| Phase | Scope |
|---|---|
| M1 | Structured brew logging form + save/view history (no photo yet) |
| M2 | Photo capture/upload attached to brews |
| M3 | Social share card generation + share flow |
| M4 | Polish, presets for equipment/beans, filtering in history |
| M5 (future) | Public release readiness: auth, mobile app/PWA |
