# OpenGraph Setup for Subspace Invites

## Overview

Subspace now has custom OpenGraph meta tags for invite links that make them look great when shared on social media platforms, Discord, Slack, and other services that support OpenGraph embeds.

## How It Works

### Static App Limitations

Since Subspace is deployed as a static app (no server-side rendering), we can't dynamically generate OpenGraph meta tags on the server. However, we've implemented a client-side solution that provides:

1. **Default fallback meta tags** in `index.html` for general app sharing
2. **Dynamic client-side updates** for invite pages when server information loads
3. **Custom OpenGraph images** for better visual presentation

### Implementation Details

#### 1. Meta Tag Management (`src/utils/meta.ts`)

- `updateMetaTags()` - Updates OpenGraph and Twitter card meta tags dynamically
- `resetMetaTags()` - Resets to default app meta tags
- Supports all major OpenGraph properties including images, dimensions, and alt text

#### 2. Invite Page Integration (`src/pages/invite.tsx`)

- Sets initial generic invite meta tags on page load
- Updates meta tags with specific server information when available
- Uses custom OpenGraph image or falls back to default
- Cleans up meta tags when component unmounts

#### 3. OpenGraph Images

- **Default**: `/invite-og-default.svg` - Generic Subspace invite image (1200x630)
- **Server-specific**: Uses server icon from Arweave when available
- **Fallback**: Subspace logo for servers without custom icons

## Files Created/Modified

### New Files
- `src/utils/meta.ts` - Meta tag management utilities
- `public/invite-og-default.svg` - Default OpenGraph image for invites
- `public/invite-og-generator.html` - Tool for creating custom invite images
- `docs/opengraph-setup.md` - This documentation

### Modified Files
- `index.html` - Enhanced default OpenGraph meta tags
- `src/pages/invite.tsx` - Added dynamic meta tag updates

## Usage

### For Developers

The system works automatically. When users visit invite links:

1. Initial generic meta tags are set immediately
2. When server data loads, meta tags update with specific information
3. Social media crawlers will see the appropriate meta tags

### For Creating Custom Invite Images

Use `/invite-og-generator.html` to create custom OpenGraph images:

1. Open `https://yourapp.com/invite-og-generator.html`
2. Enter server name, member count, and icon letter
3. Screenshot or save the generated card
4. Use as custom OpenGraph image

## Meta Tag Structure

### Default App Meta Tags
```html
<meta property="og:title" content="Subspace">
<meta property="og:description" content="Subspace is an intergalactic communication app...">
<meta property="og:image" content="/icon-512.png">
<meta property="og:type" content="website">
```

### Invite-Specific Meta Tags
```html
<meta property="og:title" content="Join [Server Name] - Subspace">
<meta property="og:description" content="You've been invited to join '[Server Name]' on Subspace. [X] members • Decentralized communication...">
<meta property="og:image" content="/invite-og-default.svg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

## Social Media Platform Support

- ✅ **Discord** - Shows rich embeds with image, title, and description
- ✅ **Twitter/X** - Twitter card with large image
- ✅ **Facebook** - OpenGraph embed with image and details
- ✅ **LinkedIn** - Professional link preview
- ✅ **Slack** - Rich link unfurling
- ✅ **Telegram** - Link preview with image
- ✅ **WhatsApp** - Link preview support

## Limitations

1. **Client-side only** - Meta tags update after page load, so some crawlers might miss dynamic updates
2. **Caching** - Social platforms cache OpenGraph data, so changes may take time to appear
3. **Image hosting** - Custom server icons must be accessible via HTTPS

## Best Practices

1. **Image dimensions** - Use 1200x630px for optimal OpenGraph display
2. **File size** - Keep images under 1MB for fast loading
3. **Alt text** - Always provide descriptive alt text for accessibility
4. **Testing** - Use social media debugger tools to test embeds:
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Future Improvements

1. **Server-side generation** - If moving to SSR, generate meta tags on the server
2. **Dynamic image generation** - API endpoint to generate custom invite images
3. **Caching strategy** - Implement proper cache headers for OpenGraph images
4. **A/B testing** - Test different image styles and descriptions for better engagement 