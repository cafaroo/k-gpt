#!/bin/bash
# Video Content Analyzer — Bootstrap Script
# Run this to set up the project from the vercel/chatbot template

set -e

echo "=== Video Content Analyzer Setup ==="

# 1. Clone the chatbot template
echo "Cloning vercel/chatbot template..."
npx create-next-app@latest video-analyzer --example https://github.com/vercel/chatbot
cd video-analyzer

# 2. Install additional dependencies
echo "Installing video processing dependencies..."
npm install @ffmpeg/ffmpeg@^0.12.10 @ffmpeg/util@^0.12.1 recharts

# 3. Create directory structure
echo "Creating project structure..."
mkdir -p components/video
mkdir -p lib/video
mkdir -p app/analyze

# 4. Add COOP/COEP headers to next.config.ts for SharedArrayBuffer
echo "Configuring headers for ffmpeg.wasm..."
cat >> next.config.ts << 'NEXTCONFIG'

// NOTE: Appended by bootstrap script for ffmpeg.wasm support
// The headers() function may need to be merged with existing config
// COOP/COEP are required for SharedArrayBuffer (ffmpeg.wasm)
NEXTCONFIG

# 5. Create .env.local template
echo "Creating .env.local template..."
cat > .env.local.example << 'ENVFILE'
# AI Provider — pick one:
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...

# Vercel AI Gateway (if using)
# AI_GATEWAY_API_KEY=
ENVFILE

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. cd video-analyzer"
echo "2. Copy .env.local.example to .env.local and add your API key"
echo "3. Read SCAFFOLD.md for architecture and implementation details"
echo "4. Start building: npm run dev"
echo ""
echo "Build order:"
echo "  1. lib/video/types.ts"
echo "  2. lib/video/ffmpeg-worker.ts"
echo "  3. lib/video/extractors.ts"
echo "  4. hooks/use-video-processor.ts"
echo "  5. components/video/*.tsx"
echo "  6. app/analyze/page.tsx"
echo "  7. Modify app/api/chat/route.ts"
