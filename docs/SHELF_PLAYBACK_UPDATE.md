# Player entrance and Play Shelf

- Media Player opens with a short fade/slide/scale entrance, a softly fading backdrop, and staggered deck and controls. The deck and tape animate as one assembly, preserving their alignment. Existing insertion animations and supplied player image are unchanged. Reduced-motion settings suppress entrance motion.
- Play Shelf snapshots the current owned tapes in Shelf order and plays once through, starting directly from the user's click. The same button pauses/resumes and displays the current position. Global and Media Player playback controls also pause/resume the same audio.
- When a track ends, the next owned tape starts and the visible player's artwork updates. Closing the dialog does not stop music or cause it to reopen automatically on the next song. Removed/unowned tracks are skipped, and the queue stops after the final tape. New acquisitions enter the next Play Shelf session, not an already-running queue.
- Manually playing another tape, ejecting, logout, reset, or an audio loading error exits the queue. Browser-denied playback preserves a resumable queue. No queue, wallet, ownership, or diary data is persisted by playback alone.
- Validation includes actual handler unit tests for order, pause/resume, auto-next, ownership checks, manual selection, closed-dialog behavior, queue completion, and delayed playback. Visual browser/device testing was not performed.

## GitHub upload

Use the prepared `press-pad-v0.1.2-github-lite` folder, not the entire working folder containing source images, multiple versions and ZIP archives. Extract the supplied ZIP and upload the folder's contents, keeping `index.html` at the repository root. ZIP files are not extracted by GitHub Pages.

GitHub browser uploads allow up to 25 MiB per file and 100 files at a time; the project's separate conservative budget keeps the whole Lite folder below 25 MB. These are different limits. Checked against https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository on 2026-09-04. Existing repository rules and branch permissions may still affect uploads.
