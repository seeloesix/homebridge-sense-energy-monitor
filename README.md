# Homebridge Sense Energy Monitor

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm](https://img.shields.io/npm/v/homebridge-sense-energy-monitor.svg)](https://www.npmjs.com/package/homebridge-sense-energy-monitor)
[![npm](https://img.shields.io/npm/dt/homebridge-sense-energy-monitor.svg)](https://www.npmjs.com/package/homebridge-sense-energy-monitor)

**Dynamic Platform** plugin for the Sense Home Energy Monitor that provides basic device status monitoring in HomeKit. 

## ⚡ Key Features

- **🏠 Dynamic Platform**: Automatically discovers and manages device status accessories
- **🔌 Device Status Tracking**: Shows when Sense devices are actively consuming power
- **📊 Threshold-Based Detection**: Configurable power threshold for device "on" detection
- **📱 Eve App Support**: Historical power data with fakegato-history integration
- **🔄 Nuclear Reset System**: Eliminates callback conflicts with smart accessory management
- **⚙️ Verification Ready**: Meets all Homebridge verification requirements
- **💾 Smart Caching**: Authentication and data caching for improved performance
- **🔐 MFA Support**: Multi-factor authentication for Sense accounts with 2FA enabled

## 🆕 **What's New in v2.4.1**
- **⚙️ Homebridge 2.0 Compatibility** Corrected Compatability warning 

### 🔐 **Multi-Factor Authentication Support**
- **MFA/2FA Support** for Sense accounts with multi-factor authentication enabled
- **Configuration options** for `mfaEnabled` and `mfaSecret` settings
- **Enhanced error messaging** with clear guidance for MFA setup
- **Test utility** included for validating MFA authentication

### 📝 **Documentation Cleanup**
- **Honest feature descriptions** that accurately reflect HomeKit limitations
- **Clear HomeKit warnings** about power data display limitations
- **Realistic comparison table** showing actual vs claimed functionality
- **Removed misleading claims** about comprehensive energy monitoring in HomeKit

### 🔧 **Technical Improvements**
- **Enhanced authentication flow** with better MFA error handling
- **Improved user guidance** for configuration troubleshooting
- **Updated configuration schema** with MFA field validation  

## 📦 Installation

### ⚠️ **Breaking Changes Notice**
**Upgrading from v2.0.x?** This is a **major breaking change** that requires configuration updates:
- **Plugin type changed**: From `accessory` to `platform`
- **Configuration format**: Update your `config.json` (see below)
- **Accessories will be recreated**: You may need to re-add them to HomeKit rooms/scenes

### Via Homebridge Config UI X (Recommended)

1. Search for **"homebridge-sense-energy-monitor"** in the Homebridge UI
2. Install the plugin (v2.3.0+)
3. Configure using the settings form
4. **Update your configuration** to platform format (see Configuration section)
5. Restart Homebridge
4. Restart Homebridge

### Manual Installation

```bash
npm install -g homebridge-sense-energy-monitor
```

## ⚙️ Configuration

Add the platform to your Homebridge config:

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password",
      "mfaEnabled": false,
      "mfaCode": "123456",
      "pollingInterval": 60,
      "useWebSocket": true,
      "includeDevices": true,
      "enableHistory": true,
      "verbose": false
    }
  ]
}
```

### Configuration Options

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `platform` | ✅ | - | Must be "SenseEnergyMonitor" |
| `name` | ✅ | - | Platform name in HomeKit |
| `username` | ✅ | - | Your Sense account email |
| `password` | ✅ | - | Your Sense account password |
| `mfaEnabled` | ❌ | false | Enable if your Sense account has MFA/2FA enabled |
| `mfaSecret` | ❌ | - | TOTP secret key from your authenticator app setup (base32 encoded) |
| `monitor_id` | ❌ | Auto-detect | Specific monitor ID |
| `pollingInterval` | ❌ | 60 | Data refresh interval (30-3600 seconds) |
| `useWebSocket` | ❌ | true | Enable real-time WebSocket data |
| `includeSolar` | ❌ | true | Include solar power monitoring (if available) |
| `includeDevices` | ❌ | true | Track individual device power usage |
| `maxDevices` | ❌ | 20 | Maximum number of devices to track (1-50) |
| `devicePowerThreshold` | ❌ | 10 | Minimum watts to consider device "active" |
| `enableHistory` | ❌ | true | Enable Eve app historical data |
| `verbose` | ❌ | true | Enable detailed debug logging |

### Multi-Factor Authentication (MFA/2FA) Configuration

If your Sense account has multi-factor authentication enabled, you'll need to provide your TOTP secret key:

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password",
      "mfaEnabled": true,
      "mfaSecret": "YOUR_BASE32_SECRET_KEY"
    }
  ]
}
```

**Important MFA Notes:**
- Set `mfaEnabled` to `true` if your Sense account has 2FA enabled
- Enter your TOTP secret key in `mfaSecret` (the base32 encoded secret, not the 6-digit code)
- The secret key is shown when you first set up 2FA (looks like: JBSWY3DPEHPK3PXP)
- The plugin will automatically generate fresh TOTP codes as needed
- The plugin uses Sense's two-step MFA flow: initial auth → MFA token → TOTP validation
- The plugin will provide clear error messages if MFA authentication fails

### Child Bridge Configuration

For improved performance and isolation, you can run this plugin as a child bridge:

```json
{
  "platforms": [
    {
      "platform": "SenseEnergyMonitor",
      "name": "Sense Energy Monitor",
      "username": "your@email.com",
      "password": "your_sense_password",
      "_bridge": {
        "username": "CC:22:3D:E3:CE:31",
        "port": 51827
      }
    }
  ]
}
```

## 🏠 HomeKit Features

### What You'll See in Apple Home App
- **Main Energy Monitor**: Shows as an "outlet" that's on/off based on power threshold
- **Device Outlets**: Individual Sense devices appear as outlets (on when power > threshold)
- **Basic Status**: Only shows if devices are consuming power, not actual power amounts
- **Simple Automation**: Can trigger automations when devices turn on/off

⚠️ **Important HomeKit Limitations:**
- Power consumption amounts (watts) are **NOT** displayed in Apple Home app
- Energy costs and usage data are **NOT** visible in HomeKit
- Solar power generation is **NOT** shown in HomeKit
- For actual power data, you must use the Eve app

### Eve App Integration
When `enableHistory` is enabled and fakegato-history is installed:
- **Power History**: Historical consumption graphs with actual watt values
- **Voltage/Current**: Technical measurements for analysis
- **Data Export**: Historical data export capabilities

## 🔧 Advanced Features

### Real-time WebSocket Streaming
- Live device status updates from Sense API
- Automatic reconnection with exponential backoff
- Rate limiting to prevent API abuse
- Powers the on/off threshold detection

### Smart Authentication
- Token caching for improved performance
- Automatic token refresh
- MFA/2FA support for secured accounts
- Graceful authentication failure handling
- Secure credential storage

### Error Resilience
- Comprehensive error handling and logging
- Automatic recovery from network issues
- Graceful degradation when services unavailable
- No unhandled exceptions

## 🛠️ API Integration

This plugin integrates with the comprehensive Sense API providing:

### Data Sources
- **Real-time Stream**: Live power data via WebSocket
- **Trend Data**: Historical consumption and production metrics
- **Device Detection**: Automatic smart device discovery
- **Monitor Status**: System health and connectivity

### Rate Limiting
- Respects Sense API rate limits
- Configurable polling intervals
- WebSocket connection management
- Smart caching to reduce API calls

## 📊 Data Collection & Monitoring

### What the Plugin Collects from Sense API
- **Active Power**: Current total consumption in watts
- **Device Status**: Individual device power usage
- **Voltage**: Line voltage measurements
- **Device Detection**: Automatic device discovery

### What's Available in HomeKit (Apple Home App)
- **Device On/Off Status**: Based on configurable power thresholds only
- **Basic Automation**: Trigger when devices start/stop using power

### What's Available in Eve App Only
- **Power History**: Historical consumption graphs with actual watt values
- **Voltage/Current**: Technical measurements
- **Consumption Data**: Detailed power usage over time

⚠️ **Important**: Detailed energy data (watts, kWh, costs) is only accessible through the Eve app, not Apple's Home app.

## 🔍 Troubleshooting

### 🚨 **Critical Issues**

#### Plugin Not Loading / Callback Errors
```
This callback function has already been called by someone else
```
**Nuclear Reset Solution**: 
1. **Stop Homebridge**: `sudo systemctl stop homebridge`
2. **Clear cache**: `sudo rm -rf ~/.homebridge/accessories/ ~/.homebridge/persist/`
3. **Set config**: `"individualDevices": false` (temporarily)
4. **Restart**: `sudo systemctl start homebridge`

#### Authentication Problems
```
Error: Authentication failed - invalid credentials
```
**Solution**: 
- Verify Sense account credentials in Sense mobile app
- Ensure account has access to the monitor
- Check for typos in username/password
- Wait 15 minutes if rate limited

#### Configuration Format Errors  
```
No plugin was found for the accessory "SensePowerMeter"
```
**Solution**: Update config from accessory to platform format:
```json
// OLD (v2.0.x) - Remove this:
"accessories": [{"accessory": "SensePowerMeter", ...}]

// NEW (v2.3.0+) - Use this:
"platforms": [{"platform": "SenseEnergyMonitor", ...}]
```

### ⚙️ **Common Issues**

#### Authentication Problems
```
Error: Authentication failed - invalid credentials
```
**Solution**: Verify Sense account credentials and ensure account has monitor access.

#### WebSocket Connection Issues
```
WebSocket error: Connection refused
```
**Solutions**:
- Check network connectivity and firewall settings
- Try disabling WebSocket: `"useWebSocket": false`
- Verify Sense service status

#### Rate Limiting
```
Rate limited - skipping realtime update
```
**Solution**: Increase polling interval: `"pollingInterval": 120`

#### Callback Function Errors
```
This callback function has already been called by someone else
```
**Solution**: 
- **Disable individual device accessories**: Set `"individualDevices": false`
- **Clear Homebridge cache**: Remove `~/.homebridge/accessories/` and `~/.homebridge/persist/`
- **Restart Homebridge** completely

#### Missing Devices
```
No devices found
```
**Solutions**:
- Ensure Sense monitor has completed device detection
- Check device detection in Sense mobile app
- Wait for detection cycle to complete

### Debug Mode

Enable verbose logging for troubleshooting:

```json
{
  "verbose": true
}
```

### Log Analysis

Key log messages:
- `✅ Authentication successful` - Login working
- `🔌 WebSocket connected` - Real-time stream active
- `📊 Power: XXXXw` - Regular power updates
- `📱 Retrieved X devices` - Device detection working

## 🏗️ Development

### Requirements
- Node.js v20.0.0 or higher
- Homebridge v1.8.0 or higher

### Setup
```bash
git clone https://github.com/seeloesix/homebridge-sense-energy-monitor.git
cd homebridge-sense-energy-monitor
npm install
npm link
```

### Testing
```bash
# Run integration tests
node test-integration.js <username> <password>

# Or use environment variables
SENSE_USERNAME=your@email.com SENSE_PASSWORD=password npm test
```

### Linting
```bash
npm run lint
```

## 📈 Performance

### System Requirements
- **Memory**: ~50MB RAM usage
- **CPU**: Minimal impact
- **Network**: WebSocket connection + periodic API calls
- **Storage**: <1MB for caching and history

### Optimization Features
- Authentication token caching
- Rate-limited API calls
- Efficient WebSocket connection management
- Smart polling intervals
- Minimal HomeKit characteristic updates

## 🔒 Privacy & Security

### Data Handling
- ✅ **No Analytics**: No user tracking or data collection
- ✅ **Local Storage**: All data stored locally in Homebridge directory
- ✅ **Secure Caching**: Encrypted credential storage
- ✅ **Minimal Data**: Only necessary data cached locally

### Network Security
- HTTPS API connections
- WSS WebSocket encryption
- No external data transmission
- Homebridge network isolation support

## 🆚 Comparison with Existing Plugins

| Feature | This Plugin (v2.3.2) | homebridge-sense-power-meter |
|---------|----------------------|------------------------------|
| Plugin Type | ✅ Dynamic Platform | ❌ Static Accessory |
| Real-time Updates | ✅ WebSocket + Polling | ❌ Polling Only |
| Device Status Tracking | ✅ 50+ Devices | ❌ No Support |
| HomeKit Power Display | ❌ On/Off Status Only | ❌ Limited |
| Error Handling | ✅ Nuclear Reset System | ❌ Basic |
| MFA Support | ✅ 2FA/MFA Support | ❌ No Support |
| Configuration GUI | ✅ User-Friendly | ❌ Basic |
| Eve App Support | ✅ Historical Data | ❌ No Support |
| Verification Status | ✅ Verification Ready | ❌ Abandoned (5+ years) |
| Node.js Support | ✅ v20+ (Latest LTS) | ❌ Outdated |
| HomeKit Energy Data | ❌ Requires Eve App | ❌ Limited |

**Note**: No HomeKit plugin can display actual power consumption in Apple's Home app due to platform limitations.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add appropriate error handling
- Update documentation
- Test thoroughly
- No breaking changes without major version bump

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Credits

- **API Integration**: Based on [tadthies/sense](https://github.com/tadthies/sense)
- **Original Inspiration**: [Cisien/homebridge-sense-power-meter](https://github.com/Cisien/homebridge-sense-power-meter)
- **WebSocket Implementation**: Inspired by [brbeaird/sense-energy-node](https://github.com/brbeaird/sense-energy-node)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/seeloesix/homebridge-sense-energy-monitor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/seeloesix/homebridge-sense-energy-monitor/discussions)
- **Homebridge Discord**: #plugin-support channel
- **Documentation**: [Plugin Wiki](https://github.com/seeloesix/homebridge-sense-energy-monitor/wiki)

## 📅 Changelog

### v2.1.0 - Verification Release
- 🏗️ **BREAKING**: Converted from accessory to dynamic platform
- ✅ **Verification**: Meets all Homebridge verification requirements
- 🚀 **Performance**: Improved authentication caching and error handling
- 📱 **Features**: Enhanced individual device support and configuration options
- 🔧 **Stability**: Comprehensive error handling and graceful degradation
- 📊 **Monitoring**: Extended power monitoring and historical data features
- 🎛️ **Configuration**: Enhanced configuration schema with validation

### v2.0.0 - Major Rewrite
- Complete rewrite with comprehensive API integration
- Added WebSocket support for real-time data
- Integrated tadthies/sense API methods
- Added solar power support
- Enhanced error handling and reconnection
- Added fakegato-history support
- Improved HomeKit characteristics
- Added device monitoring capabilities

### v1.0.0 - Initial Release
- Basic functionality (accessory-based)
- Simple power monitoring
- Basic Sense API integration

## 🚀 **Current Status & Limitations**

### ✅ **What Works (v2.3.2)**
- **Device Status Detection**: Shows when devices are on/off in HomeKit
- **Sense API Integration**: Reliable data collection from Sense monitors
- **Eve App Integration**: Historical power data visualization
- **WebSocket Streaming**: Real-time device status updates
- **MFA Support**: Works with 2FA-enabled Sense accounts
- **Verification Compliance**: Meets all Homebridge requirements

### ⚠️ **Known Limitations**
- **HomeKit Display**: Apple Home app only shows on/off status, not power amounts
- **No Energy Costs**: Cannot display energy costs or consumption totals in HomeKit
- **No Solar Display**: Solar power data collected but not shown in HomeKit
- **Threshold-Based**: Only detects devices above configurable power threshold

### 🔮 **HomeKit Platform Limitations**
- HomeKit has no native support for energy monitoring
- Power consumption data requires third-party apps like Eve
- Apple's Home app ignores custom energy characteristics
- Energy automation limited to basic on/off triggers

---

**⭐ If this plugin helps you monitor your home energy usage, please consider giving it a star on GitHub!**