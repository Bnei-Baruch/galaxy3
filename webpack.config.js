const path = require('path');
const webpack = require('webpack');
const fs = require('fs');
const dotenv = require('dotenv');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const WorkerPlugin = require('worker-plugin');

// Determine the current environment (e.g., 'development', 'production', 'staging')
// We check REACT_APP_ENV first, then NODE_ENV, and default to 'development'
const currentEnv = process.env.REACT_APP_ENV || process.env.NODE_ENV || 'development';

// Files to load in order of lowest to highest priority
const envFiles = [
  '.env',
  '.env.local',
  `.env.${currentEnv}`,
  `.env.${currentEnv}.local`,
].filter(Boolean);

let parsedEnv = {};

// Load each file if it exists, merging its parsed contents
envFiles.forEach(envFile => {
  const envPath = path.resolve(__dirname, envFile);
  if (fs.existsSync(envPath)) {
    const parsed = dotenv.config({ path: envPath }).parsed;
    if (parsed) {
      parsedEnv = { ...parsedEnv, ...parsed };
    }
  }
});

const processEnv = Object.keys(process.env)
  .filter(key => key.startsWith('REACT_APP_'))
  .reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});

const mergedEnv = { ...parsedEnv, ...processEnv };

const envKeys = Object.keys(mergedEnv)
  .filter(key => key.startsWith('REACT_APP_'))
  .reduce((prev, next) => {
    prev[`process.env.${next}`] = JSON.stringify(mergedEnv[next]);
    return prev;
  }, {});

// Always define NODE_ENV
envKeys['process.env.NODE_ENV'] = JSON.stringify(process.env.NODE_ENV || 'development');

module.exports = {
  devServer: {
    port: process.env.PORT || '3000',
    compress: true,
    historyApiFallback: true,
  },
  devtool: "source-map",
  entry: path.resolve(__dirname, './src/index.js'),
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'static/js/[name].[chunkhash:8].js',
    chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js',
    clean: true,
  },
  resolve: {
    modules: [path.join(__dirname, 'src'), 'node_modules'],
    alias: {
      react: path.join(__dirname, 'node_modules', 'react'),
      'process/browser': require.resolve('process/browser'),
    },
    extensions: [ '.ts', '.js' ],
    fallback: {
      "buffer": require.resolve("buffer")
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              compact: true,
              "sourceType": "unambiguous",
              presets: [
                '@babel/preset-react',
                '@babel/preset-env',
              ],
              plugins: [
                '@babel/plugin-proposal-class-properties',
                '@babel/plugin-transform-runtime'
              ],
            }

          }
        ]
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.scss$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
        test: /\.(woff(2)?|ttf|png|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: 'static/media/'
        }
      }
    ],
  },
  plugins: [
    new WorkerPlugin(),
    new HtmlWebPackPlugin({
      inject: true,
      template: './public/index.html',
      favicon: './public/favicon.ico',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      },
    }),
    new MiniCssExtractPlugin({
      filename: 'static/css/[name].[contenthash:8].css',
      chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
    }),
    new CopyWebpackPlugin({patterns: [{ from: 'public' }]}),
    new webpack.DefinePlugin(envKeys),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendors: {
          test: /node_modules\/(?!antd\/).*/,
          name: "vendors",
          chunks: "all",
        },
        // This can be your own design library.
        antd: {
          test: /node_modules\/(antd\/).*/,
          name: "antd",
          chunks: "all",
        },
      },
    },
    runtimeChunk: {
      name: "manifest",
    },
  }
};
