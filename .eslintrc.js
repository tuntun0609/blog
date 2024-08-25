module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:prettier/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
  },
  parser: '@typescript-eslint/parser',
  plugins: ['prettier', '@typescript-eslint/eslint-plugin'],
  rules: {
    'prettier/prettier': 'error',
    'import/no-named-as-default': 'off',
    'no-template-curly-in-string': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'react/jsx-key': 'error',
    'no-unneeded-ternary': 'warn',
    'arrow-body-style': 'warn',
    'no-debugger': 'error',
    quotes: ['error', 'single'],
    'linebreak-style': ['error', 'unix'],
    '@typescript-eslint/no-unused-vars': 'warn',
    'prefer-template': 'warn',
    'no-nested-ternary': 'warn',
    curly: ['error', 'all'],
    'react/self-closing-comp': 'warn',
    'import/no-named-as-default-member': 'off',
    'import/order': [
      'warn',
      {
        // 对导入模块进行分组，分组排序规则如下
        groups: [
          'builtin', // 内置模块
          'external', // 外部模块
          'internal', //内部引用
          'parent', //父节点依赖
          'sibling', //兄弟依赖
          'index', // index文件
          'type', //类型文件
          'unknown',
        ],
        //通过路径自定义分组
        pathGroups: [
          {
            pattern: '**.{scss,css,less}',
            patternOptions: { matchBase: true },
            group: 'unknown',
            position: 'after',
          },
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: 'react**',
            group: 'external',
            position: 'before',
          },
          {
            pattern: 'react**/**',
            group: 'external',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['react'],
        distinctGroup: false,
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          orderImportKind: 'asc',
        },
      },
    ],
  },
}
