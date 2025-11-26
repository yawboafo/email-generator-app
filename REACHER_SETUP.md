# Email Verification Setup Guide

This app supports two email verification methods:

## 1. EmailListVerify (Default)
- ✅ Cloud-based API service
- No local setup required
- Fast and accurate verification

## 2. Reacher API (Self-Hosted Alternative)
- ⚡ Self-hosted verification
- 🔍 More detailed results
- 🐳 Requires Docker

### Quick Setup for Reacher API

#### Option A: Docker (Recommended)
```bash
# Pull and run the Reacher API container
docker run -p 8080:8080 reacherhq/check-if-email-exists
```

The API will be available at `http://localhost:8080`

#### Option B: Build from Source
```bash
# Clone the repository
git clone https://github.com/reacherhq/check-if-email-exists
cd check-if-email-exists

# Build and run with Cargo
cargo run --release
```

### How to Use

1. **Start the Reacher API** (if using this method):
   ```bash
   docker run -p 8080:8080 reacherhq/check-if-email-exists
   ```

2. **Open the app** at http://localhost:3000

3. **Go to "Verify Emails" tab**

4. **Select verification method**:
   - Choose "EmailListVerify" for cloud-based verification (default)
   - Choose "Reacher API" for self-hosted verification (requires Docker)

5. **Enter emails** and click "Verify Emails"

### Comparison

| Feature | EmailListVerify | Reacher API |
|---------|----------------|-------------|
| Setup | ✅ None | 🐳 Docker required |
| Speed | Fast (~1-2s/email) | Fast (~1-2s/email) |
| Accuracy | Excellent | Excellent |
| Details | Good | Comprehensive |
| Cost | Free tier available | Free (self-hosted) |

### Troubleshooting

**Reacher API not connecting?**
- Make sure Docker is running
- Check if port 8080 is available: `lsof -i :8080`
- Verify container is running: `docker ps`
- Check container logs: `docker logs <container-id>`

### Resources

- [Reacher GitHub](https://github.com/reacherhq/check-if-email-exists)
- [Reacher Documentation](https://github.com/reacherhq/check-if-email-exists#readme)
