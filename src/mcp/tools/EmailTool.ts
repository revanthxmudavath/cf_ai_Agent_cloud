import { ToolDefinition, ToolContext, ToolResult, SendEmailSchema, SendEmailParams, EmailResult } from '../../types/tools';

  /**
   * Send an email using PostMarkApp API
   */
  export const sendEmailTool: ToolDefinition = {
    name: 'sendEmail',
    description: 'Send a transactional email via PostMarkApp',
    parameters: SendEmailSchema,
    async execute(params: SendEmailParams, context: ToolContext): Promise<ToolResult> {
      try {
        const { to, subject, textBody, htmlBody } = params;
        const apiKey = context.env.POSTMARK_API_KEY;
        const fromEmail = context.env.POSTMARK_FROM_EMAIL;

        if (!apiKey || !fromEmail) {
          return {
            success: false,
            error: 'PostMark API credentials not configured',
          };
        }

        // Call PostMark API
        const response = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': apiKey,
          },
          body: JSON.stringify({
            From: fromEmail,
            To: to,
            Subject: subject,
            TextBody: textBody,
            HtmlBody: htmlBody,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as any;
          return {
            success: false,
            error: errorData.Message || `Email API error: ${response.status}`,
          };
        }

        const data = await response.json() as any;

        // Transform API response to EmailResult interface
        const emailResult: EmailResult = {
          messageId: data.MessageID,
          to: data.To,
          submittedAt: data.SubmittedAt,
        };

        return {
          success: true,
          data: emailResult,
          message: `Email sent to ${to}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }
    },
  };