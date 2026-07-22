/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: [
    "<rootDir>/src/diting",
    "<rootDir>/../../packages/core/src/diting",
    "<rootDir>/../../packages/plugin-api/src/diting"
  ],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  },
  moduleFileExtensions: ["ts", "js", "json"],
  testPathIgnorePatterns: ["/dist/", "/web/"]
};
