const OpenAI = require('openai');

class OpenAIProcessor {
  constructor() {
    this.openai = null;
    this.apiKeyConfigured = !!process.env.OPENAI_API_KEY;
    
    if (this.apiKeyConfigured) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  // Verificar si la API key está configurada
  verifyAPIKey() {
    if (!this.apiKeyConfigured || !this.openai) {
      throw new Error('❌ Falta configurar OPENAI_API_KEY en las variables de entorno');
    }
  }

  // Procesar PDF con OpenAI
  async processPDF(attachment) {
    try {
      this.verifyAPIKey();
      
      console.log(`🤖 Procesando PDF con OpenAI: ${attachment.filename}`);

      // Usar el buffer del PDF directamente
      const base64PDF = attachment.buffer.toString('base64');

      // Prompt personalizado para extraer datos específicos de fondos
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
      
      console.log('📊 Datos extraídos por OpenAI:', extractedData);

      // Intentar parsear el JSON array
      let parsedData;
      try {
        // Limpiar la respuesta en caso de que tenga texto adicional
        let cleanedData = extractedData;
        
        // Si la respuesta contiene texto adicional, extraer solo el array JSON
        const jsonMatch = extractedData.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedData = jsonMatch[0];
        }
        
        parsedData = JSON.parse(cleanedData);
        
        // Verificar que sea un array
        if (!Array.isArray(parsedData)) {
          throw new Error('La respuesta no es un array válido');
        }
        
        console.log(`✅ Se procesaron ${parsedData.length} fondos exitosamente`);
        
      } catch (e) {
        console.log('⚠️  La respuesta no está en formato JSON array válido:', e.message);
        console.log('📄 Respuesta original:', extractedData);
        parsedData = { 
          error: 'Formato JSON inválido',
          raw_response: extractedData 
        };
      }

      // Retornar resultados directamente sin guardar archivos
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

      // Mostrar resumen de fondos extraídos
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        console.log('\n📋 Resumen de fondos extraídos:');
        parsedData.forEach((fondo, index) => {
          console.log(`${index + 1}. ID: ${fondo.idFund}`);
          console.log(`   Fecha: ${fondo.date}`);
          console.log(`   Precio: ${fondo.price}`);
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Error al procesar con OpenAI:', error.message);
      
      // Retornar un resultado de error pero no fallar completamente
      return {
        success: false,
        error: error.message,
        archivo_original: attachment.filename
      };
    }
  }
}

module.exports = OpenAIProcessor; 