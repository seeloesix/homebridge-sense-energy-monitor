# Contributing to Homebridge Sense Energy Monitor

Thank you for your interest in contributing to this project! We welcome contributions from the community and appreciate your help in making this plugin better.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our code of conduct:
- Be respectful and inclusive
- Use welcoming and inclusive language
- Focus on what is best for the community
- Show empathy towards other community members

## 🐛 Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

### Bug Report Template
```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment:**
- Homebridge version: [e.g. 1.8.0]
- Plugin version: [e.g. 2.1.0]
- Node.js version: [e.g. 20.10.0]
- Operating System: [e.g. Raspberry Pi OS, macOS, Ubuntu]

**Configuration:**
```json
{
  "your": "config here"
}
```

**Logs:**
```
Relevant log output here
```

**Additional context**
Add any other context about the problem here.
```

## 💡 Suggesting Features

Feature requests are welcome! Please provide:
- A clear description of the feature
- Why you think it would be useful
- How it should work
- Any alternatives you've considered

## 🔧 Development Setup

### Prerequisites
- Node.js v20.0.0 or higher
- npm v9.0.0 or higher
- Git

### Setup Instructions

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/homebridge-sense-energy-monitor.git
   cd homebridge-sense-energy-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up development environment**
   ```bash
   # Link the plugin for local testing
   npm link
   
   # Create a test configuration
   cp config.example.json config.dev.json
   # Edit config.dev.json with your Sense credentials
   ```

4. **Run tests**
   ```bash
   # Run linting
   npm run lint
   
   # Run integration tests (requires Sense account)
   SENSE_USERNAME=your@email.com SENSE_PASSWORD=password node test-integration.js
   ```

## 📝 Development Guidelines

### Code Style
- Follow the existing code style
- Use ESLint for code quality: `npm run lint`
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and small

### Commit Messages
Use conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

Examples:
```
feat(api): add solar power monitoring support
fix(websocket): handle connection timeouts gracefully
docs(readme): update installation instructions
```

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Follow the existing patterns
   - Add appropriate error handling
   - Update documentation if needed

3. **Test your changes**
   ```bash
   # Run linting
   npm run lint
   
   # Test the plugin loads
   node -e "require('./index.js')"
   
   # Run integration tests if possible
   node test-integration.js
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a pull request on GitHub.

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] I have tested this change locally
- [ ] I have added appropriate error handling
- [ ] I have updated documentation if needed
- [ ] I have checked that no existing functionality is broken

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] My changes generate no new ESLint warnings
- [ ] I have updated the README if needed
```

## 🧪 Testing

### Types of Testing

1. **Linting**
   ```bash
   npm run lint
   ```

2. **Integration Testing**
   ```bash
   # With credentials as arguments
   node test-integration.js username password
   
   # With environment variables
   SENSE_USERNAME=user SENSE_PASSWORD=pass node test-integration.js
   ```

3. **Manual Testing**
   - Install the plugin in a test Homebridge instance
   - Verify all accessories appear correctly
   - Test WebSocket and polling modes
   - Verify error handling

### Test Cases to Cover
- Authentication success and failure
- WebSocket connection and disconnection
- Device discovery and updates
- Error handling and recovery
- Configuration validation
- Platform startup and shutdown

## 📚 Documentation

### Updating Documentation
- Update README.md for user-facing changes
- Update code comments for implementation changes
- Update config.schema.json for new configuration options
- Add JSDoc comments for new functions

### Documentation Standards
- Use clear, concise language
- Provide examples where helpful
- Keep documentation up to date with code changes
- Include troubleshooting information for common issues

## 🏗️ Architecture Notes

### Key Components
- **SenseAPI**: Handles all Sense service communication
- **SenseEnergyMonitorPlatform**: Main platform class that manages accessories
- **Accessories**: Main energy monitor and individual device accessories

### Design Principles
- **Error Resilience**: All operations should handle errors gracefully
- **Performance**: Minimize API calls and resource usage
- **Configurability**: Allow users to customize behavior
- **Compatibility**: Support all current LTS Node.js versions

### Breaking Changes
- Avoid breaking changes when possible
- Document breaking changes clearly
- Provide migration guides
- Bump major version for breaking changes

## 🚀 Release Process

1. **Version Bump**
   ```bash
   npm version patch|minor|major
   ```

2. **Update Changelog**
   - Document all changes
   - Include migration notes if needed

3. **Create GitHub Release**
   - Tag the version
   - Include detailed release notes
   - Attach any relevant files

4. **Publish to NPM**
   ```bash
   npm publish
   ```

## 📞 Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For general questions and community discussion
- **Homebridge Discord**: #plugin-support channel for real-time help

## 🙏 Recognition

Contributors will be recognized in:
- GitHub contributors list
- README acknowledgments
- Release notes (for significant contributions)

Thank you for contributing to the Homebridge Sense Energy Monitor plugin!