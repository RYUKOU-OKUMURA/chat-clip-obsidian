const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const tailwindcss = require("tailwindcss");
const autoprefixer = require("autoprefixer");
const webpack = require("webpack");

module.exports = (env) => {
  const browser = env.browser || "chromium"; // Default to chromium if not specified

  return {
    entry: {
      popup: `./src/${browser}/popup/index.js`,
      options: `./src/${browser}/options/options.js`,
      background: `./src/${browser}/background/background.js`,
      contentScript: './src/contentScripts/js/inject.js',
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, `dist-${browser}`),
      publicPath: "",
      clean: true,
    },
    mode: "production",
    module: {
      rules: [
        {
          test: /\.js|jsx$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: [tailwindcss, autoprefixer],
                },
              },
            },
          ],
        },
        {
          test: /src\/contentScripts\/.*\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader",
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        filename: "popup.html",
        chunks: ["popup"],
      }),
      new HtmlWebpackPlugin({
        template: "./public/options.html",
        filename: "options.html",
        chunks: ["options"],
      }),
      new MiniCssExtractPlugin({
        filename: (pathData) => {
          return pathData.chunk.name === 'contentScript' ? 'contentScript.css' : '[name].css';
        },
      }),
      new CopyPlugin({
        patterns: [
          { from: "public/logo48.png", to: "logo48.png" },
          { from: "public/logo128.png", to: "logo128.png" },
          { from: `manifests/manifest_${browser}.json`, to: "manifest.json" },
          {
            from: "src/workers",
            to: "workers",
            globOptions: { ignore: ["**/README.md"] },
          }
        ],
      }),
      new webpack.DefinePlugin({
        "process.env.BROWSER": JSON.stringify(browser),
      }),
    ],
  };
};
