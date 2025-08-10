# Changelog

All notable changes to the Homebridge Sense Energy Monitor plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2025-08-10

### Fixed
- **MFA Persistence Issue**: Fixed TOTP authentication failing on re-authentication
  - Changed from static 6-digit code to TOTP secret key configuration
  - Implemented dynamic TOTP code generation using secret key
  - Plugin now generates fresh codes automatically for each authentication
  - Updated configuration from `mfaCode` to `mfaSecret`

### Changed
- **Verbose Logging**: Now enabled by default for better troubleshooting
- **Configuration Cleanup**: 
  - Removed `individualDevices` option (feature was causing callback conflicts)
  - Kept `includeDevices` and `maxDevices` for future use
  - Simplified configuration options to focus on working features
- **Code Cleanup**:
  - Removed disabled individual device accessories code
  - Cleaned up unused functions and handlers
  - Improved code maintainability

### Added
- **TOTP Test Utility**: New `test-totp.js` script to verify TOTP code generation

## [2.3.4] - 2025-08-09

### Fixed
- Minor bug fixes and improvements

## [2.3.3] - 2025-08-09

### Fixed
- Authentication improvements

## [2.3.2] - 2025-08-08

### Fixed
- **MFA Authentication Flow**: Implemented correct two-step MFA authentication
  - Fixed API parameter name (`totp` instead of `totp_code`)
  - Implemented proper two-step flow: initial auth → MFA token → TOTP validation
  - Added support for `/authenticate/mfa` endpoint
  - Enhanced error handling to extract MFA tokens from error responses
- **Updated test-mfa.js**: Now demonstrates correct two-step MFA flow

## [2.3.0] - 2025-08-08

### Added
- **Multi-Factor Authentication (MFA/2FA) support**
  - New `mfaEnabled` configuration option
  - New `mfaCode` configuration field for TOTP codes
  - Enhanced error messages for MFA-related authentication failures
  - Test script (`test-mfa.js`) for validating MFA authentication
- **Documentation improvements**
  - This CHANGELOG file for better version tracking
  - Accurate feature descriptions reflecting real HomeKit capabilities
  - Clear warnings about HomeKit energy monitoring limitations

### Changed
- **Authentication system enhancements**
  - Updated SenseAPI constructor to accept MFA parameters
  - Modified authentication flow to include TOTP codes when MFA is enabled
  - Enhanced configuration schema with MFA options and validation
- **Documentation cleanup**
  - Removed misleading claims about "comprehensive HomeKit energy monitoring"
  - Updated feature descriptions to reflect actual capabilities
  - Clarified that detailed power data requires Eve app, not Apple Home
  - Honest comparison table showing real limitations vs competitors

### Fixed
- Improved error handling for authentication failures
- Better user guidance when MFA configuration is required

## [2.1.1] - 2024

### Fixed
- Nuclear reset system to eliminate callback conflicts
- Prevented "callback already called" errors
- Improved cached accessory management

### Changed
- Automatically removes problematic cached accessories on startup
- Creates fresh accessories every time to prevent conflicts
- Enhanced characteristic handlers with proper error handling

## [2.1.0] - 2024

### Added
- Verification-ready architecture meeting all Homebridge requirements
- Dynamic platform architecture (required for verification)
- Node.js v20+ support (latest LTS requirement)
- Comprehensive error handling with no unhandled exceptions
- Storage directory compliance for all cached data
- Smart authentication caching with automatic token refresh
- Robust WebSocket management with exponential backoff reconnection
- Comprehensive data validation preventing undefined characteristic values
- Memory leak prevention with proper cleanup on shutdown

### Changed
- Major architectural shift from accessory to platform plugin
- Complete rewrite of core functionality
- Enhanced reliability and stability

## [2.0.0] - 2024

### Breaking Changes
- Changed from accessory to platform plugin type
- New configuration format required
- Accessories will be recreated (may need re-adding to HomeKit rooms/scenes)

### Added
- Dynamic platform support
- Automatic device discovery
- Enhanced WebSocket real-time monitoring
- Solar power monitoring support
- Individual device tracking (50+ devices)
- Daily, weekly, monthly, and yearly consumption tracking
- Eve App support with historical data
- FakeGato history integration

### Changed
- Complete plugin rewrite
- Improved API integration
- Better error handling and recovery
- Enhanced performance optimization

## [1.0.0] - Initial Release

### Added
- Basic Sense Energy Monitor integration
- Real-time power monitoring
- HomeKit compatibility
- Basic authentication support
- Simple polling mechanism

---

## Version Naming Convention

- **Major** (X.0.0): Breaking changes requiring configuration updates
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes and minor improvements

## Support

For issues, feature requests, or questions, please visit:
https://github.com/seeloesix/homebridge-sense-energy-monitor/issues