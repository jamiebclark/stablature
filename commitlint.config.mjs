const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Long bodies are useful; the subject line is what needs discipline.
    "body-max-line-length": [0],
  },
};

export default config;
