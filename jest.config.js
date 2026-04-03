// jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/__tests__/**/*.js",
    "**/?(*.)(spec|test).js?(x)"
  ],
  moduleNameMapper: {
    "^.+\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/__test__/__mocks__/fileMock.js"
  },
  moduleFileExtensions: ["js", "json"],
  transform: {},
  globals: {
    'jest': true
  },
  injectGlobals: true
};