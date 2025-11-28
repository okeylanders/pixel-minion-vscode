const path = require('path');

const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@messages': path.resolve(__dirname, 'src/shared/types/messages'),
      '@handlers': path.resolve(__dirname, 'src/application/handlers'),
      '@services': path.resolve(__dirname, 'src/infrastructure/api/services'),
      '@secrets': path.resolve(__dirname, 'src/infrastructure/secrets'),
      '@ai': path.resolve(__dirname, 'src/infrastructure/ai'),
      '@logging': path.resolve(__dirname, 'src/infrastructure/logging')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json'
            }
          }
        ]
      }
    ]
  }
};

const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/presentation/webview/main.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@messages': path.resolve(__dirname, 'src/shared/types/messages'),
      '@handlers': path.resolve(__dirname, 'src/application/handlers'),
      '@services': path.resolve(__dirname, 'src/infrastructure/api/services'),
      '@secrets': path.resolve(__dirname, 'src/infrastructure/secrets'),
      '@ai': path.resolve(__dirname, 'src/infrastructure/ai'),
      '@components': path.resolve(__dirname, 'src/presentation/webview/components'),
      '@hooks': path.resolve(__dirname, 'src/presentation/webview/hooks'),
      '@utils': path.resolve(__dirname, 'src/presentation/webview/utils')
    }
  },
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('tailwindcss'),
                  require('autoprefixer')
                ]
              }
            }
          }
        ]
      }
    ]
  }
};

module.exports = (env, argv) => {
  const mode = argv.mode || 'none';
  extensionConfig.mode = mode;
  webviewConfig.mode = mode;

  return [extensionConfig, webviewConfig];
};
