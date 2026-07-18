/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "cream-paper": "#ffedd2",
        "void-black": "#0d0d0d",
        "polished-white": "#ffffff",
        "hairline-gray": "#e5e7eb",
        "muted-ash": "#9e9e9e",
        "surface-charcoal": "#1f1f1f",
      },
      fontFamily: {
        // Design substitutes for commercial Telka / TelkaExtended.
        telka: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      fontSize: {
        caption: ["12px", { lineHeight: "1.5", letterSpacing: "-0.24px" }],
        "body-sm": ["14px", { lineHeight: "1.43", letterSpacing: "-0.28px" }],
        body: ["16px", { lineHeight: "1.5", letterSpacing: "-0.32px" }],
        display: ["32px", { lineHeight: "1.13", letterSpacing: "0.32px" }],
      },
      fontWeight: {
        light: "300",
        regular: "400",
        medium: "450",
        black: "900",
      },
      borderRadius: {
        button: "6px",
        input: "6px",
        card: "10px",
      },
      spacing: {
        8: "8px",
        16: "16px",
        20: "20px",
        24: "24px",
        28: "28px",
        32: "32px",
        56: "56px",
        64: "64px",
        80: "80px",
      },
    },
  },
  plugins: [],
};
