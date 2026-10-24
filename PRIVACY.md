# Privacy policy — Multiview: Be Omnipresent

_Last updated: 25 October 2026_

Multiview has no servers, accounts, analytics or tracking. Nothing you do in it is sent to the developer or to any third party.

## What is stored, and where

All of the following is kept only in your browser (`chrome.storage.local`) and never leaves it:

- your layout and settings (grid size, mode, audio and bar preferences)
- the videos and URLs currently on your wall
- the source categories you define and the labels you assign to channels or sites
- the observation log (latest 2,000 entries)

Uninstalling the extension deletes all of it. You can also clear labels and the log at any time from Settings and the Log panel. Exports (CSV or JSON) are files you save yourself; the extension never uploads them.

## Network requests the extension makes

- **YouTube** (`youtube.com`, `i.ytimg.com`): embedded players for the tiles you add, video thumbnails in the tab drawer, and reading a video's or channel's public watch or channel page to learn its live status, title and channel name. These requests go to YouTube just as if you had opened the page yourself, so YouTube's own privacy policy applies to them.
- **example.com**: the viewer page is loaded from `https://example.com/#multiview` and its content is replaced locally (see the README for why). Nothing is sent to example.com beyond that normal page load.
- **Any URL you add as an embed**: loaded in a tile exactly as you entered it.

## Permissions and why they are needed

| Permission | Used for |
|---|---|
| `storage` | Saving your settings, wall, labels and log locally |
| `scripting` | Reading live status, channel name and playback position from your open YouTube tabs, and pausing a tab when you move its video to the wall |
| `contextMenus` | The right-click **Add to Multiview** menu on YouTube links and pages |
| Host access to `youtube.com` / `youtu.be` | The **+ Multiview** button on watch pages, listing your YouTube tabs, and reading public video and channel pages |
| Host access to `example.com` | Hosting the viewer page |

## Contact

Questions or concerns: open an issue at https://github.com/Vindicator655/Multiview-Be-Omnipresent/issues
