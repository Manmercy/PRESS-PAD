# Player and demo purchases

- The main player uses the supplied blue player image from `Cassete Player`, converted to WebP without modifying the original. Machine and cassette share one proportional coordinate system; the cassette docks into the image's actual bay. The assembly is centered in the full-width player stage on desktop and mobile.
- Existing Shelf entries remain owned. Previously saved data is migrated on first purchase. The original starter collection is retained for a device without saved data; use Reset to test an empty collection.
- The demo wallet starts at $100. Every unowned Common tape costs $1. Buying adds it to Shelf and persists wallet and ownership in one local-storage value. Repeat purchases do not charge twice. All app playback entry points require ownership. Login background music remains the existing free ambience.
- Reset Local Data has a confirmation. It empties Shelf, restores $100, removes legacy PRESS//PAD shelf/daily records, stops audio and reloads to Login. It does not clear unrelated applications' storage. No actual user data was reset during implementation or tests.
- Mobile Settings is available only from bottom navigation; the duplicate header control is hidden at the mobile/tablet navigation breakpoint.

This is a local prototype using simulated credits, not a real payment service or secure media paywall. Audio files remain public static assets, and browser storage is user-editable. Real purchases require a trusted server, payment integration and protected media delivery. No real charges are made.

Tests cover $100 initialization, $1 purchases, duplicate/insufficient-funds handling, persistence, migration, storage failure, playback blocking, and confirmation-scoped reset. Browser visuals and audible playback have not been automatically tested.
