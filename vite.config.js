import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Only the production deployment sets this; previews and local dev leave it
// unset, which is also what shows the DEV badge in the app itself.
const isProduction = process.env.VITE_APP_ENV === 'production'

/**
 * Point non-production builds at the dev icon set and manifest.
 *
 * Both icon sets are committed rather than generated during the build, because
 * scripts/make-icons.mjs uses macOS `sips` and Vercel builds on Linux. So the
 * choice has to happen here, by rewriting the references in index.html.
 *
 * The point is telling the two installs apart on a phone home screen: the dev
 * build gets the inverted logo and installs as "Brew Log dev".
 */
function environmentIcons() {
  return {
    name: 'brew-log-environment-icons',
    transformIndexHtml(html) {
      if (isProduction) return html
      return html
        .replace('/manifest.webmanifest', '/manifest-dev.webmanifest')
        .replace('/apple-touch-icon.png', '/dev-apple-touch-icon.png')
        .replace('/favicon-32.png', '/dev-favicon-32.png')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), environmentIcons()],
})
