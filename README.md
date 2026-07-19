<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/51af7000-c808-4c63-bba5-9c7c1feacefa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Small-circle access

Set invite codes in your deployment secrets:

```env
INVITE_CODES="member_a_code,member_b_code"
ACCESS_COOKIE_SECRET="a-long-random-secret"
```

Send each user a link like:

```text
https://your-domain.com?invite=member_a_code
```

The app stores a signed HttpOnly cookie after the first visit, so users do not need to sign in again. Keep `GEMINI_API_KEY`, `INVITE_CODES`, and `ACCESS_COOKIE_SECRET` out of GitHub.
