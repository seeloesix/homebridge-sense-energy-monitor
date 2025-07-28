module.exports = {
    env: {
        node: true,
        es2022: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs'  // Changed from 'module' to 'commonjs' for Node.js
    },
    rules: {
        // Code quality
        'no-unused-vars': ['error', { 
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_' 
        }],
        'no-console': 'off', // Console logging is expected in Homebridge plugins
        'no-undef': 'error',
        'no-unreachable': 'error',
        'no-irregular-whitespace': 'error',
        
        // Style preferences
        'indent': ['error', 4],
        'quotes': ['error', 'single', { allowTemplateLiterals: true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'brace-style': ['error', '1tbs'],
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'space-before-function-paren': ['error', 'never'],
        'keyword-spacing': 'error',
        'space-infix-ops': 'error',
        'eol-last': 'error',
        'no-trailing-spaces': 'error',
        
        // Best practices
        'no-var': 'error',
        'prefer-const': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-template': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-throw-literal': 'error',
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        
        // Error handling
        'handle-callback-err': 'error',
        'no-unused-expressions': 'error',
        
        // ES6+
        'arrow-spacing': 'error',
        'prefer-destructuring': ['error', {
            array: false,
            object: true
        }],
        'object-shorthand': 'error',
        'prefer-spread': 'error'
    },
    overrides: [
        {
            files: ['test-*.js', '*.test.js'],
            env: {
                mocha: true
            },
            rules: {
                'no-console': 'off'
            }
        }
    ]
};