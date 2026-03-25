# Image Search & Download Extension

Chrome Extension v3 for searching and downloading images from multiple search engines.

## Features

- 🔍 Search images across 3 search engines: Google, Bing, Yandex
- ✅ Automatic image validation (minimum 100x100px)
- 📦 Batch download multiple images
- 🎯 Keyword matching in title/alt text
- 🖼️ Grid view with image preview and metadata
- 📁 Organized downloads in custom folders
- 🎨 Supports both HTTP/HTTPS URLs and base64 data URLs (Google thumbnails)

## Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd agent-download-image
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `/agent-download-image` folder (the one containing `manifest.json`)

4. **Verify installation**
   - You should see the extension icon in your Chrome toolbar

## How to Use

1. **Click the extension icon** to open the application in a new tab

2. **Enter search parameters:**
   - **Save Folder**: Name of the subfolder in Downloads (e.g., "my-images")
   - **Keywords**: One keyword per line (e.g., "rắn lục", "rắn đuôi chuông")
   - **Search Engines**: Select which engines to search

3. **Click "Search Images"**
   - The extension will automatically open tabs for each search
   - Images are scraped and validated (>=100px width AND height)
   - Only images with keywords in title/alt are included
   - Each search fetches 5 pages of results

4. **Review results**
   - Images appear in a 4-column grid
   - Each card shows: thumbnail, source badge, dimensions, title
   - Click cards to toggle selection

5. **Download selected images**
   - Click "Download Selected" button
   - Files are named: `{source}-{timestamp}-{keyword}.{ext}`
   - Downloads go to: `Downloads/{saveFolder}/`

## Project Structure

```
agent-download-image/
├── manifest.json          # Extension configuration
├── index.html             # Main UI page
├── styles.css             # Styling
├── app.js                 # Main application logic
├── background.js          # Service worker (opens app page)
├── content.js             # Content script (scrapes images)
├── searchEngine.js        # Search URL generator
├── imageValidator.js      # Image validation & dimension parsing
├── imageDownloader.js     # Download handler
└── icon.png               # Extension icon
```

## Technical Details

### Architecture

- **Pure functions**: Each function has single responsibility
- **Class-based**: Organized into focused classes
- **No bundler**: Plain ES6 modules, no webpack
- **Chrome Extension v3**: Uses Manifest V3 API

### Image Validation

- Checks title/alt for keyword match
- Reads first 512 bytes of image to parse dimensions
- Supports JPEG, PNG, GIF formats
- Validates both width AND height >= 100px

### Download Process

- Fetches image via `fetch()` API (supports both HTTP URLs and base64 data URLs)
- Creates blob URL
- Triggers download via `<a download>`
- Cleans up blob URLs after download
- Automatically extracts file extension from MIME type for base64 images

## Permissions

- `downloads`: To save images to disk
- `tabs`: To create and manage search tabs
- `activeTab`: To interact with current tab
- `scripting`: To inject content script
- `host_permissions`: To access search engine websites

## Notes

- Extension opens search pages in background tabs automatically
- CORS issues are avoided by scraping from actual search pages
- Downloads may trigger browser's download prompt
- Large batch downloads may take time

## Development

### Comments
- All comments in English
- Class and function descriptions provided
- No line-by-line comments

### Logging
- 🎯 Main steps
- ✅ Success messages
- ‼️ Error messages
- ⚠️ Warning messages

## Troubleshooting

**Images not appearing:**
- Check that search engines are accessible
- Verify keyword spelling
- Try different search engines

**Downloads not working:**
- Check browser download permissions
- Verify folder name is valid
- Check browser's download settings

**Extension not loading:**
- Verify all files are in correct location
- Check console for errors (`chrome://extensions/` → Details → Inspect views)
- Ensure `manifest.json` is valid

## License

This project is for educational purposes.
