require('dotenv').config();
const { google } = require('googleapis');
const OpenAIProcessor = require('./openai-processor');
const { saveToFirebase } = require('./save-firebase');

// Configuración de autenticación de Gmail
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

class GmailProcessor {
  constructor() {
    this.gmail = null;
    this.auth = null;
    this.openaiProcessor = new OpenAIProcessor();
  }

  // Configurar autenticación OAuth2
  async authenticate() {
    try {
      // Verificar que las variables de entorno requeridas estén configuradas
      const requiredEnvVars = [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET', 
        'GOOGLE_REDIRECT_URI',
        'ACCESS_TOKEN_KEY',
        'REFRESH_TOKEN_KEY'
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Variable de entorno requerida no encontrada: ${envVar}`);
        }
      }

      // Configurar OAuth2 con variables de entorno
      this.auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Limpiar y configurar credenciales del token desde variables de entorno
      const cleanValue = (value) => {
        if (!value) return value;
        // Remover comillas dobles, simples y comas al final
        return value.replace(/^["']|["'],?$/g, '').trim();
      };

      const tokenCredentials = {
        access_token: cleanValue(process.env.ACCESS_TOKEN_KEY),
        refresh_token: cleanValue(process.env.REFRESH_TOKEN_KEY),
        scope: cleanValue(process.env.SCOPE_KEY),
        token_type: cleanValue(process.env.TOKEN_TYPE_KEY)
      };

      // Agregar expiry_date si está disponible
      if (process.env.EXPIRY_DATE_KEY) {
        tokenCredentials.expiry_date = parseInt(process.env.EXPIRY_DATE_KEY);
      }

      this.auth.setCredentials(tokenCredentials);

      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      console.log('✅ Autenticación exitosa con Gmail API usando variables de entorno');
    } catch (error) {
      console.error('❌ Error en autenticación:', error.message);
      throw error;
    }
  }

  // Obtener fecha de hoy en formato YYYY/MM/DD
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  // Buscar emails del día de hoy del remitente específico
  async searchTodayEmails(senderEmail = 'extractos@accivalores.com') {
    try {
      const todayDate = this.getTodayDate();
      const requiredSubject = 'Valor diario de la unidad y rentabilidad fondos';
      
      // Consulta para buscar emails de hoy del remitente específico con asunto específico
      const query = `from:${senderEmail} after:${todayDate} has:attachment filename:pdf subject:"${requiredSubject}"`;
      
      console.log(`🔍 Buscando emails de hoy (${todayDate}) de ${senderEmail} con archivos PDF...`);
      console.log(`📋 Asunto requerido: "${requiredSubject}"`);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
      });

      const messages = response.data.messages || [];
      console.log(`📧 Se encontraron ${messages.length} email(s) que coinciden con los criterios`);
      
      return messages;
    } catch (error) {
      console.error('❌ Error al buscar emails:', error.message);
      throw error;
    }
  }

  // Obtener detalles del mensaje y procesar PDFs en memoria
  async downloadPDFsFromMessage(messageId) {
    try {
      console.log(`📥 Procesando mensaje ID: ${messageId}`);
      
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });

      const attachments = [];
      const parts = message.data.payload.parts || [message.data.payload];
      
      for (const part of parts) {
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
          console.log(`📎 Encontrado archivo PDF: ${part.filename}`);
          
          const attachment = await this.gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId,
          });

          const data = attachment.data.data;
          const buffer = Buffer.from(data, 'base64');
          
          console.log(`📎 PDF procesado en memoria: ${part.filename}`);
          
          attachments.push({
            filename: part.filename,
            buffer: buffer,
            size: buffer.length
          });
        }
      }

      return attachments;
    } catch (error) {
      console.error('❌ Error al procesar PDF:', error.message);
      throw error;
    }
  }

  // Procesar PDF con IA usando OpenAI
  async processPDFWithAI(attachment) {
    try {
      // Verificar si OpenAI está configurado
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️  OpenAI no configurado. Para usar IA, configura OPENAI_API_KEY');
        
        return {
          message: 'OpenAI no configurado - PDF procesado exitosamente',
          skipped_ai: true
        };
      }

      // Procesar con OpenAI
      const result = await this.openaiProcessor.processPDF(attachment);
      return result;

    } catch (error) {
      console.error('❌ Error al procesar PDF con IA:', error.message);
      
      return {
        message: 'Error en procesamiento con IA - PDF procesado exitosamente',
        error: error.message,
        skipped_ai: true
      };
    }
  }

  // Función principal
  async processDaily() {
    try {
      console.log('🚀 Iniciando procesamiento diario de emails...');
      
      await this.authenticate();
      
      const messages = await this.searchTodayEmails('extractos@accivalores.com');
      
      if (messages.length === 0) {
        console.log('ℹ️  No se encontraron emails de hoy con PDFs del remitente especificado');
        return {
          success: false,
          message: 'No se encontraron emails para procesar',
          emailsFound: 0
        };
      }

      // Solo procesar el email más reciente (el primero de la lista)
      const mostRecentMessage = messages[0];
      
      if (messages.length > 1) {
        console.log(`📬 Se encontraron ${messages.length} emails, pero solo se procesará el más reciente`);
      }

      console.log(`📨 Procesando el email más reciente...`);

      const allFondosData = [];
      
      const attachments = await this.downloadPDFsFromMessage(mostRecentMessage.id);
      
      for (const attachment of attachments) {
        const result = await this.processPDFWithAI(attachment);
        
        // Si el procesamiento fue exitoso y tenemos datos de fondos
        if (result.success && result.fondos_extraidos && Array.isArray(result.fondos_extraidos)) {
          allFondosData.push(...result.fondos_extraidos);
        }
      }

      // Guardar todos los datos en Firebase
      let firebaseResult = { success: false };
      if (allFondosData.length > 0) {
        console.log(`\n🔥 Guardando ${allFondosData.length} registros de fondos en Firebase...`);
        firebaseResult = await saveToFirebase(allFondosData);
      } else {
        console.log('⚠️  No se encontraron datos de fondos para guardar en Firebase');
      }

      console.log('✅ Procesamiento completado exitosamente');
      
      return {
        success: true,
        emailsFound: messages.length,
        fondosProcessed: allFondosData.length,
        firebaseResult: firebaseResult
      };

    } catch (error) {
      console.error('❌ Error en el procesamiento:', error.message);
      throw error;
    }
  }
}

module.exports = GmailProcessor; 