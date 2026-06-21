/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(@stellar/stellar-sdk|@noble)/)"
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.m?js$': 'babel-jest'
  },
};
