import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sendNotification(title: string, message: any) {
  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  // Return early if notifications aren't supported or permitted
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  // Create a concise title that includes context
  let notificationTitle = title;
  if (message.server && !title.includes(message.server)) {
    // Add server to title if not already included
    notificationTitle = `${message.server}: ${title}`;
  }

  // Keep title reasonably short
  // const MAX_TITLE_LENGTH = 60;
  // if (notificationTitle.length > MAX_TITLE_LENGTH) {
  //   notificationTitle = notificationTitle.substring(0, MAX_TITLE_LENGTH) + "...";
  // }

  // Create a brief body with just the essential content
  let body = message.content || "";

  // For channel mentions, prefix with # instead of including in full sentence
  if (message.channel && !body.includes(message.channel)) {
    body = `#${message.channel}: ${body}`;
  }

  // Make body very concise - much shorter than before
  // const MAX_BODY_LENGTH = 100;
  // if (body.length > MAX_BODY_LENGTH) {
  //   body = body.substring(0, MAX_BODY_LENGTH) + "...";
  // }

  const notif = new Notification(notificationTitle, {
    icon: "/s.png",
    tag: `${message.SID}${message.CID}${message.MID}`,
    body: body,
    silent: false // Allow system sounds
  });

  // Play a custom notification sound
  try {
    // Check if we have the audio file by testing with a HEAD request first
    fetch('/audio/notification.wav', { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          const audio = new Audio('/audio/notification.wav');
          audio.volume = 0.5; // Set volume to 50%
          audio.play().catch(err => console.warn("Could not play notification sound:", err));
        } else {
          console.log("[sendNotification] Notification sound file not found, skipping playback");
        }
      })
      .catch(() => {
        console.log("[sendNotification] Could not check for notification sound file");
      });
  } catch (e) {
    console.warn("Error playing notification sound:", e);
  }

  notif.onclick = () => {
    if (message.SID && message.CID) {
      window.location.href = `/#/app/${message.SID}/${message.CID}`;
      // Focus window if it's not in focus
      window.focus();
    } else if (message.SID) {
      window.location.href = `/#/app/${message.SID}`;
      window.focus();
    } else {
      window.location.href = `/#/app`;
      window.focus();
    }
    notif.close();
  };
}

export function testNotification() {
  const testMessage = {
    SID: '12345',
    CID: '1',
    MID: Math.random().toString(),
    author: 'Test User',
    content: 'This is a test notification message',
    channel: 'general',
    server: 'Test Server',
    timestamp: new Date().toISOString()
  };

  sendNotification('Test Notification', testMessage);
  return 'Test notification sent! If you don\'t see it, check your browser notification permissions.';
}

