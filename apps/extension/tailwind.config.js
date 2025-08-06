/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./**/*.{js,ts,jsx,tsx}", "!./node_modules/**"],
  plugins: [],
  theme: {
    extend: {
      boxShadow: {
        "inner-bottom": "inset 0 -1px 0 #3d444d",
      },
    },
  },
};
