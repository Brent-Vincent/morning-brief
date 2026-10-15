# Morning Brief — personal news desk

A polished HTML news dashboard that fetches RSS headlines every morning and learns what you like. **No paid API, database, build framework, or server is needed for the starter edition.**

## What it does

- Pulls **headline + original-story link + publisher + timestamp + topic** from editable RSS feeds in `feeds.json`.
- Ranks stories using your topic priorities, **More like this / Less like this** reactions, opened headlines, publishers, keyword boosts, and freshness.
- Provides an unpersonalized **Latest** view, category filters, search, reading list, and publisher controls.
- Stores preferences in **localStorage** in the browser, which means nobody else's browser sees them and you don't need to sign up.
- Builds a static website using GitHub Actions at approximately **04:37 Asia/Jakarta time** each day and hosts it on GitHub Pages.
- Starts with **clearly labeled demonstration headlines** until the first successful live fetch. Demo titles are examples, not actual news.

## Install on your phone

Open https://brent-vincent.github.io/morning-brief/ on your phone. On iPhone, use Safari's Share menu, then **Add to Home Screen**. On Android, tap **Install app** on the page, or use Chrome's menu and choose **Install app** / **Add to Home screen**. The installed app opens in its own window. After one online visit, the last successfully loaded headlines remain available offline; reconnect to get a newer edition. This is a web app, so no app-store download is required.

## Local preview

Double-click `index.html` to preview the design with demo headlines. To use actual local news data, open a terminal in this folder:

```bash
python3 scripts/update_news.py
python3 -m http.server 8000
```

Then open **http://localhost:8000**. Python must have internet access for the first command. The scraper needs only the Python standard library (Python 3.10+). If the scraper cannot access the RSS feeds, it **does not overwrite** the demo or the last successful dataset.

To run the bundled offline tests:

```bash
python3 -m unittest discover -s tests -v
```

## Make it your real daily webpage with GitHub Pages

1. Create a **new public GitHub repository** named `morning-brief`, with `main` as its default branch. (GitHub Pages hosting on GitHub Free works with a public repository.)
2. Unzip the package. Upload **all contents** of the `morning-brief` folder into the repository, including `.github/workflows/publish-morning-brief.yml` (some file explorers hide the `.github` folder). You can also open the folder with Codex/VS Code and push the code to GitHub.
3. In **GitHub → repository → Settings → Pages**, set **Build and deployment → Source: GitHub Actions**.
4. Open the **Actions** tab and run **Publish Morning Brief** using **Run workflow**. A push to `main` also starts a build.
5. When the deployment completes, your page is at `https://YOUR-USERNAME.github.io/morning-brief/` (or the Pages URL GitHub shows you). Bookmark the page as your daily start page.
6. The GitHub Actions schedule runs at `21:37 UTC`, equivalent to **04:37 WIB the next day**, collecting fresh headlines and publishing a new static edition.

**Important reliability note:** GitHub Actions scheduled workflows are not a precision clock. They may be delayed or occasionally skipped, and scheduled workflows in some inactive public repositories can be automatically disabled. You can run the workflow manually any time. The website displays its last updated time so you can notice stale data.

**Public vs. private:** GitHub Pages is a public site in the default setup. The headlines are public RSS data; your personal feedback stays in your individual browser's localStorage (not in GitHub). Do not place private notes, passwords, or secrets into `feeds.json`, your files, or the public repository.

## Customize the content

In **Customize my feed → Appearance**, enable **High-contrast dark mode** and choose cyan, yellow, green, pink, white, or a custom color. Appearance changes save immediately on this device. Dark custom colors are brightened to keep accent text readable on the dark background.

### In the website (no code)

Click **Customize my feed** / gear icon. You can:

- enable or disable entire topics;
- set topic priorities Low / Normal / High;
- hide individual publishers;
- boost headline words or phrases;
- block words or phrases;
- hide opened items, adjust display count;
- save stories or export/import your settings to another browser.

When you choose **More like this**, the ranking learns from the headline's topic, publisher and significant words. **Less like this** moves matching stories down. Merely opening an article adds a smaller positive signal. This is **transparent rule-based personalization**, not a neural network or a claim of having trained a large AI model. The **Latest** view remains chronological.

### Add news sources, new topics and custom Google News searches (with Codex or a text editor)

Open `feeds.json` and add an item:

```json
{
  "name": "My company news search",
  "topic": "Business",
  "url": "https://news.google.com/rss/search?q=Indonesian+startups+when%3A2d&hl=en-US&gl=ID&ceid=ID:en"
}
```

Or add a direct RSS feed from any publisher. This edit changes the **next published dataset**; a keyword boost in the website only ranks already collected stories. You can use the free online Google News RSS format, but Google does not provide a formal public guarantee that this feed format will never change. Publisher RSS feeds may be more stable.

## Using Codex

1. Install/open Codex (or the Codex extension for your editor). Open the unzipped `morning-brief` project folder.
2. Ask Codex to make your changes. Example:

> You are working on my Morning Brief project. Keep it as a small HTML/CSS/JavaScript + Python RSS news dashboard. Add a "Film Production" category by updating feeds.json with credible RSS feeds or Google News topic searches. Let me turn the category on or off in settings. Keep the existing personalized ranking and localStorage privacy design. Run the Python parser tests and check the JS syntax. Do not introduce a paid API or any secrets.

3. Review what Codex changed and commit/push to `main` to republish the site.

Codex can help with coding, design revisions, additional feeds, and new features. **Codex is a development tool; it does not itself host your webpage or run the nightly news fetch.** GitHub Pages and Actions handle those tasks.

## File map

```
index.html            HTML dashboard
styles.css            design/responsive layout
app.js                filtering, reading list, personalization and preferences
feeds.json            the sources, search feeds and categories to collect
scripts/update_news.py   RSS/Atom fetcher (Python standard library)
data/headlines.json   clearly marked demonstration stories (overwritten on live build)
.github/workflows/publish-morning-brief.yml   daily fetch + publish automation
tests/test_update_news.py   offline feed-parser tests
```

## Next versions you may want

- **Cross-device memory / accounts:** Supabase or an authenticated backend so your preferences sync from your computer to your phone. localStorage is device/browser-specific.
- **AI-powered summaries:** the OpenAI API could produce one- or two-sentence summaries *if* a legal/licensed article text source is available. Headlines alone are not enough for trustworthy article summaries. Show direct source links, date, and publisher.
- **More trustworthy ranking:** group duplicate coverage of the same story, include multiple perspectives, and retain some nonpersonalized headlines so your feed doesn't become an echo chamber.
- **Private site:** choose access-controlled hosting rather than a public GitHub Pages URL.
- **More exact publishing schedule:** choose a dedicated cron service with retries and uptime monitoring if morning freshness must be guaranteed.

## Respect publishers

The starter stores and presents RSS **headlines and links only**, rather than copying full articles. Individual feeds have their own terms and rights: check the publishers' usage rules if you plan to make this a business or public product. Some links collected from Google News may go through Google News rather than directly to the publisher.
