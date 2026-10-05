# Cuevaro UX and UI System

Status: Product-definition baseline  
Audience: product, design, engineering, QA, support, security, marketing  
Principle: Cuevaro should feel lighter than the administrative burden it removes.

## 1. Experience thesis

Cuevaro is not a document vault with an AI button attached. It is a quiet lifecycle assistant for real-world obligations.

The best Cuevaro interaction is often:

1. The user captures or forwards something they already have.
2. Cuevaro understands enough to propose a useful record.
3. The user confirms only uncertain or high-consequence facts.
4. Cuevaro stays quiet.
5. Cuevaro resurfaces the item only when the timing or state makes it useful.
6. When action is required, Cuevaro prepares the next step and preserves evidence that it was completed.

The product should minimize:
- forms,
- category decisions,
- manual reminder creation,
- repetitive typing,
- navigation depth,
- notification noise,
- unexplained AI confidence,
- "dashboard guilt."

The product should maximize:
- immediate value from one capture,
- clarity,
- recoverability,
- provenance,
- user control,
- predictable behavior,
- calmness,
- confidence.

## 2. North-star UX promise

**"Give it to Cuevaro once. It will bring back what matters when it matters."**

This promise is only valid when Cuevaro can show what it knows, why it believes it, when it will act, and what remains uncertain.

## 3. Information architecture

### Primary navigation for V1

Use no more than five persistent top-level destinations:

1. **Home**
   - calm summary,
   - items requiring attention,
   - upcoming cues,
   - recently captured,
   - unresolved confirmations,
   - no vanity activity feed.

2. **Capture**
   - camera,
   - photo/library,
   - PDF/document,
   - barcode,
   - manual add as fallback,
   - later: share sheet, forwarded email, voice.

3. **Things**
   - purchases,
   - products,
   - documents and evidence,
   - search and filters,
   - not a folder maze.

4. **Timeline**
   - upcoming return windows,
   - warranty expiries,
   - maintenance,
   - renewals,
   - due actions,
   - completed lifecycle history.

5. **You / Settings**
   - household and sharing,
   - notification preferences,
   - privacy and security,
   - export/delete,
   - billing,
   - regional preferences.

On small screens, Capture may be a prominent central action rather than a normal tab.

### Do not create top-level tabs for every category

"Home", "Auto", "Family", "Documents", "Warranties", "Subscriptions" can become views, filters, or later modules. They should not turn the app into a cabinet of mini-apps.

## 4. Core interaction patterns

### 4.1 Capture-first

Default entry should answer: **"What do you have?"**, not **"What type of record would you like to create?"**

Camera flow:
1. Live document edges when possible.
2. Capture one or multiple images.
3. Offer "add another side/page".
4. Begin background extraction immediately.
5. Show concise progress without theatrical AI animation.
6. Present a confirmation sheet.

### 4.2 Confirmation sheet

The confirmation screen is one of Cuevaro's most important surfaces.

It should show:
- what Cuevaro thinks the thing is,
- key facts extracted,
- which facts are uncertain,
- what Cuevaro proposes to watch,
- any external policy facts with source and checked date,
- what data will be saved.

Example:

> **Panasonic window air conditioner**  
> Bought Oct 5, 2026 at ABC Appliance for PHP 29,995  
> Receipt: attached  
> Return window: 7 days, source: retailer policy checked Oct 5  
> Warranty: 1 year parts, 5 years compressor, source confidence: needs confirmation  
> Proposed cues: return deadline, warranty expiry, maintenance check

Buttons:
- **Looks right**
- **Review 2 uncertain fields**

Do not force users through every extracted field if most are reliable.

### 4.3 Confidence UI

Confidence is not a raw percentage exposed everywhere.

Use three user-facing states:
- **Confirmed** - user-confirmed or authoritative evidence supports the fact.
- **Likely** - system has good evidence but needs user confirmation for consequential use.
- **Unknown** - Cuevaro does not know.

Never display guessed data as confirmed.

For high-consequence facts, confidence rules should be stricter:
- return deadline,
- warranty end,
- renewal/cancellation date,
- government document expiry,
- payment due date,
- coverage eligibility.

### 4.4 "Unknown" is a successful state

If Cuevaro cannot determine a return policy, it should say:

> **Return deadline not confirmed.**  
> I found conflicting or incomplete policy information.

Then offer:
- review source,
- enter deadline,
- remind me to check later.

Inventing a date is worse than being incomplete.

### 4.5 Evidence drawer

Every important fact should be traceable.

A tap on "Why?" should show:
- source image or source excerpt,
- source URL where applicable,
- extraction or lookup time,
- user correction history,
- whether the fact is direct or derived.

This should be understandable to ordinary users, not an audit-log dump.

### 4.6 Action cards

Cuevaro should not end at a red badge.

A cue should answer:
- What happened?
- Why does it matter?
- What can I do?
- What happens if I ignore it?

Example:

> **Return window closes in 2 days**  
> Samsung monitor, PHP 18,995  
> Bought at Store X  
>  
> [Keep] [Start return] [Remind tomorrow]

"Start return" can prepare:
- receipt,
- item details,
- store policy,
- draft message,
- checklist,
- relevant links.

The user remains the actor unless Cuevaro has explicit permission and an integration supports the action safely.

## 5. Home screen design

### Empty state

Do not present an empty dashboard.

Use one clear call to action:

> **Add something you do not want to think about later.**  
> Snap a receipt, product label, warranty card, or document.

Show 3 compact examples, not 12 category tiles.

### Normal state

Hierarchy:
1. Needs attention now.
2. Upcoming within a meaningful window.
3. Waiting / watched.
4. Recent captures.

If nothing needs attention:

> **Nothing needs you today.**

This is a success state, not an empty problem.

### Attention budgeting

The app should cap visual urgency. Red is reserved for genuinely urgent or failed states. Yellow/amber for upcoming. Neutral for background watch.

A user with 100 items should not see 100 badges.

## 6. Search and retrieval

Search should support natural concepts:
- "aircon receipt"
- "things whose warranty ends this year"
- "what did I buy from Abenson?"
- "serial number of washing machine"
- "documents expiring in December"

V1 can begin with deterministic metadata search plus extracted text. Semantic/natural-language search can follow after access control and audit behavior are robust.

Search results should group:
- thing,
- evidence,
- lifecycle status,
- next cue.

## 7. Timeline

The Timeline is a lifecycle view, not another calendar clone.

Views:
- Next 30 days,
- Later,
- Completed,
- By thing.

Events:
- purchased,
- return deadline,
- warranty start/end,
- maintenance due/completed,
- renewal/cancellation window,
- claim started/completed,
- document expiration,
- user-confirmed actions.

Do not duplicate the full calendar. Offer export/sync for users who want calendar integration.

## 8. Item page

Every tracked "Thing" should have:

### Header
- human-friendly name,
- optional photo,
- status,
- next important event.

### Essentials
- purchase/issue date,
- merchant/issuer,
- amount if relevant,
- model/serial,
- category,
- owner/household.

### What Cuevaro is watching
- return,
- warranty,
- maintenance,
- renewal,
- expiry,
- other obligations.

### Evidence
- receipt,
- warranty card,
- product label,
- email/PDF,
- policy source.

### History
- original capture,
- user edits,
- cues sent,
- action outcomes,
- service/claims.

### Actions
- claim,
- return,
- service,
- renew,
- export proof,
- share,
- archive/delete as appropriate.

## 9. Progressive disclosure

Do not show advanced controls until needed.

Example:
- Default cue schedule is sensible.
- "Customize timing" reveals schedule details.
- Default lifecycle relationships are automatic.
- "Show evidence" reveals provenance.
- Advanced export/security controls live in Settings.

This keeps Cuevaro usable by ordinary consumers while preserving expert control.

## 10. Visual direction

### Brand feeling
- calm,
- capable,
- warm,
- modern,
- trustworthy,
- not corporate,
- not childish,
- not neon "AI".

### UI style
- generous spacing,
- large readable type,
- soft hierarchy,
- restrained iconography,
- minimal card nesting,
- photos/document thumbnails where they help,
- no glassmorphism dependency,
- no decorative charts on consumer home.

### Motion
Motion should communicate:
- capture completion,
- successful linking,
- cue resolved.

Avoid:
- long AI "thinking" animations,
- celebratory confetti for administrative chores,
- motion that blocks progress.

Respect reduced-motion settings.

## 11. Accessibility

Target WCAG 2.2 AA where applicable for web surfaces and equivalent mobile accessibility practices.

Requirements:
- screen-reader names for every actionable control,
- logical focus and reading order,
- keyboard navigation on web,
- dynamic type/text scaling,
- color contrast independent of color-only meaning,
- sufficiently large touch targets,
- captions/transcripts for any instructional video,
- error messages associated with fields,
- reduced-motion support,
- accessibility testing with VoiceOver and TalkBack before release.

Scan/camera flows need text alternatives and accessible post-capture editing.

## 12. Localization and region

Cuevaro's administrative truth is region-dependent.

The UX must represent:
- locale,
- currency,
- date format,
- time zone,
- policy jurisdiction,
- merchant region,
- language.

Do not assume US return policies, date formatting, warranty law, tax language, or government-document behavior.

Initial commercial launch should deliberately support a small number of regions rather than pretending global policy knowledge is universal.

## 13. Household and sharing UX

Sharing is object-scoped, not all-or-nothing.

Roles:
- Owner,
- Household Admin,
- Contributor,
- Viewer.

A user can share:
- one item,
- one category/view,
- a household,
- a temporary evidence bundle.

UI must make it obvious:
- who can see what,
- who can edit,
- who receives cues,
- when access expires,
- what happens when someone leaves the household.

Sensitive items should support additional confirmation before sharing.

## 14. Privacy UX

Privacy cannot be buried.

At capture:
- explain whether cloud processing is needed,
- give a clear state when extraction requires server processing,
- avoid silent use of uploaded personal content for unrelated purposes.

Settings:
- download/export my data,
- delete individual evidence,
- delete account,
- connected services,
- AI processing controls if product design supports choices,
- household access,
- notification previews.

Notification previews should avoid displaying sensitive details on lock screens by default.

## 15. Error and recovery design

Every automated operation must have a recoverable failure state.

Examples:
- blurry image → retake or use anyway,
- extraction uncertain → review highlighted fields,
- policy lookup unavailable → save item and retry later,
- notification permission denied → show in-app cues and explain optional setup,
- duplicate item detected → merge/review,
- offline → queue capture locally and clearly show pending sync,
- upload failure → preserve local capture until user retries or discards,
- expired shared link → clear request-access path.

Never lose a user's only evidence because processing failed.

## 16. Notification philosophy

Cuevaro is not a notification generator.

Rules:
- notify only when action or awareness is useful,
- bundle low-priority events,
- escalate only by rule,
- respect quiet hours,
- make every cue actionable,
- let users snooze with context,
- stop reminders when the lifecycle closes,
- avoid guilt language.

Example cadence for a return deadline might be:
- once when deadline is confirmed,
- 3 days before,
- 1 day before only if unresolved.

Cadence is configurable and category-aware.

## 17. Onboarding

Goal: time-to-first-value under 90 seconds for a typical clean receipt.

Do not start with:
- questionnaire,
- category setup,
- household configuration,
- tutorial carousel.

Suggested:
1. Brand promise.
2. Privacy summary.
3. "Snap your first receipt."
4. Confirmation.
5. Show future cues created.
6. Ask for notification permission only after demonstrating why it matters.

Household setup and optional integrations come later.

## 18. Design-system primitives

Required components:
- CaptureButton
- EvidenceThumbnail
- FactRow with status/provenance
- ConfidenceBadge
- CueCard
- ActionCard
- TimelineEvent
- SourceChip
- HouseholdAvatar/Role
- EmptyState
- ErrorRecoveryPanel
- PermissionExplainer
- SensitiveValue
- ConfirmationSheet
- MergeDuplicateSheet
- ExportBundlePreview

Maintain a small component library and token system for typography, spacing, radii, elevation, semantic states, motion duration, and breakpoints.

## 19. UX metrics

Track privacy-respecting product metrics:
- time to first captured item,
- capture-to-confirm completion,
- manual fields required per successful capture,
- percent of captured items producing at least one useful consequence,
- uncertain fact review rate,
- correction rate,
- duplicate/merge rate,
- cue open rate,
- cue resolution rate,
- false/annoying cue dismissal reason,
- lifecycle completion rate,
- return/warranty/renewal actions prepared,
- notification opt-in after first value,
- 30/90 day retained households.

Do not optimize for time-in-app. Lower time-in-app can be success.

## 20. Anti-patterns

Cuevaro must not become:
- a 30-tab super-app,
- a productivity dashboard full of red badges,
- a chat interface with no structured records,
- an AI system that speaks confidently without evidence,
- a file explorer requiring folders,
- an app that demands complete data before helping,
- a paywall on access to user's own uploaded documents,
- a form builder disguised as convenience,
- a generic calendar or todo clone,
- a financial/accounting system.

## 21. UX release gates

Before V1 public launch:
- 10+ representative receipt layouts captured successfully,
- offline/pending states tested,
- first-value flow usable without tutorial,
- all high-consequence facts visibly traceable,
- no destructive action without confirmation/recovery,
- account export/delete flows tested,
- VoiceOver and TalkBack primary flows pass,
- text scaling does not break critical screens,
- notification permission requested contextually,
- sensitive notification preview policy verified,
- household sharing permissions understandable in usability testing,
- median clean-receipt flow requires no more than a small number of confirmations.


## 20. Mobile-first interaction contract

Cuevaro is designed for the phone first. Desktop/web is a companion for bulk and information-dense work.

### Mobile priorities
- camera is a primary creation surface;
- share sheet/import should be one or two taps where the OS permits;
- voice can be used for supplemental context;
- typing is minimized;
- primary actions remain reachable with one hand where practical;
- important targets are thumb-sized and accessible;
- push notifications deep-link to the exact item/action;
- biometric unlock is supported for sensitive access;
- offline captures visibly queue and never masquerade as synced;
- dark mode and accessibility are product requirements, not post-launch decoration.

### Capture Quality Gate

Immediately after capture Cuevaro checks the image before normal extraction.

**Good**
> Looks good.

Continue without interrupting the user.

**Questionable**
> Some text is blurry near the bottom. I may miss warranty details.

Actions:
- **Use anyway**
- **Retake photo**

**Bad**
> This photo is too blurry to read reliably.

Primary actions:
- **Retake photo**
- **Choose another photo**

When detectable, say what is wrong: glare, cut-off edge, blur, low light, covered text, extreme angle, or low resolution.

Never show a generic technical error when Cuevaro can explain the physical capture problem.

### Contextual Quick Replies

If the assistant can predict the likely response set, show tappable answer/action chips.

Example:
> I found a 2-year warranty ending Oct 5, 2028. Track it?

Actions:
- **Track warranty**
- **Edit warranty**
- **Don't track**

Example:
> Is this receipt for your Samsung refrigerator?

Actions:
- **Yes, that's mine**
- **No**
- **Not sure**

The rule is: **do not make the user type a generic answer that can be safely expressed as a tap.**

For meaningful consequences, action labels describe the result. Prefer **Delete receipt** over **Yes**; **Keep receipt** over **No**. Sensitive, destructive, sharing, financial, or external actions require explicit consequence-aware confirmation.

Free text is always available for open-ended questions.
