# Note Timeline

**Browse classroom notes by the dates written inside them, or by recorded file activity.** Note Timeline works with ordinary Markdown notes: no daily notes, date links, frontmatter, or special syntax required.

> **Status:** v0.2.0 public beta. Tested manually in Obsidian on Windows by the original user. Android and iOS compatibility has not yet been tested. Please back up your vault before testing.

## What it does

- Recognizes plain-text dates, with selectable formats: `DD/MM/YYYY` (default), `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`.
- Finds multiple dated sections in the same note, throughout your vault.
- Offers a monthly calendar in a right side pane or a main tab.
- Lets you filter the calendar by **all notes, a folder (including subfolders), or one note**, using a searchable expandable tree inspired by Obsidian's file explorer.
- Displays a preview of the dated passage; configurable to show 1–30 lines, with an expand/collapse button.
- Opens the original note at the line of the selected date.
- Provides a separate **Modifications** view, which can be hidden in settings.
- Adds an **Insert current date** command; assign a hotkey in Obsidian's Hotkeys settings.

## Example

A normal note can contain:

```markdown
# History of Education

23/10/2026

Education in ancient Greece and the idea of *paideia*.

27/10/2026

Education in ancient Rome.
```

Select October 23 in **Written dates** to preview the first passage; select October 27 for the second. There is no need to create `[[2026/10/23]]` or separate daily notes.

## Recognizing session dates

By default, a session begins when a date occurs **on its own line**, optionally as a Markdown heading (for example `## 23/10/2026`). This avoids treating incidental dates in the middle of sentences as class sessions.

In settings, you can turn off **Only dates on their own line** to recognize valid dates anywhere in a note. In that mode, incidental dates may also split previews into sections.

Recognition formats and the format used for inserting a new date are independently configurable. Existing note contents are not rewritten.

## Calendar and reverse filter

Open the calendar using the ribbon icon or the commands **Open calendar in side panel** and **Open calendar in main tab**. Click the scope selector to browse folders and files, expand/collapse folders, or search by name. Select **All notes** to clear the filter.

- **Written dates**: colored/marked dates are found inside the filtered Markdown notes. Selecting a day shows a dated excerpt from each matching section.
- **Modifications**: shows file activity observed while the plugin is running plus the current last-modified date from filesystem metadata. It **cannot reconstruct a complete historical edit log** before installation. This tab can be hidden without deleting stored activity.

The activity history is saved in Obsidian plugin data and **is not yet conflict-safe when multiple devices synchronize and edit that data simultaneously**. Avoid relying on it as an audit trail.

## Settings

| Setting | Purpose |
| --- | --- |
| Insert date format | Format used by the Insert current date command |
| Recognize formats | Which plain-text date formats should be indexed |
| Only dates on their own line | Treat line-separated dates as session headings |
| Preview length (lines) | Initial visible preview lines (1–30) |
| Show Modifications tab | Hide/show the activity calendar |
| Rebuild date index | Rescan Markdown notes |

## Install manually (beta)

1. Install an active [Node.js LTS](https://nodejs.org/) version.
2. From the project root, run `npm install` and `npm run build`.
3. Copy **`main.js`**, **`manifest.json`**, and **`styles.css`** into `<your-vault>/.obsidian/plugins/note-timeline/`.
4. Restart Obsidian and enable **Note Timeline** under **Settings → Community plugins**.

Once a GitHub release is published, users can alternatively download those three release assets rather than building locally.

### Update

Back up your vault. Close Obsidian, replace the same three files with the new build, then reopen Obsidian. Do not delete `data.json` if you want to retain your settings and recorded activity.

## Privacy and limitations

- The plugin works locally and does not call external services.
- It reads Markdown notes in your vault to build the index; notes are not rewritten by the indexer.
- The activity feature records paths and calendar days, not line-level diffs.
- A modified file's preview cannot show the exact text changed, because Obsidian file metadata does not contain a per-line edit history.
- Historical `mtime` is only the **latest** modification timestamp known for each file.
- Folder search follows the explorer navigation pattern but does not reuse Obsidian's private native explorer component.
- Mobile support is intended (`isDesktopOnly: false`) but **still requires testing** on Android and iOS.

## Development

```bash
npm install
npm run build
```

Source code is in `src/`. `main.js` is a generated build artifact, not stored in Git. See [CONTRIBUTING.md](CONTRIBUTING.md) and [RELEASING.md](RELEASING.md).

## License

MIT. See [LICENSE](LICENSE).
