/**
 * Time formatting utilities for user-friendly display
 */

/**
 * Format expiration time in user's timezone
 */
export function formatExpirationTime(expiresAt: string): string {
  try {
    const now = new Date();
    const expires = new Date(expiresAt);
    
    // Calculate time difference
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // If expired
    if (diffMs <= 0) {
      return 'Expired';
    }
    
    // If less than 1 hour
    if (diffHours < 1) {
      if (diffMinutes <= 1) {
        return 'Expires in 1 minute';
      }
      return `Expires in ${diffMinutes} minutes`;
    }
    
    // If less than 24 hours
    if (diffHours < 24) {
      if (diffHours === 1) {
        return `Expires in 1 hour`;
      }
      return `Expires in ${diffHours} hours`;
    }
    
    // If more than 24 hours, show exact date/time
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formattedDate = expires.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: userTimezone
    });
    
    const days = Math.floor(diffHours / 24);
    if (days === 1) {
      return `Expires tomorrow at ${formattedDate}`;
    }
    
    return `Expires in ${days} days (${formattedDate})`;
  } catch (error) {
    console.error('Error formatting expiration time:', error);
    return 'Expires soon';
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Future time
    if (diffMs < 0) {
      const futureDiff = Math.abs(diffMs);
      const futureHours = Math.floor(futureDiff / (1000 * 60 * 60));
      const futureMinutes = Math.floor((futureDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (futureHours < 1) {
        return `in ${futureMinutes} minute${futureMinutes !== 1 ? 's' : ''}`;
      }
      if (futureHours < 24) {
        return `in ${futureHours} hour${futureHours !== 1 ? 's' : ''}`;
      }
      
      const futureDays = Math.floor(futureHours / 24);
      return `in ${futureDays} day${futureDays !== 1 ? 's' : ''}`;
    }
    
    // Past time
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    return 'just now';
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'unknown time';
  }
}

/**
 * Get user's timezone name
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
