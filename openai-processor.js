const OpenAI = require('openai');

class OpenAIProcessor {
  constructor() {
    this.openai = null;
    this.apiKeyConfigured = !!process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (this.apiKeyConfigured) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: this.openaiBaseUrl,
        timeout: Number(process.env.OPENAI_TIMEOUT_MS || 30000),
        maxRetries: Number(process.env.OPENAI_MAX_RETRIES || 2)
      });
    }
  }

  // Verify if API key is configured
  verifyAPIKey() {
    if (!this.apiKeyConfigured || !this.openai) {
      throw new Error('❌ OPENAI_API_KEY missing in environment variables');
    }
  }

  // Process PDF with OpenAI
  async processPDF(attachment) {
    try {
      this.verifyAPIKey();
      
      console.log(`🤖 Processing PDF with OpenAI: ${attachment.filename}`);

      // Use PDF buffer directly
      const base64PDF = attachment.buffer.toString('base64');

      // Custom prompt to extract specific fund data
      const prompt = `
Analiza este PDF que contiene una tabla de rentabilidad de fondos.

IMPORTANTE: Solo extrae los datos de estos 5 fondos específicos y devuelve ÚNICAMENTE un array JSON sin comentarios ni descripciones adicionales:

Fondos a buscar con sus IDs:
1. "FONDO DE INVERSION COLECTIVA ACCIVAL VISTA" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d9"
2. "FIC ACCICUENTA CONSERVADOR" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d8"
3. "FIC ACCICUENTA MODERADO" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d7"
4. "FIC ABIERTO ACCICUENTAMAYOR RIESGO" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d6"
5. "FONDO DE INVERSION COLECTIVA ACCIONES USA VOO" -> ID: "6073f1cf-40df-4999-9df3-0072a673d8d5"

Para cada fondo encontrado, extrae:
- La fecha del reporte (del título del documento)
- El valor de la unidad (segunda columna "Valor de la Unidad")

Devuelve SOLO este formato JSON (sin texto adicional):
[
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d9", "date": "2025-06-18", "price": 1234.54 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d8", "date": "2025-06-18", "price": 1234.5489 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d7", "date": "2025-06-18", "price": 123.54 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d6", "date": "2025-06-18", "price": 123.54777 },
  { "idFund": "6073f1cf-40df-4999-9df3-0072a673d8d5", "date": "2025-06-18", "price": 121231233.54 }
]

IMPORTANTE: 
- Usa los precios exactos de la columna "Valor de la Unidad"
- Usa la fecha exacta del título del documento
- Devuelve solo el array JSON, sin explicaciones
- Si un fondo no se encuentra, omítelo del array
`;

      const response = await this.openai.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: attachment.filename,
                file_data: `data:application/pdf;base64,${base64PDF}`
              },
              {
                type: "input_text",
                text: prompt
              }
            ]
          }
        ]
      });

      const extractedData = response.output_text.trim();
      
      console.log('📊 Data extracted by OpenAI:', extractedData);

      // Try to parse the JSON array
      let parsedData;
      try {
        // Clean the response in case it has additional text
        let cleanedData = extractedData;
        
        // If response contains additional text, extract only the JSON array
        const jsonMatch = extractedData.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedData = jsonMatch[0];
        }
        
        parsedData = JSON.parse(cleanedData);
        
        // Verify it's an array
        if (!Array.isArray(parsedData)) {
          throw new Error('Response is not a valid array');
        }
        
        console.log(`✅ Successfully processed ${parsedData.length} funds`);
        
      } catch (e) {
        console.log('⚠️  Response is not in valid JSON array format:', e.message);
        console.log('📄 Original response:', extractedData);
        parsedData = { 
          error: 'Invalid JSON format',
          raw_response: extractedData 
        };
      }

      // Return results directly without saving files
      const result = {
        success: true,
        archivo_original: attachment.filename,
        fecha_procesamiento: new Date().toISOString(),
        fondos_extraidos: Array.isArray(parsedData) ? parsedData : null,
        total_fondos_encontrados: Array.isArray(parsedData) ? parsedData.length : 0,
        analisis_completo: parsedData,
        metadata: {
          tamaño_archivo: attachment.size,
          modelo_usado: "gpt-4.1",
          fondos_objetivo: 5
        }
      };

      // Show summary of extracted funds
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        console.log('\n📋 Summary of extracted funds:');
        parsedData.forEach((fondo, index) => {
          console.log(`${index + 1}. ID: ${fondo.idFund}`);
          console.log(`   Date: ${fondo.date}`);
          console.log(`   Price: ${fondo.price}`);
        });
      }

      return result;

    } catch (error) {
      const errorDetails = {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
        cause: error?.cause && (error.cause.code || error.cause.errno || error.cause.message),
        baseURL: this.openaiBaseUrl
      };
      try {
        // Intenta incluir propiedades no enumerables del error
        const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
        errorDetails.serialized = serialized;
      } catch (_) {}
      console.error('❌ Error processing with OpenAI:', error?.message || 'Unknown');
      console.error('🔎 OpenAI error details:', errorDetails);
      
      // Return error result but don't fail completely
      return {
        success: false,
        error: error.message,
        archivo_original: attachment.filename
      };
    }
  }

  // Simple connectivity test to OpenAI API from runtime
  async testConnectivity() {
    try {
      this.verifyAPIKey();
      const start = Date.now();
      const models = await this.openai.models.list();
      const elapsedMs = Date.now() - start;
      return {
        success: true,
        endpoint: this.openaiBaseUrl,
        elapsedMs,
        modelsCount: Array.isArray(models?.data) ? models.data.length : undefined
      };
    } catch (error) {
      const details = {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
        cause: error?.cause && (error.cause.code || error.cause.errno || error.cause.message),
        endpoint: this.openaiBaseUrl
      };
      try {
        const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
        details.serialized = serialized;
      } catch (_) {}
      return { success: false, error: 'OpenAI connectivity failed', details };
    }
  }
}

module.exports = OpenAIProcessor; 