# v0.1.2 artwork update

The catalog now uses one canonical Common cover per track across Discover, the opening case, cassette label, persistent playing cover, mini player, Radio history, artist pages, and Shelf. The physical cassette and player animation remain centered. The chosen cover is also shown beside the playing controls (compact artwork row on mobile). Reel motion follows audio play/pause.

The approved silver Seal mockup is visible only in the sealed stage of a new Daily tape, then removed when revealing its cover. The Radio background and Sora-aligned signal rings are unchanged; no package overlay is added back onto that background.

Artwork uses original built-in imagegen outputs directed by the project guides. Web images are compressed WebP copies at 640x800. Original PNGs and generation prompts are kept outside distribution folders, under the workspace mockups directory. Rare-specific artwork has not been generated; this update covers the Common releases.

To update an already uploaded GitHub site, upload the contents of the refreshed distribution: replace index.html, css/styles.css, js/app.js, data/catalog.js and include assets/images/releases plus assets/images/seal-package-v012.webp. The rest of the distribution may also be uploaded as a complete set. Keep index.html at the repository root. No remote repository or hosted site is changed by local editing.

Validation checks cover unique image content and shared paths, player artwork state transitions, pause/resume reels, file existence, audio integrity in distributions and Lite size. These are static and handler checks, not a browser visual test.
