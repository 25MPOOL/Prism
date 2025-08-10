/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./**/*.{js,ts,jsx,tsx}", "!./node_modules/**"],
  plugins: [],
  theme: {
    extend: {
      keyframes: {
        "overlay-appear": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        "inner-bottom": "inset 0 -1px 0 #3d444d",
        "drop-down":
          "0px 0px 0px 1px #3d444d, 0px 6px 12px -3px #01040966, 0px 6px 18px 0px #01040966",
      },
      animation: {
        "drop-down-menu": "overlay-appear .2s cubic-bezier(.33,1,.68,1)",
      },
    },
  },
};
