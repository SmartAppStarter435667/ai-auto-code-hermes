/**
 * @fileOverview Slack および Discord への通知ユーティリティ
 */

export async function sendNotification(message: string, details?: any) {
  if (typeof window === 'undefined') return;
  
  const slackUrl = localStorage.getItem('ca_slack_webhook_url');
  const discordUrl = localStorage.getItem('ca_discord_webhook_url');

  if (!slackUrl && !discordUrl) {
    console.warn('No notification webhooks configured. Please set them in Settings.');
    return;
  }

  // Slack 通知
  if (slackUrl) {
    try {
      const payload = {
        text: message,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🚨 Action Alert: Cursor-App*\n${message}`
            }
          },
          details ? {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `\`\`\`${JSON.stringify(details, null, 2)}\`\`\``
            }
          } : null
        ].filter(Boolean)
      };

      await fetch(slackUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Failed to send Slack notification', e);
    }
  }

  // Discord 通知
  if (discordUrl) {
    try {
      const payload = {
        content: `**🚨 Action Alert: Cursor-App**\n${message}`,
        embeds: details ? [
          {
            title: "Operation Details",
            description: `\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``,
            color: 5814783, // Discord Blurple
            timestamp: new Date().toISOString()
          }
        ] : []
      };

      await fetch(discordUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('Failed to send Discord notification', e);
    }
  }
}
