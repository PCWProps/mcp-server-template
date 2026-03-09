# Setting Up GitHub Discussions

This guide explains how to configure GitHub Discussions for the MCP Server Template repository to foster a welcoming community.

## Enabling Discussions

1. Go to the repository **Settings** tab.
2. Scroll to the **Features** section.
3. Check **Discussions** to enable the feature.
4. Click **Save changes**.

## Recommended Categories

Create the following discussion categories after enabling Discussions:

| Category | Format | Description |
|----------|--------|-------------|
| 📣 **Announcements** | Announcement | Project updates, new releases, and important news from maintainers |
| 💬 **General** | Open-ended | General discussion about the project |
| 🙋 **Q&A** | Question/Answer | Ask how to do something — community-supported questions |
| 💡 **Ideas** | Open-ended | Suggest ideas for improvements (not yet ready to be a formal issue) |
| 🔧 **Show and Tell** | Open-ended | Share projects built with this template |
| 🗺️ **Roadmap** | Announcement | Discuss upcoming features and project direction |

### How to Create Categories

1. Navigate to the **Discussions** tab in the repository.
2. Click **Edit** (pencil icon) next to the categories list.
3. Click **New category** and fill in the name, description, and format.
4. Set the emoji icon for visual identification.

## Welcome Post Template

After enabling Discussions, create a pinned **Announcement** post:

---

**Title:** 👋 Welcome to MCP Server Template Discussions!

**Body:**

```markdown
# Welcome to the MCP Server Template Community! 🚀

Thank you for your interest in this project! This is the place to ask questions,
share ideas, and connect with other builders using this template.

## How to Get Help

- **Q&A** — Ask technical questions about using the template
- **Ideas** — Propose new features or improvements  
- **Show and Tell** — Share what you've built!

## Before You Post

- Check the [README](../README.md) for getting started information
- Search existing discussions — your question may already be answered
- For bugs, please use [GitHub Issues](../issues) instead

## Community Guidelines

Please be respectful and constructive. See our [Code of Conduct](../blob/main/.github/CODE_OF_CONDUCT.md).

Happy building! 🛠️
```

---

## Integrating Discussions with Issues

For feature requests and ideas that graduate from Discussions to tracked Issues:

1. In the Discussion, click **Create issue from discussion** (GitHub converts it automatically).
2. Add appropriate labels: `enhancement`, `triage`.
3. Link back to the original Discussion for context.

## Moderation

- **Maintainers** can pin important announcements.
- **Community members** with sufficient reputation can mark Q&A answers as solved.
- Use the **Lock** feature for discussions that have been resolved and should not receive new replies.
