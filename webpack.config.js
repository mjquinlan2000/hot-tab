const path = require("path")

module.exports = {
  entry: {
    index: {
      import: "./index.ts",
      dependOn: "shared"
    },
    popup: {
      import: "./popup.ts",
      dependOn: "shared"
    },
    shared: ["webextension-polyfill"]
  },
  context: path.resolve(__dirname, "src"),
  devtool: "inline-source-map",
  mode: "development",
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist")
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: "ts-loader",
      exclude: /node_modules/
    }]
  },
  resolve: {
    extensions: [".ts", ".js"]
  }
}
