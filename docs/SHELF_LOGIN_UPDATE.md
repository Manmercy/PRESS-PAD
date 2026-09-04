# Shelf and Login update

- Shelf uses uniform spine sizing, white title/artist labels, compact cover thumbnails, and 12 stable track-specific colors. All spine colors meet 4.5:1 contrast with white. Catalog numbers remain stable when collection order changes. Mobile keeps a horizontal scrollable shelf with visible focus and touch-sized tape buttons.
- Login still requests audible, looping playback immediately at 18% volume. The supplied music file is present and its MP3 metadata is readable.
- Browser autoplay restrictions cannot be overridden by page code. The later diary update replaces the blocked-state instruction with `BGM / AUTO`. Click/tap and keyboard activation retry playback without exhausting retries after the first interaction. Explicit OFF is respected. Late autoplay completion cannot leak into Home. Media loading failures show RETRY, distinct from permission blocking.
- Behavior covered with unit media doubles, asset checks, and the existing regression suite. This does not prove audible autoplay is allowed by an individual browser's settings or verify rendered layout visually.
- No wallet, Shelf, login data, or original audio is reset or modified by this update.

Reference: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
