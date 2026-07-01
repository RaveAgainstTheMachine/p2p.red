import { siteName, siteDomain } from '../config/environments';
import { debugLog } from './logger';
import { formatFileSize } from './formatUtils';

// Meta tag management for rich link previews
export const updateMetaTags = (metadata: { fileName: string; fileSize: number; fileType: string; }) => {
  debugLog('🏷️ Updating meta tags for:', metadata);
  
  // Update title
  document.title = `${metadata.fileName} - Shared via ${siteName}`;
  debugLog('📝 Updated title:', document.title);
  
  // Update or create Open Graph meta tags
  const updateMetaTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
      debugLog('➕ Created meta tag:', property);
    }
    tag.content = content;
    debugLog('🏷️ Updated meta tag:', property, '=', content);
  };

  const updateMetaName = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', name);
      document.head.appendChild(tag);
      debugLog('➕ Created meta name:', name);
    }
    tag.content = content;
    debugLog('🏷️ Updated meta name:', name, '=', content);
  };
  
  // Update Open Graph tags
  updateMetaTag('og:type', 'website');
  updateMetaTag('og:url', `${window.location.origin}${window.location.pathname}${window.location.hash}`);
  updateMetaTag('og:title', `${metadata.fileName} - Shared via ${siteName}`);
  updateMetaTag('og:description', `A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with P2P encryption. Download directly from sender.`);
  updateMetaTag('og:site_name', siteName);
  
  // Add image for better preview (optional)
  updateMetaTag('og:image', `${window.location.origin}/favicon.svg`);
  updateMetaTag('og:image:width', '256');
  updateMetaTag('og:image:height', '256');
  
  // Update Twitter Card tags
  updateMetaName('twitter:card', 'summary_large_image');
  updateMetaName('twitter:url', `${window.location.origin}${window.location.pathname}${window.location.hash}`);
  updateMetaName('twitter:title', `${metadata.fileName} - Shared via ${siteName}`);
  updateMetaName('twitter:description', `A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with P2P encryption.`);
  updateMetaName('twitter:image', `${window.location.origin}/favicon.svg`);
  
  // Update basic meta description
  updateMetaName('description', `A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.`);
  
  debugLog('✅ Meta tags updated successfully');
};

export const resetMetaTags = () => {
  // Reset to default meta tags
  document.title = `${siteName} - Secure Peer-to-Peer File Sharing`;
  
  const updateMetaTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (tag) {
      tag.content = content;
    }
  };

  const updateMetaName = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (tag) {
      tag.content = content;
    }
  };
  
  // Reset Open Graph tags
  updateMetaTag('og:type', 'website');
  updateMetaTag('og:url', `https://${siteDomain}/`);
  updateMetaTag('og:title', `${siteName} - Secure File Sharing`);
  updateMetaTag('og:description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.');
  updateMetaTag('og:site_name', siteName);
  
  // Reset Twitter Card tags
  updateMetaName('twitter:card', 'summary');
  updateMetaName('twitter:url', `https://${siteDomain}/`);
  updateMetaName('twitter:title', `${siteName} - Secure File Sharing`);
  updateMetaName('twitter:description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.');
  
  // Reset basic meta description
  updateMetaName('description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage, no tracking.');
};
