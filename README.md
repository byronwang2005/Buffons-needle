# Buffon’s Needle Exhibit

An all-English interactive Buffon’s needle simulation built with Vite, TypeScript, and three.js. The app is designed as a static site for Cloudflare Pages.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm test`

## Deploy to Cloudflare Pages

1. Install dependencies and build the site:
   - `npm install`
   - `npm run build`
2. Authenticate Wrangler if needed:
   - `npx wrangler whoami`
3. Deploy the generated `dist` folder:
   - `npx wrangler pages deploy ./dist --project-name=<your-pages-project>`

`wrangler.jsonc` is already configured with `pages_build_output_dir = "./dist"`.
