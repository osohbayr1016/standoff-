/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        primary: "#ff9900", // Example primary from logs or inference
        secondary: "#3b82f6",
      },
      fontFamily: {
        display: ["Rajdhani"],
      }
    },
  },
  plugins: [],
}
