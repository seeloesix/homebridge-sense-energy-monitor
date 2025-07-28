# Homebridge Sense Energy Monitor

<!-- [![verified-by-homebridge](https://badgen.net/badge/homebridge/verification%20ready/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) -->
[![npm](https://img.shields.io/npm/v/homebridge-sense-energy-monitor.svg)](https://www.npmjs.com/package/homebridge-sense-energy-monitor)
[![npm](https://img.shields.io/npm/dt/homebridge-sense-energy-monitor.svg)](https://www.npmjs.com/package/homebridge-sense-energy-monitor)

Enhanced **Dynamic Platform** plugin for the Sense Home Energy Monitor with comprehensive API integration, real-time monitoring, and advanced HomeKit features. **Version 2.1.1** - Nuclear Reset & Verification Ready.

## ⚡ Key Features

- **🏠 Dynamic Platform**: Automatically discovers and manages energy monitoring accessories
- **📊 Real-time Monitoring**: Live power consumption data via WebSocket or polling  
- **☀️ Solar Power Support**: Monitor solar power generation (if available)
- **🔌 Device Tracking**: Track power usage of 50+ detected devices with comprehensive logging
- **📈 Comprehensive Data**: Daily, weekly, monthly, and yearly consumption/production tracking
- **🏡 Full HomeKit Integration**: Native HomeKit compatibility with bulletproof characteristics
- **📱 Eve App Support**: Historical data with fakegato-history integration
- **🔄 Nuclear Reset System**: Eliminates callback conflicts with smart accessory management
- **⚙️ Verification Ready**: Meets all Homebridge verification requirements
- **💾 Smart Caching**: Authentication and data caching for improved performance

## 🆕 **What's New in v2.1.1**

### 🔥 **Nuclear Reset System**
- **Eliminates callback conflicts** that caused "callback already called" errors
- **Automatically removes** problematic cached accessories on startup
- **Creates fresh accessories** every time to prevent conflicts
- **Bulletproof characteristic handlers** with proper error handling

### ✅ **Verification Ready**
- **Meets all requirements** for Homebridge plugin verification
- **Dynamic platform architecture** (required for verification)
- **Node.js v20+ support** (latest LTS requirement)
- **Comprehensive error handling** with no unhandled exceptions
- **Storage directory compliance** for all cached data

### 🛡️ **Enhanced Reliability**
- **Smart authentication caching** with automatic token refresh
- **Robust WebSocket management** with exponential backoff reconnection
- **Comprehensive data validation** preventing undefined characteristic values
- **Memory leak prevention** with proper cleanup on shutdown  

## 📦 Installation

### ⚠️ **Breaking Changes Notice**
**Upgrading from v2.0.x?** This is a **major breaking change** that requires configuration updates:
- **Plugin type changed**: From `accessory` to `platform`
- **Configuration format**: Update your `config.json` (see below)
- **Accessories will be recreated**: You may need to re-add them to HomeKit rooms/scenes

### Via Homebridge Config UI X (Recommended)

1. Search for **"homebridge-sense-energy-monitor"** in the Homebridge UI
2. Install the plugin (v2.1.1+)
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
      "pollingInterval": 60,
      "useWebSocket": true,
      "includeSolar": true,
      "includeDevices": true,
      "individualDevices": false,
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
| `monitor_id` | ❌ | Auto-detect | Specific monitor ID |
| `pollingInterval` | ❌ | 60 | Data refresh interval (30-3600 seconds) |
| `deviceLoggingInterval` | ❌ | 2 | Device status logging interval (1-60 minutes) |
| `useWebSocket` | ❌ | true | Enable real-time WebSocket data |
| `includeSolar` | ❌ | true | Monitor solar power generation |
| `includeDevices` | ❌ | true | Track individual device usage |
| `individualDevices` | ❌ | false | ⚠️ **TEMPORARILY DISABLED**: Create separate accessories for each device |
| `devicePowerThreshold` | ❌ | 10 | Minimum watts to consider device "active" |
| `maxDevices` | ❌ | 20 | Maximum individual device accessories (1-50) |
| `enableHistory` | ❌ | true | Enable Eve app historical data |
| `verbose` | ❌ | false | Enable detailed debug logging |

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

### Main Energy Monitor Accessory
- **Power Status**: On/Off based on consumption threshold
- **Outlet Usage**: Indicates active power consumption
- **Real-time Data**: Current power, voltage, frequency
- **Historical Data**: Integration with Eve app for consumption tracking

### Individual Device Accessories (Optional)
- **Device Status**: Per-device on/off state based on power usage
- **Power Monitoring**: Individual device consumption tracking
- **Smart Detection**: Automatic device discovery and management

### Eve App Integration
When `enableHistory` is enabled and fakegato-history is installed:
- **Power History**: Historical consumption graphs
- **Cost Calculations**: Energy cost tracking (configure in Eve app)
- **Trend Analysis**: Long-term usage patterns

## 🔧 Advanced Features

### Real-time WebSocket Streaming
- Live power consumption updates
- Automatic reconnection with exponential backoff
- Rate limiting to prevent API abuse
- Device status updates in real-time

### Smart Authentication
- Token caching for improved performance
- Automatic token refresh
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

## 📊 Monitoring Capabilities

### Power Data
- **Active Power**: Current total consumption in watts
- **Solar Power**: Current generation (if available)
- **Voltage**: Line voltage measurements
- **Frequency**: AC frequency monitoring
- **Current**: Calculated amperage draw

### Consumption Tracking
- **Daily**: Current day's consumption and generation
- **Weekly**: Current week's energy totals
- **Monthly**: Current month's usage patterns
- **Yearly**: Annual consumption tracking

### Device Monitoring
- **Active Devices**: Real-time device status
- **Power Thresholds**: Configurable detection sensitivity
- **Individual Tracking**: Per-device consumption history
- **Smart Detection**: Automatic device classification

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

// NEW (v2.1.1+) - Use this:
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

| Feature | This Plugin (v2.1.1) | homebridge-sense-power-meter |
|---------|----------------------|------------------------------|
| Plugin Type | ✅ Dynamic Platform | ❌ Static Accessory |
| Real-time Data | ✅ WebSocket + Polling | ❌ Polling Only |
| Solar Support | ✅ Full Support | ❌ No Support |
| Device Tracking | ✅ 50+ Devices | ❌ No Support |
| Error Handling | ✅ Nuclear Reset System | ❌ Basic |
| Authentication | ✅ Smart Caching | ❌ No Caching |
| Configuration GUI | ✅ 15+ Options | ❌ Basic |
| Eve App Support | ✅ Historical Data | ❌ No Support |
| Verification Status | ✅ Verification Ready | ❌ Abandoned (5+ years) |
| Node.js Support | ✅ v20+ (Latest LTS) | ❌ Outdated |
| Memory Management | ✅ Leak Prevention | ❌ No Cleanup |
| Callback Safety | ✅ Nuclear Reset | ❌ Conflicts |

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

## 🚀 **Development Status & Roadmap**

### ✅ **Current Status (v2.1.1)**
- **Main Energy Monitor**: ✅ Fully functional with real-time data
- **Solar Monitoring**: ✅ Complete support for solar generation
- **Device Detection**: ✅ 50+ devices detected and logged
- **WebSocket Streaming**: ✅ Real-time updates with auto-reconnection
- **Verification Compliance**: ✅ Meets all Homebridge requirements
- **Nuclear Reset System**: ✅ Eliminates callback conflicts

### 🔄 **Temporarily Disabled**
- **Individual Device Accessories**: ⚠️ Disabled due to callback conflicts
  - Will be re-enabled in v2.2.0 with redesigned architecture
  - Device data still available in logs and main accessory

### 🛣️ **Future Roadmap (v2.2.0+)**
- **Individual Device Accessories**: Redesigned with conflict-free architecture
- **Custom Characteristics**: Advanced power monitoring characteristics
- **Enhanced History**: Extended historical data features
- **Performance Optimizations**: Further memory and CPU optimizations
- **Advanced Configuration**: More granular control options

---

**⭐ If this plugin helps you monitor your home energy usage, please consider giving it a star on GitHub!**