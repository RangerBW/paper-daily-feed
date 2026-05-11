<div align="center">
  <a href="https://github.com/nehSgnaiL/paper-daily-feed" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./docs/email_header_example-dark.svg" />
      <source media="(prefers-color-scheme: light)" srcset="./docs/email_header_example.svg" />
      <img alt="paper-daily-feed" src="./docs/email_header_example.svg" width="700"/>
    </picture>
  </a>
</div>

<div align="center">
  <a href="https://github.com/nehSgnaiL/paper-daily-feed"><img alt="Last update" src="https://img.shields.io/github/last-commit/nehSgnaiL/paper-daily-feed?label=Last%20update&style=flat-square" /></a>
  <a href="https://github.com/nehSgnaiL/paper-daily-feed/actions/workflows/daily.yml"><img alt="Success feeds" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Frepos%2FnehSgnaiL%2Fpaper-daily-feed%2Factions%2Fworkflows%2Fdaily.yml%2Fruns%3Fstatus%3Dsuccess&query=%24.total_count&label=Success%20feeds&color=success&style=flat-square" /></a>
  <a href="https://github.com/nehSgnaiL/paper-daily-feed/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/nehSgnaiL/paper-daily-feed?style=social" /></a>
  <a href="https://github.com/nehSgnaiL/paper-daily-feed/network/members"><img alt="GitHub forks" src="https://img.shields.io/github/forks/nehSgnaiL/paper-daily-feed?style=social" /></a>
</div>

> The AI era's paper boom is exhausting to track. Stop endlessly chasing new papers, and let [`paper-daily-feed`](https://github.com/nehSgnaiL/paper-daily-feed) curate daily summaries personalized for your vibe.

<h1>paper-daily-feed</h1>

[English](./README.md) | [简体中文](./README.zh-CN.md)

**Smart daily feeds** tailored to your research interests or Zotero library. Get the latest, most relevant papers **delivered straight to your inbox**. 100% cloud-based, **free**, **no installs**, and quick to set up.

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/email_render_example-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="./docs/email_render_example.svg" />
    <img alt="paper-daily-feed" src="./docs/email_render_example.svg" width="650"/>
  </picture>
</div>
<div align="center">
<i>Preview for daily feeds.</i>
</div>

---

<h2>Get started</h2>

Setup takes just a few minutes on GitHub. All you need to do is fork the repo, add your credentials, and turn the workflows on!

- [1. Fork the Repository](#1-fork-the-repository)
- [2. Create Secrets](#2-create-secrets)
- [3. Create Variable](#3-create-variable)
- [4. Enable workflow \& Done](#4-enable-workflow--done)

### 1. Fork the Repository

To get started, create your own copy of this project:

1. Click here to [**Fork the repository**](https://github.com/nehSgnaiL/paper-daily-feed/fork).
2. Choose your personal GitHub account as the destination and click **Create fork**.

### 2. Create Secrets

Some features (like sending emails, using AI, or connecting to Zotero) need passwords or API keys to work. To keep this sensitive data perfectly safe, we will store them as GitHub **Secrets**.

1. Go to your repository's [Actions Secrets page](../../settings/secrets/actions) (or click **Settings ⚙️** → **Secrets and variables** → **Actions**). 
2. Make sure you are on the **Secrets** tab (it should be selected by default).
3. Click the green **New repository secret** button to create the credentials you need from the list below:

| Secret Name | Example of Secret Value | Description | Note |
| --- | --- | --- | --- |
| `RECEIVER` | `reader@example.com` |  Email address for **receiving** feeds. | :email:`Required` |
| `SENDER` | `example@qq.com` |  Email account used to **send** feeds. Suggest using a dedicated/secondary account. | :email:`Required` |
| `SENDER_PASSWORD` | `app-password-or-token` | The **password (or APP Password / Auth Code)** for the sender email. <br><br>Many providers require a special app password. Check the guides here: [QQ Mail](https://wx.mail.qq.com/list/readtemplate?name=app_intro.html#/agreement/authorizationCode), [Gmail](https://developers.google.com/workspace/gmail/imap/imap-smtp), [163 Mail](https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f67ac2a5feb28b66796d3b), [Outlook](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040).  | :email:`Required` |
| `SMTP_SERVER` | `smtp.example.com` |  SMTP server for sending email. Check the above docs. | :email:`Required` |
| `SMTP_PORT` | `465` |  Corresponding SMTP server port. Check the above docs. | :email:`Required` |
| `ZOTERO_ID` | `1234567` | Set it when using Zotero Library.<br><br> Get `ZOTERO_ID` under the button `Create new private key` in [Zotero Settings](https://www.zotero.org/settings/security#applications). See [Zotero API Key Guide](https://oeysan.github.io/c2z/articles/zotero_api.html#step-1-locate-zotero-settings). | :closed_book:`Recommended` |
| `ZOTERO_KEY` | `zotero-api-key` | Corresponding Zotero API key. <br><br> Get `ZOTERO_KEY` by creating a new key with appropriate permissions (at least "Read" access) in [Zotero Settings](https://www.zotero.org/settings/security#applications). See [Zotero API Key Guide](https://oeysan.github.io/c2z/articles/zotero_api.html#step-2-create-a-key). | :closed_book:`Recommended` |
| `OPENAI_BASE_URL` | `https://api.siliconflow.cn/v1` | The URL for an AI API to generate TLDR summaries. (If left blank, standard paper abstracts are used). <br><br> *Tip: Get a free API at [SiliconFlow](https://cloud.siliconflow.cn/i/p9BtMTtU) to use open source LLMs (e.g., `Qwen/Qwen3-8B`).* | :robot:`Recommended` |
| `OPENAI_API_KEY` | `sk-...` | Set corresponding API key if you use API for TLDR summaries. | :robot:`Recommended` |
| `EMBEDDING_BASE_URL` | `https://api.openai.com/v1` | Custom API for text matching. **Generally, leave this empty.** The built-in local model works fine on its own. | :computer:`Optional` |
| `EMBEDDING_API_KEY` | `sk-...` | Set corresponding key if you use Embeddings API for text matching. | :computer:`Optional` |

### 3. Create Variable

Next, we need to add your settings. Because this isn't sensitive data (like a password), we will add it as a **Variable** instead of a Secret.

1. Go to your repository's [Actions Variables page](../../settings/variables/actions) (or click **Settings ⚙️** → **Secrets and variables** → **Actions**, then make sure to click the **Variables** tab).
2. Click the green **New repository variable** button.
3. For the **Name**, type exactly: `APP_CONFIG`
4. For the **Value**, paste your configuration (like the example below). 
   
   **Example `APP_CONFIG` value:**

    ```json5
    {
      "interests": {
        "profile": {
          // Enable profile as an interest source
          "enabled": true,  
          // A short summary of your research interests
          "summary": "Urban mobility, transport equity, and climate adaptation." 
        },
        "zotero": {
          // Optional: Set to true to enable Zotero
          "enabled": false,  
          // Optional: Only include papers from these path(s) in your Zotero library. Leave empty to include all.
          "includeCollections": ["2026/survey/**", "example/"],  
          // Optional: Exclude papers from specific paths
          "excludeCollections": ["archive/**"]  
        }
      },
      "summary": {
        // Optional: Enable AI-generated TLDR summaries for your papers
        "enabled": false,
        // Set your AI model if TLDR is enabled. Leave empty to default to gpt-4o-mini.
        "model": "Qwen/Qwen3-8B",
        // Output language for TLDRs
        "language": "English",
      },
      "matching": {
        // Maximum number of papers to recommend
        "paperLimit": 10,
        // Minimum relevance score for a paper to be sent
        "minScore": 0.35
      },
      "feeds": {
        // Select specific journals from data/journals.config.ts, or leave Empty to include all.
        "catalogSelections": [],
        // Optional: add custom RSS feeds with name and URL here
        "customRss": [
          // {
          //   "name": "Example Lab Feed",
          //   "rss": "https://example.test/feed.xml"
          // },
        ]
      },
    }
    ```

> [!TIP]
> **Customizing your sources:** 
> You can use your Textual profile, Zotero, or both! The example above shows a minimal setup. To turn a source on, just change `"enabled": false` to `true`.
> 
> **Need more options?** See the [Customization](#customization) section for advanced settings.

### 4. Enable workflow & Done

GitHub pauses automated tasks in forked repos by default. Let's turn them on:

1. Go to the ▶️ [**Actions**](../../actions) tab at the top of your repository, and click the green button `I understand my workflows, go ahead and enable them`.
2. **Enable daily feeds:** Click [**Daily paper feeds**](../../actions/workflows/daily.yml) in the left sidebar, then click `Enable workflow` (right top).
3. **Enable auto-updates:** Click [**Repository maintenance**](../../actions/workflows/maintenance.yml) in the left sidebar, and click `Enable workflow`.
4. **Run test:** Click [**Test paper feeds**](../../actions/workflows/test.yml) in the left sidebar. Click the **Run workflow** dropdown on the right, then hit the green button **Run workflow**.

**Done!** 😄 If the test passes ✅, you'll get a short email. You will now receive automated daily emails, and you can manually run the [**Daily paper feeds**](../../actions/workflows/daily.yml) workflow anytime to get an instant update.

---

<h2>Feedback</h2>

Any issues, questions, or experience could be shared via [raising issue](https://github.com/nehSgnaiL/paper-daily-feed/issues/new/choose) in the repository.

<h2 id="customization">Customization</h2>

> [!TIP]
> - **More customization:** Check out the full template in [`config/app.example.jsonc`](./config/app.example.jsonc) to see all the extra parameters you can add.
> - **Protect your data:** Always keep passwords and API keys in **Secrets** (from [Step 2](#2-create-secrets)), never directly in your `APP_CONFIG`.
> - **Changing the daily email time:** By default, emails are sent at 06:11 UTC+8 (22:11 UTC). To change this, edit the `cron: '11 22 * * *'` line in [`.github/workflows/daily.yml`](./.github/workflows/daily.yml) using the ✏️ [**pencil icon**](../../edit/main/.github/workflows/daily.yml). (Use [crontab.guru](https://crontab.guru/) to easily generate the correct `cron` time format!)

> [!NOTE]
> **Keeping your fork active and updated:**
> * **Staying active:** A monthly [maintenance workflow](../../actions/workflows/maintenance.yml) runs automatically to keep GitHub from pausing your daily emails.
> * **Auto-updates:** Every month, the forked repository will try to update for latest features and bug fixes. If you have changed any files, it will safely skip the auto-update!

<h2>Local Run</h2>

Local setup is optional. Use it only if you want to preview or customize the feed on your local device.
<details close>
  <summary>Local setup instructions</summary>

```bash
# Install dependencies
npm install

# Copy the examples, then edit them for your account and interests
cp .env.example .env.local
cp config/app.example.jsonc config/app.jsonc

# Optional: print a starter profile block to paste into config/app.jsonc
npm run setup-profile

# Test
npm run test:config
npm run preview-email
npm run test:feeds:live

# Run
npm start -- run
```

For local development, keep non-secret app settings in `config/app.jsonc` and secrets in `.env.local`.


CLI modes:

- `run`: fetch, match, summarize if enabled, render, and send.
- `preview-email`: fetch, match, render HTML, and print it without sending.
- `setup-profile`: print a starter profile JSON fragment.
- `test-config`: validate that `APP_CONFIG`, `config/app.jsonc`, or `config/app.json` can load.

Other scripts:

- `test:feeds:live`: smoke-test the current bundled publisher feeds against live RSS. Default tests use fixtures and do not require network access.

</details>

<h2>Reference</h2>

Inspired by [TideDra/zotero-arxiv-daily](https://github.com/TideDra/zotero-arxiv-daily).
