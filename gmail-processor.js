require('dotenv').config();
const { google } = require('googleapis');
const OpenAIProcessor = require('./openai-processor');
const { saveToFirebase } = require('./save-firebase');

// Gmail authentication configuration
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

class GmailProcessor {
  constructor() {
    this.gmail = null;
    this.auth = null;
    this.openaiProcessor = new OpenAIProcessor();
  }

  // Configure OAuth2 authentication
  async authenticate() {
    try {


      // Configure OAuth2 with environment variables
      this.auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Clean and configure token credentials from environment variables
      const cleanValue = (value) => {
        if (!value) return value;
        // Remove double quotes, single quotes and trailing commas
        return value.replace(/^["']|["'],?$/g, '').trim();
      };

      const tokenCredentials = {
        access_token: cleanValue(process.env.ACCESS_TOKEN_KEY),
        refresh_token: cleanValue(process.env.REFRESH_TOKEN_KEY),
        scope: cleanValue(process.env.SCOPE_KEY) || 'https://www.googleapis.com/auth/gmail.readonly',
        token_type: cleanValue(process.env.TOKEN_TYPE_KEY) || 'Bearer'
      };

      // Add expiry_date if available
      if (process.env.EXPIRY_DATE_KEY) {
        tokenCredentials.expiry_date = parseInt(process.env.EXPIRY_DATE_KEY);
      }

      console.log('🔧 Configurando credenciales OAuth2...');
      console.log(`📅 Token expiry: ${tokenCredentials.expiry_date ? new Date(tokenCredentials.expiry_date).toISOString() : 'No configurado'}`);
      
      this.auth.setCredentials(tokenCredentials);

      // Test the authentication by making a simple API call
      console.log('🧪 Probando autenticación con Gmail API...');
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      
      // Make a test call to verify authentication
      await this.gmail.users.getProfile({ userId: 'me' });
      
      console.log('✅ Successful authentication with Gmail API using environment variables');
    } catch (error) {
      console.error('❌ Authentication error:', error.message);
      
      throw error;
    }
  }

  // Get today's date in YYYY/MM/DD format
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  // Search for today's emails from specific sender
  async searchTodayEmails(senderEmail = 'extractos@accivalores.com') {
    try {
      const todayDate = this.getTodayDate();
      const requiredSubject = 'Valor diario de la unidad y rentabilidad fondos';
      
      // Query to search for today's emails from specific sender with specific subject
      const query = `from:${senderEmail} after:${todayDate} has:attachment filename:pdf subject:"${requiredSubject}"`;
      
      console.log(`🔍 Searching for today's emails (${todayDate}) from ${senderEmail} with PDF files...`);
      console.log(`📋 Required subject: "${requiredSubject}"`);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} email(s) matching the criteria`);
      
      return messages;
    } catch (error) {
      console.error('❌ Error searching emails:', error.message);
      throw error;
    }
  }

  // Get message details and process PDFs in memory
  async downloadPDFsFromMessage(messageId) {
    try {
      console.log(`📥 Processing message ID: ${messageId}`);
      
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });

      const attachments = [];
      const parts = message.data.payload.parts || [message.data.payload];
      
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          console.log(`📎 Found PDF file: ${part.filename}`);
          
          const attachment = await this.gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId,
          });

          const data = attachment.data.data;
          const buffer = Buffer.from(data, 'base64');
          
          console.log(`📎 PDF processed in memory: ${part.filename}`);
          
          attachments.push({
            filename: part.filename,
            buffer: buffer,
            size: buffer.length
          });
        }
      }

      return attachments;
    } catch (error) {
      console.error('❌ Error processing PDF:', error.message);
      throw error;
    }
  }

  // Process PDF with AI using OpenAI
  async processPDFWithAI(attachment) {
    try {
      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️  OpenAI not configured. To use AI, configure OPENAI_API_KEY');
        
        return {
          message: 'OpenAI not configured - PDF processed successfully',
          skipped_ai: true
        };
      }

      // Process with OpenAI
      const result = await this.openaiProcessor.processPDF(attachment);
      return result;

    } catch (error) {
      console.error('❌ Error processing PDF with AI:', error.message);
      
      return {
        message: 'Error in AI processing - PDF processed successfully',
        error: error.message,
        skipped_ai: true
      };
    }
  }

  // Main function
  async processDaily() {
    try {
      console.log('🚀 Starting daily email processing...');
      
      await this.authenticate();
      
      const messages = await this.searchTodayEmails('extractos@accivalores.com');
      
      if (messages.length === 0) {
        console.log('ℹ️  No emails found today with PDFs from the specified sender');
        return {
          success: false,
          message: 'No emails found to process',
          emailsFound: 0
        };
      }

      // Only process the most recent email (first in the list)
      const mostRecentMessage = messages[0];
      
      if (messages.length > 1) {
        console.log(`📬 Found ${messages.length} emails, but only the most recent will be processed`);
      }

      console.log(`📨 Processing the most recent email...`);

      const allFondosData = [];
      
      const attachments = await this.downloadPDFsFromMessage(mostRecentMessage.id);
      
      for (const attachment of attachments) {
        const result = await this.processPDFWithAI(attachment);
        
        // If processing was successful and we have fund data
        if (result.success && result.fondos_extraidos && Array.isArray(result.fondos_extraidos)) {
          allFondosData.push(...result.fondos_extraidos);
        }
      }

      // Save all data to Firebase
      let firebaseResult = { success: false };
      if (allFondosData.length > 0) {
        console.log(`\n🔥 Saving ${allFondosData.length} fund records to Firebase...`);
        firebaseResult = await saveToFirebase(allFondosData);
      } else {
        console.log('⚠️  No fund data found to save to Firebase');
      }

      console.log('✅ Processing completed successfully');
      
      return {
        success: true,
        emailsFound: messages.length,
        fondosProcessed: allFondosData.length,
        firebaseResult: firebaseResult
      };

    } catch (error) {
      console.error('❌ Error in processing:', error.message);
      throw error;
    }
  }
}

module.exports = GmailProcessor; 