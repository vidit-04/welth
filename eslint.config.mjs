import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextVitals,
  {
    rules: {
      "no-unused-vars": ["warn"],
    },
  },
];
