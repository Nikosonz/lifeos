import localFont from "next/font/local";

// Self-hosted rather than next/font/google: this dev environment has a
// documented history of unreliable/blocked access to Google-adjacent
// services (see CLAUDE.md's Environment Constraints), and next/font/google
// fetches font files over the network at build/dev time. Self-hosting
// removes that dependency entirely, for every environment this ever builds
// in, not just this machine. Files copied from the `vazirmatn` npm package
// (fonts/webfonts/Vazirmatn-*.woff2) into ./assets — see this file's sibling
// directory. Only 4 static weights are kept (not the variable font or the
// other 5 weights) since that's all the UI actually uses.
export const vazirmatn = localFont({
  src: [
    {
      path: "../assets/fonts/vazirmatn/Vazirmatn-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/vazirmatn/Vazirmatn-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/vazirmatn/Vazirmatn-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../assets/fonts/vazirmatn/Vazirmatn-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
});
