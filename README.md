# Kindle Highlights Formatter API

A Node.js + Express backend service that allows users to manage, organize, and automatically sync their Kindle highlights with advanced direct upload capabilities from jailbroken Kindle devices.

## 🛠 Technologies Used

- Node.js
- Express.js
- MongoDB + Mongoose
- CORS
- bcrypt (password hashing)
- JWT (authentication)
- Nodemailer (email services)
- Multer (file upload handling)
- Express Rate Limit (API protection)
- Mocha & Supertest (testing)

---

## Current Implementations
- User session management with JWT authentication
- Support for `.clippings.txt` parsing and processing
- **🚀 NEW: Kindle Direct Upload Integration** - Automated upload from jailbroken Kindle devices
- **🔐 NEW: Secret Key Authentication System** - Secure device-to-server communication
- **🛡️ NEW: Advanced Rate Limiting** - IP-based protection with intelligent retry logic
- **📧 Enhanced Newsletter System** - Smart highlight selection with bitemporal tracking
- Cloud deployment (Render) with production-ready configurations
- Comprehensive duplicate detection for multiple highlight formats

## 🔥 Kindle Extension Features

### **📱 Direct Device Upload**
- **Automated Sync**: Upload highlights directly from jailbroken Kindle devices
- **Multi-Format Support**: Standard Kindle highlights + KOReader annotations
- **Real-time Processing**: Highlights available immediately after reading
- **Intelligent Deduplication**: Advanced algorithm handles overlapping and duplicate highlights

### **🔐 Security & Authentication**
- **Secret Key System**: 64-character cryptographically secure authentication
- **Rate Limiting**: 10 requests per 10 minutes per IP address
- **Request Monitoring**: Comprehensive logging and abuse detection
- **User Cooldowns**: 2-minute cooldown between uploads per user

### **🌐 API Endpoints**
```bash
# Secret Key Management
POST /user/generate-kindle-secret    # Generate new secret key
GET  /user/kindle-secret            # View existing key (masked)
DELETE /user/kindle-secret          # Revoke current key

# Kindle Direct Access (Open CORS)
POST /kindle/upload-clippings       # Direct upload from Kindle
GET  /kindle/health                 # Service health check
POST /kindle/verify-auth            # Test authentication

# Admin & Monitoring
GET  /admin/kindle-stats            # Monitor usage patterns
POST /admin/test-email-service      # Test email configuration
```

### **📋 Kindle Setup Process**
1. User generates secret key through web interface
2. Install shell script on jailbroken Kindle with credentials
3. Script automatically uploads `My Clippings.txt` with retry logic
4. Server processes highlights using existing parsing engine
5. User charged based on number of books processed

## 📌 Future Improvements

- Enhanced analytics dashboard with reading patterns
- Advanced knowledge retention tracking (bitemporal analysis)
- Mobile app for easier Kindle script management
- Integration with additional e-reader formats
- Machine learning for highlight categorization

---

# Kindle Clippings Backend

## Version

**Current Version:** 3.0.0

## Changelog

### 1.0.0
- Initial release
- Google SSO and email/password authentication
- Email verification and welcome mail system
- JWT-based session management (7 days)
- CORS and secure cookie setup for cross-origin frontend

### 1.1.0
- Coin system for users
- File upload and highlight processing with coin deduction
- `/version` API to get backend version

### 1.2.0
- Fixed Static Free Signup coins (500 coins) being sent in welcome mail. Now fetching dynamic value from environment variable.
- Added Redundant Highlights removal via overlapping sub-intervals solution.

### 1.2.1
- Updated Rendundancy Removal algorithm to ignore notes, and include all notes in the highlights regardless of the overlap with the highlights for the loc field.
- Fixed Redundancy Removal removing note/highlight if only 1 present in the book. [Weird Edge case bug I will say]

### 2.0.0
- Added Stats
- Updated Redundancy Removal 
    - to update stats by checking count for newly added books and highlights
    - to fix sort funciton overwriting existing data and causing data deletion and redundant data due to same location sorting
    - Removed novelty privilege from notes, now notes would be compared against each other.
- /auth/me returns user object from jwt token credential

### 2.0.1
- Added payment for downloading single pdf

### 2.1.0
- Enhanced email system with retry logic and better error handling
- Improved newsletter algorithm with bitemporal knowledge tracking
- Added comprehensive logging for debugging production issues
- Updated Express.js to v5.x with proper route handling

### 2.2.0
- **🔐 Secret Key Authentication System**: Generate, view, and revoke 64-character hex keys
- **📱 Kindle Health Check Endpoint**: Monitor service availability for device scripts
- **🛡️ Enhanced Security**: Input validation, file size limits, user agent detection
- **⚡ CORS Optimization**: Selective CORS policy (open for Kindle, restricted for web)

### 3.0.0 - **🚀 Kindle Direct Upload Integration**
- **📱 Direct Device Upload**: Full support for jailbroken Kindle automatic uploads
- **🔄 Advanced Rate Limiting**: IP-based limiting (10 requests/10min) with intelligent retry
- **📊 KOReader Support**: Enhanced parsing for KOReader annotations (page-based locations)
- **🔍 Improved Duplicate Detection**: N×N comparison algorithm for comprehensive deduplication
- **📧 Production Email Service**: Robust email system with exponential backoff retry logic
- **🛡️ Enhanced Security Layer**: 
  - User cooldown periods (2min between uploads)
  - Comprehensive request monitoring and logging
  - Suspicious activity detection and alerting
- **🌐 New API Endpoints**:
  - `/kindle/upload-clippings` - Direct multipart file upload
  - `/kindle/verify-auth` - Authentication testing without upload
  - `/user/generate-kindle-secret` - Secure key generation
  - `/user/kindle-secret` - Key management (view masked, revoke)
  - `/admin/kindle-stats` - Usage monitoring and analytics
- **📋 Kindle Script Template**: Complete shell script with error handling and retry logic
- **🔄 Unified Processing**: Same highlight parsing engine for web and device uploads
- **💰 Consistent Pricing**: Same coin system applies to all upload methods
- **📈 Usage Analytics**: Track device uploads, success rates, and user patterns

### Technical Improvements in 3.0.0
- **Database Schema Extensions**: Added Kindle-specific fields to user model
- **Express 5.x Compatibility**: Fixed path-to-regexp errors with proper route patterns
- **Enhanced Error Handling**: Comprehensive error codes and retry strategies
- **Production Optimizations**: 
  - Connection pooling disabled for better hosting platform compatibility
  - Extended timeouts for slow networks
  - SSL/TLS configuration optimized for Render deployment
- **Security Hardening**:
  - Cryptographically secure key generation
  - Request signature validation
  - Abuse prevention with exponential backoff
- **Monitoring & Observability**:
  - Structured logging with timestamps and request IDs
  - Email service health checks
  - Real-time usage statistics

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 5+
- Gmail account with App Password
- Jailbreken Kindle (for direct upload feature)

### Installation
```bash
# Clone and install
git clone <repository-url>
cd kindle-clippings/backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start server
npm start
```

### Kindle Setup (Optional)
1. Generate secret key through web interface
2. Install provided shell script on jailbroken Kindle
3. Configure script with your credentials
4. Test upload: `./upload_highlights.sh`

## 📊 API Usage Examples

### Generate Kindle Secret Key
```bash
curl -X POST https://your-api.com/user/generate-kindle-secret \
  -H "Authorization: Bearer your-jwt-token"
```

### Direct Kindle Upload
```bash
curl -X POST https://your-api.com/kindle/upload-clippings \
  -F "file=@My Clippings.txt" \
  -F "secretKey=your-64-char-secret" \
  -F "userId=your-user-id"
```

### Test Email Service
```bash
curl -X POST https://your-api.com/admin/test-email-service \
  -H "Authorization: Bearer your-jwt-token"
```

## 🔒 Security Features

- **Multi-layer Authentication**: JWT for web, secret keys for devices
- **Rate Limiting**: Prevents DDoS and abuse
- **Input Validation**: File size, type, and content validation
- **Request Monitoring**: Comprehensive logging and alerting
- **Secure Key Management**: Cryptographically secure generation and storage

## 📈 Performance & Reliability

- **Retry Logic**: Exponential backoff for transient failures
- **Connection Management**: Optimized for hosting platforms
- **Error Handling**: Graceful degradation and recovery
- **Monitoring**: Health checks and usage analytics
- **Scalability**: Designed for high-volume automated uploads

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Update documentation
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Note**: Kindle direct upload requires a jailbroken device. Jailbreaking voids warranty and may not be available for all Kindle models. Use at your own risk.