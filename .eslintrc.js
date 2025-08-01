module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    root: true,
    env: {
        node: true,
        es6: true,
    },
    ignorePatterns: ['.eslintrc.js', 'dist/', 'node_modules/'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Allow any types for now
        'no-console': 'off', // Allow console statements for now
    },
};