<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="Multiview icon">
</p>

<h1 align="center">Multiview — Be Omnipresent</h1>

<p align="center">
  <b>Every stream. One screen. Nothing missed.</b><br>
  Turn YouTube into a 16-screen control room: watch live streams, news and public feeds side by side,
  label every source, and keep a timestamped record of everything that happens.
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-3fb6ff">
  <img alt="Chrome 110+" src="https://img.shields.io/badge/Chrome%20%2F%20Edge%20%2F%20Brave-110%2B-10151c">
  <img alt="No dependencies" src="https://img.shields.io/badge/dependencies-0-2b8fd6">
  <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-ff4d4f">
</p>

---

Breaking news never happens on one channel. Elections, launches, storms, protests and sports finals all unfold across a dozen feeds at once. **Multiview** puts all of them on one wall, in perfect 16:9 tiles. You get proper controls on every tile, one-click capture from any YouTube page, and an observation log that remembers what you saw and when.

## ✨ Why Multiview

| | |
|---|---|
| 🧱 **A real video wall** | 2×2, 3×3 or 4×4 grids of exact 16:9 tiles. On a 4K screen, 2×2 gives you four genuine 1080p feeds. |
| ➕ **One click from YouTube** | A **+ Multiview** button sits right beside **Subscribe** on every video and live page. You can also right-click any YouTube link and choose **Add to Multiview**. |
| 🎛 **Controls on every tile** | Play/pause, ±10 s, seek, volume, mute, speed, jump-to-live, reload, open in a tab, per-tile fullscreen, and drag-to-swap. |
| 🔊 **Solo audio** | Unmute one tile and the rest go quiet. Number keys switch the audio between tiles instantly. |
| 🔴 **Live-aware** | Live-only mode refuses ordinary videos. Tiles show **LIVE** or **VOD**. Auto-add can drop newly opened live tabs onto the wall. |
| 🏷 **Label your sources** | Tag channels and sites with your own categories, for example Left, Lean Left, Center, Lean Right, Right, Liberal, Conservative, State media or Wire / Agency. An always-visible badge shows each source's category, and one click focuses a single category. |
| 📋 **Observation log** | Every tile added or removed, stream start and end, mid-stream title change, error and label change is logged with a UTC timestamp. Export it as CSV or JSON for your notes or report. |
| 🌐 **Beyond YouTube** | Paste any embeddable URL, such as a public webcam, a news player or another platform, and it becomes a tile. |
| 🪶 **Light on your machine** | A per-tile quality cap (720p by default) saves RAM and CPU, tabs you pull in are closed so nothing plays twice, and background polling pauses when the wall is hidden. |
| 🎥 **Built for capture** | Streaming view hides every control, cursor and gap, ready to use as an OBS browser or window source or on a TV. |
| 🔒 **Private by design** | No accounts, servers, analytics or tracking. Everything stays in your browser. See [PRIVACY.md](PRIVACY.md). |

## 🚀 Install

**From a release (recommended)**

1. Download the latest `multiview-vX.Y.Z.zip` from [Releases](https://github.com/Vindicator655/Multiview-Be-Omnipresent/releases) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Pin **Multiview** to your toolbar.

**From source**

```bash
git clone https://github.com/Vindicator655/Multiview-Be-Omnipresent.git
```

Then follow steps 2–4, selecting the `extension/` folder. There is no build step and nothing to install.

## 🕹 Quick start

1. Open a few YouTube live streams in normal tabs.
2. Click the Multiview icon, or press **Alt+Shift+M**. The wall opens and lists your YouTube tabs.
3. Add them from the drawer, click **+ Multiview** beside Subscribe on any video, right-click a YouTube link, or paste URLs into the top bar (several at once, space-separated).
4. Hover a tile's top edge to set its source category. Press **O** to see the log.

### Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `1`–`9` | Solo audio on that tile | `T` | Open-tabs drawer |
| `M` | Mute all | `S` | Settings |
| `P` | Play / pause all | `O` | Observation log |
| `L` | Cycle 4 → 9 → 16 tiles | `F` | Fullscreen |
| `H` | Streaming view | `?` | Help |
| `Esc` | Close panel / leave streaming view | `Alt+Shift+M` | Open Multiview (global) |

## 📚 Features in detail

**Adding sources**

- **YouTube tabs drawer**: lists your open watch, live, shorts and channel tabs, live-updating, with live/VOD status and channel names. Add one, tick several, or **Add all**. By default the source tab closes after adding; you can have it pause or keep playing instead. Ordinary videos resume at the timestamp the tab was at.
- **Paste**: video, `youtu.be`, live, shorts, `/channel/UC…` and `@handle` links. Channel links always show that channel's *current* live stream. Any other http(s) URL becomes a plain **EMBED** tile, which has the source page's own player plus reload, open-in-tab, fullscreen and remove.

**Live only / All videos**

In Live only (the default), pasted links and tabs confirmed to be ordinary videos are refused, and greyed out in the drawer. If liveness can't be determined the link is accepted with a warning. **Clear non-live** removes tiles confirmed to be ordinary videos.

**Source categories**

- Labels belong to the source: the channel for YouTube, or the site's domain for embeds. Every stream from that source therefore gets the same badge.
- Nothing comes pre-labelled. You decide what each source is. The category list is fully editable in Settings.
- Import and export labels as JSON. Import accepts a file exported from Multiview, or a simple map such as `{"Channel name": "Category", "news-site.com": "Category"}`. That lets you bring in ratings from a media-bias source you trust.
- **All sources ▾** in the top bar focuses one category, or Unlabelled. Other tiles dim and the drawer is filtered.

**Observation log**

Records `viewer opened`, `added`, `removed`, `replaced`, `playing`, `ended`, `title changed`, `error`, `controls fallback`, `label` and imports. Each entry has a UTC timestamp, tile number, source, category, title and URL. The latest 2,000 entries are kept locally. CSV export neutralises spreadsheet formula injection from untrusted stream titles.

**Settings** (`S`)

Solo audio, auto-add live tabs, pin or float the bar, gaps, source badges, **max quality per tile** (360p, 480p, 720p, 1080p or Auto), categories, label import/export, Reload all, Clear screen / Clear non-live, and a live readout of tile size in device pixels.

## 🖥 True 1080p tiles on a 4K screen

1. Set browser zoom and OS display scaling to **100%**.
2. In Settings, set **Max quality per tile** to **1080p** or **Auto**.
3. **Unpin the bar**, or press `F` (fullscreen always floats it), and leave Gaps off. The tile-size readout in Settings should show about 1920×1080.
4. Use a PC on HDMI 2.0 rather than a TV's built-in browser. Four 1080p streams need roughly 25–40 Mbps.

YouTube still chooses the final quality from player size and bandwidth. The setting is a ceiling, not a guarantee.

## 🔧 How it works

Multiview is a dependency-free Manifest V3 extension:

| File | Role |
|---|---|
| `extension/manifest.json` | MV3 manifest. Permissions: `storage`, `scripting`, `contextMenus`; host access to YouTube and example.com |
| `extension/background.js` | Service worker. Opens and focuses the wall, lists and probes your YouTube tabs, reads YouTube pages for live status and channel names, handles the right-click menu |
| `extension/viewer.js` / `viewer.css` | The wall itself: tiles, player control, labels, log, settings |
| `extension/inject.js` | Adds the **+ Multiview** button beside Subscribe on watch and live pages |
| `scripts/make-icons.js` | Regenerates the icons (`node scripts/make-icons.js`) |

**Why the wall lives at `example.com/#multiview`.** YouTube refuses to play embeds requested from a `chrome-extension://` page, which sends no `Referer` and fails with error 153. It now also refuses embeds on youtube.com itself (error 152, "self-referential"). So the extension loads the neutral, IANA-reserved `https://example.com/` and swaps its content for the wall entirely in your browser. Nothing is sent to or stored on example.com. The script only activates on that exact URL with `#multiview`.

Tile controls use the same `postMessage` widget protocol as YouTube's IFrame API, because remote scripts can't be loaded in MV3. If a player doesn't answer within 15 s, that tile switches to YouTube's own controls and the switch is logged.

## ⚠️ Known limitations

- Videos with embedding disabled show an error on the tile, with an **Open in tab** button.
- Embedded players can show ads, and a Skip button may sit under the bottom bar. Use ↗ or move the pointer off the bar.
- Live status and channel names are read from YouTube's own pages and player. If YouTube changes those, the status shows as unknown and the link is still accepted. Use All videos mode to bypass the check.
- `@handle` resolution can fail behind consent screens, for example in some EU regions.
- Plain embeds only work where the site allows framing.

## 🤝 Contributing

Issues and pull requests are welcome. CI syntax-checks every script and verifies that every file the manifest references exists. Pushing a tag `vX.Y.Z` that matches the manifest version publishes a release zip automatically.

## 📄 License & disclaimer

[MIT](LICENSE) © 2026 Soham.

Multiview is an independent project and is not affiliated with, endorsed by or sponsored by YouTube or Google. YouTube is a trademark of Google LLC. Videos are played through YouTube's official embedded player and remain subject to [YouTube's Terms of Service](https://www.youtube.com/t/terms). Source categories are labels you assign yourself, and the extension makes no claims about any outlet.
