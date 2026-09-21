// Which build this is. Only the production deployment sets VITE_APP_ENV, so
// previews and local dev fall through to the dev treatment — a missing
// variable shows dev branding in production, which is visible and easily
// fixed, rather than production branding on dev, which isn't.
export const IS_PRODUCTION = import.meta.env.VITE_APP_ENV === "production";

// The real app icon, so the in-app mark matches the one on the home screen —
// and differs between the two installs, like everything else about them.
export const APP_ICON = IS_PRODUCTION ? "/icon-192.png" : "/dev-icon-192.png";
