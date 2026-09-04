# Recent Broadcasts

Radio history is a three-column table: broadcast date, cover, and tape details. Dates are sorted newest first. Each row uses the release's canonical cover and shows its title, artist, genre, duration, and current ownership or $1 demo purchase status. Clicking the row or activating its title button opens the existing tape flow; the purchase-before-play guard remains unchanged.

On narrow screens, each date heads a row with cover and details underneath, without horizontal scrolling. Native table semantics are retained with explicit roles when the mobile layout uses CSS grid.

The original prototype had four history tracks but no broadcast dates. `window.PRESSPAD_BROADCASTS` in `data/catalog.js` now contains an explicitly labeled demo schedule (31 August–3 September 2026), not verified past broadcasts. Replace those records with actual dates when available. Dates are independent of purchases, browser time zone, local wallet, and Reset Local Data; opening the page does not shift the schedule.

No Radio background, signal-ring alignment, audio asset, wallet balance, or existing purchase was changed by this update. Tests validate the rendering and data contract; browser visual QA was not requested.
